// One-time import of static assets from the legacy Vite site (../website) into public/.
// Usage: node scripts/optimize-assets.mjs [path-to-legacy-website]
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const legacy = path.resolve(process.argv[2] ?? '../website');
const src = (p) => path.join(legacy, 'public', p);
const out = (p) => path.join(process.cwd(), p);

const IMAGES = {
  'assets/images/about_hero.png': 'images/about/hero.webp',
  'assets/images/about_timeline.png': 'images/about/timeline.webp',
  'assets/images/about_comparison.png': 'images/about/comparison.webp',
  'assets/images/about_workflow.png': 'images/about/workflow.webp',
  'assets/images/about_dashboard.png': 'images/about/dashboard.webp',
  'assets/images/about_case_study.png': 'images/about/case-study.webp',
  'assets/images/about_cta.png': 'images/about/cta.webp',
  'assets/images/case_study_mockup.png': 'images/case-study-mockup.webp',
  'assets/images/service_custom_website.png': 'images/services/custom-website-development.webp',
  'assets/images/service_business_websites.png': 'images/services/business-websites.webp',
  'assets/images/service_landing_pages.png': 'images/services/landing-page-development.webp',
  'assets/images/service_redesign.png': 'images/services/website-redesign.webp',
  'assets/images/service_seo_friendly.png': 'images/services/seo-friendly-websites.webp',
  'assets/images/service_maintenance.png': 'images/services/website-maintenance.webp',
  'assets/images/service_speed_optimization.png': 'images/services/website-speed-optimization.webp',
  'assets/images/mydesignacademia.png': 'images/portfolio/my-design-academia.webp',
  'assets/images/orionpharmaindia.png': 'images/portfolio/orion-pharma-india.webp',
  'assets/images/pune-map.webp': 'images/pune-map.webp',
};

async function ensureDir(file) {
  await fs.mkdir(path.dirname(file), { recursive: true });
}

async function convertImages() {
  for (const [from, to] of Object.entries(IMAGES)) {
    const dest = out(path.join('public', to));
    await ensureDir(dest);
    const info = await sharp(src(from))
      .resize({ width: 1600, withoutEnlargement: true })
      .webp({ quality: 78, effort: 6 })
      .toFile(dest);
    console.log(`${to}  ${info.width}x${info.height}  ${(info.size / 1024).toFixed(0)}KB`);
  }
}

// The legacy Lottie file is 27 embedded 1280x720 raster frames played at 0.25x speed.
// An animated WebP gives the same result for the 40px logo without a JS player.
async function convertLogoAnimation() {
  const json = JSON.parse(await fs.readFile(src('assets/animations/pizza-glitch-animation.json'), 'utf8'));
  const frames = json.assets
    .filter((a) => typeof a.p === 'string' && a.p.startsWith('data:image'))
    .map((a) => Buffer.from(a.p.split(',')[1], 'base64'));
  const size = { width: 160, height: 90 };
  const resized = await Promise.all(
    frames.map((f) => sharp(f).resize(size).png().toBuffer()),
  );
  const frameDelay = Math.round((1000 / json.fr) * 4);
  const animated = out('public/images/logo-animated.webp');
  await ensureDir(animated);
  await sharp(resized, { join: { animated: true } })
    .webp({ quality: 80, loop: 0, delay: resized.map(() => frameDelay) })
    .toFile(animated);
  await sharp(resized[0]).webp({ quality: 85 }).toFile(out('public/images/logo-static.webp'));
  const stat = await fs.stat(animated);
  console.log(`logo-animated.webp  ${frames.length} frames  ${(stat.size / 1024).toFixed(0)}KB`);
}

async function convertIcons() {
  const favicon = src('favicon.png');
  await sharp(favicon).resize(48, 48).png().toFile(out('src/app/icon.png'));
  await sharp(favicon).resize(180, 180).png().toFile(out('src/app/apple-icon.png'));
  await sharp(favicon).resize(256, 256).png().toFile(out('assets/og-pizza.png'));
  console.log('icon.png, apple-icon.png, og-pizza.png');
}

await convertImages();
await convertLogoAnimation();
await convertIcons();
