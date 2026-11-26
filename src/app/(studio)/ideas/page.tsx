import { Suspense } from "react";
import { IdeasView } from "@/components/studio/IdeasView";
import { RoomSkeleton } from "@/components/studio/RoomSkeleton";
import { getStudio } from "@/lib/studio/session";

export const metadata = { title: "Ideas" };

async function Ideas({ searchParams }: { searchParams: PageProps<"/ideas">["searchParams"] }) {
  const [{ data }, params] = await Promise.all([getStudio(), searchParams]);
  return <IdeasView topics={data.topics} clusters={data.clusters} scoring={data.scoring} openNew={params.new === "1"} />;
}

export default function IdeasPage(props: PageProps<"/ideas">) {
  return (
    <Suspense fallback={<RoomSkeleton />}>
      <Ideas searchParams={props.searchParams} />
    </Suspense>
  );
}
