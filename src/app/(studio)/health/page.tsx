import { Suspense } from "react";
import { RoomSkeleton } from "@/components/studio/RoomSkeleton";
import { SiteHealthView, type HealthData } from "@/components/studio/SiteHealthView";
import { getStudio } from "@/lib/studio/session";

export const metadata = { title: "Site health" };

/** 30 days back, as an ISO time (kept outside the component; render functions must stay pure). */
const monthAgo = () => new Date(Date.now() - 30 * 86_400_000).toISOString();

async function Health() {
  const { studio } = await getStudio();
  let data: HealthData = { runs: [], issues: [], fixed: [], site: studio.workspace.site_url, metrics: [], inspections: [] };
  if (studio.mode === "live") {
    const since = monthAgo();
    const [runs, issues, fixed, metrics, inspections] = await Promise.all([
      studio.db.from("crawl_runs").select("id,started_at,finished_at,status,pages,score,summary").order("started_at", { ascending: false }).limit(8),
      studio.db.from("crawl_issues").select("url,type,detail,first_seen,last_seen").is("fixed_at", null).order("first_seen", { ascending: false }).limit(2000),
      studio.db.from("crawl_issues").select("url,type,fixed_at").gte("fixed_at", since).order("fixed_at", { ascending: false }).limit(200),
      // Speed and indexing (Phases 5–6); empty until those tables exist.
      studio.db.from("metrics_daily").select("date,url,metric,value").gte("date", since.slice(0, 10)).in("metric", ["performance", "lcp", "cls", "inp"]).limit(5000),
      studio.db.from("url_inspections").select("url,indexed,coverage,checked_at").order("checked_at", { ascending: false }).limit(200),
    ]);
    data = {
      runs: (runs.data ?? []) as HealthData["runs"],
      issues: (issues.data ?? []) as HealthData["issues"],
      fixed: (fixed.data ?? []) as HealthData["fixed"],
      site: studio.workspace.site_url,
      metrics: (metrics.data ?? []) as HealthData["metrics"],
      inspections: (inspections.data ?? []) as HealthData["inspections"],
    };
  }
  return <SiteHealthView data={data} />;
}

export default function HealthPage() {
  return (
    <Suspense fallback={<RoomSkeleton />}>
      <Health />
    </Suspense>
  );
}
