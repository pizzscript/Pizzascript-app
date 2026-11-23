// Bundles the banner process so production runs it with plain Node, without TypeScript tooling in memory.
import { build } from "esbuild";

await build({
  entryPoints: ["worker/poster/child.ts"],
  outfile: "worker/poster/child.bundle.mjs",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  packages: "external",
  logLevel: "warning",
});
