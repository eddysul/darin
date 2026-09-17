export const CLIENT_EVENT_TYPES = [
  "memory_comment",
  "memory_reaction",
  "growth_book_comment",
  "growth_book_rolling_paper",
  "new_shared_log",
  "new_diary",
  "test",
] as const;

export type ClientEventType = typeof CLIENT_EVENT_TYPES[number];

const CLIENT_EVENT_TYPE_SET = new Set<string>(CLIENT_EVENT_TYPES);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isClientEventType(value: unknown): value is ClientEventType {
  return typeof value === "string" && CLIENT_EVENT_TYPE_SET.has(value);
}

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

export function isFreshResource(value: unknown, nowMs = Date.now(), maxAgeMs = 30 * 60 * 1000): boolean {
  if (typeof value !== "string") return false;
  const createdMs = Date.parse(value);
  return Number.isFinite(createdMs) && createdMs <= nowMs + 60_000 && createdMs >= nowMs - maxAgeMs;
}

export function safeRouteData(
  eventType: ClientEventType,
  ids: { babyId: string; targetId: string; memoryPostId?: string; growthBookId?: string; pageId?: string | null },
): Record<string, string> {
  switch (eventType) {
    case "memory_comment":
    case "memory_reaction":
      return { route: "memory", babyId: ids.babyId, memoryPostId: ids.memoryPostId! };
    case "growth_book_comment":
    case "growth_book_rolling_paper": {
      const data: Record<string, string> = { route: "growth_book", babyId: ids.babyId, growthBookId: ids.growthBookId! };
      if (ids.pageId) data.pageId = ids.pageId;
      return data;
    }
    case "new_shared_log":
      return { route: "record", babyId: ids.babyId, logId: ids.targetId };
    case "new_diary":
      return { route: "diary", babyId: ids.babyId, diaryEntryId: ids.targetId };
    case "test":
      return { route: "settings", settingsPage: "careAlerts" };
  }
}

export function dedupeRecipients(values: readonly string[], actorId: string): string[] {
  return [...new Set(values.filter((value) => isUuid(value) && value !== actorId))].sort();
}

export type MemoryAudience = {
  privacyType: string;
  postAuthorId: string;
  memberIds: readonly string[];
  editorIds: readonly string[];
  friendIds: readonly string[];
  taggedIds: readonly string[];
  selectedIds: readonly string[];
};

export function canActorInteractWithMemory(audience: MemoryAudience, actorId: string): boolean {
  switch (audience.privacyType) {
    case "family_circle": return audience.editorIds.includes(actorId);
    case "friend_circle": return audience.editorIds.includes(actorId) || audience.friendIds.includes(actorId);
    case "only_me": return audience.postAuthorId === actorId && audience.editorIds.includes(actorId);
    case "tagged_family": return audience.editorIds.includes(actorId) && audience.taggedIds.includes(actorId);
    case "selected_people":
      return (audience.editorIds.includes(actorId) || audience.friendIds.includes(actorId))
        && audience.selectedIds.includes(actorId);
    default: return false;
  }
}

export function deriveMemoryRecipients(audience: MemoryAudience, actorId: string): string[] {
  let recipients: readonly string[] = [];
  if (audience.privacyType === "family_circle") recipients = audience.memberIds;
  if (audience.privacyType === "friend_circle") recipients = [...audience.memberIds, ...audience.friendIds];
  if (audience.privacyType === "only_me") recipients = [audience.postAuthorId];
  if (audience.privacyType === "tagged_family") {
    recipients = audience.taggedIds.filter((id) => audience.memberIds.includes(id));
  }
  if (audience.privacyType === "selected_people") {
    recipients = audience.selectedIds.filter((id) => audience.memberIds.includes(id) || audience.friendIds.includes(id));
  }
  const author = audience.editorIds.includes(audience.postAuthorId) ? [audience.postAuthorId] : [];
  return dedupeRecipients([...recipients, ...author], actorId);
}

export function providerFailureCode(): string {
  return "provider_request_failed";
}
