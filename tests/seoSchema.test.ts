import { describe, expect, it } from "vitest";
import { buildSchemaGraph } from "../src/seoSchema.js";
import { publishPayload } from "../src/schema.js";

const basePayload = publishPayload.parse({
  external_id: "test-1",
  blog: { id: "gid://shopify/Blog/1", handle: "news" },
  title: "Test Article",
  slug: "test-article",
  content_html: "<p>Hello</p>",
  seo: {
    meta_title: "Test Article",
    meta_description: "A test article.",
    primary_keyword: "test"
  }
});

describe("buildSchemaGraph", () => {
  it("always includes BlogPosting and BreadcrumbList", () => {
    const graph = buildSchemaGraph(basePayload, "store.myshopify.com", "https://store.myshopify.com/blogs/news/test-article");
    const types = graph.map(item => item["@type"]);
    expect(types).toContain("BlogPosting");
    expect(types).toContain("BreadcrumbList");
    expect(types).not.toContain("FAQPage");
  });

  it("adds FAQPage only when FAQs are present", () => {
    const payload = { ...basePayload, seo: { ...basePayload.seo, faq: [{ question: "Q?", answer: "A." }] } };
    const graph = buildSchemaGraph(payload, "store.myshopify.com", "https://store.myshopify.com/blogs/news/test-article");
    expect(graph.map(item => item["@type"])).toContain("FAQPage");
  });

  it("appends caller-supplied custom schema", () => {
    const payload = { ...basePayload, schema: { "@context": "https://schema.org", "@type": "Product" } };
    const graph = buildSchemaGraph(payload, "store.myshopify.com", "https://store.myshopify.com/blogs/news/test-article");
    expect(graph.map(item => item["@type"])).toContain("Product");
  });
});
