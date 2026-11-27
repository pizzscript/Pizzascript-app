import { Suspense } from "react";
import { BusinessProfileView, type GbpPost, type GbpReview } from "@/components/studio/BusinessProfileView";
import { RoomSkeleton } from "@/components/studio/RoomSkeleton";
import { loadConnections } from "@/lib/studio/connections-server";
import { hasModule, planOf } from "@/lib/studio/plans";
import { getStudio } from "@/lib/studio/session";
import { DEFAULT_WORKSPACE } from "@/lib/studio/workspace-scope";

export const metadata = { title: "Business Profile" };

async function BusinessProfile() {
  const { studio, data } = await getStudio();
  const plan = planOf(studio.workspace.plan, studio.workspace.id === DEFAULT_WORKSPACE);
  const connections = await loadConnections(studio);
  const connected = ["gbp_oauth_json", "gbp_location"].every((name) => connections.find((c) => c.name === name)?.source !== "none");
  let posts: GbpPost[] = [];
  let reviews: GbpReview[] = [];
  if (studio.mode === "live") {
    const [p, r] = await Promise.all([
      studio.db.from("local_posts").select("id,post_id,source,status,summary,photo_url,cta_type,cta_url,detail,remote_name,attempts,created_at,posted_at").order("created_at", { ascending: false }).limit(60),
      studio.db.from("gbp_reviews").select("name,reviewer,stars,comment,review_time,reply,reply_time,draft_reply,reply_status,reply_error").order("review_time", { ascending: false }).limit(60),
    ]);
    const titles = new Map(data.posts.map((x) => [x.id, { title: x.title, cover: x.cover_image_url }]));
    posts = ((p.data ?? []) as Omit<GbpPost, "article">[]).map((x) => ({ ...x, article: x.post_id ? (titles.get(x.post_id) ?? null) : null }));
    reviews = (r.data ?? []) as GbpReview[];
  }
  return <BusinessProfileView posts={posts} reviews={reviews} connected={connected} moduleOn={hasModule(plan, "local")} preview={studio.mode === "preview"} />;
}

export default function BusinessProfilePage() {
  return (
    <Suspense fallback={<RoomSkeleton />}>
      <BusinessProfile />
    </Suspense>
  );
}
