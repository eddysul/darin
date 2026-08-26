import type { GrowthBookPageSticker } from "../types/growthBook";
import type { BabySticker } from "../types/babySticker";

export type GrowthBookStickerPdfPosition = {
  leftPercent: number;
  topPercent: number;
  widthPercent: number;
  rotation: number;
  zIndex: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function clampGrowthBookPageSticker(
  sticker: GrowthBookPageSticker,
  canvasWidth: number,
  canvasHeight: number,
  heightFactor = 1,
): GrowthBookPageSticker {
  const widthRatio = clamp(sticker.widthRatio, 0.1, 0.42);
  const heightRatio = canvasHeight > 0
    ? ((widthRatio * canvasWidth) / canvasHeight) * heightFactor
    : widthRatio;
  return {
    ...sticker,
    widthRatio,
    xRatio: clamp(sticker.xRatio, 0, 1 - widthRatio),
    yRatio: clamp(sticker.yRatio, 0, Math.max(0, 1 - heightRatio)),
  };
}

/** Scales around the sticker center so pinch zoom does not jump its position. */
export function scaleGrowthBookPageSticker(
  sticker: GrowthBookPageSticker,
  scale: number,
  canvasWidth: number,
  canvasHeight: number,
  heightFactor = 1,
): GrowthBookPageSticker {
  const previousWidth = sticker.widthRatio;
  const nextWidth = clamp(previousWidth * scale, 0.1, 0.42);
  const previousHeight = canvasHeight > 0
    ? ((previousWidth * canvasWidth) / canvasHeight) * heightFactor
    : previousWidth;
  const nextHeight = canvasHeight > 0
    ? ((nextWidth * canvasWidth) / canvasHeight) * heightFactor
    : nextWidth;
  return clampGrowthBookPageSticker(
    {
      ...sticker,
      widthRatio: nextWidth,
      xRatio: sticker.xRatio - (nextWidth - previousWidth) / 2,
      yRatio: sticker.yRatio - (nextHeight - previousHeight) / 2,
    },
    canvasWidth,
    canvasHeight,
    heightFactor,
  );
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
    rotation: Number.isFinite(sticker.rotation) ? sticker.rotation ?? 0 : 0,
    zIndex: sticker.zIndex,
  };
}

/** Decorative text/bubbles make the rendered sticker taller than its stored width. */
export function growthBookStickerHeightFactor(sticker: BabySticker): number {
  const hasText = sticker.text.trim().length > 0;
  if (hasText) return 1.55;
  if (sticker.frameType === "star" || sticker.frameType === "heart" || sticker.frameType === "ribbon") return 1.2;
  return 1.1;
}
