import type {
  LegacyPhotoLayout,
  PhotoLayout,
  PhotoLayoutTuning,
  PhotoSlot,
} from "../types/growthBook";

export type PhotoLayoutOption = {
  value: PhotoLayout;
  label: string;
  photoCount: 1 | 2 | 3 | 4;
};

export const PHOTO_LAYOUT_OPTIONS: PhotoLayoutOption[] = [
  { value: "single_large", label: "1장 크게", photoCount: 1 },
  { value: "two_vertical", label: "2장 세로 분할", photoCount: 2 },
  { value: "two_horizontal", label: "2장 가로 분할", photoCount: 2 },
  { value: "two_left_large", label: "왼쪽 크게", photoCount: 2 },
  { value: "two_top_large", label: "위쪽 크게", photoCount: 2 },
  { value: "three_top_large_bottom_two", label: "위 크게 + 아래 2장", photoCount: 3 },
  { value: "three_left_large_right_two", label: "왼쪽 크게 + 오른쪽 2장", photoCount: 3 },
  { value: "three_right_large_left_two", label: "오른쪽 크게 + 왼쪽 2장", photoCount: 3 },
  { value: "three_equal", label: "3장 동일", photoCount: 3 },
  {
    value: "three_left_large_right_top_medium_bottom_small",
    label: "왼쪽 크게 + 오른쪽 차등",
    photoCount: 3,
  },
  { value: "four_grid", label: "4장 격자", photoCount: 4 },
  { value: "four_top_large_bottom_three", label: "위 크게 + 아래 3장", photoCount: 4 },
  { value: "four_left_large_right_three", label: "왼쪽 크게 + 오른쪽 3장", photoCount: 4 },
];

const GAP = 0.018;
const HALF = (1 - GAP) / 2;
const THIRD = (1 - GAP * 2) / 3;
const LARGE = 0.6;
const SMALL = 1 - LARGE - GAP;
const SPECIAL_PRIMARY = 0.62;
const SPECIAL_GAP = 0.04;
const SPECIAL_SECONDARY_TOP = 0.58;

function slot(slotId: string, xRatio: number, yRatio: number, widthRatio: number, heightRatio: number): PhotoSlot {
  const normalized = (value: number) => Math.round(value * 10000) / 10000;
  return {
    slotId,
    photoId: null,
    xRatio: normalized(xRatio),
    yRatio: normalized(yRatio),
    widthRatio: normalized(widthRatio),
    heightRatio: normalized(heightRatio),
  };
}

export const PHOTO_LAYOUT_SLOTS: Record<PhotoLayout, PhotoSlot[]> = {
  single_large: [slot("photo-1", 0, 0, 1, 1)],
  two_vertical: [
    slot("photo-1", 0, 0, HALF, 1),
    slot("photo-2", HALF + GAP, 0, HALF, 1),
  ],
  two_horizontal: [
    slot("photo-1", 0, 0, 1, HALF),
    slot("photo-2", 0, HALF + GAP, 1, HALF),
  ],
  two_left_large: [
    slot("photo-1", 0, 0, LARGE, 1),
    slot("photo-2", LARGE + GAP, 0, SMALL, 1),
  ],
  two_top_large: [
    slot("photo-1", 0, 0, 1, LARGE),
    slot("photo-2", 0, LARGE + GAP, 1, SMALL),
  ],
  three_top_large_bottom_two: [
    slot("photo-1", 0, 0, 1, LARGE),
    slot("photo-2", 0, LARGE + GAP, HALF, SMALL),
    slot("photo-3", HALF + GAP, LARGE + GAP, HALF, SMALL),
  ],
  three_left_large_right_two: [
    slot("photo-1", 0, 0, LARGE, 1),
    slot("photo-2", LARGE + GAP, 0, SMALL, HALF),
    slot("photo-3", LARGE + GAP, HALF + GAP, SMALL, HALF),
  ],
  three_right_large_left_two: [
    slot("photo-1", SMALL + GAP, 0, LARGE, 1),
    slot("photo-2", 0, 0, SMALL, HALF),
    slot("photo-3", 0, HALF + GAP, SMALL, HALF),
  ],
  three_equal: [
    slot("photo-1", 0, 0, THIRD, 1),
    slot("photo-2", THIRD + GAP, 0, THIRD, 1),
    slot("photo-3", (THIRD + GAP) * 2, 0, THIRD, 1),
  ],
  three_left_large_right_top_medium_bottom_small: [
    slot("photo-1", 0, 0, SPECIAL_PRIMARY, 1),
    slot("photo-2", SPECIAL_PRIMARY + SPECIAL_GAP, 0, 1 - SPECIAL_PRIMARY - SPECIAL_GAP, SPECIAL_SECONDARY_TOP),
    slot("photo-3", SPECIAL_PRIMARY + SPECIAL_GAP, SPECIAL_SECONDARY_TOP + SPECIAL_GAP, 1 - SPECIAL_PRIMARY - SPECIAL_GAP, 1 - SPECIAL_SECONDARY_TOP - SPECIAL_GAP),
  ],
  four_grid: [
    slot("photo-1", 0, 0, HALF, HALF),
    slot("photo-2", HALF + GAP, 0, HALF, HALF),
    slot("photo-3", 0, HALF + GAP, HALF, HALF),
    slot("photo-4", HALF + GAP, HALF + GAP, HALF, HALF),
  ],
  four_top_large_bottom_three: [
    slot("photo-1", 0, 0, 1, LARGE),
    slot("photo-2", 0, LARGE + GAP, THIRD, SMALL),
    slot("photo-3", THIRD + GAP, LARGE + GAP, THIRD, SMALL),
    slot("photo-4", (THIRD + GAP) * 2, LARGE + GAP, THIRD, SMALL),
  ],
  four_left_large_right_three: [
    slot("photo-1", 0, 0, LARGE, 1),
    slot("photo-2", LARGE + GAP, 0, SMALL, THIRD),
    slot("photo-3", LARGE + GAP, THIRD + GAP, SMALL, THIRD),
    slot("photo-4", LARGE + GAP, (THIRD + GAP) * 2, SMALL, THIRD),
  ],
};

const LEGACY_LAYOUT_MAP: Record<LegacyPhotoLayout, PhotoLayout> = {
  1: "single_large",
  2: "two_vertical",
  3: "three_top_large_bottom_two",
  4: "four_grid",
};

export function defaultPhotoLayoutForCount(count: number): PhotoLayout {
  if (count <= 1) return "single_large";
  if (count === 2) return "two_vertical";
  if (count === 3) return "three_top_large_bottom_two";
  return "four_grid";
}

export function normalizePhotoLayout(value: unknown, photoCount = 1): PhotoLayout {
  if (typeof value === "number" && value >= 1 && value <= 4) {
    return LEGACY_LAYOUT_MAP[value as LegacyPhotoLayout];
  }
  if (typeof value === "string" && value in PHOTO_LAYOUT_SLOTS) return value as PhotoLayout;
  return defaultPhotoLayoutForCount(photoCount);
}

export const PRIMARY_RATIO_LAYOUTS = new Set<PhotoLayout>([
  "two_left_large",
  "two_top_large",
  "three_top_large_bottom_two",
  "three_left_large_right_two",
  "three_right_large_left_two",
  "three_left_large_right_top_medium_bottom_small",
  "four_top_large_bottom_three",
  "four_left_large_right_three",
]);

export const SECONDARY_RATIO_LAYOUTS = new Set<PhotoLayout>([
  "three_left_large_right_top_medium_bottom_small",
]);

export function getPhotoLayoutSlots(layout: PhotoLayout, tuning?: PhotoLayoutTuning): PhotoSlot[] {
  const tunedPrimary = ([0.55, 0.6, 0.65, 0.7] as number[]).includes(tuning?.primaryRatio ?? -1)
    ? tuning?.primaryRatio
    : undefined;
  const tunedSecondaryTop = ([0.55, 0.6, 0.65] as number[]).includes(tuning?.secondaryTopRatio ?? -1)
    ? tuning?.secondaryTopRatio
    : undefined;
  if (layout === "three_left_large_right_top_medium_bottom_small") {
    const primary = tunedPrimary ?? SPECIAL_PRIMARY;
    const secondaryTop = tunedSecondaryTop ?? SPECIAL_SECONDARY_TOP;
    const rightX = primary + SPECIAL_GAP;
    const bottomY = secondaryTop + SPECIAL_GAP;
    return [
      slot("photo-1", 0, 0, primary, 1),
      slot("photo-2", rightX, 0, 1 - rightX, secondaryTop),
      slot("photo-3", rightX, bottomY, 1 - rightX, 1 - bottomY),
    ];
  }

  const primary = tunedPrimary;
  if (primary !== undefined && PRIMARY_RATIO_LAYOUTS.has(layout)) {
    const secondary = 1 - primary - GAP;
    if (layout === "two_left_large") {
      return [slot("photo-1", 0, 0, primary, 1), slot("photo-2", primary + GAP, 0, secondary, 1)];
    }
    if (layout === "two_top_large") {
      return [slot("photo-1", 0, 0, 1, primary), slot("photo-2", 0, primary + GAP, 1, secondary)];
    }
    if (layout === "three_top_large_bottom_two") {
      return [
        slot("photo-1", 0, 0, 1, primary),
        slot("photo-2", 0, primary + GAP, HALF, secondary),
        slot("photo-3", HALF + GAP, primary + GAP, HALF, secondary),
      ];
    }
    if (layout === "three_left_large_right_two") {
      return [
        slot("photo-1", 0, 0, primary, 1),
        slot("photo-2", primary + GAP, 0, secondary, HALF),
        slot("photo-3", primary + GAP, HALF + GAP, secondary, HALF),
      ];
    }
    if (layout === "three_right_large_left_two") {
      return [
        slot("photo-1", secondary + GAP, 0, primary, 1),
        slot("photo-2", 0, 0, secondary, HALF),
        slot("photo-3", 0, HALF + GAP, secondary, HALF),
      ];
    }
    if (layout === "four_top_large_bottom_three") {
      return [
        slot("photo-1", 0, 0, 1, primary),
        slot("photo-2", 0, primary + GAP, THIRD, secondary),
        slot("photo-3", THIRD + GAP, primary + GAP, THIRD, secondary),
        slot("photo-4", (THIRD + GAP) * 2, primary + GAP, THIRD, secondary),
      ];
    }
    if (layout === "four_left_large_right_three") {
      return [
        slot("photo-1", 0, 0, primary, 1),
        slot("photo-2", primary + GAP, 0, secondary, THIRD),
        slot("photo-3", primary + GAP, THIRD + GAP, secondary, THIRD),
        slot("photo-4", primary + GAP, (THIRD + GAP) * 2, secondary, THIRD),
      ];
    }
  }
  return PHOTO_LAYOUT_SLOTS[layout];
}

export function getPhotoLayoutCount(layout: PhotoLayout): number {
  return PHOTO_LAYOUT_SLOTS[layout].length;
}

export function photoSlotPercentStyle(photoSlot: PhotoSlot) {
  return {
    leftPercent: photoSlot.xRatio * 100,
    topPercent: photoSlot.yRatio * 100,
    widthPercent: photoSlot.widthRatio * 100,
    heightPercent: photoSlot.heightRatio * 100,
  };
}

export function photoLayoutLabel(layout: PhotoLayout): string {
  return PHOTO_LAYOUT_OPTIONS.find((option) => option.value === layout)?.label ?? layout;
}

export function swapPhotoOrder<T>(photos: T[], sourceIndex: number, targetIndex: number): T[] {
  if (
    sourceIndex === targetIndex ||
    sourceIndex < 0 ||
    targetIndex < 0 ||
    sourceIndex >= photos.length ||
    targetIndex >= photos.length
  ) {
    return photos;
  }
  const next = [...photos];
  [next[sourceIndex], next[targetIndex]] = [next[targetIndex]!, next[sourceIndex]!];
  return next;
}
