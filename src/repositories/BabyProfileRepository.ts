import type { BabyRow } from "../types/database";
import type { BabyProfile, UpdateBabyProfileInput, UploadAvatarInput } from "../types/profileSettings";
import { MAX_PROFILE_AVATAR_BYTES } from "../types/profileSettings";
import { requireSupabase } from "../lib/supabase";
import { AuthRepository } from "./AuthRepository";

const BUCKET = "profile-media";
const SIGNED_URL_TTL_SECONDS = 180;

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
    gender: row.gender ?? undefined,
    note: row.special_notes ?? undefined,
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
    if (!name) throw new Error("아기 이름을 입력해 주세요.");
    if (input.birthDate) {
      const parsed = new Date(`${input.birthDate}T00:00:00`);
      if (!Number.isFinite(parsed.getTime()) || parsed.getTime() > Date.now() + 86_400_000 * 280) {
        throw new Error("생년월일을 다시 확인해 주세요.");
      }
    }
    const sb = requireSupabase();
    const patch: Partial<BabyRow> = {
      name,
      nickname: input.nickname?.trim() || null,
      birth_date: input.birthDate || null,
      gender: input.gender || null,
      special_notes: input.note?.trim() || null,
      updated_at: new Date().toISOString(),
    };
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
        throw new Error("이 정보를 수정할 권한이 없어요.");
      }
      throw new Error("프로필을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.");
    }
    const avatarUrl = data.avatar_storage_path
      ? await this.createBabyAvatarSignedUrl(data.avatar_storage_path).catch(() => undefined)
      : undefined;
    return rowToBabyProfile(data, avatarUrl);
  },

  async uploadBabyAvatar(babyId: string, input: UploadAvatarInput): Promise<BabyProfile> {
    if (input.fileSize !== undefined && input.fileSize > MAX_PROFILE_AVATAR_BYTES) {
      throw new Error("사진은 5MB 이하만 올릴 수 있어요.");
    }
    const sb = requireSupabase();
    await AuthRepository.ensureSession();
    const ext = extensionForMime(input.mimeType);
    const storagePath = `babies/${babyId}/avatar.${ext}`;
    const response = await fetch(input.uri);
    const bytes = await response.arrayBuffer();
    if (!bytes.byteLength) throw new Error("사진을 올리지 못했어요. 다른 사진으로 다시 시도해 주세요.");
    if (bytes.byteLength > MAX_PROFILE_AVATAR_BYTES) {
      throw new Error("사진은 5MB 이하만 올릴 수 있어요.");
    }
    const { error: uploadError } = await sb.storage.from(BUCKET).upload(storagePath, bytes, {
      contentType: input.mimeType ?? "image/jpeg",
      upsert: true,
    });
    if (uploadError) {
      if (/policy|permission|row-level/i.test(uploadError.message)) {
        throw new Error("이 정보를 수정할 권한이 없어요.");
      }
      throw new Error("사진을 올리지 못했어요. 다른 사진으로 다시 시도해 주세요.");
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
        throw new Error("이 정보를 수정할 권한이 없어요.");
      }
      throw new Error("프로필을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.");
    }
    const avatarUrl = await this.createBabyAvatarSignedUrl(storagePath);
    return rowToBabyProfile(data, avatarUrl);
  },

  async createBabyAvatarSignedUrl(storagePath: string, expiresInSeconds = SIGNED_URL_TTL_SECONDS): Promise<string> {
    const sb = requireSupabase();
    const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(storagePath, expiresInSeconds);
    if (error || !data?.signedUrl) throw error ?? new Error("사진을 불러오지 못했어요.");
    return data.signedUrl;
  },
};
