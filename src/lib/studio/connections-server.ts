import { connectionsFor, describeValue, type ConnectionName } from "./connections";
import { isDefaultClient, type Studio } from "./server";

export interface ConnectionView {
  name: ConnectionName;
  label: string;
  help: string;
  kind: "secret" | "json" | "text";
  /** admin = saved for this client; shared = a client using PizzaScript's; server = Render setting (PizzaScript only). */
  source: "admin" | "server" | "shared" | "none";
  scope: "platform" | "client" | "either";
  shown: string | null;
  status: string;
  detail: string | null;
  expiresAt: string | null;
  /** True within 7 days of the expiry date. */
  expiringSoon: boolean;
  checkedAt: string | null;
  updatedAt: string | null;
}

interface StatusRow {
  name: string;
  shown: string | null;
  status: string;
  detail: string | null;
  expires_at: string | null;
  checked_at: string | null;
  updated_at: string | null;
  in_vault: boolean;
}

/** What the Connections tab shows for the client being worked on. Never includes a full value. */
export async function loadConnections(studio: Studio): Promise<ConnectionView[]> {
  const isDefault = isDefaultClient(studio);
  let rows: StatusRow[] = [];
  let shared: StatusRow[] = [];
  if (studio.mode === "live") {
    const { data } = await studio.db.rpc("connection_status", { ws: studio.workspace.id });
    rows = (data ?? []) as StatusRow[];
    if (!isDefault) shared = ((await studio.db.rpc("connection_status")).data ?? []) as StatusRow[];
  }
  return connectionsFor(isDefault).map((c) => {
    const row = rows.find((r) => r.name === c.name);
    const serverValue = isDefault ? process.env[c.env] : undefined;
    const sharedSet = !isDefault && c.scope === "either" && (shared.find((r) => r.name === c.name)?.in_vault || Boolean(process.env[c.env]));
    const source = row?.in_vault ? "admin" : serverValue ? "server" : sharedSet ? "shared" : "none";
    return {
      name: c.name,
      label: c.label,
      help: c.help,
      kind: c.kind,
      scope: c.scope,
      source,
      shown: source === "admin" ? (row?.shown ?? null) : serverValue ? describeValue(c.name, serverValue) : null,
      status: source === "none" ? "not set" : (row?.status ?? "unchecked"),
      detail: row?.detail ?? null,
      expiresAt: row?.expires_at ?? null,
      expiringSoon: Boolean(row?.expires_at) && Date.parse(row!.expires_at!) - Date.now() < 7 * 86_400_000,
      checkedAt: row?.checked_at ?? null,
      updatedAt: row?.updated_at ?? null,
    };
  });
}
