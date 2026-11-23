import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type { PosterContext } from "./render";

const TIME_LIMIT_MS = 60_000;
const HEAP_LIMIT_MB = 180;

/** The build makes a small bundle. Without one (local development), the TypeScript source runs through tsx. */
function childArgs() {
  const folder = path.join(process.cwd(), "worker", "poster");
  const bundle = path.join(folder, "child.bundle.mjs");
  const entry = fs.existsSync(bundle) ? [bundle] : ["--import", "tsx", path.join(folder, "child.ts")];
  return [`--max-old-space-size=${HEAP_LIMIT_MB}`, ...entry];
}

// The child gets only what Node needs to start: none of the app's API keys or database secrets.
const childEnv = () =>
  Object.fromEntries(["PATH", "Path", "SystemRoot", "TEMP", "TMP", "HOME", "NODE_ENV"].flatMap((key) => (process.env[key] ? [[key, process.env[key]!]] : []))) as NodeJS.ProcessEnv;

export function renderInChild(context: PosterContext): Promise<{ webp: Buffer; peakMb: number | null }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, childArgs(), { cwd: process.cwd(), env: childEnv(), stdio: ["pipe", "pipe", "pipe"] });
    const chunks: Buffer[] = [];
    let log = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, TIME_LIMIT_MS);
    child.stdout.on("data", (chunk: Buffer | string) => chunks.push(Buffer.from(chunk as Buffer)));
    child.stderr.on("data", (chunk) => (log = (log + chunk).slice(-800)));
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      const webp = Buffer.concat(chunks);
      if (timedOut) return reject(new Error("banner process timed out"));
      if (code !== 0 || !webp.length) return reject(new Error(`banner process failed (${signal ?? code}): ${log.trim().slice(-200)}`));
      resolve({ webp, peakMb: Number(log.match(/PEAK_MB (\d+)/)?.[1]) || null });
    });
    child.stdin.on("error", () => {});
    child.stdin.end(JSON.stringify(context));
  });
}
