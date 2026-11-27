"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Activity, BarChart3, Bot, Building2, CalendarDays, Link2, FileText, LayoutDashboard, Lightbulb, LogOut, Menu, Search, Settings, Store, X } from "lucide-react";
import { enqueue, signOut } from "@/app/actions";
import { switchClient } from "@/app/clients";
import { BrandMark } from "@/components/BrandMark";
import { STATUS_LABEL, type Stage } from "@/lib/studio/types";
import { AgentActivity } from "./AgentActivity";
import { useStudio } from "./StudioProvider";

type NavItem = { href: string; label: string; icon: typeof LayoutDashboard; count?: "alerts" | "ideas"; also?: string[] };

/** Grouped by what you're doing: today's work, the content pipeline, results, and setup. */
const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  { label: "Today", items: [{ href: "/", label: "Dashboard", icon: LayoutDashboard, count: "alerts" }] },
  {
    label: "Content",
    items: [
      { href: "/ideas", label: "Ideas", icon: Lightbulb, count: "ideas" },
      { href: "/posts", label: "Posts", icon: FileText, also: ["/categories"] },
      { href: "/calendar", label: "Calendar", icon: CalendarDays },
    ],
  },
  {
    label: "Growth",
    items: [
      { href: "/health", label: "Site health", icon: Activity },
      { href: "/links", label: "Links & local", icon: Link2 },
      { href: "/business-profile", label: "Business Profile", icon: Store },
      { href: "/report", label: "Report", icon: BarChart3 },
    ],
  },
  {
    label: "Setup",
    items: [
      { href: "/clients", label: "Clients", icon: Building2 },
      { href: "/automation", label: "Automation", icon: Bot },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
];
const NAV = NAV_GROUPS.flatMap((g) => g.items);

export interface ShellClient {
  id: string;
  name: string;
  status: string;
}

export interface PaletteTicket {
  id: string;
  title: string;
  slug: string;
  stage: Stage;
}

function isActive(pathname: string, item: NavItem) {
  if (item.href === "/") return pathname === "/";
  return [item.href, ...(item.also ?? [])].some((h) => pathname.startsWith(h));
}

export function CmsShell({
  tickets,
  counts,
  email,
  client,
  clients,
  siteUrl: _siteUrl,
  children,
}: {
  tickets: PaletteTicket[];
  counts: { alerts: number; ideas: number };
  email: string | null;
  client: ShellClient;
  clients: ShellClient[];
  siteUrl?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
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
          <Link href="/" className="cms-brand">
            <BrandMark size={28} />
            <span>
              PizzaScript <span className="s-faint italic text-[14px]">studio</span>
            </span>
          </Link>
          <button type="button" className="s-btn s-btn--ghost s-btn--icon cms-menu-btn" onClick={() => setMenuOpen(false)} aria-label="Close menu">
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <label className="block mb-4">
          <span className="sr-only">Client</span>
          <select
            className="s-input w-full"
            value={client.id}
            disabled={preview}
            aria-label="Client you are working on"
            onChange={(e) => {
              const id = e.target.value;
              if (id === "new" || id === "__new__") {
                router.push("/clients?new=1");
                return;
              }
              run("Switched client", async () => {
                await switchClient(id);
                router.refresh();
              });
            }}
          >
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.status !== "active" ? ` (${c.status})` : ""}
              </option>
            ))}
            <option value="new">+ Add new client</option>
          </select>
        </label>
        {client.status !== "active" && (
          <p className="s-chip s-chip--warn mb-3 w-full justify-center">This client is {client.status}: its jobs wait</p>
        )}
        <nav aria-label="Studio">
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="cms-nav-section">
              <p className="cms-nav-group">{group.label}</p>
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const { href, label, icon: Icon, count } = item;
                  const n = count ? counts[count] : 0;
                  return (
                    <li key={href}>
                      <Link href={href} className="cms-nav-link" aria-current={isActive(pathname, item) ? "page" : undefined}>
                        <Icon size={18} aria-hidden="true" />
                        {label}
                        {n > 0 && (
                          <span className="cms-nav-count" aria-label={`${n} ${count === "alerts" ? "open alerts" : "ideas waiting"}`}>
                            {n}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
        <AgentActivity titles={titles} />
        {(email || !preview) && (
          <div className="mt-auto pt-4 border-t s-line">
            <div className="flex items-center gap-2 px-2.5 py-1 min-w-0">
              {!preview && (
                <button
                  type="button"
                  className="s-btn s-btn--ghost s-btn--icon !w-7 !h-7 flex-shrink-0"
                  onClick={() => run("Signed out", () => signOut())}
                  title="Sign out"
                  aria-label="Sign out"
                >
                  <LogOut size={16} aria-hidden="true" />
                </button>
              )}
              {email && (
                <span className="s-faint text-[12px] truncate min-w-0 select-all" title={email}>
                  {email}
                </span>
              )}
            </div>
          </div>
        )}
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
            className="s-input !w-auto sm:flex-1 max-w-[420px] flex items-center gap-2 text-left s-faint"
            onClick={() => setPaletteOpen(true)}
            aria-label="Search posts or jump to a page"
          >
            <Search size={16} aria-hidden="true" />
            <span className="flex-1 hidden sm:inline whitespace-nowrap">Search posts or jump to…</span>
            <kbd className="s-mono text-[12px] hidden sm:inline">Ctrl K</kbd>
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
      ...[...NAV, { href: "/categories", label: "Categories" }].map((n) => ({ id: n.href, label: n.label, hint: "Go to", perform: () => router.push(n.href) })),
      { id: "new-idea", label: "New idea", hint: "Action", perform: () => router.push("/ideas?new=1") },
      { id: "briefing", label: "Refresh today's suggestion", hint: "Action", perform: onBriefing },
      ...tickets.map((t) => ({ id: t.id, label: t.title, hint: STATUS_LABEL[t.stage], perform: () => router.push(`/posts/${t.id}`) })),
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
            className="w-full bg-transparent h-12 outline-none text-[16px]"
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
