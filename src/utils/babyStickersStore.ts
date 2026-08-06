import type { BabySticker } from "../types/babySticker";
import { qaStorage } from "./qaStorage";
import { STORAGE_KEYS } from "./storageKeys";
import { reportStorageIssue } from "./storageIssues";
import {
  isValidLocalDataScope,
  localDataScopeId,
  readScopedWithLegacyMigration,
  scopedStorageKey,
  type LocalDataScope,
} from "./scopedLocalStorage";

const STORAGE_KEY = STORAGE_KEYS.babyStickers;

let memory: BabySticker[] | null = null;
let hydrated = false;
let hydratePromise: Promise<boolean> | null = null;
let activeScopeId: string | null = null;

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
    faceImageUri: s.faceImageUri || s.cutoutImageUri || s.originalImageUri,
    finalStickerImageUri: s.finalStickerImageUri || s.cutoutImageUri || s.originalImageUri,
    cutoutMode: s.cutoutMode === "personCutout" ? "personCutout" : "circular",
    stickerType: s.stickerType ?? "faceTemplate",
    templateId: s.templateId ?? "portrait",
    label: s.label || "내 아기 스티커",
    borderStyle: s.borderStyle ?? "whiteThick",
    shadowStyle: s.shadowStyle ?? "soft",
    speechBubbleType: s.speechBubbleType ?? "none",
    frameType: s.frameType ?? "none",
    text: s.text ?? "",
  }));
}

export async function hydrateBabyStickers(scope: LocalDataScope | null, force = false): Promise<boolean> {
  if (!isValidLocalDataScope(scope)) {
    resetBabyStickersMemory();
    return true;
  }
  const nextScopeId = localDataScopeId(scope);
  if (activeScopeId !== nextScopeId) {
    resetBabyStickersMemory();
    activeScopeId = nextScopeId;
  }
  if (force) {
    hydrated = false;
    hydratePromise = null;
  }
  if (hydrated) return true;
  if (!hydratePromise) {
    const requestedScopeId = nextScopeId;
    hydratePromise = (async () => {
      try {
        const result = await readScopedWithLegacyMigration({
          baseKey: STORAGE_KEY,
          scope,
          parse: (raw) => normalize(JSON.parse(raw)),
          serialize: JSON.stringify,
          merge: (scoped, legacy) => {
            const byId = new Map(legacy.map((item) => [item.id, { ...item, babyId: scope.babyId }]));
            for (const item of scoped ?? []) byId.set(item.id, item);
            return [...byId.values()];
          },
        });
        if (activeScopeId !== requestedScopeId) return false;
        memory = result.value;
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

export async function saveBabyStickers(stickers: BabySticker[], scope: LocalDataScope | null): Promise<void> {
  if (!isValidLocalDataScope(scope) || activeScopeId !== localDataScopeId(scope)) return;
  memory = stickers;
  hydrated = true;
  try {
    await qaStorage.setItem(scopedStorageKey(STORAGE_KEY, scope), JSON.stringify(stickers));
  } catch {
    reportStorageIssue("save", STORAGE_KEY);
  }
}

export function resetBabyStickersMemory(): void {
  memory = null;
  hydrated = false;
  hydratePromise = null;
  activeScopeId = null;
}
