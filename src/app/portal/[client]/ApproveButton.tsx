"use client";

import { useState, useTransition } from "react";
import { approveAsClient } from "../actions";

export function ApproveButton({ slug, postId, approved }: { slug: string; postId: string; approved: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="text-right">
      <button
        type="button"
        className={`s-btn s-btn--sm ${approved ? "" : "s-btn--primary"}`}
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            try {
              await approveAsClient(slug, postId, !approved);
            } catch (e) {
              setError(e instanceof Error ? e.message : "Something went wrong.");
            }
          })
        }
      >
        {approved ? "Approved ✓ (undo)" : "Approve"}
      </button>
      {error && <p className="s-chip s-chip--bad mt-1">{error}</p>}
    </div>
  );
}
