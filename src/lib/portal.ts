// The client portal: a client signs in with an email link and sees only the workspaces they were invited to.
// Data is read on the server with the service key, but only after membership is checked, and always scoped to that client.
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseServer, type WorkspaceInfo } from "./studio/server";
import { scopeClient } from "./studio/workspace-scope";

export const serviceDb = () => createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });

export interface Member {
  email: string;
  workspaces: (WorkspaceInfo & { role: string })[];
}

/** The signed-in client and the workspaces they may see, or a redirect to the portal login. */
export async function requireMember(): Promise<Member> {
  await connection();
  if (!process.env.SUPABASE_URL) redirect("/portal/login?error=not-configured");
  const { data } = await (await supabaseServer()).auth.getUser();
  const email = data.user?.email?.toLowerCase();
  if (!email) redirect("/portal/login");
  const service = serviceDb();
  const { data: rows } = await service.from("workspace_members").select("role,workspace_id").eq("email", email);
  const ids = ((rows ?? []) as { role: string; workspace_id: string }[]).map((r) => r.workspace_id);
  if (!ids.length) redirect("/portal/login?error=no-access");
  const { data: list } = await service.from("workspaces").select("id,slug,name,site_url,status,approval_mode,cms,location,language,plan,created_at").in("id", ids).neq("status", "archived");
  const workspaces = ((list ?? []) as WorkspaceInfo[]).map((w) => ({ ...w, role: (rows as { role: string; workspace_id: string }[]).find((r) => r.workspace_id === w.id)!.role }));
  return { email, workspaces };
}

/** One of the member's workspaces by its short name, with a database client limited to it. */
export async function memberWorkspace(slug: string) {
  const member = await requireMember();
  const workspace = member.workspaces.find((w) => w.slug === slug);
  if (!workspace) redirect("/portal");
  return { member, workspace, db: scopeClient(serviceDb(), () => workspace.id) };
}
