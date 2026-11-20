import { Suspense } from "react";
import { CalendarView } from "@/components/studio/CalendarView";
import { RoomSkeleton } from "@/components/studio/RoomSkeleton";
import { todayIst } from "@/lib/studio/server";
import { getStudio } from "@/lib/studio/session";

export const metadata = { title: "Calendar" };

async function Calendar() {
  const { data } = await getStudio();
  return <CalendarView posts={data.posts} autopilot={data.autopilot} today={todayIst()} />;
}

export default function CalendarPage() {
  return (
    <Suspense fallback={<RoomSkeleton />}>
      <Calendar />
    </Suspense>
  );
}
