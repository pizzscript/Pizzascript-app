"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { jobStatuses } from "@/app/admin/actions";
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
}

interface StudioContextValue {
  preview: boolean;
  pending: Tracked[];
  /** Runs a server action; string results are treated as job ids and tracked until done. */
  run: (label: string, fn: () => Promise<unknown>, job?: { type: JobType; postId?: string }) => Promise<void>;
  busy: boolean;
  toast: (text: string, tone?: Toast["tone"]) => void;
}

const StudioContext = createContext<StudioContextValue | null>(null);



export function StudioProvider({ preview, activeJobs = [], children }: { preview: boolean; activeJobs?: Tracked[]; children: React.ReactNode }) {
  const router = useRouter();
  const [pending, setPending] = useState<Tracked[]>(activeJobs);
  // Jobs the server reports as queued/running (after a reload, or started by the schedule) join the tracked list.
  const activeKey = activeJobs.map((j) => j.id).join(",");
  const [seenKey, setSeenKey] = useState(activeKey);
  if (activeKey !== seenKey) {
    setSeenKey(activeKey);
    setPending((p) => [...p, ...activeJobs.filter((j) => !p.some((x) => x.id === j.id))]);
  }
  const [toasts, setToasts] = useState<Toast[]>([]);
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

  useEffect(() => {
    if (pending.length === 0) return;
    const timer = setInterval(async () => {
      const statuses = await jobStatuses(pending.map((p) => p.id)).catch(() => []);
      const finished = statuses.filter((s) => s.status === "done" || s.status === "failed");
      if (finished.length === 0) return;
      for (const job of finished) {
        const name = jobLabel(job.type);
        toast(job.status === "done" ? `${name} ready` : `${name} failed: ${friendlyJobError(job.error)}`, job.status === "done" ? "ok" : "bad");
      }
      setPending((p) => p.filter((x) => !finished.some((f) => f.id === x.id)));
      router.refresh();
    }, 2000);
    return () => clearInterval(timer);
  }, [pending, router, toast]);

  const value = useMemo(() => ({ preview, pending, run, busy, toast }), [preview, pending, run, busy, toast]);

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
