import type { BabyMemberRow, InviteCodeRow, PermissionRole } from "../types/database";
import type { FamilyMember, FamilyRole } from "../types/family";
import { requireSupabase } from "../lib/supabase";
import {
  familyRoleToPermission,
  permissionToFamilyRole,
  toDbRelationshipLabel,
} from "../utils/supabaseMappers";
import { AuthRepository } from "./AuthRepository";

function memberFromRow(row: BabyMemberRow, displayName?: string): FamilyMember {
  return {
    id: row.user_id,
    name: displayName ?? "멤버",
    role: permissionToFamilyRole(row.permission_role),
    relationshipLabel: row.relationship_label,
    status: row.status,
  };
}

export const FamilyRepository = {
  async listMembers(babyId: string): Promise<BabyMemberRow[]> {
    const sb = requireSupabase();
    const { data, error } = await sb
      .from("baby_members")
      .select("*")
      .eq("baby_id", babyId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return data ?? [];
  },

  async listMembersAsFamily(babyId: string): Promise<FamilyMember[]> {
    const rows = await this.listMembers(babyId);
    const user = await AuthRepository.getUser();
    return rows.map((row) => ({
      ...memberFromRow(row),
      isMe: user?.id === row.user_id,
    }));
  },

  async addMember(input: {
    babyId: string;
    userId: string;
    role: FamilyRole;
    relationshipLabel?: string;
    status?: BabyMemberRow["status"];
  }): Promise<BabyMemberRow> {
    const sb = requireSupabase();
    const { data, error } = await sb
      .from("baby_members")
      .insert({
        baby_id: input.babyId,
        user_id: input.userId,
        permission_role: familyRoleToPermission(input.role),
        relationship_label: toDbRelationshipLabel(input.relationshipLabel),
        status: input.status ?? "active",
      })
      .select("*")
      .single();
    if (error) throw error;
    return data;
  },

  async updateMemberRole(
    babyId: string,
    userId: string,
    role: FamilyRole,
  ): Promise<BabyMemberRow> {
    const sb = requireSupabase();
    const { data, error } = await sb
      .from("baby_members")
      .update({ permission_role: familyRoleToPermission(role) })
      .eq("baby_id", babyId)
      .eq("user_id", userId)
      .select("*")
      .single();
    if (error) throw error;
    return data;
  },

  async createInviteCode(input: {
    babyId: string;
    code: string;
    role?: FamilyRole;
    relationshipLabel?: string;
    expiresAt?: string | null;
  }): Promise<InviteCodeRow> {
    const sb = requireSupabase();
    const user = await AuthRepository.getUser();
    const { data, error } = await sb
      .from("invite_codes")
      .insert({
        baby_id: input.babyId,
        code: input.code,
        created_by: user?.id ?? null,
        permission_role: familyRoleToPermission(input.role ?? "editor"),
        relationship_label: toDbRelationshipLabel(input.relationshipLabel),
        expires_at: input.expiresAt ?? null,
      })
      .select("*")
      .single();
    if (error) throw error;
    return data;
  },

  async getMyPermission(babyId: string): Promise<PermissionRole | null> {
    const sb = requireSupabase();
    const user = await AuthRepository.getUser();
    if (!user) return null;
    const { data, error } = await sb
      .from("baby_members")
      .select("permission_role")
      .eq("baby_id", babyId)
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle();
    if (error) throw error;
    return data?.permission_role ?? null;
  },
};
