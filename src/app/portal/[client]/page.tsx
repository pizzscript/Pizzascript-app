import { Suspense } from "react";
import Link from "next/link";
import { MonthlyReportView } from "@/components/report/MonthlyReportView";
import { memberWorkspace } from "@/lib/portal";
import { buildReport, lastMonth } from "@/lib/studio/report";
import { signOutPortal } from "../actions";
import { ApproveButton } from "./ApproveButton";

export const metadata = { title: "Your site" };

export function generateStaticParams() {
  return [{ client: "__none__" }];
}

async function ClientHome({ params, searchParams }: PageProps<"/portal/[client]">) {
  const { client } = await params;
  const month = (await searchParams).month;
  const { member, workspace, db } = await memberWorkspace(client);
  const role = member.workspaces.find((w) => w.id === workspace.id)?.role;
  const canApprove = workspace.approval_mode === "client" || (workspace.approval_mode === "owner" && role !== "client_viewer");
  const [{ data: waiting }, report] = await Promise.all([
    db.from("posts").select("id,title,excerpt,scheduled_for,approved_at,audit,stage").in("stage", ["audit", "slotted"]).not("scheduled_for", "is", null).order("scheduled_for"),
    buildReport({ db, workspace }, typeof month === "string" && /^\d{4}-\d{2}$/.test(month) ? month : lastMonth()),
  ]);
  const ready = ((waiting ?? []) as { id: string; title: string; excerpt: string; scheduled_for: string; approved_at: string | null; audit: { ok?: boolean } | null }[]).filter((p) => p.audit?.ok);
  return (
    <div>
      <div className="max-w-[980px] mx-auto px-5 pt-6 flex flex-wrap items-center justify-between gap-2">
        {member.workspaces.length > 1 ? <Link href="/portal" className="s-btn s-btn--sm">All sites</Link> : <span />}
        <form action={signOutPortal}>
          <button className="s-btn s-btn--sm">Sign out</button>
        </form>
      </div>
      {workspace.approval_mode !== "automatic" && ready.length > 0 && (
        <section className="max-w-[980px] mx-auto px-5 pt-6">
          <h2 className="text-[18px] font-semibold mb-2">Upcoming articles</h2>
          <ul className="space-y-2">
            {ready.map((p) => (
              <li key={p.id} className="card card-body flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium">{p.title}</div>
                  <div className="s-faint text-[13px]">Planned for {new Date(p.scheduled_for).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" })}</div>
                  <p className="s-dim text-[14px] mt-1">{p.excerpt}</p>
                </div>
                {canApprove ? <ApproveButton slug={workspace.slug} postId={p.id} approved={Boolean(p.approved_at)} /> : <span className="s-faint text-[13px]">{p.approved_at ? "Approved" : "Waiting for approval"}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
      <MonthlyReportView r={report} />
    </div>
  );
}

export default function PortalClient(props: PageProps<"/portal/[client]">) {
  return (
    <Suspense fallback={<main className="p-16">Loading…</main>}>
      <ClientHome {...props} />
    </Suspense>
  );
}
