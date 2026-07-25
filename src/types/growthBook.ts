/** Growth book edit models — separate from Diary (원본 일기). */

export type PhotoLayout = 1 | 2 | 3 | 4;

export const PHOTO_LAYOUT_OPTIONS: Array<{ value: PhotoLayout; label: string }> = [
  { value: 1, label: "1장 크게" },
  { value: 2, label: "2장" },
  { value: 3, label: "3장" },
  { value: 4, label: "4장" },
];

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

/** Per-diary page overrides stored only on the growth book edit copy. */
export type GrowthBookPageEdit = {
  diaryId: string;
  /** When set, replaces diary photos for this growth-book page. */
  photos?: string[];
  layout: PhotoLayout;
  /**
   * Growth-book-only page comment.
   * `undefined` → fall back to diary body in preview.
   * string (incl. "") → use this value only (does not mutate diary).
   */
  pageComment?: string;
  rollingComments: GrowthBookComment[];
  /** Baby sticker ids placed in the page footer decoration area. */
  stickerIds?: string[];
};

export type GrowthBookEdit = {
  id: string;
  babyId: string;
  coverTitle: string;
  coverPhotoUri: string | null;
  /** diaryId → page edit */
  pages: Record<string, GrowthBookPageEdit>;
  letters: GrowthBookLetter[];
  updatedAt: string;
};

export function formatGrowthAuthorLabel(
  relationshipLabel: RelationshipLabel | string,
  name: string,
): string {
  return `${relationshipLabel} ${name}`.trim();
}

export function defaultLayoutForPhotoCount(count: number): PhotoLayout {
  if (count <= 1) return 1;
  if (count === 2) return 2;
  if (count === 3) return 3;
  return 4;
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
