import { requireSupabase } from "../lib/supabase";
import type { BabyStickerRow, Json } from "../types/database";
import type { BabySticker } from "../types/babySticker";
import { qaStorage } from "../utils/qaStorage";
import { scopedStorageKey, type LocalDataScope } from "../utils/scopedLocalStorage";
import { STORAGE_KEYS } from "../utils/storageKeys";
import { AuthRepository } from "./AuthRepository";

const BUCKET = "baby-stickers";
const MAX_STICKER_BYTES = 10 * 1024 * 1024;
const SIGNED_URL_TTL_SECONDS = 180;

type StickerMetadata = Pick<
  BabySticker,
  | "cutoutMode"
  | "stickerType"
  | "templateId"
  | "borderStyle"
  | "shadowStyle"
  | "speechBubbleType"
  | "frameType"
  | "text"
>;

function metadataFromSticker(sticker: BabySticker): StickerMetadata {
  return {
    cutoutMode: sticker.cutoutMode,
    stickerType: sticker.stickerType,
    templateId: sticker.templateId,
    borderStyle: sticker.borderStyle,
    shadowStyle: sticker.shadowStyle,
    speechBubbleType: sticker.speechBubbleType,
    frameType: sticker.frameType,
    text: sticker.text,
  };
}

function metadataObject(value: Json): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

async function requireUserId(): Promise<string> {
  const user = await AuthRepository.getUser();
  if (!user) throw new Error("Baby stickers require an authenticated user.");
  return user.id;
}

async function signedUrlForRow(row: BabyStickerRow): Promise<string> {
  const sb = requireSupabase();
  const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(row.storage_path, SIGNED_URL_TTL_SECONDS);
  if (error) throw error;
  return data.signedUrl;
}

async function rowToSticker(row: BabyStickerRow): Promise<BabySticker> {
  const metadata = metadataObject(row.metadata);
  const imageUri = await signedUrlForRow(row);
  return {
    id: row.id,
    babyId: row.baby_id,
    originalImageUri: imageUri,
    faceImageUri: imageUri,
    cutoutImageUri: imageUri,
    finalStickerImageUri: imageUri,
    storagePath: row.storage_path,
    serverBacked: true,
    cutoutMode: metadata.cutoutMode === "personCutout" ? "personCutout" : "circular",
    stickerType: metadata.stickerType === "faceCrop" ? "faceCrop" : "faceTemplate",
    templateId: typeof metadata.templateId === "string" ? metadata.templateId as BabySticker["templateId"] : "portrait",
    label: row.label,
    borderStyle: typeof metadata.borderStyle === "string" ? metadata.borderStyle as BabySticker["borderStyle"] : "whiteThick",
    shadowStyle: typeof metadata.shadowStyle === "string" ? metadata.shadowStyle as BabySticker["shadowStyle"] : "soft",
    speechBubbleType: typeof metadata.speechBubbleType === "string" ? metadata.speechBubbleType as BabySticker["speechBubbleType"] : "none",
    frameType: typeof metadata.frameType === "string" ? metadata.frameType as BabySticker["frameType"] : "none",
    text: typeof metadata.text === "string" ? metadata.text : "",
    createdBy: row.created_by ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const BabyStickerRepository = {
  async createStickerSignedUrl(storagePath: string): Promise<string> {
    const sb = requireSupabase();
    // The table lookup and Storage policy both enforce sticker visibility.
    const { data: row, error: rowError } = await sb
      .from("baby_stickers")
      .select("storage_path")
      .eq("storage_path", storagePath)
      .single();
    if (rowError || !row) throw rowError ?? new Error("Sticker not found or not accessible.");
    const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);
    if (error) throw error;
    return data.signedUrl;
  },

  async listByBabyId(babyId: string): Promise<BabySticker[]> {
    const sb = requireSupabase();
    const { data, error } = await sb
      .from("baby_stickers")
      .select("*")
      .eq("baby_id", babyId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return Promise.all((data ?? []).map(rowToSticker));
  },

  async listBabyStickers(babyId: string): Promise<BabySticker[]> {
    return this.listByBabyId(babyId);
  },

  async getById(stickerId: string): Promise<BabySticker | null> {
    const sb = requireSupabase();
    const { data, error } = await sb.from("baby_stickers").select("*").eq("id", stickerId).maybeSingle();
    if (error) throw error;
    return data ? rowToSticker(data) : null;
  },

  async listByIds(stickerIds: string[]): Promise<BabySticker[]> {
    const ids = [...new Set(stickerIds.filter(Boolean))];
    if (!ids.length) return [];
    const sb = requireSupabase();
    const { data, error } = await sb.from("baby_stickers").select("*").in("id", ids);
    if (error) throw error;
    return Promise.all((data ?? []).map(rowToSticker));
  },

  async uploadSticker(sticker: BabySticker, source = "app"): Promise<BabySticker> {
    const sb = requireSupabase();
    const createdBy = await requireUserId();
    const response = await fetch(sticker.finalStickerImageUri || sticker.cutoutImageUri || sticker.originalImageUri);
    const bytes = await response.arrayBuffer();
    if (!bytes.byteLength) throw new Error("스티커 이미지를 읽지 못했어요.");
    if (bytes.byteLength > MAX_STICKER_BYTES) throw new Error("스티커 이미지는 10MB 이하만 저장할 수 있어요.");
    const storagePath = `${sticker.babyId}/${sticker.id}.png`;
    const { error: uploadError } = await sb.storage.from(BUCKET).upload(storagePath, bytes, {
      contentType: "image/png",
      upsert: true,
    });
    if (uploadError) throw uploadError;

    const { data, error } = await sb.from("baby_stickers").upsert({
      id: sticker.id,
      baby_id: sticker.babyId,
      created_by: createdBy,
      label: sticker.label.trim() || "내 아기 스티커",
      storage_path: storagePath,
      source,
      metadata: metadataFromSticker(sticker),
      created_at: sticker.createdAt,
      updated_at: new Date().toISOString(),
      deleted_at: null,
    }, { onConflict: "id" }).select("*").single();
    if (error) {
      await sb.storage.from(BUCKET).remove([storagePath]);
      throw error;
    }
    return rowToSticker(data);
  },

  async uploadBabySticker(sticker: BabySticker, source = "app"): Promise<BabySticker> {
    return this.uploadSticker(sticker, source);
  },

  async createBabySticker(sticker: BabySticker): Promise<BabySticker> {
    return this.uploadSticker(sticker, "app");
  },

  async deleteSticker(stickerId: string): Promise<void> {
    const sb = requireSupabase();
    const { error } = await sb.from("baby_stickers").update({ deleted_at: new Date().toISOString() }).eq("id", stickerId);
    if (error) throw error;
  },

  async deleteBabySticker(stickerId: string): Promise<void> {
    return this.deleteSticker(stickerId);
  },

  async uploadLocalBabyStickersMigration(scope: LocalDataScope, local: BabySticker[]): Promise<BabySticker[]> {
    const flagKey = scopedStorageKey(STORAGE_KEYS.babyStickersMigration, scope);
    const completed = await qaStorage.getItem(flagKey);
    if (!completed) {
      for (const sticker of local.filter((item) => item.babyId === scope.babyId && !item.serverBacked)) {
        await this.uploadSticker(sticker, "local_migration");
      }
      await qaStorage.setItem(flagKey, JSON.stringify({ migratedAt: new Date().toISOString() }));
    }
    return this.listByBabyId(scope.babyId);
  },
};
