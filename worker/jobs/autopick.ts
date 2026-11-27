import { AUTO_PICK_DEFAULTS, chooseTopic, istSlot, nextOpenDate, nextToScore, type AutoPickSettings, type AutoPickState } from "../../src/lib/studio/autopick";
import { MODEL_CHAINS, MODEL_LIMITS, quotaDayStart, type AgentState } from "../../src/lib/studio/models";
import type { StudioPost } from "../../src/lib/studio/types";
import { allFacts, allPosts, allTopics, check, db, enqueue, raiseSignal, rawDb, setting, settings, todayIst } from "../db";
import { hasModule } from "../../src/lib/studio/plans";
import { aiKeyOwner } from "../connections";
import { currentPlan } from "../profile";
import { aiBudgetLeft, articlesThisMonth } from "../usage";
import { isBillingError } from "../gemini";
import { approvalRequired } from "./research";
import { approvedResearchProfile } from "../research/profile-store";

const BUSY_JOBS = ["daily_briefing", "score_topic", "write_brief", "write_draft", "generate_image", "run_audit", "discover_ideas", "prune_ideas", "scan_services", "analyze_site"];
const PIPELINE_JOBS = ["write_brief", "write_draft", "generate_image", "run_audit"];

const saveState = async (state: AutoPickState) => check(await db.from("settings").upsert({ key: "autopick_state", value: state }), "autopick state");

const pickedAt = (post: StudioPost) => (post.seo_plan?.autoPicked as { at?: string } | undefined)?.at ?? "";

async function notify(today: string, key: string, title: string, topicId: string | null = null, priority: "P1" | "P2" = "P2") {
  await raiseSignal({ kind: "quality_gate", title, detail: { source: "auto-pick" }, priority, post_id: null, topic_id: topicId, dedupe_key: `autopick:${today}:${key}` });
}

/** Writer requests left today on the key this client uses. Clients sharing PizzaScript's key share its quota. */
async function writerRequestsLeft() {
  const since = new Date(quotaDayStart()).toISOString();
  const { data } = await rawDb.from("ai_calls").select("model,error").eq("key_owner", aiKeyOwner()).gte("created_at", since).in("model", MODEL_CHAINS.writer);
  // A billing block is refused before it reaches the model, so it doesn't use the daily request limit.
  const used = (data ?? []).filter((call) => !(call.error && isBillingError(call.error)));
  return MODEL_CHAINS.writer.reduce((left, model) => left + Math.max(0, MODEL_LIMITS[model].rpd - used.filter((call) => call.model === model).length), 0);
}

/**
 * Runs after the queue is empty. Picks at most one idea a day, schedules it ahead and hands it to the normal pipeline.
 * Returns true only when it queued work, so the runner knows to keep going.
 */
export async function autoPick(): Promise<boolean> {
  const [saved, autopilot, schedule, savedState, agent] = await Promise.all([
    setting<Partial<AutoPickSettings>>("autopick", {}),
    settings.autopilot(),
    settings.schedule(),
    setting<AutoPickState>("autopick_state", {}),
    setting<AgentState>("agent_state", {}),
  ]);
  const config = { ...AUTO_PICK_DEFAULTS, ...saved };
  if (!config.enabled || !autopilot || savedState.pausedReason) return false;
  const plan = currentPlan();
  if (!hasModule(plan, "autopick")) return false;

  const today = todayIst();
  if (savedState.doneDate === today) return false;
  const time = new Date(Date.now() + 5.5 * 3_600_000).toISOString().slice(11, 16);
  if (time < schedule.briefingAt) return false;

  const { count: busy } = await db.from("jobs").select("id", { count: "exact", head: true }).in("type", BUSY_JOBS).in("status", ["queued", "running"]);
  if (busy) return false;

  const state: AutoPickState = savedState.scoringDate === today ? { ...savedState } : { ...savedState, scoringDate: today, scored: [] };
  const [posts, topics, facts, failedJobs] = await Promise.all([
    allPosts(),
    allTopics(),
    allFacts(),
    db.from("jobs").select("payload").in("type", PIPELINE_JOBS).eq("status", "failed").gte("finished_at", new Date(Date.now() - 7 * 86_400_000).toISOString()),
  ]);

  const failedIds = new Set((failedJobs.data ?? []).map((job) => (job.payload as { postId?: string }).postId));
  const picked = posts.filter((post) => pickedAt(post) && post.stage !== "live").sort((a, b) => pickedAt(b).localeCompare(pickedAt(a)));
  // A post still waiting on review, or with only an autofixable/warning issue, is not a failure — only a real
  // blocker (or an actual failed pipeline job) counts. Otherwise Auto-pick pauses on posts still mid-pipeline.
  const failed = (post: StudioPost) => failedIds.has(post.id) || (post.audit?.checks ?? []).some((c) => !c.pass && c.level === "blocker");
  const recent = posts.filter((post) => pickedAt(post)).sort((a, b) => pickedAt(b).localeCompare(pickedAt(a))).slice(0, config.maxFailures);
  if (recent.length === config.maxFailures && recent.every(failed)) {
    const pausedReason = `${config.maxFailures} picked articles in a row failed`;
    await saveState({ ...state, pausedReason });
    await notify(today, "paused", `Auto-pick paused: ${pausedReason}. Check them, then turn Auto-pick back on.`, null, "P1");
    return false;
  }
  if (picked.some((post) => ["brief", "draft", "image"].includes(post.stage) && !failed(post))) return false;

  const date = nextOpenDate(posts, today, schedule.perDay, config.leadDays, config.horizonDays);
  if (!date) {
    await saveState({ ...state, doneDate: today });
    return false;
  }

  const agentPaused = Boolean(agent.cooldownUntil && Date.parse(agent.cooldownUntil) > Date.now());
  const needed = agentPaused ? config.writerRequestsWithoutAgent : config.writerRequestsWithAgent;
  const drafted = await articlesThisMonth();
  if (drafted >= plan.articlesPerMonth) {
    await saveState({ ...state, doneDate: today });
    await notify(today, "month-limit", `Auto-pick is resting: this month's ${plan.articlesPerMonth} articles are done (${plan.name} plan).`);
    return false;
  }
  const budget = await aiBudgetLeft();
  if (budget < needed + 6) {
    await saveState({ ...state, doneDate: today });
    await notify(today, "budget", `Auto-pick skipped today: only ${budget} AI requests left in today's budget.`);
    return false;
  }
  const left = await writerRequestsLeft();
  if (left < needed) {
    await saveState({ ...state, doneDate: today });
    await notify(today, "quota", `Auto-pick skipped today: only ${left} writer requests left, and it needs ${needed} to finish an article.`);
    return false;
  }

  const [requireApproval, profile] = await Promise.all([approvalRequired(), approvedResearchProfile()]);
  const topic = chooseTopic(topics, posts, config.minScore, facts.map((fact) => fact.subject), requireApproval, profile?.topicGroups ?? []);
  if (!topic) {
    const next = (state.scored?.length ?? 0) < config.maxScoringPerDay ? nextToScore(topics, state.scored ?? []) : null;
    if (next) {
      await saveState({ ...state, scored: [...(state.scored ?? []), next.id] });
      await enqueue("score_topic", { topicId: next.id });
      return true;
    }
    await saveState({ ...state, doneDate: today });
    await notify(
      today,
      "no-idea",
      requireApproval
        ? `Auto-pick found no approved idea to write. Mark ideas "OK for Auto-pick" on the Ideas page.`
        : `Auto-pick found no idea scoring ${config.minScore}+ that doesn't overlap existing content.`,
    );
    return false;
  }

  const scheduleFor = istSlot(date, schedule.publishAt);
  await enqueue("write_brief", { topicId: topic.id, auto: true, scheduleFor });
  await saveState({ ...state, doneDate: today });
  await notify(today, "picked", `Auto-pick scheduled "${topic.query}" for ${date}. Remove its date before then if you don't want it.`, topic.id);
  return true;
}
