"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandMark } from "@/components/BrandMark";
import { useScroll } from "@/components/motion/ScrollProvider";
import { NAV_LINKS } from "@/lib/site";

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export function Navbar() {
  const pathname = usePathname();
  const { scrollTo } = useScroll();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let lastY = window.scrollY;
    let frame = 0;
    const update = () => {
      frame = 0;
      const y = window.scrollY;
      setScrolled(y > 100);
      setHidden(y > 50 && y > lastY);
      lastY = y;
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  const [menuPath, setMenuPath] = useState(pathname);
  if (menuPath !== pathname) {
    setMenuPath(pathname);
    setMenuOpen(false);
  }

  useEffect(() => {
    document.body.classList.toggle("mobile-menu-open", menuOpen);
    if (!menuOpen) return;

    const header = headerRef.current;
    const focusables = () =>
      Array.from(header?.querySelectorAll<HTMLElement>("#mobile-menu a, .hamburger") ?? []);
    focusables()[1]?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
        toggleRef.current?.focus();
        return;
      }
      if (e.key !== "Tab") return;
      const items = focusables();
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.classList.remove("mobile-menu-open");
    };
  }, [menuOpen]);

  const goToOrder = (e: React.MouseEvent<HTMLAnchorElement>) => {
    setMenuOpen(false);
    if (pathname !== "/") return;
    e.preventDefault();
    history.replaceState(null, "", "#order");
    scrollTo("order");
  };

  const isHome = pathname === "/";
  const className = [
    "navbar",
    scrolled && "scrolled",
    hidden && !menuOpen && "navbar-hidden",
    !isHome && "navbar-sticky",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <header ref={headerRef} className={className} id="navbar">
      <div className="navbar-inner">
        <Link href="/" className="navbar-logo" aria-label="PizzaScript home">
          <BrandMark />
          <span className="logo-text">Pizza Script</span>
        </Link>

        <nav className="navbar-links" aria-label="Main">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`navbar-link${isActive(pathname, link.href) ? " active" : ""}`}
              aria-current={pathname === link.href ? "page" : undefined}
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/#order"
            className="btn btn-primary navbar-cta font-mono"
            style={{ padding: "10px 24px", fontSize: "0.75rem" }}
            onClick={goToOrder}
          >
            Get in Touch
          </Link>
        </nav>

        <button
          ref={toggleRef}
          type="button"
          className="hamburger"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          aria-controls="mobile-menu"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span className="hamburger-line" />
          <span className="hamburger-line" />
          <span className="hamburger-line" />
        </button>
      </div>

      <nav className="mobile-menu" id="mobile-menu" aria-label="Mobile">
        {NAV_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`mobile-menu-link${isActive(pathname, link.href) ? " active" : ""}`}
            aria-current={pathname === link.href ? "page" : undefined}
            tabIndex={menuOpen ? undefined : -1}
          >
            {link.label}
          </Link>
        ))}
        <Link
          href="/#order"
          className="btn btn-primary mt-4 font-mono text-center block w-full"
          onClick={goToOrder}
          tabIndex={menuOpen ? undefined : -1}
        >
          Get in Touch
        </Link>
      </nav>
    </header>
  );
}
