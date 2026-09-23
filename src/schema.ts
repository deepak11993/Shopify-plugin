import { z } from "zod";

const internalLink = z.object({
  anchor_text: z.string().min(1).max(200),
  target_url: z.string().min(1).max(2048),
  occurrence: z.number().int().positive().default(1)
});

export const publishPayload = z.object({
  external_id: z.string().min(1).max(150),
  content_type: z.literal("article").default("article"),
  shopify_article_id: z.string().nullable().optional(),
  blog: z.object({ id: z.string().min(1), handle: z.string().min(1) }),
  author_name: z.string().min(1).max(150).default("Editorial Team"),
  title: z.string().min(1).max(255),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  content_html: z.string().min(1),
  summary_html: z.string().default(""),
  seo: z.object({
    meta_title: z.string().min(1).max(255),
    meta_description: z.string().min(1).max(500),
    primary_keyword: z.string().min(1).max(255),
    secondary_keywords: z.array(z.string().min(1).max(255)).default([]),
    search_intent: z.string().max(100).optional(),
    canonical_url: z.string().url().optional(),
    faq: z.array(z.object({ question: z.string(), answer: z.string() })).default([]),
    aeo_summary: z.string().optional(),
    geo_entities: z.array(z.string()).default([]),
    robots: z.enum(["index,follow", "noindex,nofollow", "index,nofollow", "noindex,follow"]).default("index,follow"),
    og_title: z.string().max(255).optional(),
    og_description: z.string().max(500).optional(),
    og_image_url: z.string().url().optional(),
    twitter_card: z.enum(["summary", "summary_large_image"]).default("summary_large_image")
  }),
  internal_links: z.array(internalLink).default([]),
  tags: z.array(z.string().min(1).max(255)).default([]),
  featured_image: z.object({ url: z.string().url(), alt_text: z.string().min(1).max(512) }).optional(),
  schema: z.record(z.string(), z.unknown()).optional(),
  status: z.enum(["draft", "published", "scheduled"]).default("draft"),
  publish_at: z.string().datetime().nullable().optional(),
  redirect_old_slug: z.boolean().default(true),
  callback_url: z.string().url().optional()
});

export type PublishPayload = z.infer<typeof publishPayload>;
