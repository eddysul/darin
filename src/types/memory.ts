export type MemoryPrivacyType =
  | "only_me"
  | "family_circle"
  | "friend_circle"
  | "tagged_family"
  | "selected_people";
export type MemoryCommentType = "text" | "sticker";

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
  commentType: MemoryCommentType;
  stickerId?: string;
  stickerLabel?: string;
  stickerImageUrl?: string;
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

export type MemoryPostBundle = {
  post: MemoryPost;
  media: MemoryMedia[];
  tags: MemoryTag[];
  comments: MemoryComment[];
  reactions: MemoryReaction[];
  selectedUserIds: string[];
};

export type MemoryCard = {
  post: MemoryPost;
  coverMedia?: MemoryMedia;
  coverUrl?: string;
  tags: MemoryTag[];
  commentCount: number;
  reactionCount: number;
  isSaved: boolean;
};

export type MemoryTagDraft =
  | { tagType: "baby"; babyId: string }
  | { tagType: "family_member"; taggedUserId: string }
  | { tagType: "manual_guest"; manualLabel: string };

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
  selectedUserIds?: string[];
  tags?: MemoryTagDraft[];
};

export type CreateMemoryWithImageInput = {
  babyId: string;
  imageUri: string;
  imageSizeBytes?: number;
  mimeType?: string;
  width?: number;
  height?: number;
  caption?: string;
  privacyType: MemoryPrivacyType;
  selectedUserIds?: string[];
  tags?: MemoryTagDraft[];
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

export type AddMemoryStickerCommentInput = {
  id?: string;
  memoryPostId: string;
  stickerId: string;
  stickerLabel: string;
};

export type SetMemoryReactionInput = {
  memoryPostId: string;
  reactionType: string;
};
