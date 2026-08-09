import type { BabyMemberRow, InviteCodeRow, InviteType, PermissionRole } from "../types/database";
import type { FamilyMember, FamilyRole } from "../types/family";
import type { FamilyMemberDisplay } from "../types/profileSettings";
import type { RelationshipLabel } from "../types/growthBook";
import { requireSupabase } from "../lib/supabase";
import {
  familyRoleToPermission,
  permissionToFamilyRole,
  toDbRelationshipLabel,
} from "../utils/supabaseMappers";
import { AuthRepository } from "./AuthRepository";
import { ProfileRepository } from "./ProfileRepository";

function memberFromRow(row: BabyMemberRow, displayName?: string): FamilyMember {
  return {
    id: row.user_id,
    name: displayName ?? row.display_name_override ?? "멤버",
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
    let profiles = new Map<string, { displayName: string; realName?: string; avatarUrl?: string }>();
    try {
      const list = await ProfileRepository.listDisplayProfilesForBaby(babyId);
      profiles = new Map(list.map((item) => [item.userId, { displayName: item.displayName, realName: item.nickname, avatarUrl: item.avatarUrl }]));
    } catch {
      // Fall back to membership-only labels when profile join is unavailable.
    }
    return rows.map((row) => {
      const profile = profiles.get(row.user_id);
      const name = row.display_name_override?.trim() || profile?.displayName || "멤버";
      return {
        ...memberFromRow(row, name),
        realName: profile?.realName,
        isMe: user?.id === row.user_id,
        avatarUrl: profile?.avatarUrl,
      };
    });
  },

  async listMemberDisplays(babyId: string): Promise<FamilyMemberDisplay[]> {
    const rows = await this.listMembers(babyId);
    const user = await AuthRepository.getUser();
    const profiles = await ProfileRepository.listDisplayProfilesForBaby(babyId).catch(() => []);
    const byId = new Map(profiles.map((item) => [item.userId, item]));
    return rows.map((row) => {
      const profile = byId.get(row.user_id);
      return {
        membershipId: row.id,
        userId: row.user_id,
        displayName: row.display_name_override?.trim() || profile?.displayName || "멤버",
        realName: profile?.nickname,
        nickname: profile?.nickname,
        relation: (row.relationship_label || "가족") as RelationshipLabel,
        role: row.permission_role,
        status: row.status,
        isMe: user?.id === row.user_id,
        avatarUrl: profile?.avatarUrl,
        avatarStoragePath: profile?.avatarStoragePath,
        kind: "family" as const,
      };
    });
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
    const me = await AuthRepository.getUser();
    if (me?.id === userId) throw new Error("내 권한은 직접 바꿀 수 없어요.");
    const sb = requireSupabase();
    const { data, error } = await sb
      .from("baby_members")
      .update({ permission_role: familyRoleToPermission(role), updated_at: new Date().toISOString() })
      .eq("baby_id", babyId)
      .eq("user_id", userId)
      .select("*")
      .single();
    if (error) {
      if (error.code === "42501" || /permission|policy|admin/i.test(error.message)) {
        throw new Error("이 정보를 수정할 권한이 없어요.");
      }
      throw error;
    }
    return data;
  },

  async updateMemberRelation(input: {
    babyId: string;
    userId: string;
    relation: RelationshipLabel;
    displayNameOverride?: string | null;
  }): Promise<BabyMemberRow> {
    const sb = requireSupabase();
    const { data, error } = await sb
      .from("baby_members")
      .update({
        relationship_label: toDbRelationshipLabel(input.relation),
        display_name_override:
          input.displayNameOverride === undefined
            ? undefined
            : (input.displayNameOverride?.trim() || null),
        updated_at: new Date().toISOString(),
      })
      .eq("baby_id", input.babyId)
      .eq("user_id", input.userId)
      .select("*")
      .single();
    if (error) {
      if (error.code === "42501" || /permission|policy/i.test(error.message)) {
        throw new Error("이 정보를 수정할 권한이 없어요.");
      }
      throw error;
    }
    return data;
  },

  async removeMember(input: { babyId: string; userId: string }): Promise<void> {
    const me = await AuthRepository.getUser();
    if (me?.id === input.userId) throw new Error("내 계정은 여기서 제거할 수 없어요.");
    const sb = requireSupabase();
    const { error } = await sb
      .from("baby_members")
      .delete()
      .eq("baby_id", input.babyId)
      .eq("user_id", input.userId);
    if (error) {
      if (error.code === "42501" || /permission|policy/i.test(error.message)) {
        throw new Error("이 정보를 수정할 권한이 없어요.");
      }
      throw error;
    }
  },

  async createInviteCode(input: {
    babyId?: string | null;
    inviteType?: InviteType;
    role?: FamilyRole;
    relationshipLabel?: string;
    expiresAt?: string | null;
  }): Promise<InviteCodeRow> {
    const sb = requireSupabase();
    const { data, error } = await sb
      .rpc("create_invite_code", {
        p_baby_id: input.babyId ?? null,
        p_invite_type: input.inviteType ?? "family",
        p_role: input.inviteType === "family" ? familyRoleToPermission(input.role ?? "editor") : "viewer",
        p_relation: input.relationshipLabel ?? (input.inviteType === "family" ? "가족" : "친구"),
        p_expires_at: input.expiresAt ?? null,
        p_max_uses: 1,
      });
    if (error) throw error;
    return data;
  },

  async previewInviteCode(code: string) {
    const { data, error } = await requireSupabase().rpc("preview_invite_code", { p_code: code });
    if (error) throw error;
    return data?.[0] ?? null;
  },

  async acceptInviteCode(input: { code: string; displayName: string; nickname?: string; relation: string }) {
    const { data, error } = await requireSupabase().rpc("accept_invite_code", {
      p_code: input.code,
      p_display_name: input.displayName,
      p_nickname: input.nickname ?? null,
      p_relation: input.relation,
    });
    if (error) throw error;
    return data?.[0] ?? null;
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
