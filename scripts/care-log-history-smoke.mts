import assert from "node:assert/strict";
import type { BabyLogEntry } from "../src/types/babyLog.ts";
import {
  careLogCoverageContains,
  careLogRequestMatchesScope,
  extendCareLogCoverage,
  filterCareLogsByDateRange,
  isCareLogEntryCovered,
  mergeCareLogEntries,
  reconcileCareLogCategories,
  reconcileCareLogRange,
  resolveCareLogBootstrapPolicy,
  recentCareLogRange,
} from "../src/utils/careLogHistory.ts";
import { formatDateKey } from "../src/utils/dateKey.ts";
import { isDarinStorageKey, STORAGE_KEYS } from "../src/utils/storageKeys.ts";

const range = recentCareLogRange("2026-08-28", 3);
assert.deepEqual(range, { kind: "range", fromDateKey: "2026-08-26", toDateKey: "2026-08-28" });
assert.equal(careLogCoverageContains(range, "2026-08-26", "2026-08-28"), true);
assert.equal(careLogCoverageContains(range, "2026-08-25", "2026-08-28"), false);
assert.equal(careLogCoverageContains({ kind: "full" }, "2020-01-01", "2030-01-01"), true);
assert.equal(
  careLogRequestMatchesScope("user-a:baby-a", { userId: "user-a", babyId: "baby-a" }),
  true,
);
assert.equal(
  careLogRequestMatchesScope("user-a:baby-a", { userId: "user-a", babyId: "baby-b" }),
  false,
);
assert.equal(careLogRequestMatchesScope("user-a:baby-a", null), false);
assert.deepEqual(
  resolveCareLogBootstrapPolicy({ coverage: null, verifiedAt: null, migrationCandidateCount: 0 }),
  { historyMode: "full", preserveMigrationCandidates: true },
);
assert.equal(isDarinStorageKey(STORAGE_KEYS.babyLogs), true);
assert.equal(isDarinStorageKey(`${STORAGE_KEYS.babyLogs}:user-a:baby-a`), true);
assert.equal(isDarinStorageKey(`${STORAGE_KEYS.babyLogs}:scoped-migration:v1:user-a:baby-a`), true);
assert.equal(isDarinStorageKey("unrelated:third-party-key"), false);
assert.deepEqual(
  resolveCareLogBootstrapPolicy({
    coverage: { kind: "full" },
    verifiedAt: "2026-08-28T12:00:00.000Z",
    migrationCandidateCount: 0,
  }),
  { historyMode: "recent", preserveMigrationCandidates: false },
);
assert.deepEqual(
  resolveCareLogBootstrapPolicy({
    coverage: { kind: "range", fromDateKey: "2026-06-01", toDateKey: "2026-08-28" },
    verifiedAt: "2026-08-28T12:00:00.000Z",
    migrationCandidateCount: 2,
  }),
  { historyMode: "full", preserveMigrationCandidates: true },
);
assert.deepEqual(
  extendCareLogCoverage(range, { kind: "range", fromDateKey: "2026-08-24", toDateKey: "2026-08-25" }),
  { kind: "range", fromDateKey: "2026-08-24", toDateKey: "2026-08-28" },
);
assert.deepEqual(
  extendCareLogCoverage(range, { kind: "range", fromDateKey: "2026-08-01", toDateKey: "2026-08-02" }),
  range,
);

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

assert.equal(isCareLogEntryCovered(second, range, new Set()), true);
assert.equal(isCareLogEntryCovered(old, range, new Set()), false);
assert.equal(isCareLogEntryCovered(old, range, new Set(["sleep"])), true);

assert.deepEqual(filterCareLogsByDateRange([old, first, second], "2026-08-26", "2026-08-27").map((item) => item.id), ["first", "second"]);
const legacyToday = { ...entry("legacy-today", formatDateKey(), "12:00"), dateKey: undefined };
assert.deepEqual(
  filterCareLogsByDateRange([legacyToday], formatDateKey(), formatDateKey()).map((item) => item.id),
  ["legacy-today"],
);
const merged = mergeCareLogEntries([second, old], [first, updated]);
assert.deepEqual(merged.map((item) => item.id), ["old", "first", "second"]);
assert.equal(merged.find((item) => item.id === "second")?.duration, "45");

const deletedInRange = entry("deleted-in-range", "2026-08-27", "11:00");
assert.deepEqual(
  reconcileCareLogRange([old, deletedInRange, second], [updated], "2026-08-27", "2026-08-27")
    .map((item) => item.id),
  ["old", "second"],
);
const medication = { ...entry("medication", "2026-01-01", "08:00"), cat: "med" as const };
const deletedMedication = { ...entry("deleted-medication", "2025-01-01", "08:00"), cat: "med" as const };
assert.deepEqual(
  reconcileCareLogCategories([old, deletedMedication], [medication], ["med"]).map((item) => item.id),
  ["medication", "old"],
);

console.log("CareLog history contract smoke passed");
