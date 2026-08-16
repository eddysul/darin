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
    hint: "배경을 지우고 아기만 남겨요. 이 기기에서만 처리해요.",
    iosOnly: true,
  },
];

export function isPersonCutoutSupported(): boolean {
  return Platform.OS === "ios" && isPersonCutoutAvailable();
}

/** Korean reason for the cutting error screen. */
export function explainStickerCutoutError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  const text = raw.toLowerCase();
  if (
    text.includes("이 실행에서") ||
    text.includes("not available") ||
    text.includes("native module") ||
    text.includes("cannot find native")
  ) {
    return "인물 컷아웃 모듈을 이 실행에서 찾지 못했어요. Metro만 다시 켠 상태면 앱을 한 번 다시 빌드해 주세요.";
  }
  if (text.includes("얼굴을 찾지") || text.includes("no person") || text.includes("noperson")) {
    return "사진에서 아기 얼굴을 찾지 못했어요. 얼굴이 잘 나온 사진으로 다시 시도하거나, 둥근 사각형으로 계속할 수 있어요.";
  }
  if (text.includes("불러오지") || text.includes("could not load") || text.includes("invalidimage")) {
    return "사진을 불러오지 못했어요. 시뮬레이터 iCloud 사진이면 사진 앱에 저장한 로컬 사진을 골라 주세요.";
  }
  if (text.includes("지원하지") || text.includes("ios 15") || text.includes("unsupported")) {
    return "이 기기는 인물 컷아웃을 지원하지 않아요. 둥근 사각형으로 계속할 수 있어요.";
  }
  if (
    text.includes("genericobjc") ||
    text.includes("couldn't be completed") ||
    text.includes("couldn’t be completed") ||
    text.includes("error 0")
  ) {
    return "시뮬레이터나 이 사진에서는 인물 분리가 실패할 수 있어요. 얼굴이 잘 나온 로컬 사진으로 다시 시도하거나, 둥근 사각형으로 계속할 수 있어요.";
  }
  if (text.includes("문제가 생겼") || text.includes("processing") || text.includes("createpersoncutout")) {
    return "배경을 지우는 중 문제가 생겼어요. 다시 시도하거나 둥근 사각형으로 계속할 수 있어요.";
  }
  if (raw.trim() && !text.includes("function") && !text.includes("foundation.")) return raw.trim();
  return "다시 시도하거나 둥근 사각형 방식으로 계속할 수 있어요.";
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
    if (!isPersonCutoutSupported()) {
      throw new Error("인물 컷아웃을 이 실행에서 쓸 수 없어요.");
    }
    const uri = await nativePersonCutout(imageUri, 2.5);
    return { uri, method: "personCutout", mode: "personCutout" };
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
