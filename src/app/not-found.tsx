import type { Metadata } from "next";
import Link from "next/link";
import { NAV_LINKS } from "@/lib/site";

export const metadata: Metadata = {
  title: "Page not found",
};

export default function NotFound() {
  return (
    <main
      id="main-content"
      className="min-h-screen flex items-center justify-center px-6 text-center"
      style={{ background: "#0B0604" }}
    >
      <div className="max-w-xl">
        <p className="font-mono text-sm uppercase tracking-widest text-oven-orange mb-4">Error 404</p>
        <h1 className="text-4xl md:text-5xl font-serif font-bold text-cream mb-6">This slice went missing</h1>
        <p className="text-stone-300 mb-10">
          The page you&apos;re looking for isn&apos;t on the menu anymore. Try one of these instead:
        </p>
        <nav aria-label="Site">
          <ul className="flex flex-wrap justify-center gap-3">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="inline-block border border-white/15 rounded-full px-5 py-2 text-sm text-stone-200 hover:text-oven-orange hover:border-oven-orange/40 transition-colors"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </main>
  );
}
