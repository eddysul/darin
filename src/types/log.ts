/** Primary care categories aligned with Darin report direction */
export type LogPrimaryCategory = "bowel" | "sleep" | "meal" | "growth" | "clinic";

/** Detailed log categories (11-row care log) */
export type LogDetailCategory =
  | "bowel"
  | "meal"
  | "sleep"
  | "growth"
  | "bath"
  | "clinic"
  | "environment"
  | "supplement"
  | "tummy_time"
  | "snack"
  | "medication";

export type LogEntry = {
  id: string;
  category: LogPrimaryCategory;
  timestamp: string;
  rawText: string;
  summary?: string;
};

export const PRIMARY_CATEGORY_META: Record<
  LogPrimaryCategory,
  { labelEn: string; labelKo: string; emoji: string }
> = {
  bowel: { labelEn: "Bowel", labelKo: "배변", emoji: "🍑" },
  sleep: { labelEn: "Sleep", labelKo: "수면", emoji: "🌙" },
  meal: { labelEn: "Meal", labelKo: "식사", emoji: "🍼" },
  growth: { labelEn: "Growth", labelKo: "성장", emoji: "📏" },
  clinic: { labelEn: "Clinic", labelKo: "진료", emoji: "🏥" },
};

export const ORDERED_PRIMARY_CATEGORIES: LogPrimaryCategory[] = [
  "bowel",
  "sleep",
  "meal",
  "growth",
  "clinic",
];
