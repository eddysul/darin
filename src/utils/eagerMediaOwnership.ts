export type EagerMediaOwnership = {
  memoryPostId?: string;
  diaryEntryId?: string;
};

export function isUnownedEagerMedia(media: EagerMediaOwnership): boolean {
  return !media.memoryPostId && !media.diaryEntryId;
}
