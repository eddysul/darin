import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  OVERVIEW_FIXED_CATEGORY_IDS,
  OVERVIEW_OPTIONAL_CATEGORY_ORDER,
  collectOverviewExtraCategoryIds,
  isOverviewFixedLogCat,
  overviewOptionalOrderIndex,
} from "../src/utils/overviewCategoryOrder.ts";
import { mixHexWithWhite } from "../src/utils/overviewCardTint.ts";
import { buildOverviewRhythmSegments } from "../src/utils/overviewRhythmSegments.ts";
import {
  buildOverviewCategoryCardsAtCutoff,
  buildOverviewInspectionRows,
  buildOverviewTimelineRows,
} from "../src/utils/overviewCategoryCards.ts";
import type { BabyLogEntry } from "../src/types/babyLog.ts";

assert.deepEqual([...OVERVIEW_FIXED_CATEGORY_IDS], ["feed", "sleep", "diaper"]);
assert.ok(isOverviewFixedLogCat("formula"));
assert.ok(isOverviewFixedLogCat("breast"));
assert.ok(isOverviewFixedLogCat("sleep"));
assert.ok(isOverviewFixedLogCat("diaper"));
assert.equal(isOverviewFixedLogCat("tummy"), false);
assert.equal(isOverviewFixedLogCat("food"), false);

assert.deepEqual(collectOverviewExtraCategoryIds([]), []);

const extras = collectOverviewExtraCategoryIds([
  { cat: "formula", dateKey: "2026-09-18", time: "08:00" },
  { cat: "sleep", dateKey: "2026-09-18", time: "01:00" },
  { cat: "diaper", dateKey: "2026-09-18", time: "09:10" },
  { cat: "tummy", dateKey: "2026-09-18", time: "10:00" },
  { cat: "bath", dateKey: "2026-09-18", time: "19:00" },
  { cat: "play", dateKey: "2026-09-17", time: "11:00" },
]);
assert.deepEqual(extras, ["bath", "tummy", "play"], "recency first, then predefined order");
assert.ok(!extras.includes("food"), "empty extras stay off the list");
assert.ok(OVERVIEW_OPTIONAL_CATEGORY_ORDER.indexOf("tummy") < OVERVIEW_OPTIONAL_CATEGORY_ORDER.indexOf("play"));

const onlyYesterday = collectOverviewExtraCategoryIds([
  { cat: "med", dateKey: "2026-09-17", time: "09:00" },
]);
assert.deepEqual(onlyYesterday, ["med"]);

const sameStamp = collectOverviewExtraCategoryIds([
  { cat: "play", dateKey: "2026-09-18", time: "12:00" },
  { cat: "tummy", dateKey: "2026-09-18", time: "12:00" },
]);
assert.deepEqual(sameStamp, ["tummy", "play"], "equal recency uses predefined order");

const expandedExtras = collectOverviewExtraCategoryIds([
  { cat: "tummy", dateKey: "2026-09-18", time: "10:15" },
  { cat: "play", dateKey: "2026-09-18", time: "14:00" },
  { cat: "bath", dateKey: "2026-09-18", time: "18:30" },
  { cat: "formula", dateKey: "2026-09-18", time: "08:00" },
]).sort((a, b) => overviewOptionalOrderIndex(a) - overviewOptionalOrderIndex(b) || a.localeCompare(b));
assert.deepEqual(expandedExtras, ["tummy", "bath", "play"], "expanded rows keep optional order, not recency");

const carousel = await readFile(new URL("../src/components/babylog/OverviewCategoryCarousel.tsx", import.meta.url), "utf8");
assert.match(carousel, /horizontal/);
assert.match(carousel, /snapToInterval/);
assert.match(carousel, /disableIntervalMomentum/);
assert.match(carousel, /accessibilityLabel=\{t\("report\.critical\.259"/);
assert.match(carousel, /minWidth: TOUCH_MIN/);
assert.match(carousel, /report\.critical\.258/);
assert.match(carousel, /report\.critical\.257/);

const presenter = await readFile(new URL("../src/utils/overviewCategoryCards.ts", import.meta.url), "utf8");
assert.match(presenter, /feedDisplay\(/);
assert.match(presenter, /sleepMinutesFor\(/);
assert.match(presenter, /collectOverviewExtraCategoryIds/);
assert.match(presenter, /buildOverviewTimelineRows/);
assert.match(presenter, /collectOverviewExtraCategoryIds\(todayLogs\)/);
assert.match(presenter, /compareMetricFor/);
assert.match(presenter, /overviewCompareOrderIndex/);
assert.match(presenter, /semanticDelta/);

const rhythm = await readFile(new URL("../src/components/babylog/OverviewRhythmCard.tsx", import.meta.url), "utf8");
assert.match(rhythm, /OverviewCategoryCarousel/);
assert.match(rhythm, /todayLabelWrap/);
assert.match(rhythm, /LogCategoryIcon/);
assert.match(rhythm, /buildOverviewTimelineRows/);
assert.doesNotMatch(rhythm, /hasTummy/);
assert.doesNotMatch(rhythm, /item\.kind !== "activity"/);
assert.match(rhythm, /function TrackSegments/);
assert.match(rhythm, /<TrackSegments segments=\{yesterdaySegments\}/);
assert.match(rhythm, /<TrackSegments segments=\{todaySegments\}/);
assert.match(rhythm, /todayCursorTime/);
assert.match(rhythm, /yesterdayCursorTime/);
assert.match(rhythm, /todayPan\.panHandlers/);
assert.match(rhythm, /yesterdayPan\.panHandlers/);
assert.match(rhythm, /buildOverviewInspectionRows/);
assert.match(rhythm, /buildOverviewIndependentCompareRows/);
assert.match(rhythm, /recorded\.find\(\(row\) => row\.id === "sleep"\)/);
assert.match(rhythm, /row\.events\.length > 0/);
assert.match(rhythm, /kind="refresh"/);
assert.match(rhythm, /report\.critical\.272/);
assert.doesNotMatch(rhythm, /setInspection/);
assert.doesNotMatch(rhythm, /setPlayhead/);

const todayCutoffLogs = [
  { id: "t-feed-1", cat: "formula", dateKey: "2026-09-18", time: "08:00", amountValue: 120 },
  { id: "t-feed-2", cat: "formula", dateKey: "2026-09-18", time: "14:00", amountValue: 90 },
  { id: "t-sleep", cat: "sleep", dateKey: "2026-09-18", time: "10:00", duration: "180" },
] as BabyLogEntry[];
const yesterdayCutoffLogs = [
  { id: "y-feed-1", cat: "formula", dateKey: "2026-09-17", time: "08:00", amountValue: 100 },
  { id: "y-feed-2", cat: "formula", dateKey: "2026-09-17", time: "13:00", amountValue: 200 },
  { id: "y-sleep", cat: "sleep", dateKey: "2026-09-17", time: "10:00", duration: "120" },
] as BabyLogEntry[];
const cutoffCards = buildOverviewCategoryCardsAtCutoff(todayCutoffLogs, yesterdayCutoffLogs, 12 * 60);
const cutoffFeed = cutoffCards.find((card) => card.id === "feed");
const cutoffSleep = cutoffCards.find((card) => card.id === "sleep");
assert.equal(cutoffFeed?.numeric, 120, "today comparison stops at now");
assert.equal(cutoffFeed?.delta, 20, "yesterday comparison uses the same wall-clock cutoff");
assert.equal(cutoffSleep?.numeric, 120, "active sleep is clipped at the comparison cutoff");
assert.equal(cutoffSleep?.delta, 0);

const inspectedMorning = buildOverviewInspectionRows(todayCutoffLogs, 8 * 60 + 5);
const inspectedFeed = inspectedMorning.find((row) => row.id === "feed");
assert.equal(inspectedFeed?.eventValue, 120);
assert.equal(inspectedFeed?.cumulative, 120);
const inspectedAfternoon = buildOverviewInspectionRows(todayCutoffLogs, 15 * 60);
assert.equal(inspectedAfternoon.find((row) => row.id === "feed")?.cumulative, 210);

assert.deepEqual(
  buildOverviewTimelineRows(todayCutoffLogs).map((row) => row.id),
  ["feed", "sleep"],
  "timeline/legend omit fixed categories with no today record",
);
assert.deepEqual(buildOverviewTimelineRows([]), [], "no today records means no legend rows");
assert.deepEqual(
  buildOverviewTimelineRows([
    { id: "only-tummy", cat: "tummy", dateKey: "2026-09-18", time: "10:15", duration: "12" },
  ] as BabyLogEntry[]).map((row) => row.id),
  ["tummy"],
  "a recorded extra can appear without forcing feed/sleep/diaper",
);

const sourceRhythm = {
  sleep: [{ start: 60, duration: 180 }, { start: 260, duration: 120 }],
  ticks: [
    { start: 120, kind: "feed" as const },
    { start: 122, kind: "diaper" as const },
    { start: 275, kind: "activity" as const, duration: 30 },
  ],
};
const composed = buildOverviewRhythmSegments(sourceRhythm, 1440, 320);
const eventGroups = composed.filter((segment) => segment.kind === "event");
assert.deepEqual(eventGroups.map((segment) => segment.eventKinds), [["feed", "diaper"], ["activity"]]);
for (let index = 1; index < composed.length; index += 1) {
  assert.ok(
    composed[index - 1].start + composed[index - 1].duration <= composed[index].start + 0.000001,
    "all visual segments share one lane without overlap",
  );
}
assert.deepEqual(sourceRhythm.sleep, [{ start: 60, duration: 180 }, { start: 260, duration: 120 }], "visual composition never changes source sleep");
assert.deepEqual(sourceRhythm.ticks.map((tick) => tick.start), [120, 122, 275], "event timestamps remain unchanged");
assert.ok(buildOverviewRhythmSegments(sourceRhythm, 280, 320).every((segment) => segment.start + segment.duration <= 280));
const demo = await readFile(new URL("../demos/overview-demo.html", import.meta.url), "utf8");
assert.match(demo, /id="trackVisuals"/);
assert.match(demo, /const composeVisualTrack =/);
assert.match(demo, /renderVisualTracks\(\)/);
assert.match(demo, /id="rhythmLegend"/);
assert.match(demo, /renderRhythmLegend/);

const record = await readFile(new URL("../src/screens/tabs/RecordScreen.tsx", import.meta.url), "utf8");
assert.match(record, /route\.params\?\.category/);
assert.match(record, /openSheet\(category/);

const i18n = await readFile(new URL("../src/i18nReportCriticalMessages.ts", import.meta.url), "utf8");
assert.match(i18n, /\["255","어제보다 늘었어요"/);
assert.match(i18n, /\["256","비슷해요"/);
assert.match(i18n, /\["257","비교할 기록이 아직 부족해요"/);
assert.match(i18n, /\["258","아직 기록이 없어요"/);
assert.match(i18n, /\["259","\{label\}\. \{value\}\. \{change\}"/);
assert.match(i18n, /\["137","변화가 없어요"/);
assert.match(i18n, /\["265","비교 초기화"/);
assert.match(i18n, /\["266","오늘과 어제의 선택 시점까지 기록을 비교해요\."/);
assert.match(i18n, /\["267","오늘 기준 시각 \{time\}"/);
assert.match(i18n, /\["268","어제 기준 시각 \{time\}"/);
assert.match(i18n, /\["272","아직 이 시간대에 비교할 기록이 없어요\."/);
assert.match(carousel, /report\.critical\.256/);
assert.match(carousel, /mixHexWithWhite/);
assert.match(carousel, /resolveLogCategory/);
assert.doesNotMatch(carousel, /return colors\.chip/);
assert.doesNotMatch(carousel, /id === "tummy"/);
assert.doesNotMatch(carousel, /statActivity/);
assert.equal(mixHexWithWhite("#7c83fd"), "#eff0ff");
assert.equal(mixHexWithWhite("#5b8dee"), "#ebf1fd");
assert.equal(mixHexWithWhite("#4fa8e0"), "#eaf5fb");

const demoSeed = await readFile(new URL("../src/utils/demoSeed.ts", import.meta.url), "utf8");
assert.match(demoSeed, /if \(isToday\) \{/);
assert.match(demoSeed, /cat: "tummy"[\s\S]*time: "10:15"/);
assert.match(demoSeed, /cat: "play"[\s\S]*time: "14:30"/);
assert.match(demoSeed, /cat: "bath"[\s\S]*time: "18:30"/);
assert.match(demoSeed, /cat: "pump"[\s\S]*amount: "110"/);
assert.match(demoSeed, /고정 카드\(수유·수면·기저귀\)[\s\S]*양쪽 날짜/);
assert.match(demoSeed, /function normalizeDemoDayTimeline/);
assert.match(demoSeed, /overlapsSleep\(candidate, duration, sleepRanges\)/);
assert.match(demoSeed, /normalizeDemoDayTimeline\(out, dateKeyDaysAgo\(0, now\)\)/);
assert.match(demoSeed, /normalizeDemoDayTimeline\(out, dateKeyDaysAgo\(1, now\)\)/);
assert.match(demoSeed, /recent comparison point/);
assert.match(demoSeed, /ageMonthsNow - 0\.25/);
const babyLogContext = await readFile(new URL("../src/context/BabyLogContext.tsx", import.meta.url), "utf8");
assert.match(babyLogContext, /setGrowthRecords\(seed\.growthRecords\)/);
assert.match(babyLogContext, /saveGrowthRecords\(seed\.growthRecords, localDataScope\)/);

console.log("overview category cards QA: PASS (fixed 3, extras by recency then order, carousel snap/a11y)");
