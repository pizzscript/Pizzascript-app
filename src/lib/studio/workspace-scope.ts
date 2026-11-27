/**
 * Client isolation for database access. Wrap a Supabase client once; every table query is then limited to one
 * workspace: reads, updates and deletes only see its rows, and inserts and upserts are stamped with it.
 */
export const DEFAULT_WORKSPACE = "00000000-0000-4000-8000-000000000001";

/** Tables shared by the whole platform rather than owned by one client. */
const GLOBAL_TABLES = new Set(["workspaces", "workspace_members", "admins"]);

/** Unique keys that are per workspace. An upsert on them must include the workspace. */
const SCOPED_CONFLICT: Record<string, string | undefined> = {
  posts: undefined,
  topics: undefined,
  signals: undefined,
  link_plan: undefined,
  gsc_daily: undefined,
  settings: "key",
  briefings: "date",
  research_opportunities: "query,source",
};

function conflictFor(table: string, given: string | undefined) {
  if (!(table in SCOPED_CONFLICT)) return given;
  const columns = given ?? SCOPED_CONFLICT[table];
  if (!columns || columns.split(",").map((c) => c.trim()).includes("workspace_id")) return columns;
  return `workspace_id,${columns}`;
}

const stamp = (rows: unknown, workspace: string) => {
  const one = (row: unknown) => (row && typeof row === "object" && !("workspace_id" in row) ? { ...row, workspace_id: workspace } : row);
  return Array.isArray(rows) ? rows.map(one) : one(rows);
};

type Builder = Record<string, unknown> & { eq: (column: string, value: string) => unknown };

function scopeTable(table: string, query: object, workspace: string) {
  if (GLOBAL_TABLES.has(table)) return query;
  return new Proxy(query, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof value !== "function") return value;
      if (prop === "select" || prop === "update" || prop === "delete") {
        return (...args: unknown[]) => (value.apply(target, args) as Builder).eq("workspace_id", workspace);
      }
      if (prop === "insert") return (rows: unknown, options?: object) => value.call(target, stamp(rows, workspace), options);
      if (prop === "upsert") {
        return (rows: unknown, options: { onConflict?: string } = {}) => {
          const onConflict = conflictFor(table, options.onConflict);
          return value.call(target, stamp(rows, workspace), onConflict ? { ...options, onConflict } : options);
        };
      }
      return value.bind(target);
    },
  });
}

/** Returns the same client, limited to the workspace `workspace()` returns at the moment each query starts. */
export function scopeClient<T extends object>(client: T, workspace: () => string): T {
  return new Proxy(client, {
    get(target, prop, receiver) {
      if (prop !== "from") return Reflect.get(target, prop, receiver);
      const from = Reflect.get(target, "from", receiver) as (table: string) => object;
      return (table: string) => scopeTable(table, from.call(target, table), workspace());
    },
  });
}
