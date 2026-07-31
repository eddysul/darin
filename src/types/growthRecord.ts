export type GrowthWeightUnit = "kg" | "lb";
export type GrowthLengthUnit = "cm" | "in";
export type GrowthRecordSource = "hospital" | "home";
export type GrowthRecordInputMethod = "manual" | "ai_extract";

/**
 * Growth measurements are stored in canonical metric units (kg/cm).
 * Input-unit fields support the local cache; server-hydrated records reopen in current user units.
 */
export type GrowthRecord = {
  id: string;
  /** Stable local id retained by Supabase for idempotent migration. */
  clientGeneratedId?: string;
  babyId: string;
  measuredAt: string;
  weightKg?: number;
  weightUnit: GrowthWeightUnit;
  heightCm?: number;
  heightUnit: GrowthLengthUnit;
  headCircumferenceCm?: number;
  headCircumferenceUnit: GrowthLengthUnit;
  source: GrowthRecordSource;
  inputMethod: GrowthRecordInputMethod;
  userConfirmed: boolean;
  confidence?: number;
  originalText?: string;
  note?: string;
  /** Null only when the original author deleted an account on a shared baby. */
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type GrowthRecordDraft = Omit<
  GrowthRecord,
  "id" | "babyId" | "createdBy" | "createdAt" | "updatedAt"
>;
