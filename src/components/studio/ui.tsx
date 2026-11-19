import type { Audit, Cluster, Stage } from "@/lib/studio/types";
import { STATUS_LABEL } from "@/lib/studio/types";

export function PageHead({ title, sub, children }: { title: string; sub?: string; children?: React.ReactNode }) {
  return (
    <div className="page-head">
      <div>
        <h1 className="page-title">{title}</h1>
        {sub && <p className="page-sub">{sub}</p>}
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}

const STATUS_TONE: Record<string, string> = {
  Brief: "",
  Draft: "s-chip--info",
  Ready: "s-chip--warn",
  Scheduled: "s-chip--accent",
  Live: "s-chip--ok",
};

export function StatusBadge({ stage }: { stage: Stage }) {
  const label = STATUS_LABEL[stage];
  return <span className={`s-chip ${STATUS_TONE[label]}`}>{label}</span>;
}

export function CategoryLabel({ cluster }: { cluster: Pick<Cluster, "id" | "name"> | null | undefined }) {
  if (!cluster) return <span className="s-faint">Uncategorised</span>;
  return (
    <span className={`inline-flex items-center gap-2 c-${cluster.id}`}>
      <span className="cat-dot" aria-hidden="true" />
      {cluster.name}
    </span>
  );
}

export function SeoBadge({ audit }: { audit: Audit | null }) {
  if (!audit) return <span className="s-faint">—</span>;
  const failing = audit.checks.filter((c) => !c.pass).length;
  return failing === 0 ? (
    <span className="s-chip s-chip--ok">✓ Passing</span>
  ) : (
    <span className="s-chip s-chip--bad" title={audit.checks.filter((c) => !c.pass).map((c) => c.label).join("\n")}>
      {failing} issue{failing > 1 ? "s" : ""}
    </span>
  );
}

export function formatDate(iso: string | null, withTime = false) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    ...(withTime ? { hour: "2-digit", minute: "2-digit", hour12: false } : { year: "numeric" }),
    timeZone: "Asia/Kolkata",
  }).format(new Date(iso));
}

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="card card-body text-center py-12">
      <p className="font-medium">{title}</p>
      {children && <div className="s-dim mt-1">{children}</div>}
    </div>
  );
}
