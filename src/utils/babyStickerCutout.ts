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
} from "person-cutout";

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
 * Person cutout failures fall back to circular (never throws for empty URI only).
 */
export async function createStickerCutout(
  imageUri: string,
  mode: StickerCutoutMode = "circular",
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
      // Requirement: fall back to existing circular sticker mode
      const circular = await createCircularSticker(imageUri);
      return { ...circular, method: "circular-fallback", mode: "circular" };
    }
  }

  return createCircularSticker(imageUri);
}

async function createCircularSticker(imageUri: string): Promise<CutoutResult> {
  try {
    if (Platform.OS === "ios") {
      const uri = await nativeCircularCutout(imageUri);
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
