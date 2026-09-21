import { env } from "./config.js";
import type { PublishPayload } from "./schema.js";

type GqlResponse<T> = { data?: T; errors?: Array<{ message: string }> };

async function graphql<T>(shop: string, token: string, query: string, variables: unknown): Promise<T> {
  const response = await fetch(`https://${shop}/admin/api/${env.SHOPIFY_API_VERSION}/graphql.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token },
    body: JSON.stringify({ query, variables })
  });
  const json = await response.json() as GqlResponse<T>;
  if (!response.ok || json.errors?.length) throw new Error(json.errors?.map(e => e.message).join("; ") || `Shopify HTTP ${response.status}`);
  if (!json.data) throw new Error("Shopify returned no data");
  return json.data;
}

const fields = `id title handle isPublished publishedAt blog { handle } image { url altText }`;
const metafields = (payload: PublishPayload) => [
  { namespace: "global", key: "title_tag", type: "single_line_text_field", value: payload.seo.meta_title },
  { namespace: "global", key: "description_tag", type: "single_line_text_field", value: payload.seo.meta_description },
  { namespace: "ai_seo", key: "primary_keyword", type: "single_line_text_field", value: payload.seo.primary_keyword },
  { namespace: "ai_seo", key: "secondary_keywords", type: "list.single_line_text_field", value: JSON.stringify(payload.seo.secondary_keywords) },
  { namespace: "ai_seo", key: "optimization_data", type: "json", value: JSON.stringify({ search_intent: payload.seo.search_intent, canonical_url: payload.seo.canonical_url, faq: payload.seo.faq, aeo_summary: payload.seo.aeo_summary, geo_entities: payload.seo.geo_entities }) },
  ...(payload.schema ? [{ namespace: "ai_seo", key: "schema_json_ld", type: "json", value: JSON.stringify(payload.schema) }] : [])
];

function articleInput(payload: PublishPayload, body: string) {
  return {
    blogId: payload.blog.id,
    title: payload.title,
    author: { name: payload.author_name },
    handle: payload.slug,
    body,
    summary: payload.summary_html,
    tags: payload.tags,
    isPublished: payload.status !== "draft",
    ...(payload.status === "scheduled" && payload.publish_at ? { publishDate: payload.publish_at } : {}),
    ...(payload.featured_image ? { image: { url: payload.featured_image.url, altText: payload.featured_image.alt_text } } : {}),
    metafields: metafields(payload)
  };
}

export async function createArticle(shop: string, token: string, payload: PublishPayload, body: string) {
  const query = `mutation Create($article: ArticleCreateInput!) { articleCreate(article: $article) { article { ${fields} } userErrors { field message code } } }`;
  const result = await graphql<{ articleCreate: { article: any; userErrors: any[] } }>(shop, token, query, { article: articleInput(payload, body) });
  if (result.articleCreate.userErrors.length) throw new Error(result.articleCreate.userErrors.map(e => e.message).join("; "));
  return result.articleCreate.article;
}

export async function updateArticle(shop: string, token: string, payload: PublishPayload, body: string) {
  const query = `mutation Update($id: ID!, $article: ArticleUpdateInput!) { articleUpdate(id: $id, article: $article) { article { ${fields} } userErrors { field message code } } }`;
  const input = { ...articleInput(payload, body), redirectNewHandle: payload.redirect_old_slug };
  const result = await graphql<{ articleUpdate: { article: any; userErrors: any[] } }>(shop, token, query, { id: payload.shopify_article_id, article: input });
  if (result.articleUpdate.userErrors.length) throw new Error(result.articleUpdate.userErrors.map(e => e.message).join("; "));
  return result.articleUpdate.article;
}

export async function deleteWebhooksForStore(_shop: string) {
  // Token deletion is handled locally on app/uninstalled. Shopify removes app webhooks automatically.
}
