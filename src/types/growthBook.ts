/** Growth book edit models — separate from Diary (원본 일기). */

export type LegacyPhotoLayout = 1 | 2 | 3 | 4;

export type PhotoLayout =
  | "single_large"
  | "two_vertical"
  | "two_horizontal"
  | "two_left_large"
  | "two_top_large"
  | "three_top_large_bottom_two"
  | "three_left_large_right_two"
  | "three_right_large_left_two"
  | "three_equal"
  | "three_left_large_right_top_medium_bottom_small"
  | "four_grid"
  | "four_top_large_bottom_three"
  | "four_left_large_right_three";

export type PhotoSlot = {
  slotId: string;
  /** Runtime mapping only; persisted photo order remains the source of truth. */
  photoId: string | null;
  xRatio: number;
  yRatio: number;
  widthRatio: number;
  heightRatio: number;
};

/** Limited preset tuning; photo boxes are still never freely dragged or resized. */
export type PhotoLayoutTuning = {
  primaryRatio?: 0.55 | 0.6 | 0.65 | 0.7;
  secondaryTopRatio?: 0.55 | 0.6 | 0.65;
};

/** Relationship shown to users (엄마/아빠/시터…). Separate from permission role. */
export type RelationshipLabel =
  | "엄마"
  | "아빠"
  | "보호자"
  | "시터"
  | "할머니"
  | "할아버지"
  | "가족"
  | "기타";

export const RELATIONSHIP_LABELS: RelationshipLabel[] = [
  "엄마",
  "아빠",
  "보호자",
  "시터",
  "할머니",
  "할아버지",
  "가족",
  "기타",
];

export type GrowthBookComment = {
  id: string;
  pageId: string;
  authorId: string;
  authorName: string;
  authorRelationshipLabel: RelationshipLabel;
  text: string;
  /** Baby sticker ids attached to this family comment, in display order. */
  stickerIds?: string[];
  createdAt: string;
  updatedAt: string;
};

export type GrowthBookLetter = {
  id: string;
  growthBookId: string;
  authorId: string;
  authorName: string;
  authorRelationshipLabel: RelationshipLabel;
  text: string;
  createdAt: string;
  updatedAt: string;
};

/** A sticker instance positioned against the full page using normalized ratios. */
export type GrowthBookPageSticker = {
  id: string;
  pageId: string;
  stickerId: string;
  xRatio: number;
  yRatio: number;
  widthRatio: number;
  zIndex: number;
  createdBy: string;
  createdAt: string;
};

/** Sticker attached below a page comment (kept separate for future inline rich text). */
export type GrowthBookCommentSticker = {
  id: string;
  pageId: string;
  commentId?: string;
  stickerId: string;
  order: number;
  createdBy: string;
  createdAt: string;
};

/** Per-diary page overrides stored only on the growth book edit copy. */
export type GrowthBookPageEdit = {
  diaryId: string;
  /** When set, replaces diary photos for this growth-book page. */
  photos?: string[];
  photoLayout: PhotoLayout;
  photoLayoutTuning?: PhotoLayoutTuning;
  /** @deprecated numeric layout saved by older growth-book drafts. */
  layout?: LegacyPhotoLayout | PhotoLayout;
  /**
   * Growth-book-only page comment.
   * `undefined` → fall back to diary body in preview.
   * string (incl. "") → use this value only (does not mutate diary).
   */
  pageComment?: string;
  pageStickers?: GrowthBookPageSticker[];
  commentStickers?: GrowthBookCommentSticker[];
  rollingComments: GrowthBookComment[];
  /** @deprecated legacy footer sticker ids; normalized to pageStickers when read. */
  stickerIds?: string[];
};

export type GrowthBookEdit = {
  id: string;
  babyId: string;
  coverTitle: string;
  coverSubtitle?: string;
  coverDateRange?: string;
  coverPhotoUri: string | null;
  /** diaryId → page edit */
  pages: Record<string, GrowthBookPageEdit>;
  letters: GrowthBookLetter[];
  updatedAt: string;
};

export type GrowthBookServerBook = {
  id: string;
  babyId: string;
  title: string | null;
  status: "draft" | "ready" | "exported";
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type GrowthBookServerPage = {
  id: string;
  growthBookId: string;
  babyId: string;
  pageType: "cover" | "diary" | "letter" | "rolling_paper" | "custom";
  diaryEntryId: string | null;
  pageOrder: number;
  layoutType: string | null;
  content: Record<string, unknown>;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type GrowthBookServerMedia = {
  id: string;
  growthBookId: string;
  pageId: string;
  babyId: string;
  storagePath: string;
  signedUrl?: string;
  width?: number;
  height?: number;
  createdBy: string;
  createdAt: string;
};

export type GrowthBookMigrationResult = {
  migrated: boolean;
  pagesUploaded: number;
  mediaUploaded: number;
  mediaFailed: number;
};

export function formatGrowthAuthorLabel(
  relationshipLabel: RelationshipLabel | string,
  name: string,
): string {
  return `${relationshipLabel} ${name}`.trim();
}

export function createEmptyGrowthBookEdit(input: {
  babyId: string;
  babyName: string;
}): GrowthBookEdit {
  const now = new Date().toISOString();
  return {
    id: `gb-${input.babyId}`,
    babyId: input.babyId,
    coverTitle: `${input.babyName}의 성장책`,
    coverPhotoUri: null,
    pages: {},
    letters: [],
    updatedAt: now,
  };
}
