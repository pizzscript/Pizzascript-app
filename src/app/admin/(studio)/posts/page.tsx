import { Suspense } from "react";
import { PostsTable } from "@/components/studio/PostsTable";
import { RoomSkeleton } from "@/components/studio/RoomSkeleton";
import { getStudio } from "@/lib/studio/session";

export const metadata = { title: "Posts" };

async function Posts({ searchParams }: { searchParams: PageProps<"/admin/posts">["searchParams"] }) {
  const [{ data }, params] = await Promise.all([getStudio(), searchParams]);
  return <PostsTable posts={data.posts} clusters={data.clusters} initialTab={typeof params.status === "string" ? params.status : "all"} />;
}

export default function PostsPage(props: PageProps<"/admin/posts">) {
  return (
    <Suspense fallback={<RoomSkeleton />}>
      <Posts searchParams={props.searchParams} />
    </Suspense>
  );
}
