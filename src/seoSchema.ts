import type { PublishPayload } from "./schema.js";

export function buildSchemaGraph(payload: PublishPayload, shop: string, canonicalUrl: string): Record<string, unknown>[] {
  const graph: Record<string, unknown>[] = [];

  graph.push({
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: payload.title,
    description: payload.seo.meta_description,
    ...(payload.featured_image ? { image: [payload.featured_image.url] } : {}),
    author: { "@type": "Person", name: payload.author_name },
    mainEntityOfPage: { "@type": "WebPage", "@id": canonicalUrl },
    url: canonicalUrl
  });

  if (payload.seo.faq.length) {
    graph.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: payload.seo.faq.map(item => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: { "@type": "Answer", text: item.answer }
      }))
    });
  }

  graph.push({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `https://${shop}/` },
      { "@type": "ListItem", position: 2, name: payload.blog.handle, item: `https://${shop}/blogs/${payload.blog.handle}` },
      { "@type": "ListItem", position: 3, name: payload.title, item: canonicalUrl }
    ]
  });

  if (payload.schema) graph.push(payload.schema);

  return graph;
}
