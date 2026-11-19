"use client";

/* eslint-disable @next/next/no-img-element -- banners come from Supabase Storage at arbitrary sizes. */
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronRight, Code2, ExternalLink, ImagePlus, RefreshCw, Sparkles, WandSparkles } from "lucide-react";
import { approvePost, enqueue, restoreVersion, saveBody, slotPost, updatePost, updateTaxonomy } from "@/app/admin/actions";
import { istDate } from "@/lib/studio/briefing";
import { wordCount } from "@/lib/studio/content";
import type { AgentMessage, Audit, Cluster, Fact, PostVersion, RewritePayload, StudioPost, Topic } from "@/lib/studio/types";
import { AgentThread } from "./AgentThread";
import { useStudio } from "./StudioProvider";
import { SeoBadge, StatusBadge, formatDate } from "./ui";

const JOB_LABEL = { write_brief: "Brief", write_draft: "Draft", generate_image: "Banner", run_audit: "Audit" } as const;

interface Section {
  index: number;
  heading: string | null;
  html: string;
}

interface Props {
  post: StudioPost;
  sections: Section[];
  topic: Topic | null;
  clusters: Cluster[];
  audit: Audit | null;
  links: { path: string; present: boolean; service: boolean }[];
  versions: PostVersion[];
  facts: Fact[];
  messages: AgentMessage[];
  wordRange: [number, number];
}

export function PostEditor({ post, sections, topic, clusters, audit, links, versions, facts, messages, wordRange }: Props) {
  const { run, busy, pending } = useStudio();
  const articleRef = useRef<HTMLDivElement>(null);
  const [selection, setSelection] = useState<{ text: string; x: number; y: number } | null>(null);
  const [sectionPrompt, setSectionPrompt] = useState<number | null>(null);
  const [instruction, setInstruction] = useState("");
  const [rawMode, setRawMode] = useState(false);
  const [raw, setRaw] = useState(post.body_html);
  const [viewing, setViewing] = useState<PostVersion | null>(null);
  const [meta, setMeta] = useState({
    title: post.title,
    seo_title: post.seo_title ?? "",
    seo_description: post.seo_description ?? "",
    excerpt: post.excerpt,
    image_prompt: post.image_prompt ?? "",
    cover_image_alt: post.cover_image_alt ?? "",
  });
  const [taxonomy, setTaxonomy] = useState({ clusterId: post.cluster_id ?? "", tags: post.tags.join(", ") });
  const metaDirty = (Object.keys(meta) as (keyof typeof meta)[]).some((k) => meta[k] !== ((post[k] as string | null) ?? ""));
  const taxonomyDirty = taxonomy.clusterId !== (post.cluster_id ?? "") || taxonomy.tags !== post.tags.join(", ");

  const rewriting = pending.some((p) => p.label === "Rewrite");
  const words = wordCount(post.body_html);
  const failing = audit?.checks.filter((c) => !c.pass) ?? [];

  const rewrite = (payload: Omit<RewritePayload, "postId">) => run("Rewrite", () => enqueue("rewrite", { postId: post.id, ...payload }));

  const onMouseUp = useCallback(() => {
    const sel = window.getSelection();
    const text = sel?.toString().trim() ?? "";
    if (!sel || text.length < 12 || !articleRef.current?.contains(sel.anchorNode)) return;
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    setSelection({ text, x: Math.max(16, Math.min(rect.left, window.innerWidth - 400)), y: rect.bottom + 8 });
    setInstruction("");
  }, []);

  useEffect(() => {
    const close = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setSelection(null);
      setSectionPrompt(null);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);

  const nextStep =
    post.stage === "brief"
      ? post.brief.angle
        ? ({ type: "write_draft", label: "Write draft" } as const)
        : ({ type: "write_brief", label: "Write brief" } as const)
      : post.stage === "draft"
        ? ({ type: "generate_image", label: "Generate banner" } as const)
        : post.stage === "image"
          ? ({ type: "run_audit", label: "Run SEO check" } as const)
          : null;

  return (
    <div>
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 s-faint text-[13px] mb-3">
        <Link href="/admin/posts" className="hover:text-[var(--s-text)]">
          Posts
        </Link>
        <ChevronRight size={14} aria-hidden="true" />
        <span className="truncate max-w-[60ch] s-dim" aria-current="page">
          {post.title}
        </span>
      </nav>

      <div className="page-head !mb-6">
        <div className="flex items-center gap-3">
          <StatusBadge stage={post.stage} />
          <SeoBadge audit={audit} />
          <span className="s-faint text-[13px]">Version {post.version}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {post.body_html && (
            <button type="button" className="s-btn" onClick={() => setRawMode((m) => !m)} aria-pressed={rawMode}>
              <Code2 size={16} aria-hidden="true" /> {rawMode ? "Visual" : "HTML"}
            </button>
          )}
          {post.stage === "live" && (
            <a href={`/blog/${post.slug}`} target="_blank" rel="noopener noreferrer" className="s-btn">
              <ExternalLink size={16} aria-hidden="true" /> View live
            </a>
          )}
          {nextStep && (
            <button
              type="button"
              className="s-btn s-btn--primary"
              disabled={busy}
              onClick={() => run(JOB_LABEL[nextStep.type], () => enqueue(nextStep.type, { postId: post.id, topicId: post.topic_id ?? undefined }))}
            >
              <WandSparkles size={16} aria-hidden="true" /> {nextStep.label}
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0">
          <div className="card overflow-hidden mb-6">
            <div className="relative aspect-[21/9] grid place-items-center" style={{ background: "var(--s-raised)" }}>
              {post.cover_image_url ? (
                <img src={post.cover_image_url} alt={post.cover_image_alt ?? ""} className="absolute inset-0 w-full h-full object-cover" />
              ) : (
                <p className="s-faint px-6 text-center max-w-md text-[13px]">
                  {post.image_prompt ? "Banner prompt ready — generate it below." : "No banner yet. The agent writes a prompt with the draft."}
                </p>
              )}
            </div>
          </div>

          <h1 className="sr-only">Edit post: {post.title}</h1>
          <label className="sr-only" htmlFor="post-title">
            Title
          </label>
          <input
            id="post-title"
            value={meta.title}
            onChange={(e) => setMeta((m) => ({ ...m, title: e.target.value }))}
            className="w-full bg-transparent s-serif text-[32px] leading-tight outline-none"
          />
          <p className="s-faint text-[13px] mt-1 mb-8">
            /blog/{post.slug} · {words} words{" "}
            <span className={words && (words < wordRange[0] * 0.85 || words > wordRange[1] * 1.15) ? "text-[var(--s-warn)]" : ""}>
              (target {wordRange[0]}–{wordRange[1]})
            </span>
            {metaDirty && " · unsaved changes"}
          </p>

          {viewing && (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg px-4 py-3" style={{ background: "var(--s-accent-soft)" }}>
              <span>
                Viewing version {viewing.version} — {viewing.note ?? viewing.author}
              </span>
              <span className="flex gap-2">
                <button type="button" className="s-btn s-btn--primary s-btn--sm" onClick={() => run(`Restored version ${viewing.version}`, async () => { await restoreVersion(post.id, viewing.id); setViewing(null); })}>
                  Restore this version
                </button>
                <button type="button" className="s-btn s-btn--sm" onClick={() => setViewing(null)}>
                  Back to current
                </button>
              </span>
            </div>
          )}

          {!post.body_html ? (
            <BriefCard post={post} topic={topic} />
          ) : rawMode ? (
            <div className="space-y-3">
              <textarea className="s-input s-mono !text-[12px] min-h-[60vh]" value={raw} onChange={(e) => setRaw(e.target.value)} aria-label="Article HTML" spellCheck={false} />
              <button type="button" className="s-btn s-btn--primary" disabled={busy || raw === post.body_html} onClick={() => run("Saved", () => saveBody(post.id, raw, "Manual edit"))}>
                Save changes
              </button>
            </div>
          ) : viewing ? (
            <div className="prose-blog" dangerouslySetInnerHTML={{ __html: viewing.body_html }} />
          ) : (
            <div ref={articleRef} onMouseUp={onMouseUp} className="prose-blog pr-12">
              {sections.map((section) => (
                <div key={section.index} className="s-section" data-busy={rewriting}>
                  <div dangerouslySetInnerHTML={{ __html: section.html }} />
                  <div className="s-section-tools">
                    <button
                      type="button"
                      className="s-btn s-btn--icon s-btn--ghost"
                      title="Rewrite this section"
                      aria-label={`Rewrite section: ${section.heading ?? "introduction"}`}
                      onClick={() => rewrite({ scope: "section", section: section.index, instruction: "Rewrite this section with a sharper angle; keep facts and links." })}
                    >
                      <RefreshCw size={15} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className="s-btn s-btn--icon s-btn--ghost"
                      title="Ask AI to change this section"
                      aria-label={`Ask AI about section: ${section.heading ?? "introduction"}`}
                      onClick={() => {
                        setSectionPrompt(section.index);
                        setInstruction("");
                      }}
                    >
                      <Sparkles size={15} aria-hidden="true" />
                    </button>
                  </div>
                  {sectionPrompt === section.index && (
                    <PromptBox
                      label={`Change "${section.heading ?? "introduction"}"`}
                      value={instruction}
                      onChange={setInstruction}
                      onCancel={() => setSectionPrompt(null)}
                      onSubmit={() => {
                        rewrite({ scope: "section", section: section.index, instruction });
                        setSectionPrompt(null);
                      }}
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          {post.body_html && !rawMode && !viewing && (
            <form
              className="sticky bottom-4 mt-10 flex gap-2 rounded-xl border s-line p-2 shadow-[0_12px_40px_rgba(0,0,0,0.45)]"
              style={{ background: "var(--s-raised)" }}
              onSubmit={(e) => {
                e.preventDefault();
                const input = e.currentTarget.elements.namedItem("article-prompt") as HTMLInputElement;
                if (!input.value.trim()) return;
                rewrite({ scope: "article", instruction: input.value });
                e.currentTarget.reset();
              }}
            >
              <Sparkles size={18} className="self-center ml-2 text-[var(--s-accent)] flex-none" aria-hidden="true" />
              <input name="article-prompt" className="s-input !border-0 !bg-transparent !shadow-none" placeholder="Ask AI to change the whole post — e.g. shorter, more code examples, friendlier for clients" aria-label="Ask AI to change the whole post" />
              <button type="submit" className="s-btn s-btn--primary" disabled={busy}>
                Apply
              </button>
            </form>
          )}
          {post.body_html && !viewing && <p className="s-faint text-[12px] mt-2">Tip: select any text in the post to rewrite just that part.</p>}

          {selection && (
            <div className="s-float" style={{ left: selection.x, top: selection.y }}>
              <p className="s-faint text-[12px] px-1 pb-1 truncate">&ldquo;{selection.text.slice(0, 80)}&rdquo;</p>
              <PromptBox
                label="Change selected text"
                value={instruction}
                onChange={setInstruction}
                onCancel={() => setSelection(null)}
                onSubmit={() => {
                  rewrite({ scope: "selection", selection: selection.text, instruction });
                  setSelection(null);
                }}
              />
            </div>
          )}
        </div>

        <aside aria-label="Post settings" className="xl:sticky xl:top-[84px] xl:max-h-[calc(100vh-100px)] xl:overflow-y-auto">
          <div className="card px-5">
            <Panel title="Publish" open>
              {post.stage === "live" ? (
                <p className="s-dim">Published {formatDate(post.published_at)}</p>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label htmlFor="publish-date" className="s-label">
                      Publish date (09:00 IST)
                    </label>
                    <input
                      id="publish-date"
                      type="date"
                      className="s-input"
                      defaultValue={post.scheduled_for ? istDate(post.scheduled_for) : ""}
                      onChange={(e) => e.target.value && run(`Scheduled for ${e.target.value}`, () => slotPost(post.id, e.target.value))}
                    />
                  </div>
                  <button
                    type="button"
                    className={`s-btn w-full ${post.approved_at ? "" : "s-btn--primary"}`}
                    disabled={!post.approved_at && !(audit?.ok ?? false)}
                    onClick={() => run(post.approved_at ? "Approval removed" : "Approved", () => approvePost(post.id, !post.approved_at))}
                  >
                    {post.approved_at ? "Approved ✓ — click to undo" : "Approve for publishing"}
                  </button>
                  <p className="s-hint">{audit?.ok ? "Approved posts publish automatically on their date." : "Approval unlocks once the SEO check passes."}</p>
                </div>
              )}
            </Panel>

            <Panel title="Category & tags">
              <div className="space-y-3">
                <div>
                  <label htmlFor="post-category" className="s-label">
                    Category
                  </label>
                  <select id="post-category" className="s-input" value={taxonomy.clusterId} onChange={(e) => setTaxonomy((t) => ({ ...t, clusterId: e.target.value }))}>
                    <option value="">Uncategorised</option>
                    {clusters.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="post-tags" className="s-label">
                    Tags
                  </label>
                  <input id="post-tags" className="s-input" value={taxonomy.tags} onChange={(e) => setTaxonomy((t) => ({ ...t, tags: e.target.value }))} placeholder="react, performance" />
                  <p className="s-hint">Separate with commas.</p>
                </div>
                <button
                  type="button"
                  className="s-btn s-btn--sm"
                  disabled={!taxonomyDirty || busy}
                  onClick={() => run("Saved", () => updateTaxonomy(post.id, { clusterId: taxonomy.clusterId || null, tags: taxonomy.tags.split(",") }))}
                >
                  Save
                </button>
              </div>
            </Panel>

            <Panel title="SEO" badge={audit ? <SeoBadge audit={audit} /> : null} open={failing.length > 0}>
              <div className="space-y-3">
                <Field label="SEO title" value={meta.seo_title} max={60} onChange={(v) => setMeta((m) => ({ ...m, seo_title: v }))} />
                <Field label="Meta description" value={meta.seo_description} min={120} max={160} multiline onChange={(v) => setMeta((m) => ({ ...m, seo_description: v }))} />
                <Field label="Excerpt" value={meta.excerpt} multiline onChange={(v) => setMeta((m) => ({ ...m, excerpt: v }))} />
                {audit && (
                  <ul className="space-y-1.5 pt-2">
                    {audit.checks.map((c) => (
                      <li key={c.id} className={`flex gap-2 text-[13px] ${c.pass ? "s-dim" : "text-[var(--s-bad)]"}`}>
                        <span aria-hidden="true">{c.pass ? "✓" : "✕"}</span>
                        <span>
                          {c.label}
                          {c.detail && <span className="s-faint"> · {c.detail}</span>}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                {post.body_html && (
                  <button type="button" className="s-btn s-btn--sm" onClick={() => run("Audit", () => enqueue("run_audit", { postId: post.id }))}>
                    Re-run SEO check
                  </button>
                )}
              </div>
            </Panel>

            <Panel title="Links" badge={links.some((l) => !l.present) && post.body_html ? <span className="s-chip s-chip--bad">{links.filter((l) => !l.present).length} missing</span> : null}>
              {links.length === 0 ? (
                <p className="s-faint">No required links.</p>
              ) : (
                <ul className="space-y-2">
                  {links.map((l) => (
                    <li key={l.path} className="flex items-center justify-between gap-2 text-[13px]">
                      <span className={`truncate ${l.present ? "s-dim" : post.body_html ? "text-[var(--s-bad)]" : "s-faint"}`}>
                        {l.present ? "✓" : post.body_html ? "✕" : "·"} {l.path}
                      </span>
                      {!l.present && post.body_html && (
                        <button type="button" className="s-btn s-btn--sm" onClick={() => run("Link", () => enqueue("insert_link", { fromSlug: post.slug, toPath: l.path }))}>
                          Add
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel title="Banner image">
              <div className="space-y-3">
                <Field label="Alt text" value={meta.cover_image_alt} multiline onChange={(v) => setMeta((m) => ({ ...m, cover_image_alt: v }))} />
                <Field label="Image prompt" value={meta.image_prompt} multiline onChange={(v) => setMeta((m) => ({ ...m, image_prompt: v }))} />
                <button
                  type="button"
                  className="s-btn s-btn--sm"
                  disabled={busy || !post.body_html}
                  onClick={() => run("Banner", () => enqueue("generate_image", { postId: post.id, prompt: meta.image_prompt || undefined }))}
                >
                  <ImagePlus size={15} aria-hidden="true" /> {post.cover_image_url ? "Regenerate banner" : "Generate banner"}
                </button>
              </div>
            </Panel>

            {versions.length > 0 && (
              <Panel title={`Versions (${versions.length})`}>
                <ol className="space-y-1">
                  {versions.map((v) => (
                    <li key={v.id}>
                      <button type="button" className="w-full text-left flex justify-between gap-2 py-1 text-[13px] hover:text-[var(--s-accent)]" onClick={() => setViewing(v)}>
                        <span className="truncate">
                          v{v.version} · {v.note ?? v.author}
                        </span>
                        <span className="s-faint whitespace-nowrap">{formatDate(v.created_at, true)}</span>
                      </button>
                    </li>
                  ))}
                </ol>
              </Panel>
            )}

            <Panel title="Facts the AI can use">
              {facts.length === 0 ? (
                <p className="s-faint text-[13px]">
                  None verified yet, so the AI won&apos;t quote any numbers.{" "}
                  <Link href="/admin/settings?tab=facts" className="underline">
                    Verify facts
                  </Link>
                </p>
              ) : (
                <ul className="space-y-1.5 s-dim text-[13px]">
                  {facts.map((f) => (
                    <li key={f.id}>
                      <span className="s-faint">{f.subject}:</span> {f.statement}
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel title="Notes & AI chat">
              <AgentThread thread={`post:${post.id}`} messages={messages} placeholder="Ask about this post…" />
            </Panel>
          </div>
          {metaDirty && (
            <button type="button" className="s-btn s-btn--primary w-full mt-3" disabled={busy} onClick={() => run("Saved", () => updatePost(post.id, meta))}>
              Save title & SEO changes
            </button>
          )}
        </aside>
      </div>
    </div>
  );
}

function Panel({ title, badge, open, children }: { title: string; badge?: React.ReactNode; open?: boolean; children: React.ReactNode }) {
  return (
    <details className="s-panel first:border-t-0" open={open}>
      <summary>
        <span className="flex items-center gap-2">
          {title} {badge}
        </span>
      </summary>
      <div>{children}</div>
    </details>
  );
}

function Field({ label, value, onChange, max, min, multiline }: { label: string; value: string; onChange: (value: string) => void; max?: number; min?: number; multiline?: boolean }) {
  const off = (max !== undefined && value.length > max) || (min !== undefined && value.length > 0 && value.length < min);
  return (
    <label className="block">
      <span className="flex justify-between s-label">
        <span>{label}</span>
        {max && (
          <span className={off ? "text-[var(--s-warn)]" : "s-faint"}>
            {value.length}/{max}
          </span>
        )}
      </span>
      {multiline ? (
        <textarea className="s-input min-h-[72px]" value={value} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input className="s-input" value={value} onChange={(e) => onChange(e.target.value)} />
      )}
    </label>
  );
}

function PromptBox({ label, value, onChange, onSubmit, onCancel }: { label: string; value: string; onChange: (v: string) => void; onSubmit: () => void; onCancel: () => void }) {
  return (
    <form
      className="flex gap-2 my-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (value.trim()) onSubmit();
      }}
    >
      <input autoFocus className="s-input" value={value} onChange={(e) => onChange(e.target.value)} placeholder="What should change?" aria-label={label} />
      <button type="submit" className="s-btn s-btn--primary" disabled={!value.trim()}>
        Apply
      </button>
      <button type="button" className="s-btn s-btn--ghost" onClick={onCancel}>
        Cancel
      </button>
    </form>
  );
}

function BriefCard({ post, topic }: { post: StudioPost; topic: Topic | null }) {
  const b = post.brief;
  return (
    <div className="card card-body space-y-4">
      {b.angle ? (
        <>
          <p className="s-faint text-[12px] font-medium uppercase tracking-wide">Brief</p>
          <p className="text-[17px] leading-relaxed">{b.angle}</p>
          {b.outline && (
            <ol className="list-decimal pl-5 space-y-1 s-dim">
              {b.outline.map((o) => (
                <li key={o}>{o}</li>
              ))}
            </ol>
          )}
          <p className="s-dim text-[13px]">Click <strong>Write draft</strong> above to have the AI write the full post.</p>
        </>
      ) : (
        <>
          <p className="font-medium">This post hasn&apos;t been started.</p>
          <p className="s-dim">
            Target search: <span className="text-[var(--s-text)]">{post.seo_plan.targetQuery ?? topic?.query}</span>. Click <strong>Write brief</strong> and the AI will plan the angle, outline and links.
          </p>
        </>
      )}
      {(b.servicePage || (b.linksTo?.length ?? 0) > 0) && (
        <p className="s-faint text-[13px]">Will link to: {[...(b.linksTo ?? []), b.servicePage].filter(Boolean).join(", ")}</p>
      )}
    </div>
  );
}
