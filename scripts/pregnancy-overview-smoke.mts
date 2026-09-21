import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pregnancyProgressFromDueDate } from "../src/utils/pregnancyProgress.ts";
import {
  buildPregnancyDayItems,
  buildPregnancyRecentItems,
  buildPregnancyTodayStatus,
  buildPregnancyUpcomingEvents,
  isPregnancyOverviewLog,
  parsePregnancyEventDate,
  pregnancyCalendarMarkedDates,
  PREGNANCY_WEEK_CONTENT,
} from "../src/utils/pregnancyOverview.ts";
import type { BabyLogEntry, DiaryEntry } from "../src/types/babyLog.ts";
import type { LogCategoryKey } from "../src/types/logCategory.ts";
import { reportLogsForDisplay } from "../src/utils/reportLogSelection.ts";
import {
  pregnancyOverviewEn, pregnancyOverviewEs, pregnancyOverviewJa, pregnancyOverviewKo, pregnancyOverviewZhCN,
} from "../src/i18nPregnancyOverviewMessages.ts";

const pregnancyCustom = new Set<LogCategoryKey>(["custom:walk"]);
const logs: BabyLogEntry[] = [
  { id: "mood", cat: "pregMood", dateKey: "2026-09-18", time: "08:00", chip: "좋음" },
  { id: "symptom", cat: "pregSymptom", dateKey: "2026-09-18", time: "09:00", chip: "피로", notes: "오후에는 나아짐" },
  { id: "kick", cat: "pregKick", dateKey: "2026-09-18", time: "10:00", chip: "느꼈어요" },
  { id: "visit", cat: "pregHospital", dateKey: "2026-09-10", time: "11:00", chip: "검진", title: "정기 검진", nextAt: "2026-09-26 10:00" },
  { id: "custom", cat: "custom:walk", dateKey: "2026-09-17", time: "17:00", notes: "천천히 산책" },
  { id: "born", cat: "formula", dateKey: "2026-09-18", time: "12:00", amount: "120", nextAt: "2026-09-25 12:00" },
];
const diaries = [{
  id: "diary", babyId: "baby", date: "9월 18일", dateKey: "2026-09-18", photos: ["file://ultrasound.jpg"],
  comment: "초음파 사진", weatherStamp: null, moodStamp: null, careLogSummarySnapshot: "", momentSuggestionsUsed: [],
  milestoneTag: null, customMilestoneTag: null, includedInGrowthBook: false, createdAt: "2026-09-18T14:00:00.000Z",
  updatedAt: "2026-09-18T14:00:00.000Z", source: "manual", draftStatus: "saved",
}] satisfies DiaryEntry[];

assert.deepEqual(pregnancyProgressFromDueDate("2027-01-15", "2026-09-18"), {
  gestationalDays: 161, weeks: 23, days: 0, remainingDays: 119, percent: 58,
});
assert.equal(pregnancyProgressFromDueDate(undefined), null);
assert.deepEqual(parsePregnancyEventDate("2026-09-26 10:00"), { dateKey: "2026-09-26", time: "10:00" });
assert.equal(parsePregnancyEventDate("not a date"), null);
assert.equal(isPregnancyOverviewLog(logs[0], pregnancyCustom), true);
assert.equal(isPregnancyOverviewLog(logs[4], pregnancyCustom), true);
assert.equal(isPregnancyOverviewLog(logs[5], pregnancyCustom), false);

const upcoming = buildPregnancyUpcomingEvents(logs, "2026-09-18", pregnancyCustom);
assert.deepEqual(upcoming.map((event) => event.source.id), ["visit"], "only real pregnancy nextAt events appear");
const status = buildPregnancyTodayStatus(logs, diaries, "2026-09-18");
assert.equal(status.condition?.id, "mood");
assert.equal(status.symptomCount, 1);
assert.equal(status.kickCount, 1);
assert.equal(status.memoCount, 2);

const dayItems = buildPregnancyDayItems({
  dateKey: "2026-09-18", logs, diaries, events: upcoming, pregnancyCustomCategories: pregnancyCustom,
});
assert.deepEqual(dayItems.map((item) => item.kind), ["log", "log", "log", "diary"]);
const futureItems = buildPregnancyDayItems({
  dateKey: "2026-09-26", logs, diaries, events: upcoming, pregnancyCustomCategories: pregnancyCustom,
});
assert.deepEqual(futureItems.map((item) => item.kind), ["event"]);

const recent = buildPregnancyRecentItems({ logs, diaries, pregnancyCustomCategories: pregnancyCustom });
assert.equal(recent[0].kind, "diary");
assert.equal(recent.some((item) => item.id === "log:born"), false, "post-birth categories do not leak into pregnancy overview");
const marked = pregnancyCalendarMarkedDates({ logs, diaries, events: upcoming, pregnancyCustomCategories: pregnancyCustom });
assert.deepEqual([...marked].sort(), ["2026-09-10", "2026-09-17", "2026-09-18", "2026-09-26"]);
assert.deepEqual(PREGNANCY_WEEK_CONTENT, [], "unreviewed medical/education copy is not invented");

const firstLoadingLogs = reportLogsForDisplay(logs, false, false);
const nextLoadingLogs = reportLogsForDisplay(logs, false, false);
assert.strictEqual(firstLoadingLogs, nextLoadingLogs, "loading records have one stable reference across renders");
assert.deepEqual(firstLoadingLogs, [], "uncovered records must not be shown under a new baby scope");
assert.strictEqual(reportLogsForDisplay(logs, true, false), logs, "covered records become visible");
assert.strictEqual(reportLogsForDisplay(logs, false, true), logs, "completed history becomes visible");

for (const messages of [pregnancyOverviewEn, pregnancyOverviewKo, pregnancyOverviewJa, pregnancyOverviewEs, pregnancyOverviewZhCN]) {
  assert.deepEqual(Object.keys(messages).sort(), Object.keys(pregnancyOverviewEn).sort());
  for (const value of Object.values(messages)) assert.ok(value.trim());
}

const screen = readFileSync("src/screens/tabs/BabyReportScreen.tsx", "utf8");
assert.match(screen, /const pregnancy = isPregnancyStage\(careSetup\.child\)/);
assert.match(screen, /pregnancy \? \([\s\S]*?<PregnancyOverview[\s\S]*?: \([\s\S]*?<OverviewTodaySummary/,
  "pregnancy mode branches before unchanged born overview components");
assert.match(screen, /pregnancy \? null : createWeeklyAiCacheIdentity/, "pregnancy mode does not generate post-birth AI copy");
assert.match(screen, /if \(pregnancy\) return;/, "pregnancy mode does not run post-birth narrative state updates");
assert.match(screen, /reportLogsForDisplay\(logs, reportRangeCovered, reportHistoryComplete\)/,
  "report loading uses a stable empty input instead of allocating during render");
const component = readFileSync("src/components/babylog/PregnancyOverview.tsx", "utf8");
assert.match(component, /accessibilityRole="button"/);
assert.match(component, /accessibilityState=\{\{ selected \}\}/);
assert.match(component, /diaryEntryId: item\.diary\.id/);
assert.match(component, /logId: item\.log\.id/);
assert.match(component, /duck-pregnancy-rest\.png/, "pregnancy progress card uses its dedicated duck asset");
assert.match(component, /const reduceMotion = useReduceMotion\(\)/, "decorative motion respects reduced motion");
assert.match(component, /if \(reduceMotion\) return;/, "decorative loop is disabled for reduced motion");
const duckAsset = readFileSync("assets/duck-pregnancy-rest.png");
assert.equal(duckAsset.subarray(1, 4).toString(), "PNG", "duck asset is a PNG");
assert.equal(duckAsset.readUInt32BE(16), 512, "duck asset width is app-appropriate");
assert.equal(duckAsset.readUInt32BE(20), 512, "duck asset height is app-appropriate");
assert.equal(duckAsset[25], 6, "duck asset preserves an RGBA alpha channel");
console.log("Pregnancy overview data, lifecycle, navigation, a11y and locale smoke: PASS");
