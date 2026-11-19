import { cache } from "react";
import { loadStudio, requireAdmin } from "./server";

/** One admin check + data load per request, shared by the studio layout and pages. */
export const getStudio = cache(async () => {
  const studio = await requireAdmin();
  const data = await loadStudio(studio);
  return { studio, data };
});
