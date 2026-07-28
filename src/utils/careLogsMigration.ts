/**
 * Detect local AsyncStorage care logs that are candidates for server migration.
 * Does NOT upload automatically — call `uploadLocalCareLogsMigration` explicitly.
 */
import type { BabyLogEntry } from "../types/babyLog";

export function detectLocalCareLogMigrationCandidates(
  localLogs: BabyLogEntry[],
  serverLogs: BabyLogEntry[],
): BabyLogEntry[] {
  const serverIds = new Set(serverLogs.map((l) => l.id));
  return localLogs.filter((log) => !serverIds.has(log.id));
}

/**
 * Safe one-shot upload helper. Idempotent via client_generated_id upsert.
 * Not called automatically on app start.
 */
export async function uploadLocalCareLogsMigration(
  babyId: string,
  candidates: BabyLogEntry[],
): Promise<{ uploaded: number; failed: number }> {
  // Keep candidate detection platform-neutral for the Node smoke suite. The
  // repository pulls in React Native storage and is only needed when uploading.
  const { CareLogRepository } = await import("../repositories/CareLogRepository");
  let uploaded = 0;
  let failed = 0;
  for (const entry of candidates) {
    try {
      await CareLogRepository.createCareLog(babyId, entry);
      uploaded += 1;
    } catch {
      failed += 1;
    }
  }
  return { uploaded, failed };
}
