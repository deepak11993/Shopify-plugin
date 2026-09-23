# AI SEO Publisher for Shopify

A multi-store Shopify publishing service that accepts signed content from n8n or another AI automation platform and creates or updates Shopify blog articles.

## Included

- Shopify OAuth installation flow, embedded-app aware (App Bridge, top-level redirect out of the admin iframe, per-shop `frame-ancestors` CSP)
- Shopify session token (JWT) verification, ready for embedded admin API routes
- Encrypted per-store access tokens
- Per-store API key and HMAC signing secret
- Create/update blog articles through Shopify GraphQL Admin API
- Title, HTML content, slug, tags, blog, author, featured image and alt text
- Draft, immediate publish and scheduled publish
- Meta title and description using Shopify's `global.title_tag` and `global.description_tag` metafields
- Primary/secondary keywords and AEO/GEO data in `ai_seo` metafields
- Canonical URL, robots directive, Open Graph and Twitter Card tags in `ai_seo` metafields
- Auto-generated BlogPosting, FAQPage (when FAQs are sent) and BreadcrumbList JSON-LD, merged with any custom schema you send
- A theme app extension block that renders all of the above (canonical link, robots meta, OG/Twitter tags, JSON-LD) in the article page head
- Automatic internal-link insertion
- Slug redirect on article updates
- Idempotent publishing with `external_id`
- Status response and optional callback URL
- PostgreSQL job history and errors
- Docker deployment files and n8n signing example

## Important limitation

The app stores canonical URL, robots, Open Graph/Twitter tags and JSON-LD schema in `ai_seo` metafields. The included `extensions/ai-seo-schema` theme app extension renders all of them in the article page head, but only after the merchant enables the app block on the blog article template in the theme editor — nothing renders on the storefront until that one-time setup step is done.

`ai_seo.canonical_url` and the JSON-LD graph's `url`/`mainEntityOfPage` are computed from `blog.handle` + `slug` (or `seo.canonical_url` if you send one). If Shopify has to rename the handle because it collides with an existing article in the same blog, that computed URL will be stale — send a globally unique `slug` per blog to avoid this.

## Local setup

1. Install Node.js 22 and Docker Desktop.
2. Copy `.env.example` to `.env` and fill in the values.
3. Generate a 32-byte encryption key with `openssl rand -hex 32`.
4. Start PostgreSQL: `docker compose up -d postgres`. If you're instead using a hosted
   provider (Aiven, etc.) with `sslmode=require` in `DATABASE_URL`, download that
   provider's CA certificate and set `DATABASE_CA_CERT_PATH` in `.env` to its path —
   otherwise Node rejects the connection with "self-signed certificate in certificate chain".
5. Install packages: `npm install`.
6. Create the development migration: `npx prisma migrate dev --name init`.
7. Start the app: `npm run dev`.
8. Expose it through an HTTPS tunnel during development.
9. Create an app in Shopify Partner Dashboard and copy the API key and secret into `.env`.
10. Set the app URL and callback to `https://YOUR-DOMAIN/auth/callback`.
11. Visit `https://YOUR-DOMAIN/auth?shop=STORE.myshopify.com`.
12. Copy the API key and signing secret shown once after installation.

## Send from n8n

Use `examples/n8n-sign-and-send.js` in a Code node. In the following HTTP Request node:

- Method: POST
- URL: `https://YOUR-DOMAIN/api/v1/content/upsert`
- Body: expression `={{ $json.body }}` with raw JSON enabled
- Headers: use the three values returned under `$json.headers`

Use `examples/article-payload.json` as the input contract.

To update a post, send its GraphQL ID in `shopify_article_id`. Keep the same `external_id` only when retrying the exact operation. Use a new external ID for a later intentional update.

## Embedded app status

`shopify.app.toml.example` sets `embedded = true`. There is no in-admin dashboard yet — opening the app from the Shopify Admin sidebar shows a placeholder page (loaded correctly inside the iframe via App Bridge). `src/security.ts#verifySessionToken` verifies the session-token JWTs App Bridge attaches to requests, ready for the first embedded admin API route; nothing calls it yet.

## Production checklist

- Confirm the uninstall webhook registration on a Shopify development store.
- Add Shopify mandatory privacy webhooks if distributing through the App Store.
- Create and enable a theme app extension to render schema JSON-LD.
- Put publishing into a durable queue for high-volume installations.
- Restrict `ALLOWED_IMAGE_HOSTS` to approved CDN or Google Drive proxy domains.
- Configure HTTPS, database backups, monitoring and secret rotation.
- Run `npm test` and test create, update, draft, published and scheduled flows on a Shopify development store.

## API response

Successful requests return the action, publication status, Shopify article ID, storefront URL, external ID, and warnings. Repeated completed requests with the same store and `external_id` return the stored result without creating a duplicate.
