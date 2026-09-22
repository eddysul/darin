import type { BabyLogEntry, DiaryEntry } from "../types/babyLog";
import type { FamilyMember } from "../types/family";
import type { GrowthBookEdit } from "../types/growthBook";
import type { RelationshipLabel } from "../types/growthBook";

export type ProfileDisplayUpdate = {
  userId: string;
  babyId: string | null;
  displayName: string;
  realName?: string;
  avatarUrl?: string;
  relationshipLabel: RelationshipLabel;
};

type ResolvedProfileDisplayUpdate = ProfileDisplayUpdate & {
  applyRelationship: boolean;
  legacyUserIds?: readonly string[];
};

export function profileDisplayUpdateFromFamilyMember(
  member: FamilyMember,
  babyId: string,
): ResolvedProfileDisplayUpdate {
  return {
    userId: member.id,
    babyId,
    displayName: member.name,
    realName: member.realName,
    avatarUrl: member.avatarUrl,
    relationshipLabel: member.relationshipLabel ?? "가족",
    applyRelationship: true,
    legacyUserIds: member.isMe ? ["local-me"] : undefined,
  };
}

function matchesAuthor(authorId: string | null | undefined, update: ResolvedProfileDisplayUpdate): boolean {
  if (!authorId) return false;
  return authorId === update.userId || Boolean(update.legacyUserIds?.includes(authorId));
}

export function applyProfileDisplayToFamily(
  members: FamilyMember[],
  update: ResolvedProfileDisplayUpdate,
): FamilyMember[] {
  let changed = false;
  const next = members.map((member) => {
    if (!member.isMe && !matchesAuthor(member.id, update)) return member;
    const relationshipLabel = update.applyRelationship
      ? update.relationshipLabel
      : member.relationshipLabel;
    if (
      member.name === update.displayName
      && member.realName === update.realName
      && member.avatarUrl === update.avatarUrl
      && member.relationshipLabel === relationshipLabel
    ) return member;
    changed = true;
    return {
      ...member,
      name: update.displayName,
      realName: update.realName,
      avatarUrl: update.avatarUrl,
      relationshipLabel,
    };
  });
  return changed ? next : members;
}

export function applyProfileDisplayToLogs(
  entries: BabyLogEntry[],
  update: ResolvedProfileDisplayUpdate,
): BabyLogEntry[] {
  let changed = false;
  const next = entries.map((entry) => {
    const actor = entry.createdBy;
    if (!actor || !matchesAuthor(actor.userId, update) || actor.name === update.displayName) return entry;
    changed = true;
    return { ...entry, createdBy: { ...actor, name: update.displayName } };
  });
  return changed ? next : entries;
}

export function applyProfileDisplayToDiaries(
  entries: DiaryEntry[],
  update: ResolvedProfileDisplayUpdate,
): DiaryEntry[] {
  let changed = false;
  const next = entries.map((entry) => {
    const actor = entry.createdBy;
    if (!actor || !matchesAuthor(actor.userId, update) || actor.name === update.displayName) return entry;
    changed = true;
    return { ...entry, createdBy: { ...actor, name: update.displayName } };
  });
  return changed ? next : entries;
}

export function applyProfileDisplayToGrowthBook(
  edit: GrowthBookEdit,
  update: ResolvedProfileDisplayUpdate,
  changedAt = new Date().toISOString(),
): GrowthBookEdit {
  let changed = false;
  const pages = Object.fromEntries(Object.entries(edit.pages).map(([id, page]) => {
    let pageChanged = false;
    const rollingComments = page.rollingComments.map((comment) => {
      if (!matchesAuthor(comment.authorId, update)) return comment;
      const relationshipLabel = update.applyRelationship
        ? update.relationshipLabel
        : comment.authorRelationshipLabel;
      if (comment.authorName === update.displayName && comment.authorRelationshipLabel === relationshipLabel) {
        return comment;
      }
      pageChanged = true;
      return { ...comment, authorName: update.displayName, authorRelationshipLabel: relationshipLabel };
    });
    if (!pageChanged) return [id, page];
    changed = true;
    return [id, { ...page, rollingComments }];
  }));
  const letters = edit.letters.map((letter) => {
    if (!matchesAuthor(letter.authorId, update)) return letter;
    const relationshipLabel = update.applyRelationship
      ? update.relationshipLabel
      : letter.authorRelationshipLabel;
    if (letter.authorName === update.displayName && letter.authorRelationshipLabel === relationshipLabel) {
      return letter;
    }
    changed = true;
    return { ...letter, authorName: update.displayName, authorRelationshipLabel: relationshipLabel };
  });
  return changed ? { ...edit, pages, letters, updatedAt: changedAt } : edit;
}
