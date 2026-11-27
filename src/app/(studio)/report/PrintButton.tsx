"use client";

export function PrintButton() {
  return (
    <div className="report-actions">
      <button type="button" className="s-btn s-btn--sm s-btn--primary" onClick={() => window.print()}>
        Print or save as PDF
      </button>
    </div>
  );
}
