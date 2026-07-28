import type { GrowthRecord } from "../types/growthRecord";

export function detectLocalGrowthRecordMigrationCandidates(
  local: GrowthRecord[],
  remote: GrowthRecord[],
): GrowthRecord[] {
  const remoteKeys = new Set(
    remote.flatMap((record) =>
      [record.id, record.clientGeneratedId].filter((id): id is string => Boolean(id)),
    ),
  );
  return local.filter(
    (record) =>
      !remoteKeys.has(record.id) && !remoteKeys.has(record.clientGeneratedId ?? ""),
  );
}

export function mergePendingGrowthRecords(
  remote: GrowthRecord[],
  pending: GrowthRecord[],
): GrowthRecord[] {
  const remoteKeys = new Set(
    remote.flatMap((record) =>
      [record.id, record.clientGeneratedId].filter((id): id is string => Boolean(id)),
    ),
  );
  return [
    ...remote,
    ...pending.filter(
      (record) =>
        !remoteKeys.has(record.id) && !remoteKeys.has(record.clientGeneratedId ?? ""),
    ),
  ].sort((a, b) => a.measuredAt.localeCompare(b.measuredAt));
}
