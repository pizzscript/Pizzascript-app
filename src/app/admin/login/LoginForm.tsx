"use client";

import { useActionState } from "react";
import { signInWithPassword } from "./actions";

const ERRORS: Record<string, string> = {
  forbidden: "That account isn't an admin.",
  link: "That sign-in link expired. Request a new one.",
  "not-configured": "Supabase isn't configured yet.",
};

export function LoginForm({ error }: { error?: string }) {
  const [state, action, pending] = useActionState(signInWithPassword, null);
  const message = state?.message ?? (error ? ERRORS[error] : null);

  return (
    <form action={action} className="w-full max-w-[320px] space-y-3">
      <label htmlFor="email" className="sr-only">
        Email
      </label>
      <input
        id="email"
        name="email"
        type="email"
        required
        autoComplete="email"
        autoFocus
        placeholder="you@pizzascript.com"
        className="s-input h-10"
      />
      <label htmlFor="password" className="sr-only">
        Password
      </label>
      <input id="password" name="password" type="password" required autoComplete="current-password" placeholder="Password" className="s-input h-10" />
      <button type="submit" className="s-btn s-btn--primary w-full h-10 justify-center" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
      <p role="status" className={`s-mono min-h-5 ${state?.ok ? "s-dim" : "text-[var(--s-bad)]"}`}>
        {message}
      </p>
    </form>
  );
}
