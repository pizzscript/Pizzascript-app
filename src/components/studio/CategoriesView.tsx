"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { enqueue, saveCategory } from "@/app/actions";
import type { Cluster } from "@/lib/studio/types";
import { useStudio } from "./StudioProvider";
import { CategoryLabel, PageHead } from "./ui";

export interface CategoryRow {
  cluster: Cluster;
  live: number;
  inProgress: number;
  mainArticle: { id: string; title: string } | null;
  trafficShare: number;
}

export interface LinkProblem {
  postId: string;
  postTitle: string;
  fromSlug: string;
  issue: string;
  toPath?: string;
}

const AUDIENCE = { client: "Clients", developer: "Developers", both: "Both" } as const;

export function CategoriesView({ rows, problems }: { rows: CategoryRow[]; problems: LinkProblem[] }) {
  const { run, busy } = useStudio();
  const [editing, setEditing] = useState<{ id?: string; name: string; audience: Cluster["audience"]; targetT1: number } | null>(null);

  return (
    <div className="space-y-8">
      <PageHead title="Categories" sub="How your posts are grouped on the blog, and how each group is doing.">
        <Link href="/posts" className="s-btn s-btn--ghost">
          ← All posts
        </Link>
        <button type="button" className="s-btn s-btn--primary" onClick={() => setEditing({ name: "", audience: "both", targetT1: 60 })}>
          <Plus size={16} aria-hidden="true" /> New category
        </button>
      </PageHead>

      {editing && (
        <form
          className="card card-body grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_200px_auto] items-end"
          onSubmit={(e) => {
            e.preventDefault();
            const value = editing;
            setEditing(null);
            run("Category saved", () => saveCategory(value));
          }}
        >
          <div>
            <label htmlFor="cat-name" className="s-label">
              Name
            </label>
            <input id="cat-name" autoFocus className="s-input" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
          </div>
          <div>
            <label htmlFor="cat-audience" className="s-label">
              Written for
            </label>
            <select id="cat-audience" className="s-input" value={editing.audience} onChange={(e) => setEditing({ ...editing, audience: e.target.value as Cluster["audience"] })}>
              {Object.entries(AUDIENCE).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="cat-mix" className="s-label">
              Traffic posts target: {editing.targetT1}%
            </label>
            <input id="cat-mix" type="range" min={0} max={100} step={5} className="s-range" value={editing.targetT1} onChange={(e) => setEditing({ ...editing, targetT1: Number(e.target.value) })} />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="s-btn s-btn--primary" disabled={busy || editing.name.trim().length < 3}>
              Save
            </button>
            <button type="button" className="s-btn s-btn--ghost" onClick={() => setEditing(null)}>
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="card relative overflow-x-auto">
        <table className="s-table min-w-[760px]">
          <thead>
            <tr>
              <th>Category</th>
              <th>Written for</th>
              <th>Live</th>
              <th>In progress</th>
              <th>Main article</th>
              <th title="Share of broad traffic posts vs. expert posts, compared with the target">Traffic mix</th>
              <th>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.cluster.id}>
                <td className="font-medium whitespace-nowrap">
                  <Link href={`/posts?category=${row.cluster.id}`} className="hover:text-[var(--s-accent)]">
                    <CategoryLabel cluster={row.cluster} />
                  </Link>
                </td>
                <td className="s-dim">{AUDIENCE[row.cluster.audience]}</td>
                <td>{row.live}</td>
                <td className="s-dim">{row.inProgress}</td>
                <td className="max-w-[260px]">
                  {row.mainArticle ? (
                    <Link href={`/posts/${row.mainArticle.id}`} className="line-clamp-1 hover:text-[var(--s-accent)]">
                      {row.mainArticle.title}
                    </Link>
                  ) : (
                    <span className="s-chip s-chip--warn">None yet</span>
                  )}
                </td>
                <td className={row.live > 2 && Math.abs(row.trafficShare - row.cluster.target_t1) > 20 ? "text-[var(--s-warn)]" : "s-dim"}>
                  {row.trafficShare}% <span className="s-faint">/ {row.cluster.target_t1}%</span>
                </td>
                <td className="text-right">
                  <button
                    type="button"
                    className="s-btn s-btn--sm s-btn--ghost"
                    onClick={() => setEditing({ id: row.cluster.id, name: row.cluster.name, audience: row.cluster.audience, targetT1: row.cluster.target_t1 })}
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="card" aria-labelledby="links-title">
        <div className="card-head">
          <h2 id="links-title" className="card-title">
            Link problems {problems.length > 0 && <span className="s-faint font-normal">· {problems.length}</span>}
          </h2>
        </div>
        {problems.length === 0 ? (
          <p className="card-body s-dim">All posts link where they should.</p>
        ) : (
          <ul>
            {problems.map((p) => (
              <li key={`${p.postId}-${p.issue}-${p.toPath ?? ""}`} className="flex flex-wrap items-center gap-3 px-5 py-3 border-b s-line last:border-0">
                <div className="flex-1 min-w-[240px]">
                  <Link href={`/posts/${p.postId}`} className="font-medium hover:text-[var(--s-accent)]">
                    {p.postTitle}
                  </Link>
                  <p className="s-dim text-[13px]">{p.issue}</p>
                </div>
                {p.toPath ? (
                  <button type="button" className="s-btn s-btn--sm" disabled={busy} onClick={() => run("Link", () => enqueue("insert_link", { fromSlug: p.fromSlug, toPath: p.toPath }))}>
                    Add link
                  </button>
                ) : (
                  <Link href={`/posts/${p.postId}`} className="s-btn s-btn--sm">
                    Open post
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
