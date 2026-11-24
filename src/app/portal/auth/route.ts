import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/studio/server";

/** Where the emailed sign-in link lands: turns the one-time code into a session, then opens the portal. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  if (code) {
    const { error } = await (await supabaseServer()).auth.exchangeCodeForSession(code);
    if (error) return NextResponse.redirect(new URL("/portal/login?error=link", url));
  }
  return NextResponse.redirect(new URL("/portal", url));
}
