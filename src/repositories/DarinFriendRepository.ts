import { requireSupabase } from "../lib/supabase";
import type { FriendshipStatus, InviteCodeRow, MemoryFriendStatus } from "../types/database";

export type DarinFriendDisplay = {
  friendshipId: string;
  userId: string;
  displayName: string;
  realName?: string;
  status: FriendshipStatus;
  acceptedAt?: string;
};

export type BabyMemoryFriendDisplay = {
  membershipId: string;
  userId: string;
  displayName: string;
  realName?: string;
  status: MemoryFriendStatus;
};

/** User-facing friend with access to this baby's friend-public Memories. */
export type FriendDisplay = BabyMemoryFriendDisplay;

export const FriendRepository = {
  async listFriendsByBabyId(babyId: string): Promise<FriendDisplay[]> {
    const { data, error } = await requireSupabase().rpc("list_baby_memory_friends", {
      p_baby_id: babyId,
    });
    if (error) throw error;
    const unique = new Map<string, FriendDisplay>();
    for (const row of data ?? []) {
      unique.set(row.user_id, {
        membershipId: row.membership_id,
        userId: row.user_id,
        displayName: row.display_name,
        realName: row.nickname ?? undefined,
        status: row.status,
      });
    }
    return [...unique.values()];
  },

  async createFriendInvite(babyId: string): Promise<InviteCodeRow> {
    const { data, error } = await requireSupabase().rpc("create_invite_code", {
      p_baby_id: babyId,
      p_invite_type: "baby_friend",
      p_role: "viewer",
      p_relation: "친구",
      p_expires_at: null,
      p_max_uses: 1,
    });
    if (error) throw error;
    return data;
  },
};

export const DarinFriendRepository = {
  async listMyFriends(): Promise<DarinFriendDisplay[]> {
    const { data, error } = await requireSupabase().rpc("list_my_darin_friends", {});
    if (error) throw error;
    return (data ?? []).map((row) => ({
      friendshipId: row.friendship_id,
      userId: row.user_id,
      displayName: row.display_name,
      realName: row.nickname ?? undefined,
      status: row.status,
      acceptedAt: row.accepted_at ?? undefined,
    }));
  },

  async listBabyMemoryFriends(babyId: string): Promise<BabyMemoryFriendDisplay[]> {
    const { data, error } = await requireSupabase().rpc("list_baby_memory_friends", {
      p_baby_id: babyId,
    });
    if (error) throw error;
    return (data ?? []).map((row) => ({
      membershipId: row.membership_id,
      userId: row.user_id,
      displayName: row.display_name,
      realName: row.nickname ?? undefined,
      status: row.status,
    }));
  },

  async inviteFriendToBaby(babyId: string, friendUserId: string): Promise<void> {
    const { error } = await requireSupabase().rpc("add_darin_friend_to_baby", {
      p_baby_id: babyId,
      p_friend_user_id: friendUserId,
    });
    if (error) throw error;
  },
};
