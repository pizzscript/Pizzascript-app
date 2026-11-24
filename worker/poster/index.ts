import type { StudioPost } from "../../src/lib/studio/types";
import { json } from "../gemini";
import { currentProfile } from "../profile";
import { CATEGORY_STYLE } from "./assets";
import { mergePlan, planPrompt, rulePlan, type PosterInput, type PosterPlan } from "./plan";

/**
 * Designed banner for a post: the AI art director picks the concept (type, headline, icons, stat or code), fixed
 * templates draw it. Works with no AI at all — rules fill the plan when Gemini is unavailable. Drawing happens elsewhere.
 */
export async function planPoster(
  post: StudioPost,
  categoryName: string,
  opts: { useAi?: boolean } = {},
): Promise<{ plan: PosterPlan; alt: string; ai: boolean }> {
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
      const answer = await Promise.race([json<Partial<PosterPlan>>(planPrompt(input, rules, currentProfile().name), "You design blog banners. Return only JSON."), timeout]);
      plan = mergePlan(answer, rules, input.bodyHtml);
      ai = true;
    } catch (error) {
      console.warn(`[poster] AI art direction unavailable, using rules: ${error instanceof Error ? error.message.slice(0, 120) : error}`);
    }
  }
  const alt = `${plan.headline} — ${categoryName} | ${currentProfile().name} blog banner`;
  return { plan, alt, ai };
}
