import sharp from "sharp";

/**
 * Free, AI-free banner: a 21:9 abstract composition in the brand palette, seeded by the post slug so every post gets
 * its own image and re-running gives the same one. No text on purpose — the page renders the title, and text in SVG
 * would depend on fonts installed on the server.
 */

const CLUSTER_ACCENT: Record<string, string> = {
  "custom-builds": "#e8703a",
  performance: "#e9b949",
  "tech-seo": "#6fb3e0",
  "scroll-motion": "#b48ce0",
  "ai-workflows": "#7cc47f",
  deployment: "#e07a7a",
  "case-studies": "#efe6da",
};

function rng(seed: string) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

export async function fallbackBanner(slug: string, clusterId: string | null, width = 1600): Promise<Buffer> {
  const W = 1600;
  const H = 686; // 21:9
  const rand = rng(slug);
  const accent = (clusterId && CLUSTER_ACCENT[clusterId]) || "#e8703a";
  const brand = "#e8703a";

  const orbs = Array.from({ length: 3 }, (_, i) => {
    const r = 220 + rand() * 260;
    const cx = W * (0.15 + rand() * 0.7);
    const cy = H * (0.2 + rand() * 0.6);
    return `<circle cx="${cx.toFixed(0)}" cy="${cy.toFixed(0)}" r="${r.toFixed(0)}" fill="url(#g${i % 2})" opacity="${(0.35 + rand() * 0.3).toFixed(2)}"/>`;
  }).join("");

  // A loose grid of "code" bars, like lines in an editor, kept inside the safe area (≈20% margins).
  const bars = Array.from({ length: 9 }, (_, row) => {
    let x = W * 0.22 + rand() * 40;
    const y = H * 0.24 + row * 44;
    const parts: string[] = [];
    const count = 2 + Math.floor(rand() * 4);
    for (let i = 0; i < count && x < W * 0.78; i++) {
      const w = 40 + rand() * 180;
      const color = rand() < 0.22 ? accent : rand() < 0.5 ? brand : "#efe6da";
      const op = color === "#efe6da" ? 0.14 + rand() * 0.12 : 0.55 + rand() * 0.35;
      parts.push(`<rect x="${x.toFixed(0)}" y="${y}" width="${Math.min(w, W * 0.78 - x).toFixed(0)}" height="14" rx="7" fill="${color}" opacity="${op.toFixed(2)}"/>`);
      x += w + 18 + rand() * 30;
    }
    return parts.join("");
  }).join("");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#1a110c"/><stop offset="1" stop-color="#0d0907"/>
    </linearGradient>
    <radialGradient id="g0"><stop offset="0" stop-color="${brand}" stop-opacity="0.55"/><stop offset="1" stop-color="${brand}" stop-opacity="0"/></radialGradient>
    <radialGradient id="g1"><stop offset="0" stop-color="${accent}" stop-opacity="0.45"/><stop offset="1" stop-color="${accent}" stop-opacity="0"/></radialGradient>
    <pattern id="dots" width="28" height="28" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.4" fill="#efe6da" opacity="0.07"/></pattern>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect width="${W}" height="${H}" fill="url(#dots)"/>
  ${orbs}
  ${bars}
  <rect x="${W * 0.2}" y="${H * 0.18}" width="${W * 0.6}" height="${H * 0.64}" rx="22" fill="none" stroke="#efe6da" stroke-opacity="0.08" stroke-width="2"/>
</svg>`;

  return sharp(Buffer.from(svg)).resize({ width, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
}
