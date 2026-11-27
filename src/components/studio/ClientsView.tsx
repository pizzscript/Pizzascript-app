"use client";

import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { createClientWorkspace, deleteClient, inviteClientUser, removeClientUser, saveClientProfile, setClientStatus, switchClient, updateClient, type NewClient } from "@/app/clients";
import { MODULES, PLAN_PRESETS, planOf, type ModuleId, type ResearchLevel } from "@/lib/studio/plans";
import type { ClientOverview } from "@/lib/studio/server";
import { DEFAULT_WORKSPACE } from "@/lib/studio/workspace-scope";
import { useStudio } from "./StudioProvider";
import { PageHead } from "./ui";
import { ResearchProfileView } from "./ResearchProfileView";

const APPROVAL_LABEL = { owner: "You approve each article", client: "The client approves", automatic: "Publish automatically when checks pass" } as const;
const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 39);

function Meter({ used, limit, label }: { used: number; limit: number; label: string }) {
  const pct = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  return (
    <div className="text-[13px]">
      <div className="flex justify-between gap-2">
        <span className="s-dim">{label}</span>
        <span className="font-mono">
          {used}
          {limit ? ` / ${limit}` : " (no cap)"}
        </span>
      </div>
      {limit > 0 && (
        <div className="h-1.5 rounded bg-[var(--s-line)] mt-1" aria-hidden="true">
          <div className="h-1.5 rounded" style={{ width: `${pct}%`, background: pct >= 100 ? "#e5484d" : pct >= 80 ? "#f5a524" : "#30a46c" }} />
        </div>
      )}
    </div>
  );
}

function NewClientForm({ onDone }: { onDone: () => void }) {
  const { run, busy, preview } = useStudio();
  const router = useRouter();
  const [form, setForm] = useState<NewClient>({ name: "", slug: "", siteUrl: "https://", location: "", language: "en", approvalMode: "owner", preset: "starter" });
  const [slugEdited, setSlugEdited] = useState(false);
  const set = <K extends keyof NewClient>(key: K, value: NewClient[K]) => setForm((f) => ({ ...f, [key]: value }));
  return (
    <form
      className="card card-body space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        run(`${form.name} added`, async () => {
          await createClientWorkspace(form);
          onDone();
          router.refresh();
        });
      }}
    >
      <h2 className="section-title">New client</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1">
          <span className="s-dim text-[13px]">Business name</span>
          <input className="s-input w-full" required value={form.name} onChange={(e) => (set("name", e.target.value), !slugEdited && set("slug", slugify(e.target.value)))} />
        </label>
        <label className="space-y-1">
          <span className="s-dim text-[13px]">Short name (used in links, can&apos;t change later)</span>
          <input className="s-input w-full font-mono" required pattern="[a-z0-9][a-z0-9-]{1,38}" value={form.slug} onChange={(e) => (setSlugEdited(true), set("slug", slugify(e.target.value)))} />
        </label>
        <label className="space-y-1">
          <span className="s-dim text-[13px]">Website address</span>
          <input className="s-input w-full" required type="url" pattern="https://.+" value={form.siteUrl} onChange={(e) => set("siteUrl", e.target.value)} />
        </label>
        <label className="space-y-1">
          <span className="s-dim text-[13px]">City and country</span>
          <input className="s-input w-full" placeholder="Austin, USA" value={form.location} onChange={(e) => set("location", e.target.value)} />
        </label>
        <label className="space-y-1">
          <span className="s-dim text-[13px]">Approval</span>
          <select className="s-input w-full" value={form.approvalMode} onChange={(e) => set("approvalMode", e.target.value as NewClient["approvalMode"])}>
            {Object.entries(APPROVAL_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="s-dim text-[13px]">Plan</span>
          <select className="s-input w-full" value={form.preset} onChange={(e) => set("preset", e.target.value as NewClient["preset"])}>
            {(["starter", "growth", "pro"] as const).map((p) => (
              <option key={p} value={p}>
                {PLAN_PRESETS[p].name}: {PLAN_PRESETS[p].articlesPerMonth} articles a month, {PLAN_PRESETS[p].modules.length} modules
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="s-dim text-[13px]">Language</span>
          <input className="s-input w-full" value={form.language} onChange={(e) => set("language", e.target.value)} />
        </label>
      </div>
      <p className="s-faint text-[13px]">New clients start with Autopilot and Auto-pick off, so nothing is written or published until you switch them on.</p>
      <div className="flex gap-2">
        <button className="s-btn s-btn--primary" disabled={busy || preview}>
          Add client
        </button>
        <button type="button" className="s-btn" onClick={onDone}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function PlanEditor({ client }: { client: ClientOverview }) {
  const { run, busy, preview } = useStudio();
  const isDefault = client.workspace.id === DEFAULT_WORKSPACE;
  const current = planOf(client.workspace.plan, isDefault);
  const [plan, setPlan] = useState(current);
  const toggle = (id: ModuleId) => setPlan((p) => ({ ...p, modules: p.modules.includes(id) ? p.modules.filter((m) => m !== id) : [...p.modules, id] }));
  const num = (key: "articlesPerMonth" | "aiRequestsPerDay" | "crawlPages" | "competitors", label: string, hint: string) => (
    <label className="space-y-1">
      <span className="s-dim text-[13px]">{label}</span>
      <input className="s-input w-full" type="number" min={0} value={plan[key]} onChange={(e) => setPlan((p) => ({ ...p, [key]: Number(e.target.value) }))} />
      <span className="s-faint text-[12px]">{hint}</span>
    </label>
  );
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="section-title">Plan and limits</h3>
        {!isDefault && (
          <div className="flex gap-1">
            {(["starter", "growth", "pro"] as const).map((p) => (
              <button key={p} type="button" className="s-btn s-btn--sm" onClick={() => setPlan(PLAN_PRESETS[p])}>
                Use {PLAN_PRESETS[p].name}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {num("articlesPerMonth", "Articles a month", isDefault ? "PizzaScript's own blog is never stopped by this." : "Writing stops for the month when it's reached.")}
        {num("aiRequestsPerDay", "AI requests a day", isDefault ? "0 = no cap." : "Jobs wait until tomorrow when it's spent.")}
        {num("crawlPages", "Pages per site-health crawl", "Weekly crawl size.")}
        {num("competitors", "Competitors tracked", "")}
        <label className="space-y-1">
          <span className="s-dim text-[13px]">Idea research</span>
          <select className="s-input w-full" value={plan.researchLevel} onChange={(e) => setPlan((p) => ({ ...p, researchLevel: e.target.value as ResearchLevel }))}>
            <option value="full">Daily</option>
            <option value="light">Twice a week</option>
            <option value="off">Off</option>
          </select>
        </label>
      </div>
      {!isDefault && (
        <fieldset className="grid gap-2 sm:grid-cols-2">
          <legend className="s-dim text-[13px] mb-1">Modules</legend>
          {MODULES.map((m) => (
            <label key={m.id} className="flex items-start gap-2 text-[14px]">
              <input type="checkbox" className="mt-1" checked={plan.modules.includes(m.id)} onChange={() => toggle(m.id)} />
              <span>
                {m.label}
                <span className="block s-faint text-[12px]">{m.help}</span>
              </span>
            </label>
          ))}
        </fieldset>
      )}
      <button
        type="button"
        className="s-btn s-btn--primary s-btn--sm"
        disabled={busy || preview}
        onClick={() => run("Plan saved", () => updateClient(client.workspace.id, { plan: isDefault ? { ...plan, modules: undefined } : plan }))}
      >
        Save plan
      </button>
    </section>
  );
}

const PROFILE_FIELDS = [
  { key: "description", label: "What the business does", hint: 'Shown to the AI as "the content system for …". Example: a licensed plumbing company in Austin, Texas' },
  { key: "researchDescription", label: "What research should know", hint: "Services and customers, in one sentence." },
  { key: "market", label: "Readers", hint: "Example: homeowners in Austin first, then the rest of Texas." },
  { key: "voiceRule", label: "Voice", hint: 'Example: Write as the business itself ("we"), friendly and direct.' },
  { key: "trendFocus", label: "Trend focus (optional)", hint: "What news matters to them. Leave blank to skip trend scanning." },
  { key: "articleUrl", label: "Article address (optional)", hint: "Only if their site doesn't use the embed's ?article= addresses. Example: https://their-site.com/blog/{slug}" },
] as const;

function ProfileEditor({ client }: { client: ClientOverview }) {
  const { run, busy, preview } = useStudio();
  const [values, setValues] = useState<Record<string, string>>(Object.fromEntries(PROFILE_FIELDS.map((f) => [f.key, String(client.profile[f.key] ?? "")])));
  return (
    <section className="space-y-3">
      <h3 className="section-title">How the agent describes this client</h3>
      {PROFILE_FIELDS.map((f) => (
        <label key={f.key} className="block space-y-1">
          <span className="s-dim text-[13px]">{f.label}</span>
          <input className="s-input w-full" value={values[f.key]} onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))} />
          <span className="s-faint text-[12px]">{f.hint}</span>
        </label>
      ))}
      <button
        type="button"
        className="s-btn s-btn--primary s-btn--sm"
        disabled={busy || preview}
        onClick={() => run("Profile saved", () => saveClientProfile(client.workspace.id, { ...values, shortDescription: values.description }))}
      >
        Save profile
      </button>
    </section>
  );
}

function DetailsEditor({ client }: { client: ClientOverview }) {
  const { run, busy, preview } = useStudio();
  const w = client.workspace;
  const [d, setD] = useState({ name: w.name, siteUrl: w.site_url, location: w.location ?? "", language: w.language, approvalMode: w.approval_mode });
  return (
    <section className="space-y-3">
      <h3 className="section-title">Details</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1">
          <span className="s-dim text-[13px]">Name</span>
          <input className="s-input w-full" value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} />
        </label>
        <label className="space-y-1">
          <span className="s-dim text-[13px]">Website address</span>
          <input className="s-input w-full" value={d.siteUrl} onChange={(e) => setD({ ...d, siteUrl: e.target.value })} />
        </label>
        <label className="space-y-1">
          <span className="s-dim text-[13px]">City and country</span>
          <input className="s-input w-full" value={d.location} onChange={(e) => setD({ ...d, location: e.target.value })} />
        </label>
        <label className="space-y-1">
          <span className="s-dim text-[13px]">Approval</span>
          <select className="s-input w-full" value={d.approvalMode} onChange={(e) => setD({ ...d, approvalMode: e.target.value as typeof d.approvalMode })}>
            {Object.entries(APPROVAL_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
      </div>
      <button type="button" className="s-btn s-btn--primary s-btn--sm" disabled={busy || preview} onClick={() => run("Details saved", () => updateClient(w.id, d))}>
        Save details
      </button>
    </section>
  );
}

function SetupChecklist({ client }: { client: ClientOverview }) {
  const [copied, setCopied] = useState<string | null>(null);
  const w = client.workspace;
  // The app's own address, read only in the browser so the server and browser render the same first.
  const app = useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => "",
  );
  const embed = `<div id="ps-blog"></div>\n<script src="${app}/embed/blog.js" data-client="${w.slug}" defer></script>`;
  const server = `// On your server (best for Google): fetch the article list or one article, then render it as HTML.\nconst list = await fetch("${app}/api/feed/${w.slug}").then((r) => r.json());\nconst one = await fetch("${app}/api/feed/${w.slug}?slug=ARTICLE-SLUG").then((r) => r.json());`;
  const copy = (key: string, text: string) => {
    void navigator.clipboard.writeText(text);
    setCopied(key);
  };
  const steps: [boolean, string, string][] = [
    [client.setup.profile, "Describe the business", "Profile tab: research profile and how the agent describes the client."],
    [client.setup.searchConsole, "Connect Search Console", "Switch to this client, then Settings → Connections → Search Console property."],
    [client.setup.live > 0, "Put the articles on their site", "Paste the embed code on their blog page (below)."],
    [client.setup.competitors, "Add competitors", "Links & local → Competitors."],
    [client.setup.local, "Add business details", "Links & local → Business details (for local SEO)."],
    [client.setup.crawled, "First site check", "Site health → Check now."],
    [client.setup.autopilot, "Switch on Autopilot", "Automation, when you're happy with the setup."],
  ];
  return (
    <section className="space-y-3">
      <h3 className="section-title">
        Setup · {steps.filter((s) => s[0]).length} of {steps.length} done
      </h3>
      <ol className="space-y-1 text-[14px]">
        {steps.map(([done, title, how]) => (
          <li key={title} className="flex gap-2">
            <span aria-hidden="true">{done ? "✓" : "○"}</span>
            <span>
              <span className={done ? "s-dim line-through" : "font-medium"}>{title}</span>
              {!done && <span className="s-faint block text-[12px]">{how}</span>}
            </span>
          </li>
        ))}
      </ol>
      {w.id !== DEFAULT_WORKSPACE && (
        <div className="space-y-2">
          <div className="s-dim text-[13px]">Embed code for their blog page (articles show at ?article=…):</div>
          <pre className="s-input w-full font-mono text-[12px] whitespace-pre-wrap">{embed}</pre>
          <div className="flex gap-2">
            <button type="button" className="s-btn s-btn--sm" onClick={() => copy("embed", embed)}>
              {copied === "embed" ? "Copied" : "Copy embed code"}
            </button>
            <button type="button" className="s-btn s-btn--sm" onClick={() => copy("server", server)}>
              {copied === "server" ? "Copied" : "Copy server snippet (better for Google)"}
            </button>
          </div>
          <div className="s-faint text-[12px]">Sitemap for their Search Console: {app}/api/feed/{w.slug}/sitemap</div>
        </div>
      )}
    </section>
  );
}

function Access({ client }: { client: ClientOverview }) {
  const { run, busy, preview } = useStudio();
  const [email, setEmail] = useState("");
  const w = client.workspace;
  if (w.id === DEFAULT_WORKSPACE) return null;
  return (
    <section className="space-y-2">
      <h3 className="section-title">Client access</h3>
      <p className="s-dim text-[13px]">People you add can sign in at /portal with an emailed link to see reports{w.approval_mode === "client" ? " and approve their articles" : ""}.</p>
      <ul className="text-[14px] space-y-1">
        {client.members.map((m) => (
          <li key={m.email} className="flex items-center justify-between gap-2">
            <span>
              {m.email} <span className="s-faint">· {m.role === "client_viewer" ? "client" : m.role}</span>
            </span>
            {m.role === "client_viewer" && (
              <button type="button" className="s-btn s-btn--sm" disabled={busy || preview} onClick={() => run("Access removed", () => removeClientUser(w.id, m.email))}>
                Remove
              </button>
            )}
          </li>
        ))}
      </ul>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          run(`Invited ${email}`, async () => {
            await inviteClientUser(w.id, email);
            setEmail("");
          });
        }}
      >
        <input className="s-input flex-1" type="email" placeholder="client@their-company.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        <button className="s-btn s-btn--sm s-btn--primary" disabled={busy || preview || !email}>
          Invite
        </button>
      </form>
    </section>
  );
}

function Lifecycle({ client }: { client: ClientOverview }) {
  const { run, busy, preview } = useStudio();
  const router = useRouter();
  const w = client.workspace;
  const [confirm, setConfirm] = useState("");
  const [password, setPassword] = useState("");
  if (w.id === DEFAULT_WORKSPACE) {
    return (
      <section className="space-y-2">
        <h3 className="section-title">Data</h3>
        <a className="s-btn s-btn--sm" href={`/export/${w.id}`}>
          Export all data (JSON)
        </a>
      </section>
    );
  }
  return (
    <section className="space-y-3">
      <h3 className="section-title">Status and data</h3>
      <div className="flex flex-wrap gap-2">
        {w.status !== "active" && (
          <button type="button" className="s-btn s-btn--sm" disabled={busy || preview} onClick={() => run("Client resumed", () => setClientStatus(w.id, "active"))}>
            Resume
          </button>
        )}
        {w.status === "active" && (
          <button type="button" className="s-btn s-btn--sm" disabled={busy || preview} onClick={() => run("Client paused", () => setClientStatus(w.id, "paused"))}>
            Pause (all work waits)
          </button>
        )}
        {w.status !== "archived" && (
          <button type="button" className="s-btn s-btn--sm" disabled={busy || preview} onClick={() => run("Client archived", () => setClientStatus(w.id, "archived"))}>
            Archive
          </button>
        )}
        <a className="s-btn s-btn--sm" href={`/export/${w.id}`}>
          Export all data (JSON)
        </a>
      </div>
      {w.status === "archived" && (
        <form
          className="space-y-2 border-t s-line pt-3"
          onSubmit={(e) => {
            e.preventDefault();
            run(`${w.name} deleted`, async () => {
              await deleteClient(w.id, confirm, password);
              router.refresh();
            });
          }}
        >
          <p className="text-[14px]">
            Delete <strong>{w.name}</strong> and everything it owns: articles, ideas, keys, banners and history. This can&apos;t be undone, so export first.
          </p>
          <input className="s-input w-full font-mono" placeholder={`Type ${w.slug} to confirm`} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          <input className="s-input w-full" type="password" placeholder="Your admin password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          <button className="s-btn s-btn--sm" style={{ color: "#e5484d" }} disabled={busy || preview || confirm !== w.slug || !password}>
            Delete permanently
          </button>
        </form>
      )}
    </section>
  );
}

const CLIENT_TABS = [
  { id: "overview", label: "Overview" },
  { id: "profile", label: "Profile" },
  { id: "plan", label: "Plan and limits" },
  { id: "access", label: "Access and data" },
] as const;
type ClientTab = (typeof CLIENT_TABS)[number]["id"];

export function ClientsView({ clients, currentId, initialTab }: { clients: ClientOverview[]; currentId: string; initialTab?: string }) {
  const { run, busy, preview } = useStudio();
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [openId, setOpenId] = useState(currentId);
  const [tab, setTab] = useState<ClientTab>(CLIENT_TABS.find((t) => t.id === initialTab)?.id ?? "overview");
  const open = clients.find((c) => c.workspace.id === openId);
  return (
    <div className="space-y-6">
      <PageHead title="Clients" sub="Each client has its own ideas, articles, keys, limits and reports. The switcher at the top left chooses which one the other pages show.">
        {!adding && (
          <button type="button" className="s-btn s-btn--primary" disabled={preview} onClick={() => setAdding(true)}>
            New client
          </button>
        )}
      </PageHead>
      {adding && <NewClientForm onDone={() => setAdding(false)} />}
      <ul className="grid gap-3 md:grid-cols-2">
        {clients.map((c) => {
          const plan = planOf(c.workspace.plan, c.workspace.id === DEFAULT_WORKSPACE);
          return (
            <li key={c.workspace.id} className="card card-body space-y-3" aria-current={c.workspace.id === currentId ? "true" : undefined}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium truncate">{c.workspace.name}</div>
                  <a className="s-faint text-[13px] truncate block" href={c.workspace.site_url} target="_blank" rel="noopener noreferrer">
                    {c.workspace.site_url.replace(/^https:\/\//, "")}
                  </a>
                </div>
                <span className={`s-chip ${c.workspace.status === "active" ? "s-chip--ok" : "s-chip--warn"}`}>{c.workspace.status}</span>
              </div>
              <div className="s-dim text-[13px]">
                {plan.name} · {APPROVAL_LABEL[c.workspace.approval_mode]}
              </div>
              <Meter label="Articles this month" used={c.usage.articles} limit={plan.articlesPerMonth} />
              <Meter label="AI requests today" used={c.usage.aiToday} limit={plan.aiRequestsPerDay} />
              <div className="flex gap-2">
                {c.workspace.id !== currentId && c.workspace.status !== "archived" && (
                  <button
                    type="button"
                    className="s-btn s-btn--sm"
                    disabled={busy || preview}
                    onClick={() =>
                      run(`Working on ${c.workspace.name}`, async () => {
                        await switchClient(c.workspace.id);
                        router.push("/");
                      })
                    }
                  >
                    Work on this client
                  </button>
                )}
                <button type="button" className="s-btn s-btn--sm" aria-expanded={openId === c.workspace.id} onClick={() => setOpenId(c.workspace.id)}>
                  Open
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      {open && (
        <section className="card" key={open.workspace.id} aria-labelledby="client-detail-title">
          <div className="px-5 pt-5">
            <h2 id="client-detail-title" className="section-title">
              {open.workspace.name}
            </h2>
            <div role="tablist" aria-label={`${open.workspace.name} settings`} className="s-tabs mt-3 overflow-x-auto">
              {CLIENT_TABS.map((t) => (
                <button key={t.id} type="button" role="tab" id={`client-tab-${t.id}`} aria-selected={tab === t.id} aria-controls="client-panel" className="s-tab whitespace-nowrap" onClick={() => setTab(t.id)}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div id="client-panel" role="tabpanel" aria-labelledby={`client-tab-${tab}`} className="card-body space-y-8">
            {tab === "overview" && (
              <>
                <SetupChecklist client={open} />
                <DetailsEditor client={open} />
              </>
            )}
            {tab === "profile" && (
              <>
                <ResearchProfileView key={`research-${open.research.draft?.analysedAt ?? ""}-${open.research.approved?.version ?? ""}`} client={open} />
                <div className="border-t s-line pt-8">
                  <ProfileEditor client={open} />
                </div>
              </>
            )}
            {tab === "plan" && <PlanEditor client={open} />}
            {tab === "access" && (
              <>
                <Access client={open} />
                <Lifecycle client={open} />
              </>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
