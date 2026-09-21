import { describe, expect, it, vi } from "vitest";
import { addInternalLinks, sanitizeHtml, validateSchema } from "../src/content.js";

describe("content processing", () => {
  it("adds an internal link only to requested occurrence", () => {
    expect(addInternalLinks("<p>Shopify SEO and Shopify SEO</p>", [{ anchor_text: "Shopify SEO", target_url: "/pages/seo", occurrence: 2 }]))
      .toContain('Shopify SEO and <a href="/pages/seo">Shopify SEO</a>');
  });
  it("rejects scripts", () => expect(() => sanitizeHtml("<script>alert(1)</script>")).toThrow());
  it("accepts schema.org JSON-LD", () => expect(() => validateSchema({ "@context": "https://schema.org", "@type": "BlogPosting" })).not.toThrow());
});

describe("environment configuration", () => {
  it("loads values from the local .env file", async () => {
    const original = { ...process.env };
    delete process.env.APP_URL;
    delete process.env.SHOPIFY_API_KEY;
    delete process.env.SHOPIFY_API_SECRET;
    delete process.env.DATABASE_URL;
    delete process.env.TOKEN_ENCRYPTION_KEY;
    vi.resetModules();

    const config = await import("../src/config.js");
    expect(config.env.APP_URL).toBe("http://localhost:3000");
    expect(config.env.SHOPIFY_API_KEY).toBe("bfb785fe84cc5b952f6889414e266654");
    expect(config.env.SHOPIFY_API_SECRET).toBe("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");
    expect(config.env.DATABASE_URL).toContain("aivencloud.com");
    expect(config.env.TOKEN_ENCRYPTION_KEY).toMatch(/^[a-fA-F0-9]{64}$/);

    process.env = original;
    vi.resetModules();
  });
});
