import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

// Rule 3: no scores, indices, percentiles, grades-as-ratings, rankings or "engagement" anywhere
// in the UI. This walks every string and JSX text the app can render (comments are ignored).
const FORBIDDEN = /\b(scores?|scoring|percentiles?|rank(?:s|ed|ing|ings)?|leaderboard|engagement|overall rating|best teacher|worst teacher|top teacher|index score)\b/i;
const ROOT = join(import.meta.dirname, "../../src");

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return files(p);
    return /\.(ts|tsx)$/.test(name) && !name.includes(".gen.") ? [p] : [];
  });
}

function renderableText(path: string): string[] {
  const src = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, path.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const out: string[] = [];
  const visit = (n: ts.Node) => {
    if (ts.isImportDeclaration(n)) return;
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n)) out.push(n.text);
    if (ts.isJsxText(n)) out.push(n.getText());
    ts.forEachChild(n, visit);
  };
  visit(src);
  return out;
}

describe("rule 3: no scores", () => {
  it("has no score-like words in any text the app renders", () => {
    const hits = files(ROOT).flatMap((f) => renderableText(f).filter((t) => FORBIDDEN.test(t)).map((t) => `${relative(ROOT, f)}: ${t}`));
    expect(hits).toEqual([]);
  });

  it("the check itself catches a score", () => {
    expect(FORBIDDEN.test("Overall score 90%")).toBe(true);
    expect(FORBIDDEN.test("Better than 95% of teachers (percentile)")).toBe(true);
    expect(FORBIDDEN.test("CBSE grade 10 Mathematics")).toBe(false);
  });
});
