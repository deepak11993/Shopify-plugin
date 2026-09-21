# AI SEO Publisher for Shopify

A multi-store Shopify publishing service that accepts signed content from n8n or another AI automation platform and creates or updates Shopify blog articles.

## Included

- Shopify OAuth installation flow
- Encrypted per-store access tokens
- Per-store API key and HMAC signing secret
- Create/update blog articles through Shopify GraphQL Admin API
- Title, HTML content, slug, tags, blog, author, featured image and alt text
- Draft, immediate publish and scheduled publish
- Meta title and description using Shopify's `global.title_tag` and `global.description_tag` metafields
- Primary/secondary keywords and AEO/GEO data in `ai_seo` metafields
- JSON-LD schema storage and a theme app extension block for rendering it
- Automatic internal-link insertion
- Slug redirect on article updates
- Idempotent publishing with `external_id`
- Status response and optional callback URL
- PostgreSQL job history and errors
- Docker deployment files and n8n signing example

## Important limitation

The app stores JSON-LD in `ai_seo.schema_json_ld`. The included `extensions/ai-seo-schema` theme app extension renders it in the article page head after the merchant enables the app block in the theme editor.

## Local setup

1. Install Node.js 22 and Docker Desktop.
2. Copy `.env.example` to `.env` and fill in the values.
3. Generate a 32-byte encryption key with `openssl rand -hex 32`.
4. Start PostgreSQL: `docker compose up -d postgres`.
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
