import { Suspense } from "react";
import { ClientsView } from "@/components/studio/ClientsView";
import { RoomSkeleton } from "@/components/studio/RoomSkeleton";
import { loadClientsOverview } from "@/lib/studio/server";
import { getStudio } from "@/lib/studio/session";

export const metadata = { title: "Clients" };

async function Clients({ searchParams }: { searchParams: PageProps<"/clients">["searchParams"] }) {
  const [{ studio }, params] = await Promise.all([getStudio(), searchParams]);
  const clients = await loadClientsOverview(studio);
  return <ClientsView clients={clients} currentId={studio.workspace.id} initialTab={typeof params.tab === "string" ? params.tab : undefined} />;
}

export default function ClientsPage(props: PageProps<"/clients">) {
  return (
    <Suspense fallback={<RoomSkeleton />}>
      <Clients searchParams={props.searchParams} />
    </Suspense>
  );
}
