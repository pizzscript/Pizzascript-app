// One-time port of the legacy stylesheets into the Next.js app.
// Usage: node scripts/port-legacy-css.mjs [path-to-legacy-website]
import fs from 'node:fs/promises';
import path from 'node:path';

const legacy = path.resolve(process.argv[2] ?? '../website', 'src/styles');

const FONT_VARS = [
  [/['"]Press Start 2P['"]/g, 'var(--font-press-start)'],
  [/['"]JetBrains Mono['"]/g, 'var(--font-jetbrains-mono)'],
  [/['"]VT323['"]/g, 'var(--font-vt323)'],
  [/['"]Playfair Display['"]/g, 'var(--font-playfair)'],
  [/['"]EB Garamond['"]/g, 'var(--font-playfair)'],
  [/['"]Geist['"]/g, 'var(--font-geist)'],
  [/['"]Inter['"]/g, 'var(--font-inter)'],
];

function cutBetween(css, startMarker, endMarker) {
  const start = css.indexOf(startMarker);
  const end = css.indexOf(endMarker, start);
  if (start === -1 || end === -1) throw new Error(`Marker not found: ${startMarker}`);
  return css.slice(0, start) + css.slice(end);
}

function wrapInBaseLayer(css, startMarker, endMarker) {
  const start = css.indexOf(startMarker);
  const end = css.indexOf(endMarker, start);
  if (start === -1 || end === -1) throw new Error(`Marker not found: ${startMarker}`);
  const block = css.slice(start + startMarker.length, end).trim();
  return `${css.slice(0, start)}${startMarker}\n@layer base {\n${block}\n}\n\n${css.slice(end)}`;
}

function transform(css) {
  let out = css.replace(/^@import url\([^)]*fonts\.googleapis[^)]*\);\s*$/gm, '');
  for (const [re, value] of FONT_VARS) out = out.replace(re, value);
  return out;
}

async function port(file, dest, edit = (s) => s) {
  const css = (await fs.readFile(path.join(legacy, file), 'utf8')).replace(/\r\n/g, '\n');
  const result = edit(transform(css));
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.writeFile(dest, result);
  console.log(`${file} -> ${dest} (${result.split('\n').length} lines)`);
}

await port('index.css', 'src/styles/legacy-site.css', (css) => {
  let out = css.replace(/^@import "tailwindcss";\s*/m, '');
  out = cutBetween(out, '/* Scoped variables override for the Architect', '/* ============================================================\n   GLOBAL BASE STYLES');
  out = cutBetween(out, '/* ============================================================\n   PRELOADER', '/* ============================================================\n   DIVIDERS');
  out = out.replace(/body\.loading \{[^}]*\}\s*/g, '');
  // Element resets must live in the base layer: unlayered rules beat every Tailwind utility,
  // which silently disabled all p-*/m-*/space-*/bg-* classes in the legacy site.
  out = out.replace(
    /\*,\n\*::before,\n\*::after \{\n  box-sizing: border-box;\n  margin: 0;\n  padding: 0;\n\}/,
    '@layer base {\n  *,\n  *::before,\n  *::after {\n    box-sizing: border-box;\n    margin: 0;\n    padding: 0;\n  }\n}',
  );
  out = wrapInBaseLayer(out, '/* ---- LINKS ---- */', '/* ---- FOCUS ---- */');
  out = wrapInBaseLayer(out, '/* ---- RESETS ---- */', '/* ---- VISUALLY HIDDEN ---- */');
  out = out.replace(/\.material-symbols-outlined \{[^}]*\}\s*/g, '');
  return out;
});
await port('freelance-pune.css', 'src/styles/freelance-pune.css', (css) =>
  css.replace(/^@import '\.\/retro-theme\.css';\s*$/m, "@import './retro-theme.css';"),
);
await port('retro-theme.css', 'src/styles/retro-theme.css');
await port('whatsapp-ball.css', 'src/styles/whatsapp-ball.css');
