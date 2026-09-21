import assert from "node:assert/strict";
import type { BabyLogEntry } from "../src/types/babyLog";
import {
  completedSixDaySummary,
  recentFeedingSleepPattern,
  summarizeFeedingVolumes,
} from "../src/utils/reportAggregates";
import { buildMonthReport } from "../src/utils/periodReport";
import { readFileSync } from "node:fs";

const now = new Date("2026-08-12T12:00:00");

function log(id: string, cat: BabyLogEntry["cat"], dateKey: string, patch: Partial<BabyLogEntry> = {}): BabyLogEntry {
  return { id, cat, dateKey, time: "12:00", ...patch };
}

const volumes = summarizeFeedingVolumes([
  log("formula-ml", "formula", "2026-08-12", { amount: "120", amountUnit: "ml" }),
  log("stored-oz", "storedMilk", "2026-08-12", { amountValue: 4, amountUnit: "oz" }),
  log("legacy-oz", "formula", "2026-08-12", { amount: "1.5", amountText: "1.5 oz" }),
  log("direct", "breast", "2026-08-12", { amount: "15", amountUnit: "ml" }),
  log("pump", "pump", "2026-08-12", { amount: "80", amountUnit: "ml" }),
]);
assert.equal(volumes.ml, 120, "direct breastfeeding and pumping must not enter bottle volume");
assert.equal(volumes.oz, 5.5);
assert.equal(volumes.label, "120 ml + 5.5 oz", "ml and oz must remain separate, including legacy text");

const weeklyLogs = [
  log("day-1-feed", "formula", "2026-08-11"),
  log("day-1-sleep", "sleep", "2026-08-11", { duration: "120" }),
  log("day-3-feed-a", "breast", "2026-08-09"),
  log("day-3-feed-b", "storedMilk", "2026-08-09"),
  log("day-3-diaper", "diaper", "2026-08-09"),
  log("day-5-feed-a", "formula", "2026-08-07"),
  log("day-5-feed-b", "formula", "2026-08-07"),
  log("day-5-feed-c", "formula", "2026-08-07"),
];
const week = completedSixDaySummary(weeklyLogs, now);
assert.equal(week.recordedDayCount, 3, "only days with records count as evidence");
assert.equal(week.averageFeedingCount, 2, "empty days must not be averaged as zero");
assert.equal(week.averageSleepMinutes, 40, "all metrics share the same recorded-day evidence set");

const patternLogs: BabyLogEntry[] = [];
for (let day = 1; day <= 9; day += 1) {
  const dateKey = `2026-08-${String(day).padStart(2, "0")}`;
  patternLogs.push(log(`feed-${day}`, day % 2 ? "breast" : "storedMilk", dateKey, { time: `${18 + Math.floor((day - 1) / 3)}:00` }));
  patternLogs.push(log(`sleep-${day}`, "sleep", dateKey, { duration: String(300 + day * 10) }));
}
const pattern = recentFeedingSleepPattern(patternLogs, now);
assert.equal(pattern.validDayCount, 9);
assert.deepEqual(pattern.buckets.map((bucket) => bucket.dayCount), [3, 3, 3]);
assert.deepEqual(pattern.buckets.map((bucket) => bucket.key), ["early", "typical", "late"]);

const monthlyLogs: BabyLogEntry[] = [];
for (const [month, count, sleepMinutes] of [["08", 3, 60], ["09", 1, 120]] as const) {
  for (const day of [1, 2, 3]) {
    const dateKey = `2026-${month}-${String(day).padStart(2, "0")}`;
    for (let index = 0; index < count; index++) {
      monthlyLogs.push(log(`${month}-${day}-feed-${index}`, "formula", dateKey));
    }
    monthlyLogs.push(log(`${month}-${day}-sleep`, "sleep", dateKey, { duration: String(sleepMinutes) }));
  }
}
const monthWithLongerSleep = buildMonthReport(monthlyLogs, new Date("2026-09-20T12:00:00"));
assert.equal(monthWithLongerSleep.headlineKey, "report.critical.208");
assert.equal(monthWithLongerSleep.bodyKey, "report.critical.261", "sleep headline must not make an unsupported feeding-interval claim");
const monthWithFewerFeeds = buildMonthReport(monthlyLogs.filter((entry) => entry.cat !== "sleep"), new Date("2026-09-20T12:00:00"));
assert.equal(monthWithFewerFeeds.headlineKey, "report.critical.209");
assert.equal(monthWithFewerFeeds.bodyKey, "report.critical.261", "feed-count decrease must not imply steadier intervals");
assert.equal(buildMonthReport([], new Date("2026-09-20T12:00:00")).headlineKey, "report.critical.210");

const reportSource = readFileSync(new URL("../src/components/babylog/OverviewReportScreen.tsx", import.meta.url), "utf8");
assert.match(reportSource, /const canShowReport = dataState === "ready" && logs\.length > 0/);
assert.match(reportSource, /canShowReport && tab === "week"/);
assert.match(reportSource, /canShowReport && tab === "month"/);
assert.match(reportSource, /canShowReport && tab === "all"/);
const overviewSource = readFileSync(new URL("../src/screens/tabs/BabyReportScreen.tsx", import.meta.url), "utf8");
assert.match(overviewSource, /reportDataState === "ready" \? \([\s\S]*?<OverviewTodaySummary[\s\S]*?<OverviewRhythmCard/);
assert.match(overviewSource, /reportDataState === "ready" && narrative\.headline/);
assert.match(overviewSource, /storageReady && !growthRecordsHydrated \? \([\s\S]*?<ErrorState/);
assert.match(overviewSource, /growthRecordsHydrated \? \([\s\S]*?<OverviewGrowthSection/);

console.log("report QA: PASS");
