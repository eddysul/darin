import { requireSupabase } from "../lib/supabase";
import type { FriendshipStatus, MemoryFriendStatus } from "../types/database";

export type DarinFriendDisplay = {
  friendshipId: string;
  userId: string;
  displayName: string;
  nickname?: string;
  status: FriendshipStatus;
  acceptedAt?: string;
};

export type BabyMemoryFriendDisplay = {
  membershipId: string;
  userId: string;
  displayName: string;
  nickname?: string;
  status: MemoryFriendStatus;
};

export const DarinFriendRepository = {
  async listMyFriends(): Promise<DarinFriendDisplay[]> {
    const { data, error } = await requireSupabase().rpc("list_my_darin_friends", {});
    if (error) throw error;
    return (data ?? []).map((row) => ({
      friendshipId: row.friendship_id,
      userId: row.user_id,
      displayName: row.display_name,
      nickname: row.nickname ?? undefined,
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
      nickname: row.nickname ?? undefined,
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
