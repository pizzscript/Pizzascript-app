import { STAGES, type Briefing, type BriefingAction, type Cluster, type Signal, type StudioPost, type Topic, type Batch } from "./types";

const PRIORITY_ORDER = { P0: 0, P1: 1, P2: 2, P3: 3, P4: 4 } as const;

export function istDate(iso: string) {
  return new Date(new Date(iso).getTime() + 5.5 * 3600_000).toISOString().slice(0, 10);
}

export function clusterHealth(clusters: Cluster[], posts: StudioPost[], topics: Topic[]) {
  return clusters.map((cluster) => {
    const inCluster = posts.filter((p) => p.cluster_id === cluster.id);
    const live = inCluster.filter((p) => p.stage === "live");
    const pillar = live.find((p) => p.role === "pillar");
    const spokes = live.filter((p) => p.role === "spoke" || p.role === "edge").length;
    const t1 = live.filter((p) => p.track === 1).length;
    const candidates = topics
      .filter((t) => t.cluster_id === cluster.id && (t.status === "candidate" || t.status === "approved"))
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    return {
      cluster,
      live: live.length,
      planned: inCluster.length - live.length,
      pillar: pillar ?? null,
      spokes,
      t1Share: live.length ? Math.round((t1 / live.length) * 100) : 0,
      topCandidate: candidates[0] ?? null,
    };
  });
}

/** Builds the Pass from pipeline state. The worker adds an AI-written recommendation on top of this. */
export function composeBriefing(
  date: string,
  data: { posts: StudioPost[]; signals: Signal[]; clusters: Cluster[]; topics: Topic[]; batches: Batch[] },
): Briefing {
  const today = data.posts.find((p) => p.stage !== "live" && p.scheduled_for && istDate(p.scheduled_for) === date);
  const notes: string[] = [];
  const actions: BriefingAction[] = [];
  let text: string;

  const urgent = [...data.signals].sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority])[0];
  const pendingBatch = data.batches.find((b) => !b.approved_at && data.posts.some((p) => p.batch_id === b.id && p.stage !== "live"));
  const gap = clusterHealth(data.clusters, data.posts, data.topics).find((h) => h.pillar && h.spokes === 0 && h.topCandidate);

  if (urgent?.priority === "P0") {
    text = `${urgent.title}. This has a short window — act on it before today's slot.`;
    actions.push({ type: "navigate", label: "See alerts", href: "/#alerts-title" });
  } else if (today && STAGES.indexOf(today.stage) < STAGES.indexOf("audit")) {
    text = `"${today.title}" is scheduled for 09:00 today but is still a ${today.stage === "brief" ? "brief" : "draft in progress"}. Write it now or move it to tomorrow.`;
    actions.push({ type: today.stage === "brief" ? "write_brief" : "write_draft", label: "Write it now", payload: { postId: today.id } });
  } else if (gap) {
    text = `${gap.cluster.name} has a main article but no supporting posts yet. "${gap.topCandidate!.query}" is the best next idea for it.`;
    actions.push({ type: "write_brief", label: "Write it", payload: { topicId: gap.topCandidate!.id } });
  } else if (pendingBatch) {
    text = `${pendingBatch.name} isn't approved yet, so nothing will publish automatically. Check the calendar and approve it.`;
    actions.push({ type: "navigate", label: "Review calendar", href: "/calendar" });
  } else if (urgent) {
    text = urgent.title;
  } else {
    text = "Pipeline is clean. Use the time to research new ideas.";
    actions.push({ type: "navigate", label: "Open ideas", href: "/ideas" });
  }

  const upcoming = data.posts.filter((p) => p.stage !== "live" && p.scheduled_for).length;
  notes.push(`${upcoming} articles slotted`);
  if (pendingBatch) notes.push(`${pendingBatch.name} awaiting approval`);

  return {
    date,
    content: {
      headline: today ? `Today: ${today.title}` : "Nothing slotted today",
      recommendation: { text, actions },
      notes,
    },
  };
}
