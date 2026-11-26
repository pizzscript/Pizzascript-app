import { Suspense } from "react";
import { RoomSkeleton } from "@/components/studio/RoomSkeleton";
import { SettingsView } from "@/components/studio/SettingsView";
import { loadConnections } from "@/lib/studio/connections-server";
import { getStudio } from "@/lib/studio/session";

export const metadata = { title: "Settings" };

async function Settings({ searchParams }: { searchParams: PageProps<"/settings">["searchParams"] }) {
  const [{ studio, data }, params] = await Promise.all([getStudio(), searchParams]);
  const connections = await loadConnections(studio);
  return (
    <SettingsView
      initialTab={typeof params.tab === "string" ? params.tab : "schedule"}
      schedule={data.schedule}
      scoring={data.scoring}
      bannedPhrases={data.bannedPhrases}
      wordRanges={data.wordRanges}
      facts={data.facts}
      batches={data.batches}
      email={studio.mode === "live" ? studio.email : null}
      autopilot={data.autopilot}
      autoPick={data.autoPick}
      research={data.research}
      connections={connections}
      aiUsage={data.aiUsage}
    />
  );
}

export default function SettingsPage(props: PageProps<"/settings">) {
  return (
    <Suspense fallback={<RoomSkeleton />}>
      <Settings searchParams={props.searchParams} />
    </Suspense>
  );
}
