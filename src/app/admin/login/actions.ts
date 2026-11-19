"use server";

import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/studio/server";

export async function signInWithPassword(_: unknown, formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, message: "Enter a valid email." };
  if (!password) return { ok: false, message: "Enter your password." };
  if (!process.env.SUPABASE_URL) return { ok: false, message: "Supabase isn't configured yet." };

  const db = await supabaseServer();
  const { error } = await db.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, message: "Wrong email or password." };

  redirect("/admin");
}
