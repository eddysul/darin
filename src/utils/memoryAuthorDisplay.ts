import type { DisplayProfile } from "../types/profileSettings";

export const MISSING_MEMORY_AUTHOR_ID = "deleted-user";
export const MEMORY_AUTHOR_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** True when author_id cannot be resolved to a profile identity. */
export function isMemoryAuthorIdentityMissing(authorId: string | null | undefined): boolean {
  return !authorId || authorId === MISSING_MEMORY_AUTHOR_ID || !MEMORY_AUTHOR_ID_PATTERN.test(authorId);
}

export function collectMemoryAuthorUserIds(userIds: Array<string | null | undefined>): string[] {
  return [...new Set(userIds.filter((id): id is string => typeof id === "string" && MEMORY_AUTHOR_ID_PATTERN.test(id)))];
}

export function memoryAuthorIdsFromCards(cards: Array<{
  post: { authorId: string };
  latestComment?: { authorId: string };
}>): string[] {
  return collectMemoryAuthorUserIds(cards.flatMap((card) => [
    card.post.authorId,
    ...(card.latestComment ? [card.latestComment.authorId] : []),
  ]));
}

export function memoryAuthorIdsFromBundle(bundle: {
  post: { authorId: string };
  comments?: Array<{ authorId: string }>;
  reactions?: Array<{ authorId: string }>;
  tags?: Array<{ taggedUserId?: string }>;
}): string[] {
  return collectMemoryAuthorUserIds([
    bundle.post.authorId,
    ...(bundle.comments ?? []).map((item) => item.authorId),
    ...(bundle.reactions ?? []).map((item) => item.authorId),
    ...(bundle.tags ?? []).map((tag) => tag.taggedUserId),
  ]);
}

export function mergeDisplayProfiles(
  current: DisplayProfile[],
  incoming: DisplayProfile[],
): DisplayProfile[] {
  const unique = new Map(current.map((profile) => [profile.userId, profile]));
  incoming.forEach((profile) => unique.set(profile.userId, profile));
  return [...unique.values()];
}

/**
 * Historical author identity. Current family/friend membership is not an input
 * and must not decide the deleted-account fallback.
 */
export function resolveMemoryAuthorName(input: {
  authorId: string;
  profile?: Pick<DisplayProfile, "displayName"> | null;
  viewerUserId?: string;
  viewerName?: string;
  missingLabel: string;
}): string {
  if (isMemoryAuthorIdentityMissing(input.authorId)) return input.missingLabel;
  if (input.viewerUserId && input.authorId === input.viewerUserId && input.viewerName?.trim()) {
    return input.viewerName.trim();
  }
  const name = input.profile?.displayName?.trim();
  if (name) return name;
  return input.missingLabel;
}

export function resolveMemoryAuthorAvatarUrl(input: {
  authorId: string;
  profile?: Pick<DisplayProfile, "avatarUrl"> | null;
  viewerUserId?: string;
  viewerAvatarUrl?: string;
}): string | undefined {
  if (isMemoryAuthorIdentityMissing(input.authorId)) return undefined;
  if (input.profile?.avatarUrl) return input.profile.avatarUrl;
  if (input.viewerUserId && input.authorId === input.viewerUserId && input.viewerAvatarUrl) {
    return input.viewerAvatarUrl;
  }
  return undefined;
}
