import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import path from "node:path";
import type TypeScript from "typescript";
import { REVIEW_PENDING, keywordCoverage } from "../src/lib/studio/content";
import { QUALITY, copiedShare, issueBlocks, type ReviewCode, type ReviewIssue } from "../src/lib/studio/quality";
import type { AuditCheck, StudioPost } from "../src/lib/studio/types";
import { allFacts } from "./db";
import { currentProfile } from "./profile";
import { DUPLICATE_SIMILARITY, matchesFor, postText } from "./research/embeddings";

const decode = (s: string) =>
  s
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&amp;/g, "&");

const SCRIPT_LANG = /^(js|jsx|ts|tsx|javascript|typescript)$/i;
const OTHER_LANG = /^(bash|sh|shell|zsh|console|terminal|html|xml|css|scss|json|yaml|yml|sql|text|txt|plaintext|diff|nginx|toml|ini|env|http|graphql|md|markdown|python|py|dockerfile)$/i;

export function isScript(code: string, lang?: string) {
  if (lang) return SCRIPT_LANG.test(lang) ? true : OTHER_LANG.test(lang) ? false : looksLikeScript(code);
  return looksLikeScript(code);
}

function looksLikeScript(code: string) {
  // Comments are removed first: their prose ("do not import…") and syntax say nothing about the language.
  const t = code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/<!--[\s\S]*?-->/g, "").replace(/^\s*\/\/.*$/gm, "").trim();
  if (/^#{1,6}\s/m.test(t) && /^\s*[-*]\s/m.test(t)) return false;
  if (/^<[a-z]/i.test(t) && !/\b(const|function|return|import)\b/.test(t)) return false;
  if (/^(\$|#!|npm |npx |pnpm |yarn |git |curl |cd )/m.test(t) && !/\b(const|function|import)\b/.test(t)) return false;
  if (/^[{[]/.test(t) && !/\b(const|let|function|return)\b/.test(t)) return false;
  if (/^(<!doctype|<html|<head|<meta|<link|<script|<style)/i.test(t)) return false;
  if (/^[.#@a-z*:][^\n{=(]*\{\s*\n?\s*[a-z-]+\s*:[^:]/i.test(t) && !/\b(const|function|import|=>|interface|type|class)\b/.test(t)) return false;
  // Each keyword must appear in its actual declaration shape, not just as an English word ("type all props",
  // "export your data") — a prose block that happens to use one of these words otherwise reads as real code.
  return /\bimport\s|\bexport\s+(default\s*[{[]|(default\s+)?(function|class|const|let|interface|type)\b)|\bconst\s+[\w{[]|\blet\s+[\w{[]|\bvar\s+[\w{[]|\bfunction\s*[\w(]|\bclass\s+\w|\binterface\s+\w|\btype\s+\w+\s*=|\bawait\s+\w|=>/.test(
    t,
  );
}

// The compiler is large, so it loads only when an article actually has script code to check.
let compiler: typeof TypeScript | null = null;
const loadCompiler = () => (compiler ??= createRequire(path.join(process.cwd(), "package.json"))("typescript") as typeof TypeScript);

export function codeErrors(html: string) {
  const problems: string[] = [];
  let index = 0;
  for (const match of html.matchAll(/<pre[^>]*>\s*<code([^>]*)>([\s\S]*?)<\/code>\s*<\/pre>/gi)) {
    index++;
    const lang = match[1].match(/language-([\w-]+)/i)?.[1];
    // Articles elide code with a bare "..." line; that's editorial, not a bug.
    const code = decode(match[2]).replace(/^\s*(\.\.\.|…)\s*,?\s*$/gm, "");
    if (!isScript(code, lang)) continue;
    const ts = loadCompiler();
    const out = ts.transpileModule(code, {
      reportDiagnostics: true,
      fileName: "snippet.tsx",
      compilerOptions: { jsx: ts.JsxEmit.Preserve, target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext },
    });
    const first = out.diagnostics?.find((d) => d.category === ts.DiagnosticCategory.Error);
    if (first) problems.push(`Code block ${index}: ${ts.flattenDiagnosticMessageText(first.messageText, " ")}`);
  }
  return problems;
}

export const bodyHash = (html: string) => createHash("sha256").update(html).digest("hex").slice(0, 32);

const STAT = /\b\d+(?:\.\d+)?\s?%|\b\d+\s+(?:out of|in every)\s+\d+\b|\b\d+(?:\.\d+)?\s?(?:x|times)\s+(?:faster|slower|more|better|higher|lower|fewer)\b/gi;

/** Statistics with no proof: not in the owner's facts and no external source linked in the same sentence. */
export function unsupportedNumbers(html: string, facts: { statement: string }[]) {
  // Whole figures only: a saved "65%" must not make an invented "5%" look proven.
  const normal = (value: string) => value.replace(/\s+/g, " ").trim().toLowerCase();
  const known = new Set(facts.flatMap((f) => [...f.statement.matchAll(STAT)].map((m) => normal(m[0]))));
  const found = new Set<string>();
  const prose = html.replace(/<pre[\s\S]*?<\/pre>/gi, " ").replace(/<code[^>]*>[\s\S]*?<\/code>/gi, " ");
  for (const block of prose.match(/<(p|li|td|blockquote|h[2-4])[^>]*>[\s\S]*?<\/\1>/gi) ?? []) {
    for (const sentence of block.split(/(?<=[.!?])\s+/)) {
      if (externalLink().test(sentence)) continue;
      const text = sentence.replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/gi, " ");
      for (const match of text.matchAll(STAT)) {
        const value = match[0].replace(/\s+/g, " ").trim();
        // "100%" is usually a figure of speech ("100% custom") unless it measures a share of something.
        if (/^100\s?%$/.test(value) && !/^\s*of\b/i.test(text.slice(match.index + match[0].length))) continue;
        if (!known.has(normal(value))) found.add(value);
      }
    }
  }
  return [...found];
}

/** A link to another site in the same sentence counts as a source; links to the client's own site don't. */
const externalLink = () => new RegExp(`<a\\s[^>]*href="https?:\\/\\/(?!${new URL(currentProfile().origin).host.replace(/\./g, "\\.")})`, "i");

const MEASURED = /\b(?:under|below|over|within)\s+\d+(?:\.\d+)?\s?(?:ms|milliseconds?|seconds?|kb|mb)\b|\b\d+(?:\.\d+)?\s*(?:to|–|-)\s*\d+(?:\.\d+)?\s?(?:ms|milliseconds?|seconds?|kb|mb)\b/gi;

/** Time and size claims can be real documented thresholds, so these are shown for review rather than blocking. */
export function measuredClaims(html: string) {
  const prose = html.replace(/<pre[\s\S]*?<\/pre>/gi, " ").replace(/<code[^>]*>[\s\S]*?<\/code>/gi, " ").replace(/<[^>]+>/g, " ");
  return [...new Set([...prose.matchAll(MEASURED)].map((m) => m[0].replace(/\s+/g, " ")))];
}

/** Client names from the facts list, in the text or in a link such as a case-study URL. */
export function namedClients(html: string, facts: { subject: string }[]) {
  const lower = html.toLowerCase();
  return [...new Set(facts.map((f) => f.subject))].filter((name) => {
    const plain = name.toLowerCase();
    return lower.includes(plain) || lower.includes(plain.replace(/[^a-z0-9]+/g, "-"));
  });
}

interface Verification {
  hash: string;
  issues?: ReviewIssue[];
  code?: ReviewCode[];
}

function verifiedCheck(post: StudioPost): AuditCheck {
  const label = "Technical review passed";
  const saved = post.seo_plan?.verification as Verification | undefined;
  if (!saved || saved.hash !== bodyHash(post.body_html)) {
    return post.stage === "live"
      ? { id: "verified", label, pass: true, detail: "Published before review", level: "warning" }
      : { id: "verified", label, pass: false, detail: REVIEW_PENDING, level: "waiting" };
  }
  const issues = saved.issues ?? [];
  const proven = issues.filter((i) => issueBlocks(i, saved.code));
  if (proven.length) {
    return { id: "verified", label, pass: false, level: "autofix", detail: proven.slice(0, 2).map((e) => `${e.claim}: ${e.problem}`.slice(0, 160)).join("; ") };
  }
  const unproven = issues.filter((i) => i.severity === "error").length;
  return unproven
    ? { id: "verified", label, pass: true, level: "warning", detail: `${unproven} unproven AI concern${unproven > 1 ? "s" : ""}, worth a look` }
    : { id: "verified", label, pass: true, level: "blocker" };
}

/** High similarity alone can just mean a shared topic. It blocks only for the same search intent or copied text. */
function duplicateCheck(post: StudioPost, other: Pick<StudioPost, "slug" | "seo_plan" | "body_html"> | undefined, similarity: number): AuditCheck {
  const label = "Not a near-duplicate of another post";
  if (!other) return { id: "duplicate", label, pass: true, level: "blocker" };
  const percent = Math.round(similarity * 100);
  const mine = post.seo_plan?.targetQuery ?? post.title;
  const theirs = other.seo_plan?.targetQuery ?? "";
  const sameIntent = Boolean(theirs) && Math.min(keywordCoverage(mine, theirs), keywordCoverage(theirs, mine)) >= QUALITY.duplicate.sameQuery;
  const copied = copiedShare(post.body_html, other.body_html ?? "");
  if (sameIntent || copied >= QUALITY.duplicate.copiedText) {
    const why = sameIntent ? "same search intent" : `${Math.round(copied * 100)}% copied text`;
    return { id: "duplicate", label, pass: false, level: "blocker", detail: `${percent}% similar to /blog/${other.slug} (${why})` };
  }
  return { id: "duplicate", label, pass: true, level: "warning", detail: `Related to /blog/${other.slug} (${percent}%), different search intent` };
}

/** Checks that need the compiler or the model: run by the audit job, then carried on the post's saved audit. */
export async function deepChecks(post: StudioPost, posts: Pick<StudioPost, "id" | "slug" | "title" | "seo_plan" | "body_html">[]): Promise<AuditCheck[]> {
  const broken = codeErrors(post.body_html);
  const facts = await allFacts();
  const numbers = unsupportedNumbers(post.body_html, facts);
  const measured = measuredClaims(post.body_html);
  const clients = post.slug.startsWith("case-study-") ? [] : namedClients(post.body_html, facts);
  const checks: AuditCheck[] = [
    { id: "code", label: "Code examples compile", pass: broken.length === 0, detail: broken.slice(0, 3).join("; ") || undefined, level: "blocker" },
    {
      id: "numbers",
      label: "No unproven statistics",
      pass: numbers.length === 0,
      detail: numbers.length ? `Add a source or remove: ${numbers.slice(0, 6).join(", ")}` : measured.length ? `Double-check: ${measured.slice(0, 4).join(", ")}` : undefined,
      level: numbers.length ? "autofix" : measured.length ? "warning" : "blocker",
    },
    { id: "clients", label: "No client names", pass: clients.length === 0, detail: clients.join(", ") || undefined, level: "blocker" },
    verifiedCheck(post),
  ];
  try {
    const matches = await matchesFor("post", post.id, postText(post));
    const candidates = matches
      .filter((m) => m.owner_type === "post" && m.similarity >= DUPLICATE_SIMILARITY)
      .flatMap((m) => {
        const other = posts.find((p) => p.id === m.owner_id);
        return other ? [duplicateCheck(post, other, m.similarity)] : [];
      });
    checks.push(candidates.find((c) => !c.pass) ?? candidates[0] ?? duplicateCheck(post, undefined, 0));
  } catch (error) {
    // A model failure shouldn't stop publishing; the result says the check didn't run.
    checks.push({ id: "duplicate", label: "Not a near-duplicate of another post", pass: true, level: "warning", detail: `Skipped: ${error instanceof Error ? error.message.slice(0, 80) : "unavailable"}` });
  }
  return checks;
}
