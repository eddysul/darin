import fs from "node:fs";
import ts from "typescript";

const [catalogPath, prefix, ...files] = process.argv.slice(2);
if (!catalogPath || !prefix || files.length === 0) throw new Error("usage: catalog prefix files...");

const catalogText = fs.readFileSync(catalogPath, "utf8");
const rowPattern = /^\s*\["(\d+)",\s*"((?:[^"\\]|\\.)*)",/gm;
const inverse = new Map<string, string>();
for (const match of catalogText.matchAll(rowPattern)) {
  inverse.set(JSON.parse(`"${match[2]}"`), `${prefix}.${match[1]}`);
}

for (const file of files) {
  const sourceText = fs.readFileSync(file, "utf8");
  const source = ts.createSourceFile(file, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const edits: Array<{ start: number; end: number; text: string }> = [];
  const visit = (node: ts.Node) => {
    if (ts.isStringLiteralLike(node)) {
      const key = inverse.get(node.text);
      if (key) edits.push({ start: node.getStart(source), end: node.getEnd(), text: `t("${key}")` });
    } else if (ts.isJsxText(node)) {
      const raw = node.getText(source);
      const value = raw.trim().replace(/\s+/g, " ");
      const key = inverse.get(value);
      if (key) {
        const leading = raw.slice(0, raw.indexOf(raw.trimStart()));
        const trailing = raw.slice(raw.trimEnd().length);
        edits.push({ start: node.getStart(source), end: node.getEnd(), text: `${leading}{t("${key}")}${trailing}` });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  let next = sourceText;
  for (const edit of edits.sort((a, b) => b.start - a.start)) next = next.slice(0, edit.start) + edit.text + next.slice(edit.end);
  fs.writeFileSync(file, next);
  console.log(`${file}: ${edits.length} replacements`);
}
