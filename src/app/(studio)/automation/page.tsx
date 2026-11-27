import { Suspense } from "react";
import { AutomationView } from "@/components/studio/AutomationView";
import { RoomSkeleton } from "@/components/studio/RoomSkeleton";
import { loadClientsOverview } from "@/lib/studio/server";
import { getStudio } from "@/lib/studio/session";

export const metadata = { title: "Automation" };

async function Automation() {
  const { studio, data } = await getStudio();
  const clients = await loadClientsOverview(studio);
  const current = clients.find((c) => c.workspace.id === studio.workspace.id);
  return (
    <AutomationView
      autopilot={data.autopilot}
      autoPick={data.autoPick}
      research={data.research}
      batches={data.batches}
      profileApproved={Boolean(current?.research.approved)}
    />
  );
}

export default function AutomationPage() {
  return (
    <Suspense fallback={<RoomSkeleton />}>
      <Automation />
    </Suspense>
  );
}
