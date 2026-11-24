"use client";

import { useActionState } from "react";
import { sendSignInLink } from "../actions";

export function PortalLoginForm() {
  const [state, action, pending] = useActionState(sendSignInLink, null);
  return (
    <form action={action} className="space-y-3">
      <label className="block space-y-1">
        <span className="s-dim text-[13px]">Email</span>
        <input className="s-input w-full" type="email" name="email" required autoComplete="email" />
      </label>
      <button className="s-btn s-btn--primary w-full" disabled={pending}>
        {pending ? "Sending…" : "Send sign-in link"}
      </button>
      {state && <p className={state.ok ? "s-dim" : "s-chip s-chip--bad"}>{state.message}</p>}
    </form>
  );
}
