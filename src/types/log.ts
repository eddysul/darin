export type LogCategory = "diaper" | "sleep" | "meal" | "growth" | "medical";

export type LogEntry = {
  id: string;
  category: LogCategory;
  timestamp: string; // ISO 8601
  rawText: string;   // original speech/text from caregiver
  summary?: string;  // parsed one-liner
  data?: {
    color?: string;      // diaper
    durationMin?: number; // sleep
    food?: string;        // meal
    amountMl?: number;    // meal (feeding)
    heightCm?: number;    // growth
    weightKg?: number;    // growth
    clinic?: string;      // medical
    notes?: string;
  };
};

export const CATEGORY_META: Record<LogCategory, { labelEn: string; labelKo: string; color: string; bg: string; emoji: string }> = {
  diaper: { labelEn: "Diaper",      labelKo: "배변",     color: "#ec4899", bg: "#fdf2f8", emoji: "🍑" },
  sleep:  { labelEn: "Sleep",       labelKo: "수면",     color: "#6B7FA8", bg: "#F0F3FA", emoji: "🌙" },
  meal:   { labelEn: "Meal / Feed", labelKo: "식사",     color: "#f59e0b", bg: "#FFF9EB", emoji: "🍼" },
  growth: { labelEn: "Growth",      labelKo: "키/몸무게", color: "#22c55e", bg: "#f0fdf4", emoji: "📏" },
  medical:{ labelEn: "Medical",     labelKo: "병원진료", color: "#8b5cf6", bg: "#f5f3ff", emoji: "🏥" },
};

export const ORDERED_CATEGORIES: LogCategory[] = ["diaper", "sleep", "meal", "growth", "medical"];
