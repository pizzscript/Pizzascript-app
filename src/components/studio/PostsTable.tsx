"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { enqueue } from "@/app/actions";
import { STATUS_LABEL, type Cluster, type StudioPost } from "@/lib/studio/types";
import { useStudio } from "./StudioProvider";
import { CategoryLabel, EmptyState, PageHead, SeoBadge, StatusBadge, formatDate } from "./ui";

const TABS = [
  { id: "all", label: "All", match: () => true },
  { id: "draft", label: "In progress", match: (p: StudioPost) => ["Brief", "Draft"].includes(STATUS_LABEL[p.stage]) },
  { id: "ready", label: "Ready", match: (p: StudioPost) => STATUS_LABEL[p.stage] === "Ready" },
  { id: "scheduled", label: "Scheduled", match: (p: StudioPost) => STATUS_LABEL[p.stage] === "Scheduled" },
  { id: "live", label: "Live", match: (p: StudioPost) => p.stage === "live" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function PostsTable({ posts, clusters, initialTab }: { posts: StudioPost[]; clusters: Cluster[]; initialTab: string }) {
  const router = useRouter();
  const { run, busy } = useStudio();
  const [tab, setTab] = useState<TabId>((TABS.find((t) => t.id === initialTab)?.id ?? "all") as TabId);
  const [category, setCategory] = useState("");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const clusterById = useMemo(() => new Map(clusters.map((c) => [c.id, c])), [clusters]);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return posts
      .filter(TABS.find((t) => t.id === tab)!.match)
      .filter((p) => !category || p.cluster_id === category)
      .filter((p) => !q || p.title.toLowerCase().includes(q) || p.slug.includes(q))
      .sort((a, b) => (b.scheduled_for ?? b.published_at ?? b.updated_at).localeCompare(a.scheduled_for ?? a.published_at ?? a.updated_at));
  }, [posts, tab, category, query]);

  const selectedPosts = posts.filter((p) => selected.has(p.id));
  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const bulk = (type: "write_draft" | "run_audit", label: string) =>
    run(label, async () => {
      let last = "";
      for (const p of selectedPosts) last = await enqueue(type, { postId: p.id });
      setSelected(new Set());
      return last;
    });

  return (
    <div>
      <PageHead title="Posts" sub={`${posts.length} articles · ${posts.filter((p) => p.stage === "live").length} live`}>
        <Link href="/ideas?new=1" className="s-btn s-btn--primary">
          New post from idea
        </Link>
      </PageHead>

      <div role="tablist" aria-label="Filter by status" className="s-tabs mb-4">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className="s-tab"
            onClick={() => {
              setTab(t.id);
              setSelected(new Set());
            }}
          >
            {t.label} <span className="s-faint">{posts.filter(t.match).length}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <label className="relative flex-1 min-w-[220px] max-w-[360px]">
          <span className="sr-only">Search posts</span>
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 s-faint" aria-hidden="true" />
          <input className="s-input !pl-9" placeholder="Search by title" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <label>
          <span className="sr-only">Category</span>
          <select className="s-input !w-auto" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">All categories</option>
            {clusters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        {selected.size > 0 && (
          <div className="flex items-center gap-2 ml-auto" role="group" aria-label="Bulk actions">
            <span className="s-dim text-[13px]">{selected.size} selected</span>
            <button type="button" className="s-btn s-btn--sm" disabled={busy} onClick={() => bulk("write_draft", "Draft")}>
              Write drafts
            </button>
            <button type="button" className="s-btn s-btn--sm" disabled={busy} onClick={() => bulk("run_audit", "Audit")}>
              Run quality check
            </button>
          </div>
        )}
      </div>

      {visible.length === 0 ? (
        <EmptyState title="No posts here">Try another filter, or turn an idea into a post.</EmptyState>
      ) : (
        <div className="card relative overflow-x-auto">
          <table className="s-table min-w-[820px]">
            <thead>
              <tr>
                <th className="w-10">
                  <input
                    type="checkbox"
                    aria-label="Select all"
                    checked={visible.length > 0 && visible.every((p) => selected.has(p.id))}
                    onChange={(e) => setSelected(e.target.checked ? new Set(visible.map((p) => p.id)) : new Set())}
                    className="accent-[var(--s-accent)]"
                  />
                </th>
                <th>Title</th>
                <th>Category</th>
                <th>Status</th>
                <th>SEO</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((post) => (
                <tr key={post.id} className="cursor-pointer" onClick={() => router.push(`/posts/${post.id}`)}>
                  <td onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      aria-label={`Select ${post.title}`}
                      checked={selected.has(post.id)}
                      onChange={() => toggle(post.id)}
                      className="accent-[var(--s-accent)]"
                    />
                  </td>
                  <td className="max-w-[420px]">
                    <Link href={`/posts/${post.id}`} className="font-medium hover:text-[var(--s-accent)] line-clamp-1" onClick={(e) => e.stopPropagation()}>
                      {post.title}
                    </Link>
                    <span className="block s-faint text-[12px] truncate">/blog/{post.slug}</span>
                  </td>
                  <td className="whitespace-nowrap">
                    <CategoryLabel cluster={clusterById.get(post.cluster_id ?? "")} />
                  </td>
                  <td>
                    <StatusBadge stage={post.stage} />
                  </td>
                  <td>
                    <SeoBadge audit={post.audit} />
                  </td>
                  <td className="whitespace-nowrap s-dim">
                    {post.stage === "live" ? formatDate(post.published_at) : post.scheduled_for ? formatDate(post.scheduled_for) : "Unscheduled"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
