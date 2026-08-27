import {
  buildContractionSaveEntry,
  contractionUpdatesAfterDelete,
  durationSecondsOf,
  siblingContractionUpdates,
  withRecalculatedIntervals,
} from "../src/utils/contractionLog.ts";
import type { BabyLogEntry } from "../src/types/babyLog.ts";

function entry(partial: Partial<BabyLogEntry> & Pick<BabyLogEntry, "id" | "startedAt">): BabyLogEntry {
  return {
    cat: "contraction",
    time: "10:00",
    dateKey: "2026-08-27",
    endedAt: partial.endedAt,
    ...partial,
  };
}

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

const first = entry({
  id: "a",
  startedAt: "2026-08-27T01:00:00.000Z",
  endedAt: "2026-08-27T01:01:00.000Z",
});
const second = entry({
  id: "b",
  startedAt: "2026-08-27T01:10:00.000Z",
  endedAt: "2026-08-27T01:10:40.000Z",
});

assert(durationSecondsOf(first.startedAt!, first.endedAt!) === 60, "duration should be 60s");

const afterSecond = withRecalculatedIntervals([second, first]);
assert(afterSecond[0].id === "a" && afterSecond[0].intervalSeconds === undefined, "first contraction has no interval");
assert(afterSecond[1].id === "b" && afterSecond[1].intervalSeconds === 600, "interval is start-to-start 10 minutes");
assert(afterSecond[1].durationSeconds === 40, "second duration is 40s");

const backdated = buildContractionSaveEntry(
  {
    cat: "contraction",
    time: "09:50",
    dateKey: "2026-08-27",
    startedAt: "2026-08-27T00:50:00.000Z",
    endedAt: "2026-08-27T00:50:20.000Z",
  },
  [first, second],
);
assert(backdated.intervalSeconds === undefined, "backdated earliest record has no interval");
const siblings = siblingContractionUpdates([first, second], { ...backdated, id: "c" });
const updatedFirst = siblings.find((item) => item.id === "a");
assert(updatedFirst?.entry.intervalSeconds === 600, "original first should gain 10-minute interval after backdate");

const afterDelete = contractionUpdatesAfterDelete(
  [
    { ...backdated, id: "c" },
    { ...first, intervalSeconds: 600 },
    { ...second, intervalSeconds: 600 },
  ],
  "c",
);
const restoredFirst = afterDelete.find((item) => item.id === "a");
assert(restoredFirst?.entry.intervalSeconds === undefined, "deleting earliest record restores first interval to none");

console.log("PASS contraction duration, interval, backdate, and delete recalculation");
