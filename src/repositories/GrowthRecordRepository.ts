import { requireSupabase } from "../lib/supabase";
import type { Json, GrowthRecordRow } from "../types/database";
import type { GrowthRecord, GrowthRecordDraft } from "../types/growthRecord";
import { AuthRepository } from "./AuthRepository";

function jsonNumber(value: Json | null): number | undefined {
  return typeof value === "number" ? value : undefined;
}

function jsonText(value: Json | null): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export function growthRecordRowToModel(row: GrowthRecordRow): GrowthRecord {
  return {
    id: row.id,
    clientGeneratedId: row.client_generated_id ?? undefined,
    babyId: row.baby_id,
    measuredAt: row.measured_at,
    weightKg: row.weight_kg ?? undefined,
    weightUnit: "kg",
    heightCm: row.height_cm ?? undefined,
    heightUnit: "cm",
    headCircumferenceCm: row.head_circumference_cm ?? undefined,
    headCircumferenceUnit: "cm",
    source: row.source,
    inputMethod: row.input_method,
    userConfirmed: row.user_confirmed,
    confidence: jsonNumber(row.confidence),
    originalText: jsonText(row.original_text),
    note: row.note ?? undefined,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function draftColumns(draft: GrowthRecordDraft) {
  return {
    measured_at: draft.measuredAt,
    weight_kg: draft.weightKg ?? null,
    height_cm: draft.heightCm ?? null,
    head_circumference_cm: draft.headCircumferenceCm ?? null,
    source: draft.source,
    input_method: draft.inputMethod,
    user_confirmed: draft.userConfirmed,
    confidence: draft.confidence ?? null,
    original_text: draft.originalText ?? null,
    note: draft.note ?? null,
  };
}

export const GrowthRecordRepository = {
  async listByBabyId(babyId: string): Promise<GrowthRecord[]> {
    const sb = requireSupabase();
    const { data, error } = await sb
      .from("growth_records")
      .select("*")
      .eq("baby_id", babyId)
      .order("measured_at", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data ?? []).map(growthRecordRowToModel);
  },

  async create(babyId: string, record: GrowthRecord): Promise<GrowthRecord> {
    const sb = requireSupabase();
    const user = await AuthRepository.getUser();
    if (!user) throw new Error("Growth record create requires an authenticated user.");
    const { data, error } = await sb
      .from("growth_records")
      .upsert(
        {
          id: record.id,
          baby_id: babyId,
          client_generated_id: record.clientGeneratedId ?? record.id,
          ...draftColumns(record),
          created_by: user.id,
        },
        { onConflict: "baby_id,client_generated_id" },
      )
      .select("*")
      .single();
    if (error) throw error;
    return growthRecordRowToModel(data);
  },

  async update(babyId: string, id: string, draft: GrowthRecordDraft): Promise<GrowthRecord> {
    const sb = requireSupabase();
    const { data, error } = await sb
      .from("growth_records")
      .update(draftColumns(draft))
      .eq("baby_id", babyId)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    return growthRecordRowToModel(data);
  },

  async delete(babyId: string, id: string): Promise<void> {
    const sb = requireSupabase();
    const { error } = await sb.from("growth_records").delete().eq("baby_id", babyId).eq("id", id);
    if (error) throw error;
  },

  async hydrate(babyId: string): Promise<GrowthRecord[]> {
    return this.listByBabyId(babyId);
  },

  async uploadLocalGrowthRecordsMigration(
    babyId: string,
    records: GrowthRecord[],
  ): Promise<{ uploaded: number; failed: number }> {
    let uploaded = 0;
    let failed = 0;
    for (const record of records) {
      try {
        await this.create(babyId, record);
        uploaded += 1;
      } catch {
        failed += 1;
      }
    }
    return { uploaded, failed };
  },
};
