"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { CalendarDays, FileText, LayoutDashboard, Lightbulb, LogOut, Menu, Plus, Search, Settings, Tags, X } from "lucide-react";
import { enqueue, signOut } from "@/app/admin/actions";
import { BrandMark } from "@/components/BrandMark";
import { STATUS_LABEL, type Stage } from "@/lib/studio/types";
import { AgentActivity } from "./AgentActivity";
import { useStudio } from "./StudioProvider";

const NAV = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, count: "alerts" as const },
  { href: "/admin/posts", label: "Posts", icon: FileText },
  { href: "/admin/ideas", label: "Ideas", icon: Lightbulb, count: "ideas" as const },
  { href: "/admin/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/admin/categories", label: "Categories", icon: Tags },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export interface PaletteTicket {
  id: string;
  title: string;
  slug: string;
  stage: Stage;
}

function isActive(pathname: string, href: string) {
  return href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
}

export function CmsShell({
  tickets,
  counts,
  email,
  children,
}: {
  tickets: PaletteTicket[];
  counts: { alerts: number; ideas: number };
  email: string | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { preview, pending, run } = useStudio();
  const [menuOpen, setMenuOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const titles = useMemo(() => new Map(tickets.map((t) => [t.id, t.title])), [tickets]);

  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setMenuOpen(false);
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="cms">
      {menuOpen && <div className="cms-scrim" onClick={() => setMenuOpen(false)} aria-hidden="true" />}
      <aside className="cms-side" data-open={menuOpen} aria-label="Studio navigation">
        <div className="flex items-center justify-between">
          <Link href="/admin" className="cms-brand">
            <BrandMark size={28} />
            <span>
              PizzaScript <span className="s-faint italic text-[14px]">studio</span>
            </span>
          </Link>
          <button type="button" className="s-btn s-btn--ghost s-btn--icon cms-menu-btn" onClick={() => setMenuOpen(false)} aria-label="Close menu">
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <Link href="/admin/ideas?new=1" className="s-btn s-btn--primary w-full mb-4">
          <Plus size={16} aria-hidden="true" /> New idea
        </Link>
        <nav aria-label="Studio">
          <ul className="space-y-0.5">
            {NAV.map(({ href, label, icon: Icon, count }) => {
              const n = count ? counts[count] : 0;
              return (
                <li key={href}>
                  <Link href={href} className="cms-nav-link" aria-current={isActive(pathname, href) ? "page" : undefined}>
                    <Icon size={18} aria-hidden="true" />
                    {label}
                    {n > 0 && (
                      <span className="cms-nav-count" aria-label={`${n} ${count === "alerts" ? "open alerts" : "ideas to research"}`}>
                        {n}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <AgentActivity titles={titles} />
        <div className="mt-auto pt-4 border-t s-line space-y-2">
          <a href="/" target="_blank" rel="noopener noreferrer" className="cms-nav-link">
            View site ↗
          </a>
          {email && <p className="px-2.5 s-faint text-[12px] truncate">{email}</p>}
          {!preview && (
            <button type="button" className="cms-nav-link w-full" onClick={() => run("Signed out", () => signOut())}>
              <LogOut size={18} aria-hidden="true" /> Sign out
            </button>
          )}
        </div>
      </aside>

      <div className="min-w-0">
        <header className="cms-top">
          <button
            type="button"
            className="s-btn s-btn--ghost s-btn--icon cms-menu-btn relative"
            onClick={() => setMenuOpen(true)}
            aria-label={pending.length ? `Open menu (agent working on ${pending.length} task${pending.length > 1 ? "s" : ""})` : "Open menu"}
            aria-expanded={menuOpen}
          >
            <Menu size={20} aria-hidden="true" />
            {pending.length > 0 && <span className="cms-menu-dot animate-pulse" aria-hidden="true" />}
          </button>
          <button
            type="button"
            className="s-input !w-auto flex-1 max-w-[420px] flex items-center gap-2 text-left s-faint"
            onClick={() => setPaletteOpen(true)}
          >
            <Search size={16} aria-hidden="true" />
            <span className="flex-1">Search posts or jump to…</span>
            <kbd className="s-mono text-[11px] hidden sm:inline">Ctrl K</kbd>
          </button>
          <div className="ml-auto flex items-center gap-3">
            {preview && (
              <span className="s-chip s-chip--warn" title="Connect Supabase to make changes">
                Preview · read-only
              </span>
            )}
          </div>
        </header>
        <main id="main-content" className="cms-main">
          {children}
        </main>
      </div>

      {paletteOpen && (
        <Palette
          tickets={tickets}
          onClose={() => setPaletteOpen(false)}
          onBriefing={() => run("Briefing", () => enqueue("daily_briefing", { force: true }))}
        />
      )}
    </div>
  );
}

interface Option {
  id: string;
  label: string;
  hint: string;
  perform: () => void;
}

function Palette({ tickets, onClose, onBriefing }: { tickets: PaletteTicket[]; onClose: () => void; onBriefing: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  const options = useMemo<Option[]>(() => {
    const all: Option[] = [
      ...NAV.map((n) => ({ id: n.href, label: n.label, hint: "Go to", perform: () => router.push(n.href) })),
      { id: "new-idea", label: "New idea", hint: "Action", perform: () => router.push("/admin/ideas?new=1") },
      { id: "briefing", label: "Refresh today's suggestion", hint: "Action", perform: onBriefing },
      ...tickets.map((t) => ({ id: t.id, label: t.title, hint: STATUS_LABEL[t.stage], perform: () => router.push(`/admin/posts/${t.id}`) })),
    ];
    const q = query.trim().toLowerCase();
    return q ? all.filter((o) => o.label.toLowerCase().includes(q) || o.hint.toLowerCase().includes(q)) : all;
  }, [query, tickets, router, onBriefing]);

  const choose = (option: Option | undefined) => {
    if (!option) return;
    option.perform();
    onClose();
  };

  useEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
  }, [index]);

  return (
    <div className="s-palette-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="s-palette" role="dialog" aria-modal="true" aria-label="Search">
        <div className="flex items-center gap-2 px-4 border-b s-line">
          <Search size={16} className="s-faint" aria-hidden="true" />
          <input
            autoFocus
            className="w-full bg-transparent h-12 outline-none text-[15px]"
            placeholder="Search posts, pages and actions"
            value={query}
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-list"
            aria-activedescendant={options[index] ? `opt-${options[index].id}` : undefined}
            onChange={(e) => {
              setQuery(e.target.value);
              setIndex(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setIndex((i) => Math.min(i + 1, options.length - 1));
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setIndex((i) => Math.max(i - 1, 0));
              }
              if (e.key === "Enter") choose(options[index]);
            }}
          />
        </div>
        <ul id="palette-list" role="listbox" ref={listRef} className="max-h-[calc(60vh-48px)] overflow-y-auto py-1">
          {options.map((option, i) => (
            <li
              key={option.id}
              id={`opt-${option.id}`}
              role="option"
              aria-selected={i === index}
              className="s-option flex items-center justify-between gap-4 px-4 py-2.5 cursor-pointer"
              onMouseEnter={() => setIndex(i)}
              onClick={() => choose(option)}
            >
              <span className="truncate">{option.label}</span>
              <span className="s-faint text-[12px] whitespace-nowrap">{option.hint}</span>
            </li>
          ))}
          {options.length === 0 && <li className="px-4 py-3 s-dim">No results.</li>}
        </ul>
      </div>
    </div>
  );
}
