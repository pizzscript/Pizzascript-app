import { Suspense } from "react";
import { CmsShell } from "@/components/studio/CmsShell";
import { StudioProvider } from "@/components/studio/StudioProvider";
import { jobLabel } from "@/lib/studio/jobs";
import { getStudio } from "@/lib/studio/session";
import { verdictFor } from "@/lib/studio/types";

async function Shell({ children }: { children: React.ReactNode }) {
  const { studio, data } = await getStudio();
  const tickets = data.posts.map((p) => ({ id: p.id, title: p.title, slug: p.slug, stage: p.stage }));
  const counts = {
    alerts: data.signals.length,
    ideas: data.topics.filter((t) => t.status === "candidate" && verdictFor(t) === "unresearched").length,
  };
  const initialJobs = data.jobs
    .filter((j) => j.status === "queued" || j.status === "running")
    .map((j) => {
      const postId = typeof j.payload?.postId === "string" ? j.payload.postId : undefined;
      const topicId = typeof j.payload?.topicId === "string" ? j.payload.topicId : undefined;
      return {
        id: j.id,
        label: jobLabel(j.type),
        type: j.type,
        postId,
        status: j.status as "queued" | "running",
        subject: data.posts.find((p) => p.id === postId)?.title ?? data.topics.find((t) => t.id === topicId)?.query,
      };
    });
  return (
    <StudioProvider preview={studio.mode === "preview"} initialJobs={initialJobs}>
      <CmsShell
        tickets={tickets}
        counts={counts}
        email={studio.mode === "live" ? studio.email : null}
        client={{ id: studio.workspace.id, name: studio.workspace.name, status: studio.workspace.status }}
        siteUrl={studio.workspace.site_url}
        clients={studio.workspaces.map((w) => ({ id: w.id, name: w.name, status: w.status }))}
      >
        {children}
      </CmsShell>
    </StudioProvider>
  );
}

export default function StudioLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <Shell>{children}</Shell>
    </Suspense>
  );
}
