"use server";

import { headers } from "next/headers";
import { supabaseServer } from "@/lib/studio/server";

export async function sendMagicLink(_: unknown, formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, message: "Enter a valid email." };
  if (!process.env.SUPABASE_URL) return { ok: false, message: "Supabase isn't configured yet." };
  const origin = (await headers()).get("origin") ?? "https://www.pizzascript.com";
  const db = await supabaseServer();
  // shouldCreateUser: false — only users invited from the Supabase dashboard can sign in.
  const { error } = await db.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/admin/auth/callback`, shouldCreateUser: false },
  });
  // Same response for unknown emails, so the form can't be used to probe accounts.
  if (error && !/signups not allowed|not found/i.test(error.message)) return { ok: false, message: "Couldn't send the link. Try again." };
  return { ok: true, message: `If ${email} has access, a sign-in link is on its way.` };
}
