import { readFileSync } from "node:fs";
import path from "node:path";

/** Fonts, logo and icons for the poster renderer. Everything is bundled with the app — no network, no system fonts. */

const root = process.cwd();
const font = (pkg: string, file: string) => readFileSync(path.join(root, "node_modules", "@fontsource", pkg, "files", file));

export type FontSpec = { name: string; data: Buffer; weight: 400 | 500 | 600 | 700; style: "normal" };

let fonts: FontSpec[] | null = null;
export function loadFonts(): FontSpec[] {
  fonts ??= [
    { name: "Playfair", data: font("playfair-display", "playfair-display-latin-700-normal.woff"), weight: 700, style: "normal" },
    { name: "Playfair", data: font("playfair-display", "playfair-display-latin-600-normal.woff"), weight: 600, style: "normal" },
    { name: "Inter", data: font("inter", "inter-latin-400-normal.woff"), weight: 400, style: "normal" },
    { name: "Inter", data: font("inter", "inter-latin-600-normal.woff"), weight: 600, style: "normal" },
    { name: "Inter", data: font("inter", "inter-latin-700-normal.woff"), weight: 700, style: "normal" },
    { name: "Mono", data: font("jetbrains-mono", "jetbrains-mono-latin-400-normal.woff"), weight: 400, style: "normal" },
    { name: "Mono", data: font("jetbrains-mono", "jetbrains-mono-latin-500-normal.woff"), weight: 500, style: "normal" },
  ];
  return fonts;
}

let logo: string | null = null;
/** The PizzaScript mark as a PNG data URI (the renderer can't read WebP). */
export async function logoDataUri() {
  if (!logo) {
    const { default: sharp } = await import("sharp");
    const png = await sharp(path.join(root, "public", "images", "logo-static.webp")).resize(128, 128).png().toBuffer();
    logo = `data:image/png;base64,${png.toString("base64")}`;
  }
  return logo;
}

const svgUri = (svg: string) => `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;

// ── Tech logos (Simple Icons) ──
const iconSvg = new Map<string, string>();
const readIcon = (slug: string) => {
  let svg = iconSvg.get(slug);
  if (!svg) {
    svg = readFileSync(path.join(root, "node_modules", "simple-icons", "icons", `${slug}.svg`), "utf8");
    iconSvg.set(slug, svg);
  }
  return svg;
};

/** Tech keywords the planner and the AI may pick from, with the logo used for each. */
export const TECH: Record<string, { slug: string; hex: string; label: string; match: RegExp }> = {
  react: { slug: "react", hex: "61DAFB", label: "React", match: /\breact(?!\s*router)\b/i },
  nextjs: { slug: "nextdotjs", hex: "000000", label: "Next.js", match: /\bnext\.?js\b/i },
  gsap: { slug: "gsap", hex: "0AE448", label: "GSAP", match: /\b(gsap|scrolltrigger|greensock)\b/i },
  vite: { slug: "vite", hex: "9135FF", label: "Vite", match: /\bvite\b/i },
  cloudflare: { slug: "cloudflare", hex: "F38020", label: "Cloudflare", match: /\bcloudflare\b/i },
  vercel: { slug: "vercel", hex: "000000", label: "Vercel", match: /\bvercel\b/i },
  wordpress: { slug: "wordpress", hex: "21759B", label: "WordPress", match: /\bwordpress\b/i },
  webflow: { slug: "webflow", hex: "146EF5", label: "Webflow", match: /\bwebflow\b/i },
  tailwind: { slug: "tailwindcss", hex: "06B6D4", label: "Tailwind", match: /\btailwind/i },
  typescript: { slug: "typescript", hex: "3178C6", label: "TypeScript", match: /\btypescript\b/i },
  javascript: { slug: "javascript", hex: "F7DF1E", label: "JavaScript", match: /\bjavascript\b/i },
  lighthouse: { slug: "lighthouse", hex: "F44B21", label: "Lighthouse", match: /\blighthouse\b/i },
  reactrouter: { slug: "reactrouter", hex: "CA4245", label: "React Router", match: /\breact\s*router\b/i },
  cursor: { slug: "cursor", hex: "000000", label: "Cursor", match: /\bcursor\s*(ai|ide|editor)\b/i },
  searchconsole: { slug: "googlesearchconsole", hex: "458CF5", label: "Search Console", match: /\bsearch\s*console\b/i },
  google: { slug: "google", hex: "4285F4", label: "Google", match: /\bgoogle\b/i },
  node: { slug: "nodedotjs", hex: "5FA04E", label: "Node.js", match: /\bnode\.?js\b/i },
  supabase: { slug: "supabase", hex: "3FCF8E", label: "Supabase", match: /\bsupabase\b/i },
  netlify: { slug: "netlify", hex: "00C7B7", label: "Netlify", match: /\bnetlify\b/i },
  framer: { slug: "framer", hex: "0055FF", label: "Framer Motion", match: /\bframer\b/i },
  gemini: { slug: "googlegemini", hex: "8E75B2", label: "Gemini", match: /\bgemini\b/i },
};

/** Logo as a data URI, in its brand colour — or cream when the brand colour is too dark for the poster background. */
export function techLogo(key: string): { uri: string; color: string; label: string } | null {
  const tech = TECH[key];
  if (!tech) return null;
  const hex = `#${tech.hex}`;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(tech.hex.slice(i, i + 2), 16) / 255);
  const color = 0.2126 * r + 0.7152 * g + 0.0722 * b < 0.28 ? "#f3e9dc" : hex;
  return { uri: svgUri(readIcon(tech.slug).replace("<svg ", `<svg fill="${color}" `)), color, label: tech.label };
}

// ── Topic icons (Lucide) ──
export const TOPIC_ICONS = [
  "gauge", "search", "mouse-pointer-2", "rocket", "code-xml", "indian-rupee", "sparkles", "layers", "server", "zap",
  "bot", "cloud", "briefcase", "trending-up", "scale", "timer", "check-check", "arrow-right", "file-code-2", "monitor-smartphone",
] as const;
export type TopicIcon = (typeof TOPIC_ICONS)[number];

const lucideCache = new Map<string, string>();
export function topicIcon(name: string, color: string, strokeWidth = 1.75): string {
  const key = `${name}|${color}|${strokeWidth}`;
  let uri = lucideCache.get(key);
  if (!uri) {
    const file = path.join(root, "node_modules", "lucide-static", "icons", `${(TOPIC_ICONS as readonly string[]).includes(name) ? name : "sparkles"}.svg`);
    const svg = readFileSync(file, "utf8").replace(/currentColor/g, color).replace(/stroke-width="[\d.]+"/, `stroke-width="${strokeWidth}"`);
    uri = svgUri(svg);
    lucideCache.set(key, uri);
  }
  return uri;
}

/** Category look: accent colour and the topic icon used when a post names no specific tech. */
export const CATEGORY_STYLE: Record<string, { accent: string; icon: TopicIcon }> = {
  "custom-builds": { accent: "#ef7d45", icon: "code-xml" },
  performance: { accent: "#f2c14e", icon: "gauge" },
  "tech-seo": { accent: "#6fb6ea", icon: "search" },
  "scroll-motion": { accent: "#b892f0", icon: "mouse-pointer-2" },
  "ai-workflows": { accent: "#7fd18a", icon: "sparkles" },
  deployment: { accent: "#f08a8a", icon: "cloud" },
  "case-studies": { accent: "#f3e9dc", icon: "briefcase" },
  "business-automation": { accent: "#5fd3c6", icon: "zap" },
  "software-tools": { accent: "#9aa7ff", icon: "layers" },
};
