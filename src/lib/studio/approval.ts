// Who has to say yes before an article publishes. Shared by the worker and the admin.

export type ApprovalMode = "owner" | "client" | "automatic";

export const APPROVAL_LABELS: Record<ApprovalMode, string> = {
  owner: "You approve each article",
  client: "The client approves",
  automatic: "Publish automatically when checks pass",
};

/**
 * Automatic: Autopilot, an approved post or an approved batch is enough (PizzaScript's rule, unchanged).
 * Owner / client: Autopilot still prepares the article, but it publishes only once someone approved the post or its batch.
 */
export function isApproved(
  post: { approved_at: string | null; batch_id: string | null },
  context: { mode: ApprovalMode; autopilot: boolean; approvedBatches: Set<string> },
) {
  const explicit = Boolean(post.approved_at) || (post.batch_id !== null && context.approvedBatches.has(post.batch_id));
  return context.mode === "automatic" ? context.autopilot || explicit : explicit;
}

/** Rewrites the article's blog links for a client's own site: known posts get their real address. */
export function rewriteBlogLinks(html: string, addressOf: (slug: string) => string) {
  return html.replace(/href="\/blog\/([a-z0-9-]+)\/?(#[^"]*)?"/gi, (_whole, slug: string, hash?: string) => `href="${addressOf(slug)}${hash ?? ""}"`);
}
