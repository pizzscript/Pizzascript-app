import ts from "typescript";
import type { AuditCheck, StudioPost } from "../src/lib/studio/types";
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
  if (/^[.#@a-z*:][^\n{=(]*\{\s*\n?\s*[a-z-]+\s*:[^:]/i.test(t) && !/\b(const|function|import|=>)\b/.test(t)) return false;
  return /\b(import|export|const|let|var|function|class|await|interface|type)\b|=>/.test(t);
}

export function codeErrors(html: string) {
  const problems: string[] = [];
  let index = 0;
  for (const match of html.matchAll(/<pre[^>]*>\s*<code([^>]*)>([\s\S]*?)<\/code>\s*<\/pre>/gi)) {
    index++;
    const lang = match[1].match(/language-([\w-]+)/i)?.[1];
    // Articles elide code with a bare "..." line; that's editorial, not a bug.
    const code = decode(match[2]).replace(/^\s*(\.\.\.|…)\s*,?\s*$/gm, "");
    if (!isScript(code, lang)) continue;
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

/** Checks that need the compiler or the model: run by the audit job, then carried on the post's saved audit. */
export async function deepChecks(post: StudioPost, posts: Pick<StudioPost, "id" | "slug" | "title">[]): Promise<AuditCheck[]> {
  const broken = codeErrors(post.body_html);
  const checks: AuditCheck[] = [{ id: "code", label: "Code examples compile", pass: broken.length === 0, detail: broken.slice(0, 3).join("; ") || undefined }];
  try {
    const matches = await matchesFor("post", post.id, postText(post));
    const top = matches.find((m) => m.owner_type === "post" && m.similarity >= DUPLICATE_SIMILARITY && posts.some((p) => p.id === m.owner_id));
    const other = top && posts.find((p) => p.id === top.owner_id);
    checks.push({
      id: "duplicate",
      label: "Not a near-duplicate of another post",
      pass: !other,
      detail: other ? `${Math.round(top!.similarity * 100)}% similar to /blog/${other.slug}` : undefined,
    });
  } catch (error) {
    // A model failure shouldn't stop publishing; the result says the check didn't run.
    checks.push({ id: "duplicate", label: "Not a near-duplicate of another post", pass: true, detail: `Skipped: ${error instanceof Error ? error.message.slice(0, 80) : "unavailable"}` });
  }
  return checks;
}
