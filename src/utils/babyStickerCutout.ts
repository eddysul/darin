/**
 * Baby sticker cutout — on-device only.
 * - roundedRect: rounded rectangle transparent PNG (current default)
 * - circular: round transparent PNG retained for existing stickers
 * - personCutout: iOS Vision person segmentation (falls back to roundedRect)
 * Never upload baby photos to a server from this path.
 */

import { Platform } from "react-native";
import type { StickerCutoutMode } from "../types/babySticker";
import {
  createCircularCutout as nativeCircularCutout,
  createRoundedRectCutout as nativeRoundedRectCutout,
  createPersonCutout as nativePersonCutout,
  isPersonCutoutAvailable,
  type CircularCutoutCrop,
} from "person-cutout";

export type { CircularCutoutCrop };

export const DEFAULT_CIRCLE_CROP: CircularCutoutCrop = {
  offsetX: 0.5,
  offsetY: 0.5,
  zoom: 1,
};
export const DEFAULT_STICKER_CROP = DEFAULT_CIRCLE_CROP;

export type { StickerCutoutMode };

export type CutoutMethod =
  | "roundedRect"
  | "circular"
  | "personCutout"
  | "rounded-rect-fallback"
  | "display";

export type CutoutResult = {
  uri: string;
  method: CutoutMethod;
  mode: StickerCutoutMode;
};

export const STICKER_CUTOUT_MODE_OPTIONS: Array<{
  value: StickerCutoutMode;
  label: string;
  hint: string;
  iosOnly?: boolean;
}> = [
  {
    value: "roundedRect",
    label: "둥근 사각형",
    hint: "사진을 부드러운 둥근 사각형으로 잘라요",
  },
  {
    value: "personCutout",
    label: "인물 컷아웃",
    hint: "배경을 지우고 아기만 남겨요 (기기 안에서만 처리)",
    iosOnly: true,
  },
];

export function isPersonCutoutSupported(): boolean {
  return Platform.OS === "ios" && isPersonCutoutAvailable();
}

/**
 * Produce a transparent sticker PNG for the selected mode.
 * Person cutout failures open the rounded-rectangle positioner.
 */
export async function createStickerCutout(
  imageUri: string,
  mode: StickerCutoutMode = "roundedRect",
  crop?: CircularCutoutCrop,
): Promise<CutoutResult> {
  if (!imageUri) throw new Error("이미지 URI가 없어요.");

  if (mode === "personCutout") {
    try {
      if (!isPersonCutoutSupported()) {
        throw new Error("Person cutout unavailable");
      }
      const uri = await nativePersonCutout(imageUri, 2.5);
      return { uri, method: "personCutout", mode: "personCutout" };
    } catch {
      return { uri: imageUri, method: "rounded-rect-fallback", mode: "roundedRect" };
    }
  }

  return mode === "circular"
    ? createCircularSticker(imageUri, crop)
    : createRoundedRectSticker(imageUri, crop);
}

async function createRoundedRectSticker(
  imageUri: string,
  crop?: CircularCutoutCrop,
): Promise<CutoutResult> {
  if (Platform.OS === "ios") {
    try {
      const uri = await nativeRoundedRectCutout(imageUri, crop);
      return { uri, method: "roundedRect", mode: "roundedRect" };
    } catch (error) {
      // Never pretend the crop succeeded: returning the original image here made
      // the positioner appear to work while silently discarding its coordinates.
      throw new Error("둥근 사각형 위치를 적용하지 못했어요.", { cause: error });
    }
  }
  // Android uses the system picker's square editor before reaching this point.
  return { uri: imageUri, method: "display", mode: "roundedRect" };
}

async function createCircularSticker(
  imageUri: string,
  crop?: CircularCutoutCrop,
): Promise<CutoutResult> {
  try {
    if (Platform.OS === "ios") {
      const uri = await nativeCircularCutout(imageUri, crop);
      return { uri, method: "circular", mode: "circular" };
    }
  } catch {
    // fall through to display-only circular
  }
  // Non-iOS / native failure: keep original; UI still clips to a circle.
  return { uri: imageUri, method: "display", mode: "circular" };
}

/** @deprecated Prefer createStickerCutout — kept for call-site compatibility. */
export async function removeBackground(imageUri: string): Promise<CutoutResult> {
  return createStickerCutout(imageUri, "roundedRect");
}
