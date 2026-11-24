import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { CASE_STUDIES } from "@/data/portfolio";
import { SERVICES } from "@/data/services";

const KNOWN: Record<string, Set<string>> = {
  services: new Set(SERVICES.map((s) => s.slug)),
  portfolio: new Set(CASE_STUDIES.map((s) => s.slug)),
};

const PUBLIC_ADMIN = ["/admin/login", "/portal/login", "/portal/auth"];

/** Refreshes the Supabase session cookie and keeps signed-out visitors on the login page (admin or client portal). */
async function admin(request: NextRequest, login = "/admin/login") {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_PUBLISHABLE_KEY) return NextResponse.next();
  let response = NextResponse.next({ request });
  const supabase = createServerClient(process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        toSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  const { data } = await supabase.auth.getUser();
  const isPublic = PUBLIC_ADMIN.some((path) => request.nextUrl.pathname.startsWith(path));
  if (!data.user && !isPublic) return NextResponse.redirect(new URL(login, request.url));
  return response;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return admin(request);
  if (pathname === "/portal" || pathname.startsWith("/portal/")) return admin(request, "/portal/login");

  // With Cache Components the prerendered shell starts streaming before notFound() runs, which would
  // send a 200. Rewriting unknown slugs to an unmatched path returns a real 404 before streaming.
  const [, section, slug] = pathname.split("/");
  if (slug && !KNOWN[section]?.has(slug)) {
    return NextResponse.rewrite(new URL("/__not-found", request.url));
  }
}

export const config = {
  matcher: ["/services/:slug", "/portfolio/:slug", "/admin", "/admin/:path*", "/portal", "/portal/:path*"],
};
