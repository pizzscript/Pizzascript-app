import { Suspense } from "react";
import { LinksView, type LinksData } from "@/components/studio/LinksView";
import { RoomSkeleton } from "@/components/studio/RoomSkeleton";
import { getStudio } from "@/lib/studio/session";

export const metadata = { title: "Links & local" };

async function Links() {
  const { studio } = await getStudio();
  let data: LinksData = { opportunities: [], backlinks: [], competitors: [], competitorPages: [], local: {}, localPosts: [] };
  if (studio.mode === "live") {
    const [opportunities, backlinks, settings, competitorPages, localPosts] = await Promise.all([
      studio.db.from("link_opportunities").select("*").in("status", ["new", "sent", "won"]).order("created_at", { ascending: false }).limit(60),
      studio.db.from("backlinks").select("source_url,target_url,anchor,first_seen,lost_at").order("first_seen", { ascending: false }).limit(300),
      studio.db.from("settings").select("key,value").in("key", ["competitors", "local_profile"]),
      studio.db.from("competitor_pages").select("competitor,url,title,first_seen").order("first_seen", { ascending: false }).limit(40),
      studio.db.from("local_posts").select("created_at,status,detail").order("created_at", { ascending: false }).limit(10),
    ]);
    const setting = (key: string) => ((settings.data ?? []) as { key: string; value: unknown }[]).find((s) => s.key === key)?.value;
    data = {
      opportunities: (opportunities.data ?? []) as LinksData["opportunities"],
      backlinks: (backlinks.data ?? []) as LinksData["backlinks"],
      competitors: (setting("competitors") as string[] | undefined) ?? [],
      competitorPages: (competitorPages.data ?? []) as LinksData["competitorPages"],
      local: (setting("local_profile") as LinksData["local"] | undefined) ?? {},
      localPosts: (localPosts.data ?? []) as LinksData["localPosts"],
    };
  }
  return <LinksView data={data} />;
}

export default function LinksPage() {
  return (
    <Suspense fallback={<RoomSkeleton />}>
      <Links />
    </Suspense>
  );
}
