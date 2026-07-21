import type { BabySticker } from "../types/babySticker";
import { qaStorage } from "./qaStorage";
import { STORAGE_KEYS } from "./storageKeys";
import { reportStorageIssue } from "./storageIssues";

const STORAGE_KEY = STORAGE_KEYS.babyStickers;

let memory: BabySticker[] | null = null;
let hydrated = false;
let hydratePromise: Promise<boolean> | null = null;

function isSticker(item: unknown): item is BabySticker {
  if (typeof item !== "object" || item === null) return false;
  const s = item as BabySticker;
  return (
    typeof s.id === "string" &&
    typeof s.babyId === "string" &&
    typeof s.originalImageUri === "string" &&
    typeof s.finalStickerImageUri === "string"
  );
}

function normalize(raw: unknown): BabySticker[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isSticker).map((s) => ({
    ...s,
    cutoutImageUri: s.cutoutImageUri || s.originalImageUri,
    finalStickerImageUri: s.finalStickerImageUri || s.cutoutImageUri || s.originalImageUri,
    label: s.label || "내 아기 스티커",
    borderStyle: s.borderStyle ?? "whiteThick",
    shadowStyle: s.shadowStyle ?? "soft",
    speechBubbleType: s.speechBubbleType ?? "none",
    frameType: s.frameType ?? "none",
    text: s.text ?? "",
  }));
}

export async function hydrateBabyStickers(force = false): Promise<boolean> {
  if (force) {
    hydrated = false;
    hydratePromise = null;
  }
  if (hydrated) return true;
  if (!hydratePromise) {
    hydratePromise = (async () => {
      try {
        const raw = await qaStorage.getItem(STORAGE_KEY);
        memory = raw ? normalize(JSON.parse(raw)) : null;
        hydrated = true;
        return true;
      } catch {
        reportStorageIssue("load", STORAGE_KEY);
        return false;
      }
    })();
  }
  return hydratePromise;
}

export function getBabyStickers(): BabySticker[] | null {
  return memory;
}

export async function saveBabyStickers(stickers: BabySticker[]): Promise<void> {
  memory = stickers;
  hydrated = true;
  try {
    await qaStorage.setItem(STORAGE_KEY, JSON.stringify(stickers));
  } catch {
    reportStorageIssue("save", STORAGE_KEY);
  }
}
