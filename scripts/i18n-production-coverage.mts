import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { createT, type Locale, type MessageKey } from "../src/i18n.ts";

const root = process.cwd();
const entry = path.join(root, "App.tsx");
const sourceExtensions = [".ts", ".tsx", ".js", ".jsx"];

function resolveSource(fromFile: string, specifier: string): string | null {
  if (!specifier.startsWith(".")) return null;
  const base = path.resolve(path.dirname(fromFile), specifier);
  const candidates = [
    base,
    ...sourceExtensions.map((extension) => `${base}${extension}`),
    ...sourceExtensions.map((extension) => path.join(base, `index${extension}`)),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile()) ?? null;
}

function sourceFile(file: string): ts.SourceFile {
  const text = fs.readFileSync(file, "utf8");
  const kind = file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  return ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, kind);
}

function reachableFiles(): Set<string> {
  const visited = new Set<string>();
  const queue = [entry];
  while (queue.length > 0) {
    const file = queue.pop()!;
    if (visited.has(file)) continue;
    visited.add(file);
    const source = sourceFile(file);
    const enqueue = (specifier: string) => {
      const resolved = resolveSource(file, specifier);
      if (resolved && !visited.has(resolved)) queue.push(resolved);
    };
    for (const statement of source.statements) {
      if ((ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement))
        && statement.moduleSpecifier && ts.isStringLiteralLike(statement.moduleSpecifier)) {
        enqueue(statement.moduleSpecifier.text);
      }
    }
    const visit = (node: ts.Node) => {
      if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword
        && node.arguments[0] && ts.isStringLiteralLike(node.arguments[0])) {
        enqueue(node.arguments[0].text);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return visited;
}

function usedTranslationKeys(files: Iterable<string>): Set<string> {
  const keys = new Set<string>();
  for (const file of files) {
    const source = sourceFile(file);
    const visit = (node: ts.Node) => {
      if (ts.isCallExpression(node)
        && ts.isIdentifier(node.expression)
        && node.expression.text === "t"
        && node.arguments[0]
        && ts.isStringLiteralLike(node.arguments[0])) {
        keys.add(node.arguments[0].text);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return keys;
}

const reachable = reachableFiles();
const keys = usedTranslationKeys(reachable);
const locales: Locale[] = ["ko", "en", "ja", "es", "zh-CN"];
const translators = Object.fromEntries(locales.map((locale) => [locale, createT(locale)])) as Record<Locale, ReturnType<typeof createT>>;
const missing: string[] = [];
const englishFallbacks: string[] = [];
// These values contain only punctuation, placeholders, or terms spelled the
// same in Spanish and English. Equality is intentional, not fallback.
const languageNeutralValues = new Set([
  "es:auth.legal.suffix",
  "ja:onboardingFlow.authorByline",
  "zh-CN:onboardingFlow.authorByline",
  "es:onboardingFlow.requests.meta",
  "zh-CN:onboardingFlow.requests.meta",
  "es:record.custom.color",
  "es:record.custom.colorA11y",
  "es:record.date.daySuffix",
  "es:record.date.monthSuffix",
  "es:record.date.yearSuffix",
  "es:record.quick.color",
  "es:record.timeline.labelAmount",
  "zh-CN:record.timeline.labelAmount",
  "es:record.timeline.labelDuration",
  "zh-CN:record.timeline.labelDuration",
  "ja:record.timeline.sideValue",
  "es:record.timeline.sideValue",
  "zh-CN:record.timeline.sideValue",
]);

for (const key of [...keys].sort()) {
  const values = Object.fromEntries(locales.map((locale) => [locale, translators[locale](key as MessageKey)])) as Record<Locale, string | undefined>;
  for (const locale of locales) {
    if (!values[locale]?.trim()) missing.push(`${locale}:${key}`);
  }
  for (const locale of ["ja", "es", "zh-CN"] as const) {
    const localeKey = `${locale}:${key}`;
    if (values[locale] === values.en && values.en !== key && !languageNeutralValues.has(localeKey)) {
      englishFallbacks.push(localeKey);
    }
  }
}

console.log(`INFO reachable source files: ${reachable.size}`);
console.log(`INFO reachable literal translation keys: ${keys.size}`);
if (missing.length > 0) {
  console.error(`FAIL missing translations (${missing.length})`);
  console.error(missing.join("\n"));
  process.exitCode = 1;
} else {
  console.log("PASS no missing translations in reachable production UI");
}
if (englishFallbacks.length > 0) {
  console.error(`FAIL English fallback in ja/es/zh-CN (${englishFallbacks.length})`);
  console.error(englishFallbacks.join("\n"));
  process.exitCode = 1;
} else {
  console.log("PASS no English fallback in reachable ja/es/zh-CN production UI");
}
