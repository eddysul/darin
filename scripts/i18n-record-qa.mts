import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

type Catalog = Map<string, string>;

function unwrap(expression: ts.Expression): ts.Expression {
  if (ts.isAsExpression(expression) || ts.isSatisfiesExpression(expression) || ts.isParenthesizedExpression(expression)) {
    return unwrap(expression.expression);
  }
  return expression;
}

function readCatalogs(file: string, names: readonly string[]): Map<string, Catalog> {
  const source = ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const catalogs = new Map<string, Catalog>();
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      const name = ts.isIdentifier(declaration.name) ? declaration.name.text : "";
      if (!names.includes(name) || !declaration.initializer) continue;
      const initializer = unwrap(declaration.initializer);
      if (!ts.isObjectLiteralExpression(initializer)) continue;
      const entries: Catalog = new Map();
      for (const property of initializer.properties) {
        if (!ts.isPropertyAssignment(property) || !ts.isStringLiteralLike(property.name) || !ts.isStringLiteralLike(property.initializer)) continue;
        entries.set(property.name.text, property.initializer.text);
      }
      catalogs.set(name, entries);
    }
  }
  return catalogs;
}

const coreNames = ["recordEn", "recordKo", "recordJa", "recordEs", "recordZhCN"] as const;
const detailNames = ["recordDetailEn", "recordDetailKo", "recordDetailJa", "recordDetailEs", "recordDetailZhCN"] as const;
const core = readCatalogs("src/i18nCoreMessages.ts", coreNames);
const detail = readCatalogs("src/i18nRecordDetailMessages.ts", detailNames);

function placeholders(value: string): string[] {
  return [...value.matchAll(/\{([A-Za-z0-9_]+)\}/g)].map((match) => match[1]).sort();
}

function assertParity(catalogs: Map<string, Catalog>, names: readonly string[], englishName: string) {
  for (const name of names) assert.ok(catalogs.has(name), `missing explicit catalog: ${name}`);
  const english = catalogs.get(englishName)!;
  const englishKeys = [...english.keys()].sort();
  for (const name of names) {
    const catalog = catalogs.get(name)!;
    assert.deepEqual([...catalog.keys()].sort(), englishKeys, `${name}: key parity failed`);
    for (const key of englishKeys) {
      const value = catalog.get(key) ?? "";
      assert.ok(value.trim(), `${name}: empty translation for ${key}`);
      assert.deepEqual(placeholders(value), placeholders(english.get(key)!), `${name}: placeholder mismatch for ${key}`);
    }
  }
  return englishKeys.length;
}

const coreCount = assertParity(core, coreNames, "recordEn");
const detailCount = assertParity(detail, detailNames, "recordDetailEn");

const allowedExactEnglish = new Set([
  "record.quick.color", "record.quick.durationMinutes", "record.date.yearSuffix", "record.date.monthSuffix",
  "record.date.daySuffix", "record.custom.color", "record.custom.colorA11y", "record.custom.icon.hospital",
  "record.timeline.minutes", "record.timeline.labelAmount", "record.timeline.labelDuration", "record.timeline.sideValue",
  "record.detail.monthDay", "record.detail.minutes", "record.detail.option.no", "record.detail.option.normal",
  "record.detail.option.oral",
]);

for (const [catalogs, englishName, localeNames] of [
  [core, "recordEn", ["recordJa", "recordEs", "recordZhCN"]],
  [detail, "recordDetailEn", ["recordDetailJa", "recordDetailEs", "recordDetailZhCN"]],
] as const) {
  const english = catalogs.get(englishName)!;
  for (const localeName of localeNames) {
    const locale = catalogs.get(localeName)!;
    const fallbacks = [...english.keys()].filter((key) => english.get(key) === locale.get(key) && !allowedExactEnglish.has(key));
    assert.deepEqual(fallbacks, [], `${localeName}: English fallback remains`);
  }
}

const korean = /[가-힣]/;
for (const [catalogs, names] of [[core, ["recordJa", "recordEs", "recordZhCN"]], [detail, ["recordDetailJa", "recordDetailEs", "recordDetailZhCN"]]] as const) {
  for (const name of names) {
    const leaked = [...catalogs.get(name)!.entries()].filter(([, value]) => korean.test(value)).map(([key]) => key);
    assert.deepEqual(leaked, [], `${name}: Korean text leaked into translated catalog`);
  }
}

const source = fs.readFileSync("src/i18nCoreMessages.ts", "utf8");
for (const [locale, expected] of [["ko", "recordKo"], ["en", "recordEn"], ["ja", "recordJa"], ["es", "recordEs"], ["zhCN", "recordZhCN"]] as const) {
  const match = source.match(new RegExp(`const ${locale}(?:\\s*:[^=]+)?\\s*=\\s*\\{([\\s\\S]*?)\\n\\};`));
  assert.ok(match?.[1].includes(`...${expected}`), `${locale}: expected ${expected} spread`);
  if (locale !== "en") assert.ok(!match?.[1].includes("...recordEn"), `${locale}: English Record fallback spread remains`);
}

console.log(`PASS Record core parity: ${coreCount} keys across 5 locales`);
console.log(`PASS Record detail parity: ${detailCount} keys across 5 locales`);
console.log("PASS Record placeholders, non-empty values, Korean leakage, and English fallback checks");
for (const [locale, coreName, detailName] of [["ko", "recordKo", "recordDetailKo"], ["en", "recordEn", "recordDetailEn"], ["ja", "recordJa", "recordDetailJa"], ["es", "recordEs", "recordDetailEs"], ["zh-CN", "recordZhCN", "recordDetailZhCN"]] as const) {
  console.log(`SAMPLE ${locale}: ${core.get(coreName)!.get("record.category.pump")} | ${detail.get(detailName)!.get("record.detail.leftTime")} | ${detail.get(detailName)!.get("record.detail.option.loose")} | ${core.get(coreName)!.get("record.timeline.spitUp")}`);
}
