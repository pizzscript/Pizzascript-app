"use client";

import { useState } from "react";
import { checkConnection, clearConnection, saveConnection } from "@/app/admin/connections";
import type { ConnectionView } from "@/lib/studio/connections-server";
import { useStudio } from "./StudioProvider";

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" }) : null);

function Status({ c }: { c: ConnectionView }) {
  const expiring = c.expiringSoon;
  const tone = c.status === "failing" || expiring ? "#e5484d" : c.status === "ok" ? "#30a46c" : "var(--s-faint)";
  const text = c.status === "failing" ? "Failing" : c.status === "ok" ? "Working" : c.status === "not set" ? "Not set" : "Not checked";
  return (
    <span className="text-[13px] font-medium" style={{ color: tone }}>
      ● {text}
      {expiring ? ` · expires ${fmt(c.expiresAt)}` : ""}
    </span>
  );
}

function Row({ c }: { c: ConnectionView }) {
  const { run, busy, preview } = useStudio();
  const [mode, setMode] = useState<"idle" | "replace" | "clear">("idle");
  const [value, setValue] = useState("");
  const [password, setPassword] = useState("");
  const reset = () => {
    setMode("idle");
    setValue("");
    setPassword("");
  };
  const source = c.source === "admin" ? "Saved here" : c.source === "server" ? "From Render settings" : c.source === "shared" ? "Using PizzaScript's (shared quota)" : "Not set";
  return (
    <li className="py-4 space-y-2">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-medium">{c.label}</div>
          <div className="s-faint text-[13px]">{c.help}</div>
          <div className="text-[13px] mt-1 flex flex-wrap gap-x-3">
            <Status c={c} />
            <span className="s-faint">{source}</span>
            {c.shown && <span className="s-faint font-mono">{c.shown}</span>}
            {c.expiresAt && !c.expiringSoon && <span className="s-faint">expires {fmt(c.expiresAt)}</span>}
          </div>
          {c.detail && <div className="s-faint text-[13px]">{c.detail}{c.checkedAt ? ` · checked ${fmt(c.checkedAt)}` : ""}</div>}
        </div>
        {!preview && mode === "idle" && (
          <div className="flex flex-wrap gap-2">
            {c.source !== "none" && (
              <button type="button" className="s-btn s-btn--sm" disabled={busy} onClick={() => run(`${c.label} checked`, () => checkConnection(c.name))}>
                Test
              </button>
            )}
            <button type="button" className="s-btn s-btn--sm s-btn--primary" disabled={busy} onClick={() => setMode("replace")}>
              {c.source === "none" ? "Add" : "Replace"}
            </button>
            {c.source === "admin" && (
              <button type="button" className="s-btn s-btn--sm" disabled={busy} onClick={() => setMode("clear")}>
                {c.scope === "client" ? "Remove" : "Use shared value"}
              </button>
            )}
          </div>
        )}
      </div>
      {mode !== "idle" && (
        <form
          className="space-y-2"
          onSubmit={(event) => {
            event.preventDefault();
            const action = mode === "replace" ? () => saveConnection(c.name, value, password) : () => clearConnection(c.name, password);
            run(mode === "replace" ? `${c.label} saved` : `${c.label} uses the Render value`, async () => {
              await action();
              reset();
            });
          }}
        >
          {mode === "replace" &&
            (c.kind === "json" ? (
              <textarea className="s-input w-full font-mono text-[12px]" rows={5} placeholder="Paste the whole JSON key file" value={value} onChange={(e) => setValue(e.target.value)} autoComplete="off" spellCheck={false} />
            ) : (
              <input
                className="s-input w-full font-mono"
                type={c.kind === "secret" ? "password" : "text"}
                placeholder={c.kind === "secret" ? "Paste the new key" : "New value"}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                autoComplete="off"
                spellCheck={false}
              />
            ))}
          <input className="s-input w-full" type="password" placeholder="Your admin password, to confirm" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          <p className="s-faint text-[13px]">
            {mode === "replace"
              ? "It's tested first and saved only if it works. The full value is never shown again."
              : c.scope === "client"
                ? "This removes the value saved for this client."
                : "This removes the key saved here; the shared value (or Render's setting) is used again."}
          </p>
          <div className="flex gap-2">
            <button type="submit" className="s-btn s-btn--sm s-btn--primary" disabled={busy || !password || (mode === "replace" && !value.trim())}>
              {mode === "replace" ? "Test and save" : "Confirm"}
            </button>
            <button type="button" className="s-btn s-btn--sm" onClick={reset}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </li>
  );
}

export function ConnectionsPanel({ connections }: { connections: ConnectionView[] }) {
  return <ul className="divide-y divide-[var(--s-line)]">{connections.map((c) => <Row key={c.name} c={c} />)}</ul>;
}
