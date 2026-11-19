import Link from "next/link";

export function Breadcrumbs({ items, className = "" }: { items: { name: string; href?: string }[]; className?: string }) {
  return (
    <nav aria-label="Breadcrumb" className={`breadcrumb text-xs font-mono text-stone-400 uppercase tracking-widest ${className}`}>
      <ol>
        {items.map((item) => (
          <li key={item.name}>
            {item.href ? (
              <Link href={item.href} className="hover:text-oven-orange transition-colors">
                {item.name}
              </Link>
            ) : (
              <span className="text-oven-orange" aria-current="page">
                {item.name}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
