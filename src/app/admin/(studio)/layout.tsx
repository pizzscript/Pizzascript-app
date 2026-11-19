import { Suspense } from "react";
import { CmsShell } from "@/components/studio/CmsShell";
import { StudioProvider } from "@/components/studio/StudioProvider";
import { getStudio } from "@/lib/studio/session";
import { verdictFor } from "@/lib/studio/types";

async function Shell({ children }: { children: React.ReactNode }) {
  const { studio, data } = await getStudio();
  const tickets = data.posts.map((p) => ({ id: p.id, title: p.title, slug: p.slug, stage: p.stage }));
  const counts = {
    alerts: data.signals.length,
    ideas: data.topics.filter((t) => t.status === "candidate" && verdictFor(t) === "unresearched").length,
  };
  return (
    <StudioProvider preview={studio.mode === "preview"}>
      <CmsShell tickets={tickets} counts={counts} email={studio.mode === "live" ? studio.email : null}>
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
