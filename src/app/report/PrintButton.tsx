"use client";

export function PrintButton() {
  return (
    <div className="report-actions">
      <a className="s-btn s-btn--sm" href="/">
        Back
      </a>
      <button type="button" className="s-btn s-btn--sm s-btn--primary" onClick={() => window.print()}>
        Save as PDF
      </button>
    </div>
  );
}
