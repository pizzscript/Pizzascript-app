import { Suspense } from "react";
import { CalendarView } from "@/components/studio/CalendarView";
import { RoomSkeleton } from "@/components/studio/RoomSkeleton";
import { todayIst } from "@/lib/studio/server";
import { getStudio } from "@/lib/studio/session";

export const metadata = { title: "Calendar" };

async function Calendar() {
  const { data } = await getStudio();
  const batch = data.batches.find((b) => data.posts.some((p) => p.batch_id === b.id && p.stage !== "live")) ?? null;
  return <CalendarView posts={data.posts} batch={batch} today={todayIst()} />;
}

export default function CalendarPage() {
  return (
    <Suspense fallback={<RoomSkeleton />}>
      <Calendar />
    </Suspense>
  );
}
