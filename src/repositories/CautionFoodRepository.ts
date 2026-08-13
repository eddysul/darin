import { requireSupabase } from "../lib/supabase";
import type { CautionFood, CautionFoodSource } from "../types/cautionFood";
import { normalizeCautionFoodName } from "../utils/cautionFoodsStore";
import { AuthRepository } from "./AuthRepository";

type Row = {
  id: string; baby_id: string; food_name: string; normalized_food_name: string;
  source: CautionFoodSource; created_by: string; created_at: string; archived_at: string | null;
};

function toModel(row: Row): CautionFood {
  return { id: row.id, babyId: row.baby_id, foodName: row.food_name, normalizedFoodName: row.normalized_food_name, source: row.source, createdBy: row.created_by, createdAt: row.created_at, archivedAt: row.archived_at ?? undefined };
}

export const CautionFoodRepository = {
  async list(babyId: string): Promise<CautionFood[]> {
    const { data, error } = await requireSupabase().from("baby_caution_foods").select("*").eq("baby_id", babyId).is("archived_at", null).order("created_at");
    if (error) throw error;
    return ((data ?? []) as Row[]).map(toModel);
  },
  async add(babyId: string, foodName: string, source: CautionFoodSource): Promise<CautionFood> {
    const user = await AuthRepository.getUser();
    if (!user) throw new Error("로그인이 필요해요.");
    const normalized = normalizeCautionFoodName(foodName);
    const { data, error } = await requireSupabase().from("baby_caution_foods").insert({ baby_id: babyId, food_name: foodName.trim(), normalized_food_name: normalized, source, created_by: user.id }).select("*").single();
    if (error) throw error;
    return toModel(data as Row);
  },
  async archive(id: string, babyId: string): Promise<void> {
    const { error } = await requireSupabase().from("baby_caution_foods").update({ archived_at: new Date().toISOString() }).eq("id", id).eq("baby_id", babyId);
    if (error) throw error;
  },
};
