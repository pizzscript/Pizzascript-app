import { Suspense } from "react";
import { MonthlyReportView } from "@/components/report/MonthlyReportView";
import { buildReport, lastMonth } from "@/lib/studio/report";
import { requireAdmin } from "@/lib/studio/server";
import { EmptyState, PageHead } from "@/components/studio/ui";
import { PrintButton } from "./PrintButton";

export const metadata = { title: "Monthly report" };

async function ReportPage({ searchParams }: { searchParams: PageProps<"/report">["searchParams"] }) {
  const studio = await requireAdmin();
  const params = await searchParams;
  const month = typeof params.month === "string" && /^\d{4}-\d{2}$/.test(params.month) ? params.month : lastMonth();
  if (studio.mode === "preview")
    return (
      <>
        <PageHead title="Monthly report" sub="Clicks, rankings, site health and articles for one month, ready to share with the client." />
        <EmptyState title="No report in preview">Connect Supabase to build reports from real data.</EmptyState>
      </>
    );
  return <MonthlyReportView r={await buildReport(studio, month)} actions={<PrintButton />} />;
}

export default function Page(props: PageProps<"/report">) {
  return (
    <Suspense fallback={<div className="report">Preparing the report…</div>}>
      <ReportPage searchParams={props.searchParams} />
    </Suspense>
  );
}
