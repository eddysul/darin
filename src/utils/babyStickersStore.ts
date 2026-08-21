import type { BabySticker } from "../types/babySticker";
import {
  normalizeBorderStyle,
  normalizeFrameType,
  normalizeShadowStyle,
  normalizeSpeechBubbleType,
  normalizeTemplateId,
} from "../types/babySticker";
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
    cutoutMode:
      s.cutoutMode === "personCutout" || s.cutoutMode === "roundedRect"
        ? s.cutoutMode
        : "circular",
    stickerType: s.stickerType ?? "faceTemplate",
    templateId: normalizeTemplateId(s.templateId),
    label: s.label || "내 아기 스티커",
    borderStyle: normalizeBorderStyle(s.borderStyle),
    shadowStyle: normalizeShadowStyle(s.shadowStyle),
    speechBubbleType: normalizeSpeechBubbleType(s.speechBubbleType),
    frameType: normalizeFrameType(s.frameType),
    text: s.text ?? "",
  }));
}

function isEphemeralImageUri(uri: string): boolean {
  return /^(https?:)?\/\//i.test(uri) || uri.startsWith("data:");
}

function pickDurableImageUri(primary: string, fallback: string): string {
  if (primary && !isEphemeralImageUri(primary)) return primary;
  if (fallback && !isEphemeralImageUri(fallback)) return fallback;
  return primary || fallback || "";
}

/** Keep document-directory copies; drop signed URLs that expire in minutes. */
export function withLocalStickerAssets(primary: BabySticker, fallback?: BabySticker): BabySticker {
  if (!fallback) return primary;
  return {
    ...primary,
    originalImageUri: pickDurableImageUri(primary.originalImageUri, fallback.originalImageUri),
    faceImageUri: pickDurableImageUri(primary.faceImageUri, fallback.faceImageUri),
    cutoutImageUri: pickDurableImageUri(primary.cutoutImageUri, fallback.cutoutImageUri),
    finalStickerImageUri: pickDurableImageUri(primary.finalStickerImageUri, fallback.finalStickerImageUri),
  };
}

export function mergeBabyStickerLists(server: BabySticker[], local: BabySticker[]): BabySticker[] {
  const byId = new Map<string, BabySticker>();
  for (const item of local) byId.set(item.id, item);
  for (const item of server) {
    byId.set(item.id, withLocalStickerAssets(item, byId.get(item.id)));
  }
  return [...byId.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Persist local file paths; never cache short-lived signed URLs. */
function toPersistedStickers(stickers: BabySticker[]): BabySticker[] {
  return stickers.map((sticker) => ({
    ...sticker,
    originalImageUri: isEphemeralImageUri(sticker.originalImageUri) ? "" : sticker.originalImageUri,
    faceImageUri: isEphemeralImageUri(sticker.faceImageUri) ? "" : sticker.faceImageUri,
    cutoutImageUri: isEphemeralImageUri(sticker.cutoutImageUri) ? "" : sticker.cutoutImageUri,
    finalStickerImageUri: isEphemeralImageUri(sticker.finalStickerImageUri) ? "" : sticker.finalStickerImageUri,
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
  const key = scopedStorageKey(STORAGE_KEY, scope);
  const payload = JSON.stringify(toPersistedStickers(stickers));
  try {
    await qaStorage.setItem(key, payload);
  } catch (error) {
    // Keep in-memory originals. Server remains source of truth for migrated stickers.
    if (typeof __DEV__ !== "undefined" && __DEV__) {
      console.warn("[babyStickersStore] local cache save failed", error);
    }
    reportStorageIssue("save", STORAGE_KEY, "local_cache");
  }
}

export function resetBabyStickersMemory(): void {
  memory = null;
  hydrated = false;
  hydratePromise = null;
  activeScopeId = null;
}
