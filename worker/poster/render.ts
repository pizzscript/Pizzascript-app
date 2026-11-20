import { Resvg } from "@resvg/resvg-js";
import satori from "satori";
import sharp from "sharp";
import { CATEGORY_STYLE, loadFonts, logoDataUri, techLogo, topicIcon } from "./assets";
import { sanitize, type PosterPlan } from "./plan";

/**
 * Poster templates. Layout, type scale and colour are fixed here (always on-brand, never broken); the plan only
 * supplies content. Satori lays out the element tree into SVG, resvg rasterises it to PNG, sharp makes WebP.
 */

type Style = Record<string, string | number>;
type El = { type: string; props: { style?: Style; children?: Child; src?: string; width?: number; height?: number } };
type Child = El | string | (El | string | null | false)[] | null;

const h = (type: string, style: Style, children?: Child): El => ({ type, props: { style: { display: "flex", ...style }, children } });
const img = (src: string, size: number, style: Style = {}): El => ({ type: "img", props: { src, width: size, height: size, style: { width: size, height: size, ...style } } });

const PAD_X = 84;
const PAD_Y = 60;
const LEFT_W = 760;

const C = {
  bg: "#120b07",
  surface: "#1d130d",
  surface2: "#26190f",
  line: "rgba(243,233,220,0.10)",
  cream: "#f3e9dc",
  muted: "#b5a596",
  faint: "#7d6d60",
  orange: "#e8703a",
};

export interface PosterContext {
  plan: PosterPlan;
  categoryId: string | null;
  categoryName: string;
}

// ───────────── shared pieces ─────────────

function headlineSize(text: string) {
  const n = text.length;
  return n <= 18 ? 92 : n <= 26 ? 80 : n <= 36 ? 68 : n <= 48 ? 58 : 50;
}

function headline(plan: PosterPlan, accent: string): El {
  const text = sanitize(plan.headline);
  const size = headlineSize(text);
  const norm = (w: string) => w.toLowerCase().replace(/[^a-z0-9.]/g, "");
  const hl = plan.highlight ? norm(plan.highlight) : null;
  // One element per word with explicit spacing: the renderer drops whitespace between styled text runs.
  return h(
    "div",
    { fontFamily: "Playfair", fontWeight: 700, fontSize: size, lineHeight: 1.06, color: C.cream, flexWrap: "wrap", letterSpacing: -1, columnGap: Math.round(size * 0.24) },
    text.split(/\s+/).filter(Boolean).map((w) => h("span", { color: hl && norm(w) === hl ? accent : C.cream }, w)),
  );
}

function chip(name: string, accent: string): El {
  return h("div", { alignItems: "center", gap: 14 }, [
    h("div", { width: 14, height: 14, borderRadius: 7, backgroundColor: accent, boxShadow: `0 0 18px ${accent}` }),
    h("div", { fontFamily: "Inter", fontWeight: 600, fontSize: 21, letterSpacing: 4, color: C.muted }, sanitize(name).toUpperCase()),
  ]);
}

async function footer(): Promise<El> {
  return h("div", { alignItems: "center", gap: 16 }, [
    img(await logoDataUri(), 46, { borderRadius: 12 }),
    h("div", { fontFamily: "Playfair", fontWeight: 600, fontSize: 28, color: C.cream }, "PizzaScript"),
    h("div", { fontFamily: "Inter", fontWeight: 400, fontSize: 20, color: C.faint }, "pizzascript.com/blog"),
  ]);
}

function card(style: Style, children: Child): El {
  return h("div", { backgroundColor: C.surface, border: `2px solid ${C.line}`, borderRadius: 28, boxShadow: "0 30px 80px rgba(0,0,0,0.45)", ...style }, children);
}

function logoTile(key: string, size: number, accent: string): El {
  const logo = techLogo(key);
  return card(
    { width: size, height: size, alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 14, border: `2px solid ${accent}55` },
    logo
      ? [img(logo.uri, Math.round(size * 0.46)), h("div", { fontFamily: "Inter", fontWeight: 600, fontSize: 22, color: C.cream }, logo.label)]
      : [h("div", { fontFamily: "Playfair", fontWeight: 700, fontSize: 34, color: C.cream, textAlign: "center", padding: 16 }, sanitize(key))],
  );
}

function techRow(keys: string[], size = 64): El | null {
  const logos = keys.map((k) => techLogo(k)).filter((l): l is NonNullable<typeof l> => !!l);
  if (!logos.length) return null;
  return h(
    "div",
    { gap: 14 },
    logos.map((l) => h("div", { width: size, height: size, borderRadius: 18, backgroundColor: C.surface2, border: `2px solid ${C.line}`, alignItems: "center", justifyContent: "center" }, [img(l.uri, Math.round(size * 0.5))])),
  );
}

// ───────────── hero panels (right side) ─────────────

function heroComparison(plan: PosterPlan, accent: string): El {
  const [a, b] = plan.compare ?? ["A", "B"];
  return h("div", { alignItems: "center", gap: 0 }, [
    logoTile(a, 236, accent),
    h("div", { width: 92, height: 92, borderRadius: 46, backgroundColor: C.orange, alignItems: "center", justifyContent: "center", margin: "0 -22px", zIndex: 2, boxShadow: `0 0 40px ${C.orange}88`, fontFamily: "Playfair", fontWeight: 700, fontSize: 38, color: C.bg }, "vs"),
    logoTile(b, 236, accent),
  ]);
}

function heroMetric(plan: PosterPlan, accent: string): El {
  const m = plan.metric!;
  return card({ width: 560, flexDirection: "column", padding: "40px 44px", gap: 18 }, [
    h("div", { alignItems: "center", gap: 14 }, [
      img(topicIcon("gauge", accent, 2), 40),
      h("div", { fontFamily: "Inter", fontWeight: 600, fontSize: 22, letterSpacing: 3, color: C.muted }, sanitize(m.label).toUpperCase()),
    ]),
    h("div", { alignItems: "center", gap: 22 }, [
      h("div", { fontFamily: "Inter", fontWeight: 700, fontSize: 76, color: C.faint, textDecoration: "line-through" }, sanitize(m.before)),
      img(topicIcon("arrow-right", C.orange, 2.5), 56),
      h("div", { fontFamily: "Inter", fontWeight: 700, fontSize: 96, color: accent }, sanitize(m.after)),
    ]),
    h("div", { height: 14, borderRadius: 7, backgroundColor: C.surface2, width: "100%" }, [h("div", { width: "28%", height: 14, borderRadius: 7, backgroundColor: accent })]),
    techRow(plan.tech, 56),
  ]);
}

/** One code line, simply syntax-coloured. whiteSpace "pre" keeps indentation and the spaces between tokens. */
function codeLine(line: string, accent: string): El {
  const parts: El[] = [];
  let last = 0;
  const text = sanitize(line) || " ";
  const pre = { whiteSpace: "pre" };
  for (const m of text.matchAll(/(["'`][^"'`]*["'`])|\b(const|let|var|function|return|import|from|export|default|await|async|if|else|new)\b|(\/\/.*$)/g)) {
    if (m.index! < last) continue;
    if (m.index! > last) parts.push(h("span", { ...pre, color: C.cream }, text.slice(last, m.index)));
    // Carry following spaces inside the token: a span that's only whitespace gets dropped by the renderer.
    const trailing = text.slice(m.index! + m[0].length).match(/^\s+/)?.[0] ?? "";
    parts.push(h("span", { ...pre, color: m[1] ? "#9fd28a" : m[3] ? C.faint : accent }, m[0] + trailing));
    last = m.index! + m[0].length + trailing.length;
  }
  if (last < text.length) parts.push(h("span", { ...pre, color: C.cream }, text.slice(last)));
  return h("div", { ...pre, overflow: "hidden", flexGrow: 1, flexShrink: 1, width: 0 }, parts);
}

function heroCode(plan: PosterPlan, accent: string): El {
  const code = plan.code!;
  return card({ width: 600, flexDirection: "column", overflow: "hidden" }, [
    h("div", { alignItems: "center", gap: 10, padding: "18px 24px", backgroundColor: C.surface2, borderBottom: `2px solid ${C.line}` }, [
      h("div", { width: 14, height: 14, borderRadius: 7, backgroundColor: "#f0605a" }),
      h("div", { width: 14, height: 14, borderRadius: 7, backgroundColor: "#f2c14e" }),
      h("div", { width: 14, height: 14, borderRadius: 7, backgroundColor: "#7fd18a" }),
      h("div", { fontFamily: "Mono", fontWeight: 500, fontSize: 18, color: C.muted, marginLeft: 14 }, sanitize(code.filename)),
    ]),
    h(
      "div",
      { flexDirection: "column", padding: "26px 28px 30px", gap: 12, fontFamily: "Mono", fontWeight: 400, fontSize: 21 },
      code.lines.map((l, i) =>
        h("div", { gap: 20, width: "100%" }, [h("div", { color: C.faint, width: 22, flexShrink: 0, justifyContent: "flex-end" }, String(i + 1)), codeLine(l, accent)]),
      ),
    ),
  ]);
}

function heroCost(plan: PosterPlan, accent: string): El {
  const c = plan.cost!;
  const bars = [0.42, 0.68, 0.9];
  return card({ width: 540, flexDirection: "column", padding: "40px 44px", gap: 24 }, [
    h("div", { alignItems: "center", gap: 16 }, [
      h("div", { width: 72, height: 72, borderRadius: 36, backgroundColor: `${accent}22`, border: `2px solid ${accent}66`, alignItems: "center", justifyContent: "center" }, [img(topicIcon("indian-rupee", accent, 2), 38)]),
      h("div", { fontFamily: "Inter", fontWeight: 600, fontSize: 22, letterSpacing: 3, color: C.muted }, sanitize(c.label || "Cost breakdown").toUpperCase()),
    ]),
    h("div", { fontFamily: "Inter", fontWeight: 700, fontSize: c.range.length > 14 ? 54 : 70, color: C.cream }, sanitize(c.range)),
    h(
      "div",
      { flexDirection: "column", gap: 12 },
      bars.map((w, i) =>
        h("div", { alignItems: "center", gap: 14 }, [
          h("div", { fontFamily: "Inter", fontWeight: 400, fontSize: 18, color: C.faint, width: 92 }, ["Starter", "Business", "Custom"][i]),
          h("div", { height: 12, flexGrow: 1, borderRadius: 6, backgroundColor: C.surface2 }, [h("div", { width: `${w * 100}%`, height: 12, borderRadius: 6, backgroundColor: i === 2 ? C.orange : accent })]),
        ]),
      ),
    ),
  ]);
}

function heroCaseStudy(plan: PosterPlan, accent: string): El {
  return card({ width: 560, flexDirection: "column", overflow: "hidden" }, [
    h("div", { alignItems: "center", gap: 10, padding: "16px 22px", backgroundColor: C.surface2 }, [
      ...["#f0605a", "#f2c14e", "#7fd18a"].map((c) => h("div", { width: 12, height: 12, borderRadius: 6, backgroundColor: c })),
      h("div", { flexGrow: 1, height: 26, borderRadius: 13, backgroundColor: C.bg, marginLeft: 12 }),
    ]),
    h("div", { flexDirection: "column", padding: "34px 36px", gap: 18 }, [
      h("div", { alignItems: "center", gap: 14 }, [img(topicIcon("briefcase", accent, 2), 36), h("div", { fontFamily: "Inter", fontWeight: 600, fontSize: 20, letterSpacing: 3, color: C.muted }, "CLIENT RESULT")]),
      plan.metric
        ? h("div", { alignItems: "center", gap: 18 }, [
            h("div", { fontFamily: "Inter", fontWeight: 700, fontSize: 60, color: C.faint, textDecoration: "line-through" }, sanitize(plan.metric.before)),
            img(topicIcon("arrow-right", C.orange, 2.5), 46),
            h("div", { fontFamily: "Inter", fontWeight: 700, fontSize: 80, color: accent }, sanitize(plan.metric.after)),
          ])
        : h("div", { fontFamily: "Playfair", fontWeight: 700, fontSize: 54, color: C.cream }, "Shipped & measured"),
      techRow(plan.tech, 52),
    ]),
  ]);
}

function heroGuide(plan: PosterPlan, accent: string): El {
  const logos = plan.tech.map((k) => techLogo(k)).filter((l): l is NonNullable<typeof l> => !!l);
  if (logos.length >= 2) {
    // Orbit of tech logos around the topic icon.
    // Box 560×500: centre emblem 140px at (280, 250); three 150px tiles on the ring with clear gaps around it.
    return h("div", { width: 560, height: 500, position: "relative", alignItems: "center", justifyContent: "center" }, [
      h("div", { position: "absolute", width: 440, height: 440, borderRadius: 220, border: `2px dashed ${accent}44` }),
      h("div", { width: 140, height: 140, borderRadius: 38, backgroundColor: C.surface, border: `2px solid ${accent}77`, alignItems: "center", justifyContent: "center", boxShadow: `0 0 60px ${accent}44` }, [img(topicIcon(plan.icon, accent, 1.75), 76)]),
      ...logos.slice(0, 3).map((l, i) => {
        const pos = [
          { top: 0, left: 205 },
          { top: 340, left: 40 },
          { top: 340, left: 370 },
        ][i];
        return h("div", { position: "absolute", ...pos, width: 150, height: 150, borderRadius: 36, backgroundColor: C.surface, border: `2px solid ${C.line}`, flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, boxShadow: "0 20px 50px rgba(0,0,0,0.45)" }, [
          img(l.uri, 62),
          h("div", { fontFamily: "Inter", fontWeight: 600, fontSize: 18, color: C.muted }, l.label),
        ]);
      }),
    ]);
  }
  // One or no logo: a big topic emblem with the logo (if any) as a badge.
  return h("div", { width: 520, height: 460, position: "relative", alignItems: "center", justifyContent: "center" }, [
    h("div", { position: "absolute", width: 400, height: 400, borderRadius: 200, backgroundImage: `radial-gradient(circle, ${accent}33, transparent 70%)` }),
    h("div", { width: 300, height: 300, borderRadius: 72, backgroundColor: C.surface, border: `2px solid ${accent}66`, alignItems: "center", justifyContent: "center", boxShadow: "0 30px 80px rgba(0,0,0,0.5)" }, [img(topicIcon(plan.icon, accent, 1.5), 160)]),
    logos[0]
      ? h("div", { position: "absolute", right: 40, bottom: 40, width: 130, height: 130, borderRadius: 34, backgroundColor: C.surface2, border: `2px solid ${C.line}`, alignItems: "center", justifyContent: "center" }, [img(logos[0].uri, 66)])
      : null,
  ]);
}

// ───────────── poster ─────────────

export async function renderPoster(ctx: PosterContext, size: { width: number; height: number } = { width: 1600, height: 686 }): Promise<Buffer> {
  const { plan } = ctx;
  const style = (ctx.categoryId && CATEGORY_STYLE[ctx.categoryId]) || { accent: C.orange, icon: "sparkles" as const };
  const accent = style.accent;
  const hero =
    plan.type === "comparison" ? heroComparison(plan, accent)
    : plan.type === "metric" ? heroMetric(plan, accent)
    : plan.type === "code" ? heroCode(plan, accent)
    : plan.type === "cost" ? heroCost(plan, accent)
    : plan.type === "case-study" ? heroCaseStudy(plan, accent)
    : heroGuide(plan, accent);

  // Comparison already shows its logos big on the right; guide/metric/case-study show them in the hero too.
  const showTechUnderKicker = plan.type === "code" || plan.type === "cost";

  const tree = h(
    "div",
    {
      width: size.width,
      height: size.height,
      position: "relative",
      backgroundColor: C.bg,
      backgroundImage: `radial-gradient(circle at 82% 38%, ${accent}30, transparent 46%), radial-gradient(circle at 4% 108%, ${C.orange}2e, transparent 42%)`,
    },
    [
      // Dot grid texture.
      h("div", { position: "absolute", top: 0, left: 0, width: size.width, height: size.height, backgroundImage: "radial-gradient(circle, rgba(243,233,220,0.07) 1.5px, transparent 1.6px)", backgroundSize: "30px 30px" }),
      // Accent rule along the top.
      h("div", { position: "absolute", top: 0, left: PAD_X, width: 220, height: 6, borderRadius: 3, backgroundColor: accent }),
      // Content box positioned explicitly (padding would be added on top of the canvas size and push things off it).
      h("div", { position: "absolute", top: PAD_Y, left: PAD_X, width: size.width - PAD_X * 2, height: size.height - PAD_Y * 2, alignItems: "center", justifyContent: "space-between" }, [
        h("div", { flexDirection: "column", justifyContent: "space-between", height: "100%", width: LEFT_W, flexShrink: 0 }, [
          chip(ctx.categoryName, accent),
          h("div", { flexDirection: "column", gap: 22 }, [
            headline(plan, accent),
            h("div", { fontFamily: "Inter", fontWeight: 400, fontSize: 27, lineHeight: 1.4, color: C.muted, maxWidth: 680 }, sanitize(plan.kicker)),
            showTechUnderKicker ? techRow(plan.tech) : null,
          ]),
          await footer(),
        ]),
        h("div", { alignItems: "center", justifyContent: "flex-end", width: size.width - PAD_X * 2 - LEFT_W - 40, flexShrink: 0 }, [hero]),
      ]),
    ],
  );

  const svg = await satori(tree as unknown as Parameters<typeof satori>[0], {
    width: size.width,
    height: size.height,
    fonts: loadFonts(),
  });
  const png = new Resvg(svg, { fitTo: { mode: "width", value: size.width } }).render().asPng();
  return sharp(png).webp({ quality: 86 }).toBuffer();
}
