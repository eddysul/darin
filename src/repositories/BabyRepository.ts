import type { CareSetup } from "../types/careSetup";
import type { BabyRow } from "../types/database";
import { requireSupabase } from "../lib/supabase";
import { toDbRelationshipLabel } from "../utils/supabaseMappers";
import { AuthRepository } from "./AuthRepository";
import { ProfileRepository } from "./ProfileRepository";

export type CreateBabyInput = {
  name: string;
  birthDate?: string;
  dueDate?: string;
  childStatus?: string;
  gender?: string;
  photoUrl?: string;
  gestationalAgeWeeks?: number;
  birthWeight?: string;
  specialNotes?: string;
  relationshipLabel?: string;
};

export const BabyRepository = {
  async listMyBabies(): Promise<BabyRow[]> {
    const sb = requireSupabase();
    await AuthRepository.ensureSession();
    const { data, error } = await sb.from("babies").select("*").order("created_at", { ascending: true });
    if (error) throw error;
    return data ?? [];
  },

  async getBaby(babyId: string): Promise<BabyRow | null> {
    const sb = requireSupabase();
    const { data, error } = await sb.from("babies").select("*").eq("id", babyId).maybeSingle();
    if (error) throw error;
    return data;
  },

  async createBaby(input: CreateBabyInput): Promise<BabyRow> {
    const sb = requireSupabase();
    await AuthRepository.ensureSession();
    const { data, error } = await sb.rpc("create_baby_with_owner", {
      p_name: input.name.trim() || "아기",
      p_birth_date: input.birthDate ?? null,
      p_due_date: input.dueDate ?? null,
      p_child_status: input.childStatus ?? "newborn",
      p_gender: input.gender ?? null,
      p_photo_url: input.photoUrl ?? null,
      p_gestational_age_weeks: input.gestationalAgeWeeks ?? null,
      p_birth_weight: input.birthWeight ?? null,
      p_special_notes: input.specialNotes ?? null,
      p_relationship_label: toDbRelationshipLabel(input.relationshipLabel),
    });
    if (error) throw error;
    return data as BabyRow;
  },

  async updateBaby(
    babyId: string,
    patch: Partial<{
      name: string;
      nickname: string | null;
      birthDate: string | null;
      dueDate: string | null;
      childStatus: string;
      gender: string | null;
      photoUrl: string | null;
      avatarStoragePath: string | null;
      gestationalAgeWeeks: number | null;
      birthWeight: string | null;
      specialNotes: string | null;
    }>,
  ): Promise<BabyRow> {
    const sb = requireSupabase();
    const { data, error } = await sb
      .from("babies")
      .update({
        name: patch.name,
        nickname: patch.nickname,
        birth_date: patch.birthDate,
        due_date: patch.dueDate,
        child_status: patch.childStatus,
        gender: patch.gender,
        photo_url: patch.photoUrl,
        avatar_storage_path: patch.avatarStoragePath,
        gestational_age_weeks: patch.gestationalAgeWeeks,
        birth_weight: patch.birthWeight,
        special_notes: patch.specialNotes,
      })
      .eq("id", babyId)
      .select("*")
      .single();
    if (error) throw error;
    return data;
  },

  /** Ensure profile + at least one baby exist from local CareSetup. */
  async ensureFromCareSetup(setup: CareSetup, existingBabyId?: string | null): Promise<BabyRow> {
    await AuthRepository.ensureSession();
    await ProfileRepository.upsertMyProfile({
      displayName: setup.parent.parentName.trim() || "나",
      preferredLanguage: setup.parent.preferredLanguage,
    });

    if (existingBabyId) {
      const existing = await this.getBaby(existingBabyId);
      if (existing) {
        return this.updateBaby(existingBabyId, {
          name: setup.child.childName.trim() || existing.name,
          birthDate: setup.child.birthDate ?? null,
          dueDate: setup.child.dueDate ?? null,
          childStatus: setup.child.childStatus,
          gender: setup.child.gender ?? null,
          photoUrl: setup.child.photoUri ?? null,
          gestationalAgeWeeks: setup.child.gestationalAgeWeeks ?? null,
          birthWeight: setup.child.birthWeight ?? null,
          specialNotes: setup.child.specialNotes ?? null,
        });
      }
    }

    const mine = await this.listMyBabies();
    if (mine[0]) {
      // With no account-scoped baby hint, the server row is authoritative.
      // Updating it from a device cache here could overwrite another account
      // immediately after logout/login on a shared device.
      return mine[0];
    }

    return this.createBaby({
      name: setup.child.childName.trim() || "아기",
      birthDate: setup.child.birthDate,
      dueDate: setup.child.dueDate,
      childStatus: setup.child.childStatus,
      gender: setup.child.gender,
      photoUrl: setup.child.photoUri,
      gestationalAgeWeeks: setup.child.gestationalAgeWeeks,
      birthWeight: setup.child.birthWeight,
      specialNotes: setup.child.specialNotes,
      relationshipLabel: setup.parent.relationshipToChild,
    });
  },
};
