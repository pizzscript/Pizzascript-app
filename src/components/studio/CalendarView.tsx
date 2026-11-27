"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { slotPost } from "@/app/actions";
import { istDate } from "@/lib/studio/briefing";
import type { StudioPost } from "@/lib/studio/types";
import { AutopilotToggle } from "./AutopilotToggle";
import { useStudio } from "./StudioProvider";
import { PageHead, StatusBadge } from "./ui";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function monthGrid(year: number, month: number) {
  const first = new Date(Date.UTC(year, month, 1));
  const offset = (first.getUTCDay() + 6) % 7;
  const start = new Date(Date.UTC(year, month, 1 - offset));
  return Array.from({ length: 42 }, (_, i) => new Date(start.getTime() + i * 86_400_000).toISOString().slice(0, 10));
}

export function CalendarView({ posts, autopilot, today }: { posts: StudioPost[]; autopilot: boolean; today: string }) {
  const { run } = useStudio();
  const [cursor, setCursor] = useState(() => ({ year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) - 1 }));
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);

  const days = useMemo(() => monthGrid(cursor.year, cursor.month), [cursor]);
  const byDay = useMemo(() => {
    const map = new Map<string, StudioPost[]>();
    for (const p of posts) {
      const iso = p.stage === "live" ? p.published_at : p.scheduled_for;
      if (!iso) continue;
      const key = istDate(iso);
      map.set(key, [...(map.get(key) ?? []), p]);
    }
    return map;
  }, [posts]);
  const unscheduled = posts.filter((p) => p.stage !== "live" && !p.scheduled_for);
  const monthLabel = new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(cursor.year, cursor.month, 1)));

  const shift = (delta: number) =>
    setCursor((c) => {
      const m = c.month + delta;
      return { year: c.year + Math.floor(m / 12), month: ((m % 12) + 12) % 12 };
    });

  const drop = (date: string | null) => {
    const id = dragging;
    setDragging(null);
    setOver(null);
    if (!id) return;
    if (date && date < today) return;
    run(date ? `Moved to ${date}` : "Unscheduled", () => slotPost(id, date));
  };

  return (
    <div>
      <PageHead title="Calendar" sub="One post a day at 09:00 IST. Drag posts to change their date.">
        <AutopilotToggle enabled={autopilot} />
      </PageHead>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
        <section className="card overflow-hidden min-w-0" aria-label={monthLabel}>
          <div className="card-head">
            <h2 className="card-title">{monthLabel}</h2>
            <div className="flex gap-1">
              <button type="button" className="s-btn s-btn--icon s-btn--ghost" aria-label="Previous month" onClick={() => shift(-1)}>
                <ChevronLeft size={18} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="s-btn s-btn--sm s-btn--ghost"
                onClick={() => setCursor({ year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) - 1 })}
              >
                Today
              </button>
              <button type="button" className="s-btn s-btn--icon s-btn--ghost" aria-label="Next month" onClick={() => shift(1)}>
                <ChevronRight size={18} aria-hidden="true" />
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <div className="cal min-w-[760px]">
              {WEEKDAYS.map((d) => (
                <div key={d} className="cal-head">
                  {d}
                </div>
              ))}
              {days.map((day) => {
                const items = byDay.get(day) ?? [];
                const inMonth = Number(day.slice(5, 7)) - 1 === cursor.month;
                const past = day < today;
                const taken = items.some((p) => p.stage !== "live" && p.id !== dragging);
                return (
                  <div
                    key={day}

                    className="cal-day"
                    data-muted={!inMonth}
                    data-today={day === today}
                    data-drop={over === day}
                    onDragOver={(e) => {
                      if (!dragging || past || taken) return;
                      e.preventDefault();
                      setOver(day);
                    }}
                    onDragLeave={() => setOver(null)}
                    onDrop={() => drop(day)}
                  >
                    <span className="cal-num">{Number(day.slice(8))}</span>
                    {items.map((p) => (
                      <Link
                        key={p.id}
                        href={`/posts/${p.id}`}
                        draggable={p.stage !== "live"}
                        onDragStart={() => setDragging(p.id)}
                        onDragEnd={() => setDragging(null)}
                        className={`cal-post c-${p.cluster_id} ${p.stage === "live" ? "opacity-70 !cursor-pointer" : ""}`}
                        title={`${p.title} — ${p.stage === "live" ? "published" : "scheduled"}`}
                      >
                        <span className="line-clamp-3" title={p.title}>{p.title}</span>
                        {p.stage !== "live" && (
                          <span className="block mt-1">
                            <StatusBadge stage={p.stage} />
                          </span>
                        )}
                      </Link>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <aside
          className="card self-start"
          aria-labelledby="unscheduled-title"
          onDragOver={(e) => {
            if (!dragging) return;
            e.preventDefault();
            setOver("unscheduled");
          }}
          onDragLeave={() => setOver(null)}
          onDrop={() => drop(null)}
          style={over === "unscheduled" ? { boxShadow: "inset 0 0 0 1px var(--s-accent)" } : undefined}
        >
          <div className="card-head">
            <h2 id="unscheduled-title" className="card-title">
              Unscheduled <span className="s-faint font-normal">· {unscheduled.length}</span>
            </h2>
          </div>
          {unscheduled.length === 0 ? (
            <p className="card-body s-dim text-[13px]">Every post has a date. Drop a post here to unschedule it.</p>
          ) : (
            <ul className="p-3 space-y-2">
              {unscheduled.map((p) => (
                <li key={p.id}>
                  <Link href={`/posts/${p.id}`} draggable onDragStart={() => setDragging(p.id)} onDragEnd={() => setDragging(null)} className={`cal-post !mt-0 c-${p.cluster_id}`}>
                    {p.title}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </div>
  );
}
