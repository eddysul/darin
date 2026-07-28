import type { GrowthBookPageSticker } from "../types/growthBook";
import type { BabySticker } from "../types/babySticker";

export type GrowthBookStickerPdfPosition = {
  leftPercent: number;
  topPercent: number;
  widthPercent: number;
  zIndex: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/** Converts normalized page coordinates to the percentages used by the A4 PDF page. */
export function growthBookStickerPdfPosition(
  sticker: GrowthBookPageSticker,
  heightFactor = 1,
): GrowthBookStickerPdfPosition {
  const widthRatio = clamp(sticker.widthRatio, 0.1, 0.42);
  const heightRatio = widthRatio * (210 / 297) * heightFactor;
  return {
    leftPercent: clamp(sticker.xRatio, 0, 1 - widthRatio) * 100,
    topPercent: clamp(sticker.yRatio, 0, Math.max(0, 1 - heightRatio)) * 100,
    widthPercent: widthRatio * 100,
    zIndex: sticker.zIndex,
  };
}

/** Decorative text/bubbles make the rendered sticker taller than its stored width. */
export function growthBookStickerHeightFactor(sticker: BabySticker): number {
  const hasText = sticker.text.trim().length > 0;
  if (sticker.speechBubbleType !== "none" && hasText) return 1.75;
  if (hasText) return 1.45;
  return 1.1;
}
