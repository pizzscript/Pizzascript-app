import { CONNECTIONS } from "../src/lib/studio/connections";
import { db } from "./db";
import { env } from "./env";

const REFRESH_MS = 5 * 60_000;
type Field = (typeof CONNECTIONS)[number]["field"];

/** The server's own settings, used whenever a key isn't set in the admin panel. */
const serverValues = Object.fromEntries(CONNECTIONS.map((c) => [c.field, env[c.field]])) as Record<Field, string | undefined>;
let loadedAt = 0;

/** Uses keys saved in the admin panel, refreshed every few minutes, so a replaced key works without a redeploy. */
export async function applyConnections(force = false) {
  if (!force && Date.now() - loadedAt < REFRESH_MS) return;
  loadedAt = Date.now();
  const { data, error } = await db.rpc("connection_values");
  if (error) {
    console.warn(`[connections] using server settings: ${error.message}`);
    return;
  }
  const stored = new Map(((data ?? []) as { name: string; value: string }[]).map((row) => [row.name, row.value]));
  const target = env as Record<Field, string | undefined>;
  for (const c of CONNECTIONS) target[c.field] = stored.get(c.name) || serverValues[c.field];
}
