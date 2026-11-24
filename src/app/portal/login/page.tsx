import { Suspense } from "react";
import { PortalLoginForm } from "./PortalLoginForm";

export const metadata = { title: "Client sign-in", robots: { index: false, follow: false } };

const ERRORS: Record<string, string> = {
  "no-access": "This email isn't invited to any site yet. Ask your agency to add you.",
  link: "That sign-in link has expired. Send a new one.",
  "not-configured": "The portal isn't set up yet.",
};

async function Message({ searchParams }: { searchParams: PageProps<"/portal/login">["searchParams"] }) {
  const error = (await searchParams).error;
  return typeof error === "string" && ERRORS[error] ? <p className="s-chip s-chip--warn">{ERRORS[error]}</p> : null;
}

export default function PortalLogin(props: PageProps<"/portal/login">) {
  return (
    <main className="max-w-sm mx-auto px-4 py-20 space-y-4">
      <h1 className="text-2xl font-semibold">Your SEO reports</h1>
      <p className="s-dim">Enter your email and we&apos;ll send you a sign-in link.</p>
      <Suspense fallback={null}>
        <Message searchParams={props.searchParams} />
      </Suspense>
      <PortalLoginForm />
    </main>
  );
}
