import type { StudioPost } from "../../src/lib/studio/types";
import { json } from "../gemini";
import { CATEGORY_STYLE } from "./assets";
import { mergePlan, planPrompt, rulePlan, type PosterInput, type PosterPlan } from "./plan";
import { renderPoster } from "./render";

/**
 * Designed banner for a post: the AI art director picks the concept (type, headline, icons, stat or code), fixed
 * templates draw it. Works with no AI at all — rules fill the plan when Gemini is unavailable.
 */
export async function makePoster(
  post: StudioPost,
  categoryName: string,
  opts: { useAi?: boolean } = {},
): Promise<{ webp: Buffer; plan: PosterPlan; alt: string; ai: boolean }> {
  const input: PosterInput = {
    title: post.title,
    excerpt: post.excerpt ?? "",
    tags: post.tags ?? [],
    query: post.seo_plan?.targetQuery ?? "",
    angle: post.brief?.angle ?? "",
    role: post.role,
    categoryName,
    categoryIcon: (post.cluster_id && CATEGORY_STYLE[post.cluster_id]?.icon) || "sparkles",
    bodyHtml: post.body_html ?? "",
  };
  const rules = rulePlan(input);
  let plan = rules;
  let ai = false;
  if (opts.useAi !== false) {
    try {
      // Art direction is optional: give it 30s, then go with the rule-based concept rather than hold up the banner.
      const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("art direction timed out")), 30_000));
      const answer = await Promise.race([json<Partial<PosterPlan>>(planPrompt(input, rules), "You design blog banners. Return only JSON."), timeout]);
      plan = mergePlan(answer, rules);
      ai = true;
    } catch (error) {
      console.warn(`[poster] AI art direction unavailable, using rules: ${error instanceof Error ? error.message.slice(0, 120) : error}`);
    }
  }
  const webp = await renderPoster({ plan, categoryId: post.cluster_id, categoryName });
  const alt = `${plan.headline} — ${categoryName} | PizzaScript blog banner`;
  return { webp, plan, alt, ai };
}
