"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, RefreshCw, Sparkles, Star } from "lucide-react";
import { createLocalPost, draftReply, saveLocalPost, saveReply, setLocalPost, syncBusinessProfile, type CtaType, type PostInput } from "@/app/business-profile";
import { useStudio } from "./StudioProvider";
import { EmptyState, PageHead, formatDate } from "./ui";

export interface GbpPost {
  id: string;
  post_id: string | null;
  source: "article" | "custom";
  status: "draft" | "queued" | "posted" | "failed" | "skipped" | "deleting" | "deleted";
  summary: string | null;
  photo_url: string | null;
  cta_type: CtaType;
  cta_url: string | null;
  detail: string | null;
  remote_name: string | null;
  attempts: number;
  created_at: string;
  posted_at: string | null;
  article: { title: string; cover: string | null } | null;
}

export interface GbpReview {
  name: string;
  reviewer: string | null;
  stars: number | null;
  comment: string | null;
  review_time: string | null;
  reply: string | null;
  reply_time: string | null;
  draft_reply: string | null;
  reply_status: "none" | "drafting" | "drafted" | "sending" | "sent" | "failed";
  reply_error: string | null;
}

const STATUS: Record<GbpPost["status"], { label: string; tone: string }> = {
  draft: { label: "Draft · posts on the next daily run", tone: "s-chip--info" },
  queued: { label: "Going out on the next sync", tone: "s-chip--accent" },
  posted: { label: "Live on Google", tone: "s-chip--ok" },
  failed: { label: "Failed", tone: "s-chip--bad" },
  skipped: { label: "Skipped", tone: "" },
  deleting: { label: "Being removed", tone: "s-chip--warn" },
  deleted: { label: "Removed", tone: "" },
};

const CTA_LABEL: Record<CtaType, string> = { NONE: "No button", LEARN_MORE: "Learn more", BOOK: "Book", ORDER: "Order online", SHOP: "Buy", SIGN_UP: "Sign up", CALL: "Call now" };

/** The fields of one post, shared by "new post" and editing a draft. */
function PostForm({ initial, submitLabel, onSubmit, onCancel }: { initial: PostInput; submitLabel: string; onSubmit: (v: PostInput) => void; onCancel: () => void }) {
  const [v, setV] = useState(initial);
  const needsLink = v.ctaType !== "NONE" && v.ctaType !== "CALL";
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(v);
      }}
    >
      <label className="block">
        <span className="s-label">Text</span>
        <textarea className="s-input min-h-[120px]" maxLength={1450} value={v.summary} onChange={(e) => setV({ ...v, summary: e.target.value })} />
        <span className="s-hint">{v.summary.trim().length} / 1,450 characters. Don&apos;t put phone numbers in the text; Google rejects them.</span>
      </label>
      <div className="grid gap-3 sm:grid-cols-[180px_minmax(0,1fr)]">
        <label className="block">
          <span className="s-label">Button</span>
          <select className="s-input" value={v.ctaType} onChange={(e) => setV({ ...v, ctaType: e.target.value as CtaType })}>
            {(Object.keys(CTA_LABEL) as CtaType[]).map((c) => (
              <option key={c} value={c}>
                {CTA_LABEL[c]}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="s-label">Button link</span>
          <input className="s-input" placeholder={needsLink ? "https://" : "Not needed for this button"} disabled={!needsLink} value={v.ctaUrl} onChange={(e) => setV({ ...v, ctaUrl: e.target.value })} />
        </label>
      </div>
      <label className="block">
        <span className="s-label">Photo link (optional)</span>
        <input className="s-input" placeholder="https://… (JPG, PNG or WebP; turned into a JPG for Google)" value={v.photoUrl} onChange={(e) => setV({ ...v, photoUrl: e.target.value })} />
      </label>
      <div className="flex gap-2">
        <button type="submit" className="s-btn s-btn--primary s-btn--sm">
          {submitLabel}
        </button>
        <button type="button" className="s-btn s-btn--ghost s-btn--sm" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function PostCard({ post }: { post: GbpPost }) {
  const { run, busy, preview } = useStudio();
  const [editing, setEditing] = useState(false);
  const editable = ["draft", "queued", "failed"].includes(post.status);
  const photo = post.photo_url ?? post.article?.cover ?? null;
  const text = post.summary ?? (post.article ? post.article.title : "");
  const act = (action: Parameters<typeof setLocalPost>[1], label: string) => run(label, () => setLocalPost(post.id, action));

  return (
    <li className="card card-body space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`s-chip ${STATUS[post.status].tone}`}>{STATUS[post.status].label}</span>
        <span className="s-faint text-[12px]">
          {post.source === "article" ? (post.article ? `Article: ${post.article.title}` : "Article") : "Your post"} · {formatDate(post.posted_at ?? post.created_at)}
        </span>
      </div>
      {editing ? (
        <PostForm
          initial={{ summary: post.summary ?? "", ctaType: post.cta_type, ctaUrl: post.cta_url ?? "", photoUrl: post.photo_url ?? "" }}
          submitLabel="Save changes"
          onCancel={() => setEditing(false)}
          onSubmit={(v) =>
            run("Post saved", async () => {
              await saveLocalPost(post.id, v);
              setEditing(false);
            })
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_160px]">
          <div className="min-w-0">
            <p className="whitespace-pre-line break-words">{text}</p>
            <p className="s-faint text-[12px] mt-2">
              Button: {CTA_LABEL[post.cta_type]}
              {post.cta_url && post.cta_type !== "NONE" && post.cta_type !== "CALL" ? ` → ${post.cta_url}` : ""}
            </p>
          </div>
          {photo && (
            // eslint-disable-next-line @next/next/no-img-element -- remote photo of any size; next/image would need every host allow-listed
            <img src={photo} alt="" className="w-full aspect-[16/9] object-cover rounded-lg border s-line" loading="lazy" />
          )}
        </div>
      )}
      {post.status === "failed" && post.detail && <p className="text-[13px] text-[var(--s-bad)]">Google said: {post.detail}</p>}
      {!editing && (
        <div className="flex flex-wrap gap-2">
          {editable && (
            <button type="button" className="s-btn s-btn--sm" disabled={busy || preview} onClick={() => setEditing(true)}>
              Edit
            </button>
          )}
          {post.status === "draft" && (
            <button type="button" className="s-btn s-btn--sm s-btn--primary" disabled={busy || preview} onClick={() => act("post", "Posting now")}>
              Post now
            </button>
          )}
          {post.status === "failed" && (
            <button type="button" className="s-btn s-btn--sm s-btn--primary" disabled={busy || preview} onClick={() => act("retry", "Trying again")}>
              Try again
            </button>
          )}
          {editable && (
            <button type="button" className="s-btn s-btn--sm s-btn--ghost" disabled={busy || preview} onClick={() => act("skip", "Skipped")}>
              Don&apos;t post
            </button>
          )}
          {post.status === "skipped" && (
            <button type="button" className="s-btn s-btn--sm" disabled={busy || preview} onClick={() => act("restore", "Back to drafts")}>
              Back to drafts
            </button>
          )}
          {post.status === "posted" && (
            <button
              type="button"
              className="s-btn s-btn--sm s-btn--ghost"
              disabled={busy || preview}
              onClick={() => {
                if (window.confirm("Remove this post from your Google Business Profile?")) act("delete", "Removing from Google");
              }}
            >
              Remove from Google
            </button>
          )}
        </div>
      )}
    </li>
  );
}

function ReviewCard({ review }: { review: GbpReview }) {
  const { run, busy, preview } = useStudio();
  const [reply, setReply] = useState(review.draft_reply ?? "");
  const [lastDraft, setLastDraft] = useState(review.draft_reply);
  // A new AI draft arrived from the server: show it (adjusting state during render instead of in an effect).
  if (review.draft_reply !== lastDraft) {
    setLastDraft(review.draft_reply);
    setReply(review.draft_reply ?? "");
  }
  const answered = Boolean(review.reply) && review.reply_status !== "sending";
  const low = (review.stars ?? 5) <= 3;

  return (
    <li className="card card-body space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2">
          <span className="font-medium">{review.reviewer ?? "A customer"}</span>
          <span className="flex" aria-label={`${review.stars ?? "?"} out of 5 stars`} style={{ color: low ? "var(--s-warn)" : "var(--s-accent)" }}>
            {Array.from({ length: 5 }, (_, i) => (
              <Star key={i} size={14} aria-hidden="true" fill={i < (review.stars ?? 0) ? "currentColor" : "none"} />
            ))}
          </span>
        </span>
        <span className="s-faint text-[12px]">{formatDate(review.review_time)}</span>
      </div>
      <p className={review.comment ? "break-words" : "s-faint"}>{review.comment ?? "Star rating only, no text."}</p>

      {answered ? (
        <div className="rounded-lg border s-line p-3 text-[13px]">
          <p className="s-faint mb-1">Your reply · {formatDate(review.reply_time)}</p>
          <p className="break-words">{review.reply}</p>
        </div>
      ) : (
        <div className="space-y-2">
          <label className="block">
            <span className="s-label">Your reply</span>
            <textarea className="s-input min-h-[90px]" value={reply} placeholder={review.reply_status === "drafting" ? "The AI is writing a draft…" : "Write a reply, or ask the AI for a draft."} onChange={(e) => setReply(e.target.value)} />
          </label>
          {review.reply_status === "failed" && review.reply_error && <p className="text-[13px] text-[var(--s-bad)]">{review.reply_error}</p>}
          {review.reply_status === "sending" && <p className="s-faint text-[13px]">Sending to Google…</p>}
          <div className="flex flex-wrap gap-2">
            <button type="button" className="s-btn s-btn--sm" disabled={busy || preview || review.reply_status === "drafting"} onClick={() => run("Drafting a reply", () => draftReply(review.name))}>
              <Sparkles size={14} aria-hidden="true" /> {reply ? "Draft again with AI" : "Draft with AI"}
            </button>
            <button type="button" className="s-btn s-btn--sm" disabled={busy || preview || !reply.trim()} onClick={() => run("Reply saved", () => saveReply(review.name, reply, false))}>
              Save
            </button>
            <button
              type="button"
              className="s-btn s-btn--sm s-btn--primary"
              disabled={busy || preview || !reply.trim() || review.reply_status === "sending"}
              onClick={() => {
                if (window.confirm("Post this reply publicly on Google?")) run("Sending reply", () => saveReply(review.name, reply, true));
              }}
            >
              Send reply
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

export function BusinessProfileView({ posts, reviews, connected, moduleOn, preview }: { posts: GbpPost[]; reviews: GbpReview[]; connected: boolean; moduleOn: boolean; preview: boolean }) {
  const { run, busy } = useStudio();
  const [tab, setTab] = useState<"posts" | "reviews">("posts");
  const [adding, setAdding] = useState(false);
  const unanswered = reviews.filter((r) => !r.reply).length;
  const ready = connected && moduleOn && !preview;

  return (
    <div className="space-y-6">
      <PageHead title="Business Profile" sub="Posts and reviews on your Google Business Profile. New articles become drafts you can edit or skip; nothing is replied to without you.">
        <button type="button" className="s-btn" disabled={busy || !ready} onClick={() => run("Syncing with Google", () => syncBusinessProfile())}>
          <RefreshCw size={16} aria-hidden="true" /> Sync now
        </button>
        <button type="button" className="s-btn s-btn--primary" disabled={!ready} onClick={() => (setTab("posts"), setAdding(true))}>
          <Plus size={16} aria-hidden="true" /> New post
        </button>
      </PageHead>

      {preview ? (
        <EmptyState title="Not available in preview">Connect Supabase to manage Business Profile posts and reviews.</EmptyState>
      ) : !moduleOn ? (
        <EmptyState title="Local SEO is off for this client">
          Turn on the Local SEO module in <Link href="/clients?tab=plan" className="underline">Clients → Plan and limits</Link>.
        </EmptyState>
      ) : !connected ? (
        <EmptyState title="Business Profile isn't connected">
          Add the Business Profile access and location in <Link href="/settings?tab=connections" className="underline">Settings → Connections</Link>.
        </EmptyState>
      ) : null}

      {ready && (
        <>
          <div role="tablist" aria-label="Business Profile" className="s-tabs">
            <button type="button" role="tab" aria-selected={tab === "posts"} className="s-tab" onClick={() => setTab("posts")}>
              Posts <span className="s-faint">{posts.length}</span>
            </button>
            <button type="button" role="tab" aria-selected={tab === "reviews"} className="s-tab" onClick={() => setTab("reviews")}>
              Reviews <span className="s-faint">{unanswered ? `${unanswered} to answer` : reviews.length}</span>
            </button>
          </div>

          {tab === "posts" && (
            <>
              {adding && (
                <section className="card card-body space-y-3" aria-labelledby="new-post-title">
                  <h2 id="new-post-title" className="section-title">
                    New post
                  </h2>
                  <PostForm
                    initial={{ summary: "", ctaType: "LEARN_MORE", ctaUrl: "", photoUrl: "" }}
                    submitLabel="Post to Google"
                    onCancel={() => setAdding(false)}
                    onSubmit={(v) =>
                      run("Post queued — going out now", async () => {
                        await createLocalPost(v);
                        setAdding(false);
                      })
                    }
                  />
                </section>
              )}
              {posts.length === 0 ? (
                <EmptyState title="No posts yet">New articles appear here as drafts the day they&apos;re published, or write your own with New post.</EmptyState>
              ) : (
                <ul className="space-y-3">{posts.map((p) => <PostCard key={p.id} post={p} />)}</ul>
              )}
            </>
          )}

          {tab === "reviews" &&
            (reviews.length === 0 ? (
              <EmptyState title="No reviews yet">Reviews are read every day, or press Sync now.</EmptyState>
            ) : (
              <ul className="space-y-3">{[...reviews].sort((a, b) => Number(Boolean(a.reply)) - Number(Boolean(b.reply))).map((r) => <ReviewCard key={r.name} review={r} />)}</ul>
            ))}
        </>
      )}
    </div>
  );
}
