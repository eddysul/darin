import type { ProfileRow } from "../types/database";
import { requireSupabase } from "../lib/supabase";
import { AuthRepository } from "./AuthRepository";

export const ProfileRepository = {
  async getMyProfile(): Promise<ProfileRow | null> {
    const sb = requireSupabase();
    const user = await AuthRepository.getUser();
    if (!user) return null;
    const { data, error } = await sb.from("profiles").select("*").eq("id", user.id).maybeSingle();
    if (error) throw error;
    return data;
  },

  async upsertMyProfile(input: {
    displayName: string;
    preferredLanguage?: string;
    avatarUrl?: string | null;
  }): Promise<ProfileRow> {
    const sb = requireSupabase();
    const session = await AuthRepository.ensureSession();
    const row = {
      id: session.user.id,
      display_name: input.displayName.trim(),
      preferred_language: input.preferredLanguage ?? "ko",
      avatar_url: input.avatarUrl ?? null,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await sb.from("profiles").upsert(row).select("*").single();
    if (error) throw error;
    return data;
  },
};
