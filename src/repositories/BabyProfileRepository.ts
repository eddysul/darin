import type { BabyRow } from "../types/database";
import type { BabyProfile, UpdateBabyProfileInput, UploadAvatarInput } from "../types/profileSettings";
import { MAX_PROFILE_AVATAR_BYTES } from "../types/profileSettings";
import { requireSupabase } from "../lib/supabase";
import { AuthRepository } from "./AuthRepository";

const BUCKET = "profile-media";
const SIGNED_URL_TTL_SECONDS = 180;

export type BabyProfileErrorCode =
  | "name_required"
  | "birth_date_invalid"
  | "permission_denied"
  | "save_failed"
  | "photo_too_large"
  | "photo_upload_failed"
  | "photo_load_failed";

export class BabyProfileError extends Error {
  constructor(readonly code: BabyProfileErrorCode) {
    super(code);
    this.name = "BabyProfileError";
  }
}

function extensionForMime(mimeType?: string): string {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return "jpg";
}

function rowToBabyProfile(row: BabyRow, avatarUrl?: string): BabyProfile {
  return {
    id: row.id,
    name: row.name,
    nickname: row.nickname ?? undefined,
    birthDate: row.birth_date ?? undefined,
    dueDate: row.due_date ?? undefined,
    childStatus: row.child_status,
    gender: row.gender ?? undefined,
    note: row.special_notes ?? undefined,
    birthWeight: row.birth_weight ?? undefined,
    avatarStoragePath: row.avatar_storage_path ?? undefined,
    avatarUrl: avatarUrl ?? (row.photo_url?.startsWith("http") ? row.photo_url : undefined),
    photoUrl: row.photo_url ?? undefined,
  };
}

export const BabyProfileRepository = {
  async getBabyProfile(babyId: string): Promise<BabyProfile | null> {
    const sb = requireSupabase();
    await AuthRepository.ensureSession();
    const { data, error } = await sb.from("babies").select("*").eq("id", babyId).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const avatarUrl = data.avatar_storage_path
      ? await this.createBabyAvatarSignedUrl(data.avatar_storage_path).catch(() => undefined)
      : undefined;
    return rowToBabyProfile(data, avatarUrl);
  },

  async updateBabyProfile(input: UpdateBabyProfileInput): Promise<BabyProfile> {
    const name = input.name.trim();
    if (!name) throw new BabyProfileError("name_required");
    if (input.birthDate) {
      const parsed = new Date(`${input.birthDate}T00:00:00`);
      if (!Number.isFinite(parsed.getTime()) || parsed.getTime() > Date.now() + 86_400_000 * 280) {
        throw new BabyProfileError("birth_date_invalid");
      }
    }
    const sb = requireSupabase();
    const patch: Partial<BabyRow> = {
      name,
      nickname: input.nickname?.trim() || null,
      gender: input.gender || null,
      special_notes: input.note?.trim() || null,
      updated_at: new Date().toISOString(),
    };
    if (input.birthDate !== undefined) {
      patch.birth_date = input.birthDate || null;
    }
    if (input.dueDate !== undefined) {
      patch.due_date = input.dueDate || null;
    }
    if (input.childStatus !== undefined) {
      patch.child_status = input.childStatus || "newborn";
    }
    if (input.birthWeight !== undefined) {
      patch.birth_weight = input.birthWeight || null;
    }
    if (input.clearAvatar) {
      patch.avatar_storage_path = null;
    }
    const { data, error } = await sb
      .from("babies")
      .update(patch)
      .eq("id", input.babyId)
      .select("*")
      .single();
    if (error) {
      if (error.code === "42501" || /permission|policy/i.test(error.message)) {
        throw new BabyProfileError("permission_denied");
      }
      throw new BabyProfileError("save_failed");
    }
    const avatarUrl = data.avatar_storage_path
      ? await this.createBabyAvatarSignedUrl(data.avatar_storage_path).catch(() => undefined)
      : undefined;
    return rowToBabyProfile(data, avatarUrl);
  },

  async uploadBabyAvatar(babyId: string, input: UploadAvatarInput): Promise<BabyProfile> {
    if (input.fileSize !== undefined && input.fileSize > MAX_PROFILE_AVATAR_BYTES) {
      throw new BabyProfileError("photo_too_large");
    }
    const sb = requireSupabase();
    await AuthRepository.ensureSession();
    const ext = extensionForMime(input.mimeType);
    const storagePath = `babies/${babyId}/avatar.${ext}`;
    const response = await fetch(input.uri);
    const bytes = await response.arrayBuffer();
    if (!bytes.byteLength) throw new BabyProfileError("photo_upload_failed");
    if (bytes.byteLength > MAX_PROFILE_AVATAR_BYTES) {
      throw new BabyProfileError("photo_too_large");
    }
    const { error: uploadError } = await sb.storage.from(BUCKET).upload(storagePath, bytes, {
      contentType: input.mimeType ?? "image/jpeg",
      upsert: true,
    });
    if (uploadError) {
      if (/policy|permission|row-level/i.test(uploadError.message)) {
        throw new BabyProfileError("permission_denied");
      }
      throw new BabyProfileError("photo_upload_failed");
    }
    const { data, error } = await sb
      .from("babies")
      .update({
        avatar_storage_path: storagePath,
        updated_at: new Date().toISOString(),
      })
      .eq("id", babyId)
      .select("*")
      .single();
    if (error) {
      await sb.storage.from(BUCKET).remove([storagePath]);
      if (error.code === "42501" || /permission|policy/i.test(error.message)) {
        throw new BabyProfileError("permission_denied");
      }
      throw new BabyProfileError("save_failed");
    }
    const avatarUrl = await this.createBabyAvatarSignedUrl(storagePath);
    return rowToBabyProfile(data, avatarUrl);
  },

  async createBabyAvatarSignedUrl(storagePath: string, expiresInSeconds = SIGNED_URL_TTL_SECONDS): Promise<string> {
    const sb = requireSupabase();
    const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(storagePath, expiresInSeconds);
    if (error || !data?.signedUrl) throw error ?? new BabyProfileError("photo_load_failed");
    return data.signedUrl;
  },
};
