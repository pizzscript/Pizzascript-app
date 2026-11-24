import { Suspense } from "react";
import { ClientsView } from "@/components/studio/ClientsView";
import { RoomSkeleton } from "@/components/studio/RoomSkeleton";
import { loadClientsOverview } from "@/lib/studio/server";
import { getStudio } from "@/lib/studio/session";

export const metadata = { title: "Clients" };

async function Clients() {
  const { studio } = await getStudio();
  const clients = await loadClientsOverview(studio);
  return <ClientsView clients={clients} currentId={studio.workspace.id} />;
}

export default function ClientsPage() {
  return (
    <Suspense fallback={<RoomSkeleton />}>
      <Clients />
    </Suspense>
  );
}
