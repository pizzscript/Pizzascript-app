"use server";

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { testConnection } from "@/lib/studio/connection-tests";
import { CONNECTIONS, connectionByName, describeValue, formatProblem, type ConnectionName } from "@/lib/studio/connections";
import { requireAdmin } from "@/lib/studio/server";

async function admin() {
  const studio = await requireAdmin();
  if (studio.mode === "preview") throw new Error("Preview mode — connect Supabase to make changes.");
  return studio;
}

const known = (name: string): ConnectionName => {
  if (!connectionByName(name)) throw new Error("Unknown connection");
  return name as ConnectionName;
};

/** Signs in separately with the password, so a stolen browser session alone can't change keys. */
async function confirmPassword(email: string, password: string) {
  if (!password) throw new Error("Enter your admin password to confirm.");
  const auth = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await auth.auth.signInWithPassword({ email, password });
  if (error) throw new Error("That password isn't right.");
  await auth.auth.signOut({ scope: "local" });
}

/** Current values, read on the server only, for checks that need a related setting or a saved key. */
async function currentValues() {
  const service = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });
  const { data } = await service.rpc("connection_values");
  const stored = new Map(((data ?? []) as { name: string; value: string }[]).map((row) => [row.name, row.value]));
  return Object.fromEntries(CONNECTIONS.map((c) => [c.name, stored.get(c.name) || process.env[c.env] || ""])) as Record<ConnectionName, string>;
}

export async function saveConnection(name: string, value: string, password: string) {
  const studio = await admin();
  const conn = known(name);
  const clean = value.trim();
  const problem = formatProblem(conn, clean);
  if (problem) throw new Error(problem);
  await confirmPassword(studio.email, password);
  const result = await testConnection(conn, clean, await currentValues());
  if (!result.ok) {
    await studio.db.rpc("record_connection_check", { conn, conn_ok: false, conn_detail: `Not saved: ${result.detail}`, conn_expires: null, conn_action: "rejected" });
    throw new Error(`Not saved. ${result.detail}.`);
  }
  const { error } = await studio.db.rpc("save_connection", { conn, conn_value: clean, conn_shown: describeValue(conn, clean), conn_detail: result.detail, conn_expires: result.expiresAt ?? null });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/settings");
}

export async function checkConnection(name: string) {
  const studio = await admin();
  const conn = known(name);
  const values = await currentValues();
  const result = values[conn] ? await testConnection(conn, values[conn], values) : { ok: false, detail: "Not set", expiresAt: null };
  await studio.db.rpc("record_connection_check", { conn, conn_ok: result.ok, conn_detail: result.detail, conn_expires: result.expiresAt ?? null, conn_action: "tested" });
  revalidatePath("/admin/settings");
  if (!result.ok) throw new Error(result.detail);
}

export async function clearConnection(name: string, password: string) {
  const studio = await admin();
  const conn = known(name);
  await confirmPassword(studio.email, password);
  const { error } = await studio.db.rpc("clear_connection", { conn });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/settings");
}
