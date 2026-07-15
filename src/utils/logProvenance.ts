import type { BabyLogActor, BabyLogEntry, BabyLogSource } from "../types/babyLog";
import type { FamilyRole } from "../types/family";

export function resolveLogSource(entry: Pick<BabyLogEntry, "source" | "voice" | "createdBy">): BabyLogSource {
  if (entry.source) return entry.source;
  if (entry.voice) return "voice";
  if (entry.createdBy?.role === "caregiver") return "caregiver";
  return "manual";
}

/** e.g. "엄마가 음성으로 기록" */
export function formatLogProvenance(entry: Pick<BabyLogEntry, "source" | "voice" | "createdBy">): string | null {
  const name = entry.createdBy?.name;
  if (!name) return null;
  const source = resolveLogSource(entry);
  if (source === "voice") return `${name}가 음성으로 기록`;
  if (source === "caregiver") return `${name}가 기록`;
  if (source === "diary") return `${name}가 일기로 기록`;
  return `${name}가 기록`;
}

export function actorFromFamily(member: {
  id: string;
  name: string;
  role: FamilyRole;
}): BabyLogActor {
  return { userId: member.id, name: member.name, role: member.role };
}
