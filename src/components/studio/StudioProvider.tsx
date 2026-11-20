"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { activeJobs, jobStatuses } from "@/app/admin/actions";
import { friendlyJobError, jobLabel } from "@/lib/studio/jobs";
import type { JobType } from "@/lib/studio/types";

interface Toast {
  id: number;
  text: string;
  tone: "info" | "ok" | "bad";
}

export interface Tracked {
  id: string;
  label: string;
  /** Set for agent jobs so buttons can show their own progress (e.g. "Writing draft…"). */
  type?: JobType;
  postId?: string;
  /** "running" now, or "queued" waiting its turn. */
  status?: "queued" | "running";
  /** Post title or idea the job is for, shown in the agent activity panel. */
  subject?: string;
}

interface StudioContextValue {
  preview: boolean;
  pending: Tracked[];
  /** Runs a server action; string results are treated as job ids and tracked until done. */
  run: (label: string, fn: () => Promise<unknown>, job?: { type: JobType; postId?: string }) => Promise<void>;
  busy: boolean;
  /** Agent health from the activity poll: failures in the last 24h, minutes the oldest due job has waited. */
  health: { failed24h: number; oldestWaitMin: number };
  toast: (text: string, tone?: Toast["tone"]) => void;
}

const StudioContext = createContext<StudioContextValue | null>(null);



export function StudioProvider({ preview, initialJobs = [], children }: { preview: boolean; initialJobs?: Tracked[]; children: React.ReactNode }) {
  const router = useRouter();
  const [pending, setPending] = useState<Tracked[]>(initialJobs);
  // Jobs the server reports as queued/running (after a reload, or started by the schedule) join the tracked list.
  const activeKey = initialJobs.map((j) => j.id).join(",");
  const [seenKey, setSeenKey] = useState(activeKey);
  if (activeKey !== seenKey) {
    setSeenKey(activeKey);
    setPending((p) => [...p, ...initialJobs.filter((j) => !p.some((x) => x.id === j.id))]);
  }
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [health, setHealth] = useState({ failed24h: 0, oldestWaitMin: 0 });
  const [busy, startTransition] = useTransition();
  const nextToast = useRef(0);

  const toast = useCallback((text: string, tone: Toast["tone"] = "info") => {
    const id = ++nextToast.current;
    setToasts((t) => [...t, { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === "bad" ? 7000 : 4000);
  }, []);

  const run = useCallback(
    (label: string, fn: () => Promise<unknown>, job?: { type: JobType; postId?: string }) =>
      new Promise<void>((resolve) => {
        if (preview) {
          toast("Preview mode — connect Supabase to make changes.", "bad");
          resolve();
          return;
        }
        startTransition(async () => {
          try {
            const result = await fn();
            if (typeof result === "string") setPending((p) => [...p, { id: result, label, ...job }]);
            else toast(label, "ok");
          } catch (error) {
            toast(error instanceof Error ? error.message : "Something went wrong", "bad");
          }
          resolve();
        });
      }),
    [preview, toast],
  );

  // Keeps the agent activity list current — including work autopilot or the schedule started in the background —
  // and announces jobs as they finish. Polls quickly while something is going on, slowly when idle.
  const pendingRef = useRef(pending);
  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);
  useEffect(() => {
    if (preview) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        const { jobs: active, health: h } = await activeJobs();
        const gone = pendingRef.current.filter((p) => !active.some((a) => a.id === p.id));
        if (gone.length) {
          const statuses = await jobStatuses(gone.map((g) => g.id)).catch(() => []);
          for (const job of statuses.filter((s) => s.status === "done" || s.status === "failed")) {
            const name = jobLabel(job.type);
            toast(job.status === "done" ? `${name} ready` : `${name} failed: ${friendlyJobError(job.error)}`, job.status === "done" ? "ok" : "bad");
          }
          router.refresh();
        }
        if (!stopped) {
          setPending(active);
          setHealth(h);
        }
      } catch {
        // Signed out or offline — try again next tick.
      }
      if (!stopped) timer = setTimeout(tick, pendingRef.current.length ? 3000 : 12000);
    };
    timer = setTimeout(tick, 1500);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [preview, router, toast]);

  const value = useMemo(() => ({ preview, pending, run, busy, health, toast }), [preview, pending, run, busy, health, toast]);

  return (
    <StudioContext value={value}>
      {children}
      <div className="s-toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="s-toast"
            style={{ borderColor: t.tone === "bad" ? "var(--s-bad)" : t.tone === "ok" ? "var(--s-line-strong)" : undefined }}
          >
            {t.text}
          </div>
        ))}
      </div>
    </StudioContext>
  );
}

export function useStudio() {
  const ctx = useContext(StudioContext);
  if (!ctx) throw new Error("useStudio must be used inside <StudioProvider>");
  return ctx;
}
