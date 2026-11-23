/** Draws one banner in its own short-lived process, so fonts and image tools leave memory as soon as it exits. */
import sharp from "sharp";
import type { PosterContext } from "./render";
import { renderPoster } from "./render";

sharp.concurrency(1);
sharp.cache(false);

let input = "";
for await (const chunk of process.stdin) input += chunk;
const webp = await renderPoster(JSON.parse(input) as PosterContext);
process.stderr.write(`\nPEAK_MB ${Math.round(process.resourceUsage().maxRSS / 1024)}\n`);
process.stdout.write(webp, () => process.exit(0));
