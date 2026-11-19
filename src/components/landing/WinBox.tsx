export function WinTitlebar({ title, dark = false }: { title: string; dark?: boolean }) {
  return (
    <div className={`fp-win-titlebar${dark ? " fp-win-titlebar--dark" : ""}`}>
      <div className="fp-win-buttons" aria-hidden="true">
        <span className="fp-win-btn fp-win-close">✕</span>
        <span className="fp-win-btn fp-win-min">─</span>
        <span className="fp-win-btn fp-win-max">□</span>
      </div>
      <span className="fp-win-title">{title}</span>
    </div>
  );
}

export function WinBox({
  title,
  className = "",
  dark = false,
  children,
}: {
  title: string;
  className?: string;
  dark?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`fp-win-box${dark ? " fp-win-box--dark" : ""} ${className}`}>
      <WinTitlebar title={title} dark={dark} />
      {children}
    </div>
  );
}
