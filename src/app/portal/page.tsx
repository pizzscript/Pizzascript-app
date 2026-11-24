import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireMember } from "@/lib/portal";
import { signOutPortal } from "./actions";

export const metadata = { title: "Your sites" };

async function Sites() {
  const member = await requireMember();
  if (member.workspaces.length === 1) redirect(`/portal/${member.workspaces[0].slug}`);
  return (
    <main className="max-w-2xl mx-auto px-4 py-16 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Your sites</h1>
        <form action={signOutPortal}>
          <button className="s-btn s-btn--sm">Sign out</button>
        </form>
      </div>
      <ul className="space-y-2">
        {member.workspaces.map((w) => (
          <li key={w.id}>
            <Link className="card card-body block" href={`/portal/${w.slug}`}>
              <span className="font-medium">{w.name}</span>
              <span className="s-faint block text-[13px]">{w.site_url.replace(/^https:\/\//, "")}</span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}

export default function PortalHome() {
  return (
    <Suspense fallback={<main className="p-16">Loading…</main>}>
      <Sites />
    </Suspense>
  );
}
