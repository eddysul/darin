export type FoodIngredientSource = "baby_food" | "snack";

export type FoodIngredient = {
  id: string;
  name: string;
  source: FoodIngredientSource;
  createdAt: string;
  babyId?: string;
  createdBy?: string;
};
