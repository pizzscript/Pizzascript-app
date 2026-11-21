// Runs in its own short-lived process so the model's ~140MB is returned to Render's 512MB limit as soon as it exits.
import path from "node:path";
import { env, pipeline } from "@huggingface/transformers";

env.cacheDir = process.env.EMBED_MODEL_DIR ?? path.join(process.cwd(), ".cache", "models");

const load = () => pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2", { dtype: "q8" });

if (process.argv.includes("--warm")) {
  // A failed download must not fail the build: the model is fetched on first use instead.
  await load().catch((error) => console.warn(`[embed] model not cached: ${error.message}`));
  process.exit(0);
}

let input = "";
for await (const chunk of process.stdin) input += chunk;
const texts = JSON.parse(input);
const extractor = await load();
const vectors = [];
for (const text of texts) {
  const output = await extractor(text, { pooling: "mean", normalize: true });
  vectors.push(Array.from(output.data, (n) => Number(n.toFixed(6))));
}
process.stdout.write(JSON.stringify(vectors), () => process.exit(0));
