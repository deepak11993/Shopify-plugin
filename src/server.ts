import crypto from "node:crypto";
import express from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import type { Prisma } from "@prisma/client";
import { env, allowedImageHosts } from "./config.js";
import { db } from "./db.js";
import { addInternalLinks, sanitizeHtml, validateImageUrl, validateSchema } from "./content.js";
import { publishPayload } from "./schema.js";
import { createArticle, updateArticle } from "./shopify.js";
import { decrypt, encrypt, randomSecret, sha256, validShop, verifyAutomationSignature, verifyShopifyQuery, verifyShopifyWebhook } from "./security.js";

declare global { namespace Express { interface Request { rawBody?: Buffer } } }

const app = express();
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cookieParser());
app.use(express.json({ limit: "3mb", verify: (req, _res, buffer) => { (req as express.Request).rawBody = Buffer.from(buffer); } }));

app.get("/health", (_req, res) => res.json({ ok: true, service: "shopify-ai-seo-publisher" }));

app.get("/auth", async (req, res) => {
  const shop = String(req.query.shop || "").toLowerCase();
  if (!validShop(shop)) return res.status(400).send("Invalid Shopify domain");
  const state = crypto.randomBytes(24).toString("hex");
  await db.oAuthState.create({ data: { state, shopDomain: shop, expiresAt: new Date(Date.now() + 10 * 60 * 1000) } });
  const redirectUri = `${env.APP_URL}/auth/callback`;
  const url = new URL(`https://${shop}/admin/oauth/authorize`);
  url.searchParams.set("client_id", env.SHOPIFY_API_KEY);
  url.searchParams.set("scope", env.SHOPIFY_SCOPES);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  return res.redirect(url.toString());
});

app.get("/auth/callback", async (req, res) => {
  const shop = String(req.query.shop || "").toLowerCase();
  const code = String(req.query.code || "");
  const state = String(req.query.state || "");
  if (!validShop(shop) || !code || !verifyShopifyQuery(req.query)) return res.status(401).send("Invalid OAuth callback");
  const savedState = await db.oAuthState.findUnique({ where: { state } });
  if (!savedState || savedState.shopDomain !== shop || savedState.expiresAt < new Date()) return res.status(401).send("Expired OAuth state");
  await db.oAuthState.delete({ where: { state } });
  const tokenResponse = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: env.SHOPIFY_API_KEY, client_secret: env.SHOPIFY_API_SECRET, code })
  });
  if (!tokenResponse.ok) return res.status(502).send("Shopify token exchange failed");
  const tokenData = await tokenResponse.json() as { access_token: string };
  const apiKey = `sap_${randomSecret()}`;
  const signingSecret = randomSecret();
  await db.store.upsert({
    where: { shopDomain: shop },
    create: { shopDomain: shop, accessTokenEncrypted: encrypt(tokenData.access_token), apiKeyHash: sha256(apiKey), signingSecretHash: sha256(signingSecret), signingSecretEncrypted: encrypt(signingSecret) },
    update: { accessTokenEncrypted: encrypt(tokenData.access_token), apiKeyHash: sha256(apiKey), signingSecretHash: sha256(signingSecret), signingSecretEncrypted: encrypt(signingSecret) }
  });
  res.type("html").send(`<h1>Installation complete</h1><p>Copy these credentials now. They will not be shown again.</p><pre>API key: ${apiKey}\nSigning secret: ${signingSecret}</pre>`);
});

app.post("/api/v1/content/upsert", async (req, res) => {
  let jobId: string | undefined;
  try {
    const apiKey = String(req.header("x-publisher-key") || "");
    const timestamp = String(req.header("x-timestamp") || "");
    const signature = String(req.header("x-signature") || "");
    const store = await db.store.findUnique({ where: { apiKeyHash: sha256(apiKey) } });
    if (!store) return res.status(401).json({ success: false, error: "Invalid API key" });
    const secret = decrypt(store.signingSecretEncrypted);
    if (!req.rawBody || !verifyAutomationSignature(req.rawBody, timestamp, signature, secret)) return res.status(401).json({ success: false, error: "Invalid or expired signature" });
    const payload = publishPayload.parse(req.body);
    if (payload.featured_image) validateImageUrl(payload.featured_image.url, allowedImageHosts);
    validateSchema(payload.schema);
    const existing = await db.publishJob.findUnique({ where: { storeId_externalId: { storeId: store.id, externalId: payload.external_id } } });
    if (existing?.status === "completed") return res.json(existing.responseJson);
    const requestJson = JSON.parse(JSON.stringify(payload)) as Prisma.InputJsonValue;
    const job = existing || await db.publishJob.create({ data: { storeId: store.id, externalId: payload.external_id, requestJson } });
    jobId = job.id;
    const html = addInternalLinks(sanitizeHtml(payload.content_html), payload.internal_links);
    const token = decrypt(store.accessTokenEncrypted);
    const article = payload.shopify_article_id ? await updateArticle(store.shopDomain, token, payload, html) : await createArticle(store.shopDomain, token, payload, html);
    const url = `https://${store.shopDomain}/blogs/${article.blog.handle}/${article.handle}`;
    const response = { success: true, operation: payload.shopify_article_id ? "updated" : "created", status: article.isPublished ? "published" : "draft", shopify_article_id: article.id, shopify_url: url, external_id: payload.external_id, warnings: payload.schema ? ["Schema is stored in a metafield; enable the included theme app block to render it."] : [] };
    await db.publishJob.update({ where: { id: job.id }, data: { status: "completed", operation: response.operation, articleId: article.id, articleUrl: url, responseJson: response } });
    if (payload.callback_url) void fetch(payload.callback_url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(response) }).catch(() => undefined);
    return res.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown publishing error";
    if (jobId) await db.publishJob.update({ where: { id: jobId }, data: { status: "failed", errorMessage: message } }).catch(() => undefined);
    return res.status(422).json({ success: false, error: message });
  }
});

app.post("/webhooks/app-uninstalled", async (req, res) => {
  const shop = String(req.header("x-shopify-shop-domain") || "");
  const hmac = String(req.header("x-shopify-hmac-sha256") || "");
  if (!req.rawBody || !hmac || !verifyShopifyWebhook(req.rawBody, hmac)) return res.sendStatus(401);
  if (validShop(shop)) await db.store.deleteMany({ where: { shopDomain: shop } });
  res.sendStatus(200);
});

app.get("/", (_req, res) => res.type("html").send(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>AI SEO Publisher</title><style>body{font:16px system-ui;max-width:760px;margin:64px auto;padding:24px;color:#172b4d}input,button{padding:12px;font:inherit}input{width:65%}button{background:#008060;color:white;border:0;border-radius:6px}code{background:#eef2f5;padding:3px 6px}</style></head><body><h1>AI SEO Publisher for Shopify</h1><p>Connect a Shopify store, then send signed content from n8n or another AI automation tool.</p><form action="/auth"><input name="shop" placeholder="your-store.myshopify.com" required><button>Connect store</button></form><p>Publishing endpoint: <code>POST /api/v1/content/upsert</code></p></body></html>`));

app.listen(env.PORT, () => console.log(`AI SEO Publisher listening on ${env.PORT}`));
