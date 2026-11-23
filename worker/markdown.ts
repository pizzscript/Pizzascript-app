import { marked } from "marked";
import sanitizeHtml from "sanitize-html";

/** Removes a ```markdown wrapper around the whole reply, leaving real code fences inside it alone. */
export function cleanMarkdown(text: string) {
  const trimmed = text.trim();
  const wrapped = trimmed.match(/^```(?:markdown|md)\s*\n([\s\S]*)\n```$/i);
  return (wrapped ? wrapped[1] : trimmed).trim();
}

export function markdownToHtml(markdown: string) {
  const raw = marked.parse(cleanMarkdown(markdown), { async: false, gfm: true }) as string;
  return sanitizeHtml(raw, {
    allowedTags: ["h2", "h3", "h4", "p", "ul", "ol", "li", "strong", "em", "a", "code", "pre", "blockquote", "table", "thead", "tbody", "tr", "th", "td"],
    allowedAttributes: { a: ["href"], code: ["class"] },
    allowedClasses: { code: ["language-*"] },
    allowedSchemes: ["http", "https"],
    allowProtocolRelative: false,
    transformTags: { h1: "h2" },
  }).trim();
}
