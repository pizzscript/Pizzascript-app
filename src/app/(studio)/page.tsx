import { Suspense } from "react";
import { DashboardView } from "@/components/studio/DashboardView";
import { RoomSkeleton } from "@/components/studio/RoomSkeleton";
import { SystemHealth, SystemHealthSkeleton } from "@/components/studio/SystemHealth";
import { composeBriefing, istDate } from "@/lib/studio/briefing";
import { todayIst } from "@/lib/studio/server";
import { getStudio } from "@/lib/studio/session";

export const metadata = { title: "Dashboard" };

async function Dashboard() {
  const { data } = await getStudio();
  const date = todayIst();
  const briefing = data.briefing ?? composeBriefing(date, data);
  const slotted = data.posts
    .filter((p) => p.stage !== "live" && p.scheduled_for)
    .sort((a, b) => a.scheduled_for!.localeCompare(b.scheduled_for!));
  const today = slotted.find((p) => istDate(p.scheduled_for!) === date) ?? null;

  return (
    <DashboardView
      date={date}
      briefing={briefing}
      signals={data.signals}
      today={today}
      upcoming={slotted.filter((p) => p !== today).slice(0, 6)}
      autopilot={data.autopilot}
      health={
        <Suspense fallback={<SystemHealthSkeleton />}>
          <SystemHealth />
        </Suspense>
      }
      messages={data.messages.filter((m) => m.thread === `briefing:${date}`)}
      stats={{
        live: data.posts.filter((p) => p.stage === "live").length,
        drafts: data.posts.filter((p) => p.stage !== "live" && p.stage !== "slotted").length,
        scheduled: slotted.length,
        ideas: data.topics.filter((t) => t.status === "candidate").length,
      }}
    />
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<RoomSkeleton />}>
      <Dashboard />
    </Suspense>
  );
}
