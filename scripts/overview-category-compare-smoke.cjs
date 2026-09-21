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
  buildOverviewCategoryCardsAtCursors,
  buildOverviewCategoryCardsAtCutoff,
  buildOverviewIndependentCompareRows,
  buildOverviewInspectionRows,
  compareMetricFor,
} = require("../src/utils/overviewCategoryCards.ts");
const { overviewCompareOrderIndex } = require("../src/utils/overviewCategoryOrder.ts");
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
const laterToday = buildOverviewInspectionRows(today, 10 * 60);
assert.equal(byId(laterToday, "feed")?.eventValue, 100, "event detail uses the last feed at or before the cursor");
assert.equal(byId(laterToday, "feed")?.cumulative, 220, "cumulative includes every feed through the cursor");
const emptyInspect = buildOverviewInspectionRows([], 600);
assert.deepEqual(emptyInspect, [], "an empty day is zero records, not a lookup failure");
const overnight = buildOverviewInspectionRows([
  log("night", "sleep", "22:00", { duration: "180" }),
], 23 * 60);
assert.equal(byId(overnight, "sleep")?.eventValue, 60, "overnight sleep is clipped at the cursor, not padded past midnight");
assert.equal(byId(overnight, "sleep")?.cumulative, 60);
const afterMidnight = buildOverviewInspectionRows([
  log("night", "sleep", "22:00", { duration: "180" }),
], 30);
assert.equal(byId(afterMidnight, "sleep")?.eventValue, null, "the next morning is a new clock, not the same night's leftover");
assert.equal(byId(afterMidnight, "sleep")?.cumulative, 0);
const activeNap = buildOverviewInspectionRows([
  log("nap", "sleep", "13:00", { duration: "120" }),
], 13 * 60 + 40);
assert.equal(byId(activeNap, "sleep")?.eventValue, 40, "an in-progress nap uses elapsed minutes");
assert.equal(byId(activeNap, "sleep")?.cumulative, 40);
const diaperInspect = buildOverviewInspectionRows([
  log("d1", "diaper", "08:00", { chip: "소변" }),
  log("d2", "diaper", "09:00", { chip: "대변" }),
], 9 * 60 + 20);
assert.equal(byId(diaperInspect, "diaper")?.eventLabel, "대변");
assert.equal(byId(diaperInspect, "diaper")?.cumulative, 2);
const independentCards = buildOverviewCategoryCardsAtCursors(today, yesterday, 9 * 60 + 5, 8 * 60 + 35);
assert.equal(byId(independentCards, "feed")?.numeric, 220);
assert.equal(byId(independentCards, "feed")?.delta, 130, "today 09:05 vs yesterday 08:35 stay independent");
const independentRows = buildOverviewIndependentCompareRows(today, yesterday, 13 * 60 + 30, 14 * 60 + 10);
assert.equal(byId(independentRows, "feed")?.todayCumulative, 220);
assert.equal(byId(independentRows, "feed")?.yesterdayCumulative, 90);
assert.equal(byId(independentRows, "feed")?.delta, 130);
assert.equal(byId(buildOverviewIndependentCompareRows([], yesterday, 600, 600), "feed")?.hasToday, false);
assert.equal(byId(buildOverviewIndependentCompareRows([], yesterday, 600, 600), "feed")?.hasYesterday, true);
assert.equal(byId(buildOverviewIndependentCompareRows([], yesterday, 600, 600), "feed")?.delta, null, "one-sided records do not invent a trend");
assert.deepEqual(buildOverviewIndependentCompareRows([], [], 600, 600), [], "empty days hide every compare row");
assert.equal(
  buildOverviewIndependentCompareRows(
    [log("only-feed", "formula", "08:00", { amount: "120" })],
    [log("only-feed-y", "formula", "08:00", { amount: "90" })],
    600,
    600,
  ).some((row) => row.id === "sleep" || row.id === "diaper"),
  false,
  "categories without records stay hidden",
);

const idsOf = (rows) => rows.map((row) => row.id);
const feedOnly = buildOverviewIndependentCompareRows(
  [log("only-feed", "formula", "08:00", { amount: "120" })],
  [log("only-feed-y", "formula", "08:00", { amount: "90" })],
  600,
  600,
);
assert.deepEqual(idsOf(feedOnly), ["feed"], "A: feed-only days render feed only");

const feedAndTummy = buildOverviewIndependentCompareRows(
  [log("feed-a", "formula", "08:00", { amount: "120" }), log("tummy-a", "tummy", "09:00", { duration: "18" })],
  [log("feed-b", "formula", "08:00", { amount: "90" }), log("tummy-b", "tummy", "09:00", { duration: "10" })],
  600,
  600,
);
assert.deepEqual(idsOf(feedAndTummy), ["feed", "tummy"], "B: feed + tummy only");
assert.equal(byId(feedAndTummy, "tummy")?.todayCumulative, 18);
assert.equal(byId(feedAndTummy, "tummy")?.yesterdayCumulative, 10);
assert.equal(byId(feedAndTummy, "tummy")?.delta, 8);

const todayOnly = buildOverviewIndependentCompareRows(
  [log("tummy-today", "tummy", "09:00", { duration: "18" })],
  [],
  600,
  600,
);
assert.equal(todayOnly.length, 1, "C: one-sided today still renders the row");
assert.equal(todayOnly[0].hasYesterday, false);
assert.equal(todayOnly[0].yesterdayCumulative, null);
assert.equal(todayOnly[0].delta, null, "C: one-sided data is not a +18 difference");

const yesterdayOnly = buildOverviewIndependentCompareRows(
  [],
  [log("tummy-yesterday", "tummy", "09:00", { duration: "10" })],
  600,
  600,
);
assert.equal(yesterdayOnly.length, 1, "D: one-sided yesterday still renders the row");
assert.equal(yesterdayOnly[0].hasToday, false);
assert.equal(yesterdayOnly[0].todayCumulative, null);
assert.equal(yesterdayOnly[0].delta, null);

assert.equal(byId(feedOnly, "sleep"), undefined, "E: empty categories stay hidden");
assert.deepEqual(buildOverviewIndependentCompareRows([], [], 600, 600), [], "F: empty compare is one empty list");

const cursorLogs = [
  log("feed-cursor", "formula", "08:00", { amount: "120" }),
  log("tummy-later", "tummy", "11:00", { duration: "18" }),
];
assert.deepEqual(
  idsOf(buildOverviewIndependentCompareRows(cursorLogs, cursorLogs, 9 * 60, 9 * 60)),
  ["feed"],
  "G: moving the cursor before a later record hides that category",
);
const afterCursor = buildOverviewIndependentCompareRows(cursorLogs, cursorLogs, 12 * 60, 12 * 60);
assert.deepEqual(idsOf(afterCursor), ["feed", "tummy"], "G: the same later record appears once the cursor passes it");
assert.equal(byId(afterCursor, "tummy")?.todayCumulative, 18);

const resetNow = 15 * 60 + 20;
const resetRows = buildOverviewIndependentCompareRows(today, yesterday, resetNow, resetNow);
assert.ok(resetRows.some((row) => row.id === "feed"), "H: reset uses the same live wall-clock on both days");
assert.equal(byId(resetRows, "feed")?.todayCumulative, 220);
assert.equal(byId(resetRows, "feed")?.yesterdayCumulative, 90);

const missingDiaper = compareMetricFor("diaper", [log("feed-only", "formula", "08:00", { amount: "120" })], 600, []);
assert.equal(missingDiaper.has, false, "I: no diaper record is not a loaded 0");
assert.equal(missingDiaper.numeric, null);

const deletedTummy = buildOverviewIndependentCompareRows(
  [log("keep-feed", "formula", "08:00", { amount: "120" })],
  [log("keep-feed-y", "formula", "08:00", { amount: "90" }), log("deleted-was-here", "tummy", "09:00", { duration: "10" })],
  600,
  600,
);
assert.equal(byId(deletedTummy, "tummy")?.hasToday, false, "J: deleting today's tummy leaves yesterday-only");
assert.equal(byId(buildOverviewIndependentCompareRows(
  [log("keep-feed", "formula", "08:00", { amount: "120" })],
  [log("keep-feed-y", "formula", "08:00", { amount: "90" })],
  600,
  600,
), "tummy"), undefined, "J: deleting both sides hides the category");

const recencyTrap = buildOverviewIndependentCompareRows(
  [log("play-late", "play", "14:00", { duration: "20" }), log("tummy-early", "tummy", "09:00", { duration: "10" })],
  [log("play-late-y", "play", "14:00", { duration: "15" }), log("tummy-early-y", "tummy", "09:00", { duration: "8" })],
  15 * 60,
  15 * 60,
);
assert.deepEqual(idsOf(recencyTrap), ["tummy", "play"], "compare order uses predefined priority, not recency");
assert.ok(overviewCompareOrderIndex("tummy") < overviewCompareOrderIndex("play"));
assert.ok(overviewCompareOrderIndex("feed") < overviewCompareOrderIndex("sleep"));
assert.ok(overviewCompareOrderIndex("sleep") < overviewCompareOrderIndex("diaper"));
assert.ok(overviewCompareOrderIndex("diaper") < overviewCompareOrderIndex("tummy"));

const bathMetric = compareMetricFor("bath", [log("bath-1", "bath", "09:00", { duration: "25" })], 600, []);
assert.deepEqual([bathMetric.has, bathMetric.numeric, bathMetric.unit], [true, 1, "count"], "bath compares count, not duration");

const foodMetric = compareMetricFor("food", [log("food-1", "food", "09:00", { amount: "40" })], 600, []);
assert.deepEqual([foodMetric.numeric, foodMetric.unit], [1, "count"], "food uses count");

const medMetric = compareMetricFor("med", [log("med-1", "med", "08:30"), log("med-2", "med", "09:10")], 600, []);
assert.deepEqual([medMetric.numeric, medMetric.unit], [2, "count"], "med uses count");

const tempMetric = compareMetricFor("temp", [
  log("temp-1", "temp", "08:00", { amount: "36.5" }),
  log("temp-2", "temp", "09:30", { amount: "37.2" }),
], 600, []);
assert.deepEqual([tempMetric.has, tempMetric.numeric, tempMetric.unit], [true, 37.2, "temp"], "temp uses the latest reading, not a sum");

const tempRows = buildOverviewIndependentCompareRows(
  [log("temp-t", "temp", "09:30", { amount: "37.2" })],
  [log("temp-y", "temp", "08:40", { amount: "36.8" })],
  600,
  600,
);
assert.equal(tempRows[0].semanticDelta, false, "temperature deltas stay semantically neutral");
assert.equal(Math.round((tempRows[0].delta ?? 0) * 10), 4);

const pumpMetric = compareMetricFor("pump", [log("pump-1", "pump", "09:00", { amount: "80" })], 600, []);
assert.deepEqual([pumpMetric.numeric, pumpMetric.unit], [80, "ml"], "pump uses accumulated volume");

const demo = fs.readFileSync(path.join(__dirname, "../demos/overview-demo.html"), "utf8");
const native = fs.readFileSync(path.join(__dirname, "../src/components/babylog/OverviewRhythmCard.tsx"), "utf8");
for (const pose of ["idle", "feed", "diaper", "rest"]) {
  assert.ok(fs.existsSync(path.join(__dirname, `../demos/assets/rhythm-duck-${pose}.png`)), `${pose} pose asset exists`);
}
assert.match(demo, /\.rhythm-duck\.sleeping \{ background-image: url\("\.\/assets\/rhythm-duck-rest\.png/);
assert.doesNotMatch(demo, /darin-duck-sprites\.png/, "overview demo no longer crops arbitrary cells from the large sprite sheet");
assert.match(demo, /compareRows\.replaceChildren\(\)/);
assert.match(demo, /todayCursorMinutes/);
assert.match(demo, /yesterdayCursorMinutes/);
assert.match(demo, /resetCompare/);
assert.doesNotMatch(demo, /손을 놓으면 지금으로 돌아와요/);
assert.match(demo, /event-duration/);
assert.match(demo, /track-guide/);
assert.match(demo, /00:00/);
assert.match(demo, /segmentLabel/);
assert.match(native, /buildOverviewCategoryCardsAtCutoff\(/);
assert.match(native, /buildOverviewCategoryCardsAtCursors\(/);
assert.match(native, /buildOverviewInspectionRows\(/);
assert.match(native, /todayCursorTime/);
assert.match(native, /yesterdayCursorTime/);
assert.match(native, /todayPan\.panHandlers/);
assert.match(native, /yesterdayPan\.panHandlers/);
assert.doesNotMatch(native, /setInspection/);
assert.doesNotMatch(native, /setPlayhead/);
assert.match(native, /trackEventPoint/);
assert.match(native, /TimeGuides/);
assert.match(native, /segmentLabel/);
assert.doesNotMatch(native, /sleepingDuck|duckCrop|rhythmSprites/);
assert.match(native, /report\.critical\.017/);
assert.match(native, /compareDeltaNeutral/);
assert.match(native, /semanticDelta/);
assert.match(native, /todayCursorTime = todayCursor \?\? now/);
assert.match(native, /yesterdayCursorTime = yesterdayCursor \?\? now/);
assert.match(native, /setTodayCursor\(null\)/);
assert.match(native, /setYesterdayCursor\(null\)/);
assert.doesNotMatch(native, /오늘 .+까지/);
assert.match(demo, /기록 없음/);
assert.match(demo, /아직 이 시간대에 비교할 기록이 없어요/);
const reportScreen = fs.readFileSync(path.join(__dirname, "../src/screens/tabs/BabyReportScreen.tsx"), "utf8");
assert.match(reportScreen, /reportDataState === "loading" \? <LoadingState/);
assert.match(reportScreen, /reportDataState === "error" \? <ErrorState/);
assert.match(reportScreen, /reportDataState === "partial" \? <EmptyState/);
assert.match(reportScreen, /reportDataState === "ready" \? \(/);
assert.doesNotMatch(reportScreen, /reportDataState === "loading"[\s\S]{0,80}<OverviewRhythmCard/);
console.log("overview category comparison QA: PASS (dynamic categories, cutoff, missing-day, sleeping asset)");
