import assert from "node:assert/strict";
import type { BabyLogEntry } from "../src/types/babyLog.ts";
import {
  careLogCoverageContains,
  filterCareLogsByDateRange,
  mergeCareLogEntries,
  recentCareLogRange,
} from "../src/utils/careLogHistory.ts";

const range = recentCareLogRange("2026-08-28", 3);
assert.deepEqual(range, { kind: "range", fromDateKey: "2026-08-26", toDateKey: "2026-08-28" });
assert.equal(careLogCoverageContains(range, "2026-08-26", "2026-08-28"), true);
assert.equal(careLogCoverageContains(range, "2026-08-25", "2026-08-28"), false);
assert.equal(careLogCoverageContains({ kind: "full" }, "2020-01-01", "2030-01-01"), true);

const entry = (id: string, dateKey: string, time: string): BabyLogEntry => ({
  id,
  cat: "sleep",
  dateKey,
  time,
  source: "manual",
});
const old = entry("old", "2026-08-25", "09:00");
const first = entry("first", "2026-08-26", "08:00");
const second = entry("second", "2026-08-27", "10:00");
const updated = { ...second, duration: "45" };

assert.deepEqual(filterCareLogsByDateRange([old, first, second], "2026-08-26", "2026-08-27").map((item) => item.id), ["first", "second"]);
const merged = mergeCareLogEntries([second, old], [first, updated]);
assert.deepEqual(merged.map((item) => item.id), ["old", "first", "second"]);
assert.equal(merged.find((item) => item.id === "second")?.duration, "45");

console.log("CareLog history contract smoke passed");
