export type MemoryPrivacyType =
  | "only_me"
  | "family_circle"
  | "tagged_family"
  | "selected_people";

export type MemoryMediaType = "image" | "video";
export type MemoryTagType = "baby" | "family_member" | "friend_baby" | "manual_guest";
export type MemoryTagStatus = "approved" | "pending" | "rejected";

export type MemoryPost = {
  id: string;
  babyId: string;
  authorId: string;
  caption?: string;
  privacyType: MemoryPrivacyType;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
};

export type MemoryMedia = {
  id: string;
  memoryPostId: string;
  babyId: string;
  storagePath: string;
  mediaType: MemoryMediaType;
  width?: number;
  height?: number;
  createdAt: string;
};

export type MemoryTag = {
  id: string;
  memoryPostId: string;
  tagType: MemoryTagType;
  babyId?: string;
  taggedUserId?: string;
  taggedBabyId?: string;
  manualLabel?: string;
  status: MemoryTagStatus;
  createdBy: string;
  createdAt: string;
};

export type MemoryComment = {
  id: string;
  memoryPostId: string;
  authorId: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
};

export type MemoryReaction = {
  id: string;
  memoryPostId: string;
  authorId: string;
  reactionType: string;
  createdAt: string;
};

export type CreateMemoryPostInput = {
  id?: string;
  babyId: string;
  caption?: string;
  privacyType: MemoryPrivacyType;
  selectedUserIds?: string[];
};

export type UpdateMemoryPostInput = {
  memoryPostId: string;
  caption?: string | null;
  privacyType?: MemoryPrivacyType;
};

export type AddMemoryMediaInput = {
  id?: string;
  memoryPostId: string;
  babyId: string;
  storagePath: string;
  mediaType?: MemoryMediaType;
  width?: number;
  height?: number;
};

export type AddMemoryCommentInput = {
  id?: string;
  memoryPostId: string;
  body: string;
};

export type SetMemoryReactionInput = {
  memoryPostId: string;
  reactionType: string;
};
