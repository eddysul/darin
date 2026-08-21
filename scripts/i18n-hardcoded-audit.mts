import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const root = path.resolve("src");
const excluded = new Set(["i18n.ts", "i18nCoreMessages.ts"]);
const korean = /[가-힣]/;

type Finding = { file: string; strings: number; group: string };

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return /\.tsx?$/.test(entry.name) && !excluded.has(entry.name) ? [full] : [];
  });
}

function groupFor(file: string): string {
  const name = path.basename(file);
  if (/EmailAuth|AuthStart|TermsConsent|LoginScreen/.test(name)) return "critical/signup";
  if (/Onboarding|ProfileSetup|ParentSetup|CaregiverSetup/.test(name)) return "critical/onboarding";
  if (/BabySetup|BabyProfile/.test(name)) return "critical/baby-registration";
  if (/MainTabs|RecordHomeHeader|BabySwitcher|TodayLogSummary|TodayTimeline/.test(name)) return "critical/home";
  if (/RecordScreen|RecordDetail|QuickRecord|OneTouch|ActiveTimer|RecordDatePicker|CustomCategory/.test(name)) return "critical/record";
  if (/DiaryScreen|DiaryCompose|DiaryReminder|DiaryCover|DiaryPage/.test(name)) return "critical/diary";
  if (/MenuScreen|AppSettings|AccountSettings|MyProfile/.test(name)) return "critical/settings";
  if (/Report|Overview/.test(name)) return "next/report";
  if (/Growth/.test(name)) return "next/growth";
  if (/Milestone/.test(name)) return "next/milestone";
  if (/Consult|AiChat|AIChat/.test(name)) return "next/consult";
  return "next/secondary";
}

function countStrings(file: string): number {
  const sourceText = fs.readFileSync(file, "utf8");
  const source = ts.createSourceFile(file, sourceText, ts.ScriptTarget.Latest, true, file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  let count = 0;
  const visit = (node: ts.Node) => {
    if ((ts.isStringLiteralLike(node) || ts.isJsxText(node)) && korean.test(node.getText(source))) count += 1;
    ts.forEachChild(node, visit);
  };
  visit(source);
  return count;
}

const findings: Finding[] = walk(root)
  .map((file) => ({ file: path.relative(process.cwd(), file), strings: countStrings(file), group: groupFor(file) }))
  .filter(({ strings }) => strings > 0)
  .sort((a, b) => a.group.localeCompare(b.group) || b.strings - a.strings || a.file.localeCompare(b.file));

const grouped = new Map<string, Finding[]>();
for (const finding of findings) grouped.set(finding.group, [...(grouped.get(finding.group) ?? []), finding]);
for (const [group, rows] of grouped) {
  const strings = rows.reduce((sum, row) => sum + row.strings, 0);
  console.log(`\n${group}: ${rows.length} files, ${strings} strings`);
  for (const row of rows) console.log(`  ${row.strings.toString().padStart(3)}  ${row.file}`);
}
console.log(`\nTOTAL: ${findings.length} files, ${findings.reduce((sum, row) => sum + row.strings, 0)} strings`);
