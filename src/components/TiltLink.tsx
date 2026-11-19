"use client";

import Link from "next/link";

const RESET = "perspective(1000px) rotateX(0) rotateY(0) translateY(0)";

export function TiltLink({ href, className, children }: { href: string; className?: string; children: React.ReactNode }) {
  const onMove = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    const rotateX = (e.clientY - rect.top - rect.height / 2) / 20;
    const rotateY = (rect.width / 2 - (e.clientX - rect.left)) / 20;
    card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-4px)`;
  };
  return (
    <Link
      href={href}
      className={className}
      onMouseMove={onMove}
      onMouseLeave={(e) => (e.currentTarget.style.transform = RESET)}
    >
      {children}
    </Link>
  );
}
