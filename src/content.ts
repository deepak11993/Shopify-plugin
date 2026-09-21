import type { PublishPayload } from "./schema.js";

const forbidden = /<(script|iframe|object|embed|form)\b|\son[a-z]+\s*=|javascript:/i;

export function sanitizeHtml(html: string): string {
  if (forbidden.test(html)) throw new Error("HTML contains unsafe elements or attributes");
  return html;
}

export function addInternalLinks(html: string, links: PublishPayload["internal_links"]): string {
  let output = html;
  for (const link of links) {
    const href = link.target_url.replace(/"/g, "&quot;");
    const anchor = link.anchor_text;
    let seen = 0;
    const escaped = anchor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`(?![^<]*>)(\\b${escaped}\\b)`, "gi");
    output = output.replace(pattern, match => {
      seen += 1;
      return seen === link.occurrence ? `<a href="${href}">${match}</a>` : match;
    });
  }
  return output;
}

export function validateImageUrl(url: string, allowlist: Set<string>): void {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:") throw new Error("Featured image must use HTTPS");
  if (allowlist.size && !allowlist.has(parsed.hostname)) throw new Error("Featured image host is not allowed");
}

export function validateSchema(schema: Record<string, unknown> | undefined): void {
  if (!schema) return;
  if (schema["@context"] !== "https://schema.org") throw new Error("Schema @context must be https://schema.org");
  if (typeof schema["@type"] !== "string") throw new Error("Schema @type is required");
}
