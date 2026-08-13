export type CautionFoodSource = "preset" | "custom";

export type CautionFood = {
  id: string;
  babyId: string;
  foodName: string;
  normalizedFoodName: string;
  source: CautionFoodSource;
  createdBy?: string;
  createdAt: string;
  archivedAt?: string;
};

export const CAUTION_FOOD_PRESETS = ["우유", "달걀", "땅콩", "밀", "대두", "참깨", "견과류", "생선", "갑각류", "기타"] as const;
