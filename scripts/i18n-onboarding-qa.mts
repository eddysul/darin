import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const file = "src/i18nCoreMessages.ts";
const source = ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const mapNames = ["onboardingKo", "onboardingEn", "onboardingJa", "onboardingEs", "onboardingZhCN", "homeKo", "homeEn", "homeJa", "homeEs", "homeZhCN"] as const;
const maps = new Map<string, Map<string, string>>();

function unwrapExpression(expression: ts.Expression): ts.Expression {
  if (ts.isAsExpression(expression) || ts.isSatisfiesExpression(expression) || ts.isParenthesizedExpression(expression)) {
    return unwrapExpression(expression.expression);
  }
  return expression;
}

for (const statement of source.statements) {
  if (!ts.isVariableStatement(statement)) continue;
  for (const declaration of statement.declarationList.declarations) {
    const name = ts.isIdentifier(declaration.name) ? declaration.name.text : "";
    if (!mapNames.includes(name as (typeof mapNames)[number]) || !declaration.initializer) continue;
    const initializer = unwrapExpression(declaration.initializer);
    if (!ts.isObjectLiteralExpression(initializer)) continue;
    const entries = new Map<string, string>();
    for (const property of initializer.properties) {
      if (!ts.isPropertyAssignment(property) || !ts.isStringLiteralLike(property.name) || !ts.isStringLiteralLike(property.initializer)) continue;
      entries.set(property.name.text, property.initializer.text);
    }
    maps.set(name, entries);
  }
}

for (const name of mapNames) assert.ok(maps.has(name), `missing explicit onboarding map: ${name}`);
const englishKeys = [...maps.get("onboardingEn")!.keys()].sort();
for (const name of mapNames.filter((name) => name.startsWith("onboarding"))) {
  const entries = maps.get(name)!;
  assert.deepEqual([...entries.keys()].sort(), englishKeys, `${name}: onboarding key parity failed`);
  for (const key of englishKeys) assert.ok(entries.get(key)?.trim(), `${name}: empty onboarding value for ${key}`);
}

const homeKeys = [...maps.get("homeEn")!.keys()].sort();
for (const name of mapNames.filter((name) => name.startsWith("home"))) {
  const entries = maps.get(name)!;
  assert.deepEqual([...entries.keys()].sort(), homeKeys, `${name}: home key parity failed`);
  for (const key of homeKeys) assert.ok(entries.get(key)?.trim(), `${name}: empty home value for ${key}`);
}

const localeSpreads = new Map<string, string[]>([
  ["ko", ["onboardingKo", "homeKo"]],
  ["en", ["onboardingEn", "homeEn"]],
  ["ja", ["onboardingJa", "homeJa"]],
  ["es", ["onboardingEs", "homeEs"]],
  ["zhCN", ["onboardingZhCN", "homeZhCN"]],
]);
for (const statement of source.statements) {
  if (!ts.isVariableStatement(statement)) continue;
  for (const declaration of statement.declarationList.declarations) {
    const name = ts.isIdentifier(declaration.name) ? declaration.name.text : "";
    const expected = localeSpreads.get(name);
    if (!expected || !declaration.initializer) continue;
    const initializer = unwrapExpression(declaration.initializer);
    if (!ts.isObjectLiteralExpression(initializer)) continue;
    const spreads = initializer.properties
      .filter(ts.isSpreadAssignment)
      .map((property) => ts.isIdentifier(property.expression) ? property.expression.text : "");
    for (const mapName of expected) assert.ok(spreads.includes(mapName), `${name}: expected explicit ${mapName} translations`);
    if (name !== "en") assert.ok(!spreads.includes("onboardingEn"), `${name}: English onboarding fallback remains`);
    if (name !== "en") assert.ok(!spreads.includes("homeEn"), `${name}: English home fallback remains`);
  }
}

const samples = [
  "onboardingFlow.stage.unbornTitle",
  "onboardingFlow.stage.bornTitle",
  "onboardingFlow.baby.prenatalName",
  "onboardingFlow.baby.dueDate",
  "onboardingFlow.complete.start",
];
const locales = new Map([
  ["ko", "onboardingKo"],
  ["en", "onboardingEn"],
  ["ja", "onboardingJa"],
  ["es", "onboardingEs"],
  ["zh-CN", "onboardingZhCN"],
]);

console.log(`PASS onboarding key parity: ${englishKeys.length} keys across ${locales.size} locales`);
console.log("PASS onboarding missing translation key: 0");
console.log("PASS onboarding English fallback in ja/es/zh-CN: 0");
console.log(`PASS home key parity: ${homeKeys.length} keys across ${locales.size} locales`);
console.log("PASS home missing translation key: 0");
console.log("PASS home English fallback in ja/es/zh-CN: 0");
for (const [locale, mapName] of locales) {
  const entries = maps.get(mapName)!;
  console.log(`SAMPLE ${locale}: ${samples.map((key) => entries.get(key)).join(" | ")}`);
}
