import { Suspense } from "react";
import { CategoriesView, type CategoryRow, type LinkProblem } from "@/components/studio/CategoriesView";
import { RoomSkeleton } from "@/components/studio/RoomSkeleton";
import { funnelViolations, internalLinks } from "@/lib/studio/content";
import { getStudio } from "@/lib/studio/session";

export const metadata = { title: "Categories" };

async function Categories() {
  const { data } = await getStudio();
  const rows: CategoryRow[] = data.clusters.map((cluster) => {
    const posts = data.posts.filter((p) => p.cluster_id === cluster.id);
    const live = posts.filter((p) => p.stage === "live");
    const main = live.find((p) => p.role === "pillar") ?? posts.find((p) => p.role === "pillar");
    return {
      cluster,
      live: live.length,
      inProgress: posts.length - live.length,
      mainArticle: main ? { id: main.id, title: main.title } : null,
      trafficShare: live.length ? Math.round((live.filter((p) => p.track === 1).length / live.length) * 100) : 0,
    };
  });

  const problems: LinkProblem[] = [];
  for (const post of data.posts.filter((p) => p.body_html)) {
    for (const issue of funnelViolations(post, data.posts)) {
      problems.push({ postId: post.id, postTitle: post.title, fromSlug: post.slug, issue });
    }
    const present = new Set(internalLinks(post.body_html).map((l) => l.href));
    for (const plan of data.linkPlan.filter((l) => l.from_slug === post.slug && l.status === "planned" && !present.has(l.to_path))) {
      problems.push({ postId: post.id, postTitle: post.title, fromSlug: post.slug, issue: `Missing planned link to ${plan.to_path}`, toPath: plan.to_path });
    }
  }

  return <CategoriesView rows={rows} problems={problems} />;
}

export default function CategoriesPage() {
  return (
    <Suspense fallback={<RoomSkeleton />}>
      <Categories />
    </Suspense>
  );
}
