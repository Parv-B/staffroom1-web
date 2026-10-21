import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";

export const SRC = join(import.meta.dirname, "../../src");

/** Every hand-written .ts/.tsx file under `dir` (generated files excluded). */
export function sourceFiles(dir: string = SRC): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return sourceFiles(p);
    return /\.(ts|tsx)$/.test(name) && !name.includes(".gen.") ? [p] : [];
  });
}

/** Every string literal and JSX text in a file: what the app can render (comments ignored). */
export function renderableText(path: string): string[] {
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
