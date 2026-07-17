import type { BabyLogActor, BabyLogEntry, BabyLogSource } from "../types/babyLog";
import type { FamilyRole } from "../types/family";

export function resolveLogSource(entry: Pick<BabyLogEntry, "source" | "voice" | "createdBy">): BabyLogSource {
  if (entry.source) return entry.source;
  if (entry.voice) return "voice";
  if (entry.createdBy?.role === "caregiver") return "caregiver";
  return "manual";
}

/** e.g. "작성자: 박시터" */
export function formatLogProvenance(entry: Pick<BabyLogEntry, "source" | "voice" | "createdBy">): string | null {
  const name = entry.createdBy?.name;
  if (!name) return null;
  const source = resolveLogSource(entry);
  if (source === "voice") return `작성자: ${name} · 음성`;
  return `작성자: ${name}`;
}

export function actorFromFamily(member: {
  id: string;
  name: string;
  role: FamilyRole;
}): BabyLogActor {
  return { userId: member.id, name: member.name, role: member.role };
}
