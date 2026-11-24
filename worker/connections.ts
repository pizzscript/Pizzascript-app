import { CONNECTIONS, connectionByName, type ConnectionField } from "../src/lib/studio/connections";
import { db, rawDb } from "./db";
import { env } from "./env";
import { currentWorkspace, isDefaultWorkspace, DEFAULT_WORKSPACE } from "./workspace";

const REFRESH_MS = 5 * 60_000;

/** The server's own settings, used whenever a key isn't set in the admin panel. */
const serverValues = Object.fromEntries(CONNECTIONS.map((c) => [c.field, env[c.field]])) as Record<ConnectionField, string | undefined>;
let loadedAt = 0;

/** PizzaScript's (platform) keys saved in the admin panel, refreshed every few minutes, so a replaced key works without a redeploy. */
export async function applyConnections(force = false) {
  if (!force && Date.now() - loadedAt < REFRESH_MS) return;
  loadedAt = Date.now();
  const { data, error } = await db.rpc("connection_values");
  if (error) {
    console.warn(`[connections] using server settings: ${error.message}`);
    return;
  }
  const stored = new Map(((data ?? []) as { name: string; value: string }[]).map((row) => [row.name, row.value]));
  const target = env as Record<ConnectionField, string | undefined>;
  for (const c of CONNECTIONS) target[c.field] = stored.get(c.name) || serverValues[c.field];
}

const clientValues = new Map<string, { at: number; values: Map<string, string> }>();

/** A client's own keys (never PizzaScript's), cached for a few minutes. */
export async function loadClientConnections(force = false) {
  if (isDefaultWorkspace()) return;
  const id = currentWorkspace();
  const hit = clientValues.get(id);
  if (hit && !force && Date.now() - hit.at < REFRESH_MS) return;
  const { data, error } = await rawDb.rpc("connection_values_for", { ws: id });
  if (error) console.warn(`[connections] client keys unavailable: ${error.message}`);
  clientValues.set(id, { at: Date.now(), values: new Map(((data ?? []) as { name: string; value: string }[]).map((row) => [row.name, row.value])) });
}

/** Only the offline test harness sets client keys directly. */
export function setClientConnections(workspace: string, values: Record<string, string>) {
  clientValues.set(workspace, { at: Date.now(), values: new Map(Object.entries(values)) });
}

/**
 * The value of a connection for the current client: its own value, else (for shared connections) PizzaScript's.
 * A "client" connection such as a Search Console property never falls back, so one client can't act on another's site.
 */
export function conn(field: ConnectionField): string | undefined {
  const c = CONNECTIONS.find((x) => x.field === field)!;
  if (isDefaultWorkspace()) return env[field] || undefined;
  const own = clientValues.get(currentWorkspace())?.values.get(c.name);
  if (own) return own;
  return c.scope === "client" ? undefined : env[field] || undefined;
}

/** Whose Gemini quota this client's requests use: its own key's, or the shared one (PizzaScript's). */
export function aiKeyOwner(): string {
  if (isDefaultWorkspace()) return DEFAULT_WORKSPACE;
  return clientValues.get(currentWorkspace())?.values.get("gemini_api_key") ? currentWorkspace() : DEFAULT_WORKSPACE;
}

export const geminiKey = () => conn("geminiApiKey") ?? env.geminiApiKey;

export { connectionByName };
