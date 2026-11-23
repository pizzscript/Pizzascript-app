import { AUTO_PICK_DEFAULTS, chooseTopic, istSlot, nextOpenDate, nextToScore, type AutoPickSettings, type AutoPickState } from "../../src/lib/studio/autopick";
import { MODEL_CHAINS, MODEL_LIMITS, quotaDayStart, type AgentState } from "../../src/lib/studio/models";
import type { StudioPost } from "../../src/lib/studio/types";
import { allFacts, allPosts, allTopics, check, db, enqueue, raiseSignal, setting, settings, todayIst } from "../db";

const BUSY_JOBS = ["daily_briefing", "score_topic", "write_brief", "write_draft", "generate_image", "run_audit"];
const PIPELINE_JOBS = ["write_brief", "write_draft", "generate_image", "run_audit"];

const saveState = async (state: AutoPickState) => check(await db.from("settings").upsert({ key: "autopick_state", value: state }), "autopick state");

const pickedAt = (post: StudioPost) => (post.seo_plan?.autoPicked as { at?: string } | undefined)?.at ?? "";

async function notify(today: string, key: string, title: string, topicId: string | null = null, priority: "P1" | "P2" = "P2") {
  await raiseSignal({ kind: "quality_gate", title, detail: { source: "auto-pick" }, priority, post_id: null, topic_id: topicId, dedupe_key: `autopick:${today}:${key}` });
}

async function writerRequestsLeft() {
  const since = new Date(quotaDayStart()).toISOString();
  const { data } = await db.from("ai_calls").select("model").gte("created_at", since).in("model", MODEL_CHAINS.writer);
  return MODEL_CHAINS.writer.reduce((left, model) => left + Math.max(0, MODEL_LIMITS[model].rpd - (data ?? []).filter((call) => call.model === model).length), 0);
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
  const failed = (post: StudioPost) => failedIds.has(post.id) || post.audit?.ok === false;
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
  const left = await writerRequestsLeft();
  if (left < needed) {
    await saveState({ ...state, doneDate: today });
    await notify(today, "quota", `Auto-pick skipped today: only ${left} writer requests left, and it needs ${needed} to finish an article.`);
    return false;
  }

  const topic = chooseTopic(topics, posts, config.minScore, facts.map((fact) => fact.subject));
  if (!topic) {
    const next = (state.scored?.length ?? 0) < config.maxScoringPerDay ? nextToScore(topics, state.scored ?? []) : null;
    if (next) {
      await saveState({ ...state, scored: [...(state.scored ?? []), next.id] });
      await enqueue("score_topic", { topicId: next.id });
      return true;
    }
    await saveState({ ...state, doneDate: today });
    await notify(today, "no-idea", `Auto-pick found no idea scoring ${config.minScore}+ that doesn't overlap existing content.`);
    return false;
  }

  const scheduleFor = istSlot(date, schedule.publishAt);
  await enqueue("write_brief", { topicId: topic.id, auto: true, scheduleFor });
  await saveState({ ...state, doneDate: today });
  await notify(today, "picked", `Auto-pick scheduled "${topic.query}" for ${date}. Remove its date before then if you don't want it.`, topic.id);
  return true;
}
