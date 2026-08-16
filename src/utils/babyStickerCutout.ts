/**
 * Baby sticker cutout — on-device only.
 * - circular: round transparent PNG (existing mode)
 * - personCutout: iOS Vision person segmentation (falls back to circular)
 * Never upload baby photos to a server from this path.
 */

import { Platform } from "react-native";
import type { StickerCutoutMode } from "../types/babySticker";
import {
  createCircularCutout as nativeCircularCutout,
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

export type { StickerCutoutMode };

export type CutoutMethod = "circular" | "personCutout" | "circular-fallback" | "display";

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
    value: "circular",
    label: "둥근 스티커",
    hint: "얼굴을 동그랗게 잘라 스티커로 만들어요",
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
 * Person cutout failures open the circular positioner instead of a centered crop.
 */
export async function createStickerCutout(
  imageUri: string,
  mode: StickerCutoutMode = "circular",
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
      // Let the UI open the circular positioner instead of a centered crop.
      return { uri: imageUri, method: "circular-fallback", mode: "circular" };
    }
  }

  return createCircularSticker(imageUri, crop);
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
  return createStickerCutout(imageUri, "circular");
}
