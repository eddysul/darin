const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

require.extensions[".ts"] = (module, filename) => {
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  module._compile(output, filename);
};

const {
  buildOverviewCategoryCompareRows,
  buildOverviewCategoryCardsAtCutoff,
  buildOverviewInspectionRows,
} = require("../src/utils/overviewCategoryCards.ts");
const { sleepMinutesUntil } = require("../src/utils/overviewRhythm.ts");
const log = (id, cat, time, extra = {}) => ({ id, cat, time, dateKey: "2026-09-18", ...extra });
const today = [
  log("tf1", "formula", "08:00", { amount: "120" }),
  log("tf2", "formula", "09:00", { amount: "100" }),
  log("ts", "sleep", "01:00", { duration: "180" }),
  log("td", "diaper", "09:10"),
  log("tt", "tummy", "09:50", { duration: "30" }),
  log("tb", "bath", "09:20"),
  log("tc", "custom:walk", "09:40"),
  log("tp", "pump", "09:05", { amount: "80" }),
  log("future", "pump", "11:00", { amount: "80" }),
  log("future-sleep", "sleep", "21:00", { duration: "240" }),
];
const yesterday = [
  log("yf", "formula", "08:30", { amount: "90" }),
  log("ys", "sleep", "01:00", { duration: "120" }),
  log("yd1", "diaper", "08:10"),
  log("yd2", "diaper", "09:30"),
  log("yt", "tummy", "09:40", { duration: "10" }),
  log("yp", "play", "09:10", { duration: "20" }),
  log("yc", "custom:walk", "09:30"),
  log("ypump", "pump", "09:15", { amount: "50" }),
];

const atTen = buildOverviewCategoryCompareRows(today, yesterday, 600);
const byId = (rows, id) => rows.find((row) => row.id === id);
assert.deepEqual([byId(atTen, "feed")?.delta, byId(atTen, "feed")?.unit], [130, "ml"]);
assert.deepEqual([byId(atTen, "sleep")?.delta, byId(atTen, "sleep")?.unit], [60, "min"]);
assert.deepEqual([byId(atTen, "diaper")?.delta, byId(atTen, "diaper")?.unit], [-1, "count"]);
assert.deepEqual([byId(atTen, "tummy")?.delta, byId(atTen, "tummy")?.unit], [0, "min"], "running duration stops at the selected minute");
assert.equal(byId(atTen, "bath")?.delta, null, "today-only records are shown without inventing a trend");
assert.equal(byId(atTen, "play")?.delta, null, "yesterday-only records are shown without inventing a trend");
assert.equal(byId(atTen, "custom:walk")?.delta, 0, "custom categories are not omitted");
assert.deepEqual([byId(atTen, "pump")?.delta, byId(atTen, "pump")?.unit], [30, "ml"], "amount categories use their recorded amounts");
assert.equal(byId(buildOverviewCategoryCompareRows(today, yesterday, 540), "pump"), undefined, "future records are excluded");
assert.equal(sleepMinutesUntil(today, 600), 180, "a future evening sleep must not count toward this morning");
assert.equal(byId(buildOverviewCategoryCompareRows(today.filter((item) => item.cat !== "diaper"), yesterday, 600), "diaper")?.delta, null,
  "deleting today's record removes the previous comparison");
const mixedFeed = buildOverviewCategoryCompareRows(
  [log("bottle", "formula", "08:00", { amount: "120" })],
  [log("direct", "breast", "08:00")],
  600,
);
assert.deepEqual([byId(mixedFeed, "feed")?.delta, byId(mixedFeed, "feed")?.unit], [0, "count"],
  "mixed feeding units fall back to a comparable count");
assert.deepEqual(buildOverviewCategoryCompareRows([], [], 600), [], "empty days have no fixed tooltip rows");
const atTenCards = buildOverviewCategoryCardsAtCutoff(today, yesterday, 600);
assert.deepEqual([byId(atTenCards, "feed")?.delta, byId(atTenCards, "feed")?.unit], [130, "ml"],
  "default card comparison uses today-to-now and yesterday-to-the-same-time");
assert.equal(byId(atTenCards, "sleep")?.delta, 60, "default sleep cards clip both days at the same time");
const inspectedToday = buildOverviewInspectionRows(today, 545);
assert.equal(byId(inspectedToday, "feed")?.eventValue, 100, "today cursor reports the nearby event value");
assert.equal(byId(inspectedToday, "feed")?.cumulative, 220, "today cursor reports that day's cumulative value");
const inspectedYesterday = buildOverviewInspectionRows(yesterday, 515);
assert.equal(byId(inspectedYesterday, "feed")?.eventValue, 90, "yesterday cursor is calculated independently");
assert.equal(byId(inspectedYesterday, "feed")?.cumulative, 90);

const demo = fs.readFileSync(path.join(__dirname, "../demos/overview-demo.html"), "utf8");
const native = fs.readFileSync(path.join(__dirname, "../src/components/babylog/OverviewRhythmCard.tsx"), "utf8");
for (const pose of ["idle", "feed", "diaper", "rest"]) {
  assert.ok(fs.existsSync(path.join(__dirname, `../demos/assets/rhythm-duck-${pose}.png`)), `${pose} pose asset exists`);
}
assert.match(demo, /\.rhythm-duck\.sleeping \{ background-image: url\("\.\/assets\/rhythm-duck-rest\.png/);
assert.doesNotMatch(demo, /darin-duck-sprites\.png/, "overview demo no longer crops arbitrary cells from the large sprite sheet");
assert.match(demo, /compareRows\.replaceChildren\(\)/);
assert.match(demo, /event-duration/);
assert.match(demo, /track-guide/);
assert.match(demo, /00:00/);
assert.match(demo, /segmentLabel/);
assert.match(native, /buildOverviewCategoryCardsAtCutoff\(/);
assert.match(native, /buildOverviewInspectionRows\(/);
assert.match(native, /day: "today" \| "yesterday"/);
assert.match(native, /todayPan\.panHandlers/);
assert.match(native, /yesterdayPan\.panHandlers/);
assert.doesNotMatch(native, /setPlayhead/);
assert.match(native, /trackEventPoint/);
assert.match(native, /TimeGuides/);
assert.match(native, /segmentLabel/);
assert.doesNotMatch(native, /sleepingDuck|duckCrop|rhythmSprites/);
console.log("overview category comparison QA: PASS (dynamic categories, cutoff, missing-day, sleeping asset)");
