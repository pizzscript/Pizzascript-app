import { CONNECTIONS, describeValue, type ConnectionName } from "./connections";
import type { Studio } from "./server";

export interface ConnectionView {
  name: ConnectionName;
  label: string;
  help: string;
  kind: "secret" | "json" | "text";
  source: "admin" | "server" | "none";
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

/** What the Connections tab shows. Never includes a full value. */
export async function loadConnections(studio: Studio): Promise<ConnectionView[]> {
  let rows: StatusRow[] = [];
  if (studio.mode === "live") {
    const { data } = await studio.db.rpc("connection_status");
    rows = (data ?? []) as StatusRow[];
  }
  return CONNECTIONS.map((c) => {
    const row = rows.find((r) => r.name === c.name);
    const serverValue = process.env[c.env];
    const source = row?.in_vault ? "admin" : serverValue ? "server" : "none";
    return {
      name: c.name,
      label: c.label,
      help: c.help,
      kind: c.kind,
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
