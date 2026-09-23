# HRL AI Shopify Plugin

Publish AI-written, SEO-ready blog posts to Shopify from any automation — n8n, Make, Zapier, Google Sheets workflows or your own scripts.

Send one signed JSON request and the plugin sets everything on the post automatically:

| What you send | What the plugin does in Shopify |
|---|---|
| `title`, `content_html`, `excerpt_html`, `author_name` | Creates or updates the blog article (HTML is sanitised) |
| `internal_links` | Inserts links into the body text at the right anchor phrases |
| `focus_keyword`, `secondary_keywords`, `bold_keywords` | Bolds keywords in the body text |
| `meta_title`, `meta_description` | Sets Shopify's native SEO title and description (auto-filled if blank) |
| `featured_image` | Sets the article image and alt text |
| `category` | Puts the post in the matching Shopify blog, creating it if needed (or adds it as a tag) |
| `tags` | Sets article tags |
| `status`, `publish_at` | Draft, publish now, or schedule |
| `seo.*` (optional) | FAQ schema, canonical URL, robots, Open Graph / Twitter tags, custom JSON-LD |

Every response includes SEO warnings (title/description length, focus keyword placement, word count, skipped links) so your automation can flag posts that need a human look.

---

## Payload reference

Endpoint: `POST /api/v1/content/upsert` · full example: [`examples/article-payload.json`](examples/article-payload.json)

Automation-friendly input: blank strings count as "not provided", list fields accept either an array or a comma-separated string (`"SEO, Shopify, Guides"`), and `featured_image` can be just a URL string.

| Field | Required | Default | Notes |
|---|---|---|---|
| `external_id` | yes | | Your row / run ID. Resending the same ID returns the stored result instead of publishing twice. |
| `title` | yes | | |
| `content_html` | yes | | Use `<h2>`–`<h6>` for headings; the theme renders the title as `<h1>`. |
| `slug` | | Shopify generates it | Lowercase, hyphens. Leave blank for non-English titles. |
| `excerpt_html` | | `""` | Shown on blog listing pages; also the first choice for the auto meta description. |
| `author_name` | | `HRL Editorial Team` | |
| `category` | | | Category name, blog handle, or Blog GID. |
| `category_mode` | | `blog` | `blog`: category = Shopify blog. `tag`: category is added as a tag. |
| `create_category_if_missing` | | `true` | In `blog` mode, create the blog if it doesn't exist. |
| `blog` | | `news`, else first blog | Target blog when there's no category or in `tag` mode. |
| `tags` | | `[]` | |
| `focus_keyword` | | | Used for bolding, SEO checks and schema. |
| `secondary_keywords` | | `[]` | |
| `bold_keywords` | | `true` | `true` = bold focus + secondary keywords, `false` = off, or a list of phrases to bold. |
| `bold_limit_per_keyword` | | `1` | How many occurrences of each keyword to bold. |
| `internal_links` | | `[]` | `[{ "anchor_text", "target_url", "occurrence": 1 }]` |
| `max_internal_links` | | `10` | |
| `meta_title` | | the title | |
| `meta_description` | | excerpt, else opening text, trimmed to ~155 chars | |
| `featured_image` | | | `{ "url", "alt_text" }` or a URL string. HTTPS, publicly downloadable. Alt text defaults to the title. |
| `status` | | `draft` | `draft`, `published`, `scheduled` |
| `publish_at` | when scheduled | | ISO 8601 with timezone, must be in the future. |
| `shopify_article_id` | | | Article GID to update an existing post. |
| `redirect_old_slug` | | `true` | When updating with a new slug, redirect the old URL. |
| `dry_run` | | `false` | Validate and return the processed HTML, meta and warnings without touching Shopify. |
| `callback_url` | | | HTTPS URL that receives a signed copy of the result. |
| `seo.faq` | | `[]` | `[{ "question", "answer" }]` → FAQPage schema. |
| `seo.canonical_url`, `seo.robots`, `seo.og_*`, `seo.twitter_card`, `seo.search_intent`, `seo.aeo_summary`, `seo.geo_entities`, `seo.schema` | | | Advanced SEO. `seo.schema` replaces the generated schema of the same `@type`. |

### How internal linking works

- Links only go into paragraph/list text — never inside headings, existing links, code blocks or captions.
- Whole-phrase, case-insensitive matching that works for any language (English, Hindi, etc.).
- `occurrence` picks which match to link (1 = first).
- `target_url` must be a site path (`/blogs/...`, `/products/...`) or an `http(s)` URL; anything else is rejected.
- Skipped with a warning: anchor not found, target already linked in the post, link to the post itself, over `max_internal_links`.

### How keyword bolding works

- Runs after linking, on body text only (not headings, links or code).
- Longer phrases go first, so "shopify seo" is bolded as a whole rather than "seo" inside it.
- Occurrences that are already bold count towards the limit, so posts don't get over-bolded.
- Keywords that don't appear anywhere in the post are listed in the warnings.

### Response

```json
{
  "success": true,
  "operation": "created",
  "status": "published",
  "external_id": "sheet-row-101",
  "shopify_article_id": "gid://shopify/Article/555",
  "shopify_url": "https://store.myshopify.com/blogs/seo-tips/shopify-seo-guide-2026",
  "admin_url": "https://admin.shopify.com/store/store/content/articles/555",
  "category": { "blog_id": "gid://shopify/Blog/9", "blog_handle": "seo-tips", "blog_title": "SEO Tips", "created": true },
  "tags": ["Shopify SEO", "Ecommerce", "Guides"],
  "seo": { "meta_title": "…", "meta_description": "…", "canonical_url": "…" },
  "internal_links": { "applied": 2, "details": [] },
  "bolded_keywords": [{ "keyword": "Shopify SEO", "count": 1 }],
  "warnings": ["Content is 63 words; posts under 300 words tend to rank poorly."]
}
```

Status codes: `400` invalid payload (with `details`), `401` bad key/signature, `409` same `external_id` already in progress, `422` validation error, `502` Shopify rejected the request, `503` Shopify temporarily unavailable (safe to retry). The plugin already retries Shopify rate limits and 5xx errors itself.

If a publish fails after the article was created (for example while saving SEO fields), retrying with the same `external_id` updates that article instead of creating a duplicate.

---

## Authentication

Each store gets an API key and a signing secret at install time. Every request needs:

| Header | Value |
|---|---|
| `x-hrl-key` | API key (`hrl_…`) |
| `x-hrl-timestamp` | Unix seconds; must be within 5 minutes of server time |
| `x-hrl-signature` | hex HMAC-SHA256 of `timestamp + "." + raw_body` using the signing secret |

The v1 header names (`x-publisher-key`, `x-timestamp`, `x-signature`) are still accepted. Callbacks are signed the same way with `x-hrl-timestamp` / `x-hrl-signature`.

**n8n:** put [`examples/n8n-sign-and-send.js`](examples/n8n-sign-and-send.js) in a Code node, then an HTTP Request node (POST, raw JSON body `{{ $json.body }}`, headers from `{{ $json.headers }}`).

**Manual test:** `HRL_URL=… HRL_KEY=… HRL_SECRET=… node examples/send-test-post.mjs --dry-run`

---

## Theme setup (one time per store)

Meta title and description use Shopify's built-in SEO fields, so every theme shows them with no setup.

For JSON-LD schema (BlogPosting, FAQ, breadcrumbs), robots directives, custom canonicals and optional social tags, enable the app embed: **Online Store → Themes → Customize → App embeds → HRL AI SEO**. Schema is on by default. Canonical and Open Graph/Twitter output are off by default because most themes already print them; turn them on only if yours doesn't.

---

## Setup

1. Node.js 22 and PostgreSQL (`docker compose up -d postgres` for local).
2. `cp .env.example .env` and fill it in. Generate the encryption key with `openssl rand -hex 32`.
   For hosted Postgres with a private CA (Aiven etc.), set `DATABASE_CA_CERT_PATH` to the provider's CA file.
3. `npm install`, `npx prisma migrate deploy`, `npm run dev`.
4. Create the app in the Shopify Partner Dashboard, copy `shopify.app.toml.example` to `shopify.app.toml`, set your URLs, and put the API key/secret in `.env`.
5. Visit `https://YOUR-APP/auth?shop=STORE.myshopify.com` and copy the credentials shown once.
6. Deploy the theme extension with `shopify app deploy`, then enable the app embed (above).

Running `/auth` again for a connected store issues new credentials and the old ones stop working.

`npm test` runs the test suite (no database or Shopify needed).

---

## Upgrading from AI SEO Publisher v1

- **Payload changed.** The nested `blog: {id, handle}` and `seo: {meta_title, …}` shape is replaced by the flat fields above. Map `blog` → `category` (or `blog`), `seo.meta_title` → `meta_title`, `seo.meta_description` → `meta_description`, `seo.primary_keyword` → `focus_keyword`, `seo.secondary_keywords` → `secondary_keywords`, `summary_html` → `excerpt_html`, top-level `schema` → `seo.schema`.
- **Metafield namespace** changed from `ai_seo` to `hrl_ai`. Posts published by v1 keep their `ai_seo` data but the new app embed reads `hrl_ai`; republish them to move over. Meta title/description (`global.*`) are unaffected.
- **Theme extension** renamed to `hrl-ai-seo` and is an app embed (enable under App embeds, not in the article template).
- **Database:** no migration needed; the schema is unchanged.
- New API keys are prefixed `hrl_`; existing keys keep working.

## Production checklist

- Rotate any credentials that were ever committed or shared.
- Set `ALLOWED_IMAGE_HOSTS` to the CDNs your automation uses.
- HTTPS, database backups, monitoring.
- For high volume, move publishing onto a durable queue.
- Test create, update, draft, published and scheduled flows on a development store.
