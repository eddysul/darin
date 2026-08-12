import type { BabyLogEntry } from "../types/babyLog";

export type DiaperType = "urine" | "stool" | "both" | "unknown";

/** Accept historic Korean labels as well as the new combined label. */
export function diaperTypeFor(entry: Pick<BabyLogEntry, "cat" | "chip">): DiaperType {
  if (entry.cat !== "diaper") return "unknown";
  const value = (entry.chip ?? "").replaceAll(" ", "");
  if (value === "소변") return "urine";
  if (value === "대변") return "stool";
  if (["둘다", "소변+대변", "소변대변"].includes(value)) return "both";
  return "unknown";
}

export function diaperTypeLabel(entry: Pick<BabyLogEntry, "cat" | "chip">): string | undefined {
  const type = diaperTypeFor(entry);
  if (type === "urine") return "소변";
  if (type === "stool") return "대변";
  if (type === "both") return "소변+대변";
  return undefined;
}

export function diaperCounts(logs: BabyLogEntry[]) {
  return logs.reduce(
    (counts, entry) => {
      if (entry.cat !== "diaper") return counts;
      counts.total += 1;
      const type = diaperTypeFor(entry);
      if (type === "urine" || type === "both") counts.urine += 1;
      if (type === "stool" || type === "both") counts.stool += 1;
      return counts;
    },
    { total: 0, urine: 0, stool: 0 },
  );
}
