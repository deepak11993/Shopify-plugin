import crypto from "node:crypto";
import { env } from "./config.js";

const key = Buffer.from(env.TOKEN_ENCRYPTION_KEY, "hex");

export function encrypt(value: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(".");
}

export function decrypt(value: string): string {
  const [iv, tag, ciphertext] = value.split(".").map(v => Buffer.from(v, "base64url"));
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

export const sha256 = (value: string) => crypto.createHash("sha256").update(value).digest("hex");
export const randomSecret = () => crypto.randomBytes(32).toString("base64url");
export const safeEqual = (a: string, b: string) => {
  const aa = Buffer.from(a);
  const bb = Buffer.from(b);
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
};

export function verifyShopifyQuery(query: Record<string, unknown>): boolean {
  const provided = String(query.hmac || "");
  const message = Object.entries(query)
    .filter(([key]) => key !== "hmac" && key !== "signature")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${Array.isArray(value) ? value.join(",") : value}`)
    .join("&");
  const calculated = crypto.createHmac("sha256", env.SHOPIFY_API_SECRET).update(message).digest("hex");
  return safeEqual(provided, calculated);
}

export function verifyAutomationSignature(rawBody: Buffer, timestamp: string, signature: string, secret: string): boolean {
  const unix = Number(timestamp);
  if (!Number.isFinite(unix) || Math.abs(Date.now() - unix * 1000) > 5 * 60 * 1000) return false;
  const digest = crypto.createHmac("sha256", secret).update(timestamp).update(".").update(rawBody).digest("hex");
  return safeEqual(signature, digest);
}

export function verifyShopifyWebhook(rawBody: Buffer, signature: string): boolean {
  const digest = crypto.createHmac("sha256", env.SHOPIFY_API_SECRET).update(rawBody).digest("base64");
  return safeEqual(signature, digest);
}

export function validShop(shop: string): boolean {
  return /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(shop);
}
