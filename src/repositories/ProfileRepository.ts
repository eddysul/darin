import type { ProfileRow } from "../types/database";
import type {
  DisplayProfile,
  UpdateMyProfileInput,
  UploadAvatarInput,
} from "../types/profileSettings";
import { MAX_PROFILE_AVATAR_BYTES } from "../types/profileSettings";
import { requireSupabase } from "../lib/supabase";
import { toDbRelationshipLabel } from "../utils/supabaseMappers";
import { AuthRepository } from "./AuthRepository";

const BUCKET = "profile-media";
const SIGNED_URL_TTL_SECONDS = 180;

function mapProfileWriteError(error: { code?: string; message?: string }): Error {
  const message = error.message ?? "";
  if (error.code === "23505" && /darin_id|profiles_darin_id/i.test(message)) {
    return new Error("이미 사용 중인 Darin ID예요. 새 코드를 눌러 다시 시도해 주세요.");
  }
  if (/invalid Darin ID format/i.test(message)) {
    return new Error("Darin ID 형식을 확인해 주세요.");
  }
  return new Error(message || "프로필을 저장하지 못했어요.");
}

function extensionForMime(mimeType?: string): string {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return "jpg";
}

function rowToDisplay(
  row: Pick<
    ProfileRow,
    "id" | "display_name" | "nickname" | "avatar_storage_path" | "default_relation"
  >,
  avatarUrl?: string,
): DisplayProfile {
  return {
    userId: row.id,
    displayName: row.display_name?.trim() || "가족",
    nickname: row.nickname ?? undefined,
    avatarStoragePath: row.avatar_storage_path ?? undefined,
    avatarUrl,
    defaultRelation: row.default_relation ?? undefined,
  };
}

export const ProfileRepository = {
  async getMyProfile(): Promise<ProfileRow | null> {
    const sb = requireSupabase();
    const user = await AuthRepository.getUser();
    if (!user) return null;
    const { data, error } = await sb.from("profiles").select("*").eq("id", user.id).maybeSingle();
    if (error) throw error;
    return data;
  },

  async getMyDisplayProfile(): Promise<DisplayProfile | null> {
    const row = await this.getMyProfile();
    if (!row) return null;
    const avatarUrl = row.avatar_storage_path
      ? await this.createProfileAvatarSignedUrl(row.avatar_storage_path).catch(() => undefined)
      : undefined;
    return rowToDisplay(row, avatarUrl);
  },

  async upsertMyProfile(input: {
    displayName: string;
    preferredLanguage?: string;
    avatarUrl?: string | null;
    nickname?: string | null;
    darinId?: string | null;
    defaultRelation?: string | null;
    residenceCountry?: string | null;
    guardianBirthDate?: string | null;
    avatarStoragePath?: string | null;
  }): Promise<ProfileRow> {
    const sb = requireSupabase();
    const session = await AuthRepository.ensureSession();
    const row = {
      id: session.user.id,
      display_name: input.displayName.trim(),
      preferred_language: input.preferredLanguage ?? "ko",
      avatar_url: input.avatarUrl === undefined ? undefined : input.avatarUrl,
      nickname: input.nickname === undefined ? undefined : (input.nickname?.trim() || null),
      darin_id: input.darinId === undefined ? undefined : (input.darinId?.trim() || null),
      default_relation: input.defaultRelation === undefined ? undefined : input.defaultRelation,
      residence_country:
        input.residenceCountry === undefined ? undefined : input.residenceCountry,
      guardian_birth_date:
        input.guardianBirthDate === undefined ? undefined : input.guardianBirthDate,
      avatar_storage_path:
        input.avatarStoragePath === undefined ? undefined : input.avatarStoragePath,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await sb.from("profiles").upsert(row).select("*").single();
    if (error) throw mapProfileWriteError(error);
    return data;
  },

  async updateMyProfile(input: UpdateMyProfileInput): Promise<DisplayProfile> {
    const sb = requireSupabase();
    const session = await AuthRepository.ensureSession();
    const name = input.displayName.trim();
    if (!name) throw new Error("닉네임을 입력해 주세요.");
    if (!input.nickname?.trim()) throw new Error("이름을 입력해 주세요.");

    const patch: Partial<ProfileRow> = {
      display_name: name,
      darin_id: input.darinId === undefined ? undefined : (input.darinId?.trim() || null),
      nickname: input.nickname?.trim() || null,
      default_relation: input.defaultRelation
        ? toDbRelationshipLabel(input.defaultRelation)
        : null,
      residence_country: input.residenceCountry,
      guardian_birth_date: input.guardianBirthDate,
      updated_at: new Date().toISOString(),
    };
    if (input.preferredLanguage) patch.preferred_language = input.preferredLanguage;
    if (input.clearAvatar) {
      patch.avatar_storage_path = null;
      patch.avatar_url = null;
    }

    const { data, error } = await sb
      .from("profiles")
      .update(patch)
      .eq("id", session.user.id)
      .select("*")
      .single();
    if (error) throw mapProfileWriteError(error);
    const avatarUrl = data.avatar_storage_path
      ? await this.createProfileAvatarSignedUrl(data.avatar_storage_path).catch(() => undefined)
      : undefined;
    return rowToDisplay(data, avatarUrl);
  },

  async uploadMyAvatar(input: UploadAvatarInput): Promise<DisplayProfile> {
    if (input.fileSize !== undefined && input.fileSize > MAX_PROFILE_AVATAR_BYTES) {
      throw new Error("사진은 5MB 이하만 올릴 수 있어요.");
    }
    const sb = requireSupabase();
    const session = await AuthRepository.ensureSession();
    const ext = extensionForMime(input.mimeType);
    const storagePath = `users/${session.user.id}/avatar.${ext}`;
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
    if (uploadError) throw new Error("사진을 올리지 못했어요. 다른 사진으로 다시 시도해 주세요.");

    const { data, error } = await sb
      .from("profiles")
      .update({
        avatar_storage_path: storagePath,
        avatar_url: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", session.user.id)
      .select("*")
      .single();
    if (error) {
      await sb.storage.from(BUCKET).remove([storagePath]);
      throw new Error("프로필을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.");
    }
    const avatarUrl = await this.createProfileAvatarSignedUrl(storagePath);
    return rowToDisplay(data, avatarUrl);
  },

  async createProfileAvatarSignedUrl(storagePath: string, expiresInSeconds = SIGNED_URL_TTL_SECONDS): Promise<string> {
    const sb = requireSupabase();
    const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(storagePath, expiresInSeconds);
    if (error || !data?.signedUrl) throw error ?? new Error("사진을 불러오지 못했어요.");
    return data.signedUrl;
  },

  async listDisplayProfilesForBaby(babyId: string): Promise<DisplayProfile[]> {
    const sb = requireSupabase();
    const { data: members, error: membersError } = await sb
      .from("baby_members")
      .select("user_id")
      .eq("baby_id", babyId)
      .eq("status", "active");
    if (membersError) throw membersError;
    const ids = [...new Set((members ?? []).map((row) => row.user_id).filter(Boolean))];
    if (!ids.length) return [];
    const { data, error } = await sb
      .from("profiles")
      .select("id, display_name, nickname, avatar_storage_path, default_relation, avatar_url, preferred_language, created_at, updated_at")
      .in("id", ids);
    if (error) throw error;
    return Promise.all(
      (data ?? []).map(async (row) => {
        const avatarUrl = row.avatar_storage_path
          ? await this.createProfileAvatarSignedUrl(row.avatar_storage_path).catch(() => undefined)
          : undefined;
        return rowToDisplay(row, avatarUrl);
      }),
    );
  },
};
