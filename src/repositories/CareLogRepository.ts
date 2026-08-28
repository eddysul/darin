import type { BabyLogEntry, BabyLogFlag, BabyLogSource } from "../types/babyLog";
import type { CareLogPayload, CareLogRow } from "../types/database";
import type { LogCategoryKey } from "../types/logCategory";
import { requireSupabase } from "../lib/supabase";
import { recordedAtFromDateKeyTime } from "../utils/supabaseMappers";
import { AuthRepository } from "./AuthRepository";
import { NotificationRepository } from "./NotificationRepository";

export const CARE_LOG_HYDRATION_PAGE_SIZE = 500;

function payloadFromEntry(entry: BabyLogEntry | Omit<BabyLogEntry, "id">): CareLogPayload {
  return {
    chip: entry.chip,
    chip2: entry.chip2,
    stoolState: entry.stoolState,
    amount: entry.amount,
    amountValue: entry.amountValue,
    amountUnit: entry.amountUnit,
    amountText: entry.amountText,
    duration: entry.duration,
    startedAt: entry.startedAt,
    endedAt: entry.endedAt,
    durationSeconds: entry.durationSeconds,
    intervalSeconds: entry.intervalSeconds,
    feedingMethod: entry.feedingMethod,
    leftDuration: entry.leftDuration,
    rightDuration: entry.rightDuration,
    leftAmount: entry.leftAmount,
    rightAmount: entry.rightAmount,
    leftAmountValue: entry.leftAmountValue,
    leftAmountUnit: entry.leftAmountUnit,
    leftAmountText: entry.leftAmountText,
    rightAmountValue: entry.rightAmountValue,
    rightAmountUnit: entry.rightAmountUnit,
    rightAmountText: entry.rightAmountText,
    burped: entry.burped,
    spitUp: entry.spitUp,
    supplement: entry.supplement,
    feedingNote: entry.feedingNote,
    ingredients: entry.ingredients,
    notes: entry.notes,
    title: entry.title,
    details: entry.details,
    nextAt: entry.nextAt,
    medicationType: entry.medicationType,
    medicationName: entry.medicationName,
    medicationStatus: entry.medicationStatus,
    doseValue: entry.doseValue,
    doseUnit: entry.doseUnit,
    doseText: entry.doseText,
    medicationReminderEnabled: entry.medicationReminderEnabled,
    visitType: entry.visitType,
    doctorName: entry.doctorName,
    cautions: entry.cautions,
    cautionReminderEnabled: entry.cautionReminderEnabled,
    vaccineName: entry.vaccineName,
    vaccinationRound: entry.vaccinationRound,
    vaccinationRoundText: entry.vaccinationRoundText,
    vaccinationHospitalName: entry.vaccinationHospitalName,
    vaccinationDoctorName: entry.vaccinationDoctorName,
    injectionSite: entry.injectionSite,
    injectionSiteText: entry.injectionSiteText,
    aftercareNotes: entry.aftercareNotes,
    vaccinationReminderSetting: entry.vaccinationReminderSetting,
    vaccinationCustomReminderAt: entry.vaccinationCustomReminderAt,
    voice: entry.voice,
    rawTranscript: entry.rawTranscript,
    confidence: entry.confidence,
    flags: entry.flags,
    createdBy: entry.createdBy,
  };
}

export function careLogRowToEntry(row: CareLogRow): BabyLogEntry {
  const p = (row.payload ?? {}) as CareLogPayload;
  return {
    id: row.id,
    cat: row.category as LogCategoryKey,
    time: row.time_local,
    dateKey: row.date_key,
    chip: p.chip,
    chip2: p.chip2,
    stoolState: p.stoolState,
    amount: p.amount,
    amountValue: p.amountValue,
    amountUnit: p.amountUnit,
    amountText: p.amountText,
    duration: p.duration,
    startedAt: p.startedAt,
    endedAt: p.endedAt,
    durationSeconds: p.durationSeconds,
    intervalSeconds: p.intervalSeconds,
    feedingMethod: p.feedingMethod,
    leftDuration: p.leftDuration,
    rightDuration: p.rightDuration,
    leftAmount: p.leftAmount,
    rightAmount: p.rightAmount,
    leftAmountValue: p.leftAmountValue,
    leftAmountUnit: p.leftAmountUnit,
    leftAmountText: p.leftAmountText,
    rightAmountValue: p.rightAmountValue,
    rightAmountUnit: p.rightAmountUnit,
    rightAmountText: p.rightAmountText,
    burped: p.burped,
    spitUp: p.spitUp,
    supplement: p.supplement,
    feedingNote: p.feedingNote,
    ingredients: Array.isArray(p.ingredients) ? p.ingredients.filter((item): item is string => typeof item === "string") : undefined,
    notes: p.notes,
    title: p.title,
    details: p.details,
    nextAt: p.nextAt,
    medicationType: p.medicationType,
    medicationName: p.medicationName,
    medicationStatus: p.medicationStatus,
    doseValue: p.doseValue,
    doseUnit: p.doseUnit,
    doseText: p.doseText,
    medicationReminderEnabled: p.medicationReminderEnabled,
    visitType: p.visitType,
    doctorName: p.doctorName,
    cautions: p.cautions,
    cautionReminderEnabled: p.cautionReminderEnabled,
    vaccineName: p.vaccineName,
    vaccinationRound: p.vaccinationRound,
    vaccinationRoundText: p.vaccinationRoundText,
    vaccinationHospitalName: p.vaccinationHospitalName,
    vaccinationDoctorName: p.vaccinationDoctorName,
    injectionSite: p.injectionSite,
    injectionSiteText: p.injectionSiteText,
    aftercareNotes: Array.isArray(p.aftercareNotes) ? p.aftercareNotes.filter((item): item is string => typeof item === "string") : undefined,
    vaccinationReminderSetting: p.vaccinationReminderSetting,
    vaccinationCustomReminderAt: p.vaccinationCustomReminderAt,
    voice: p.voice,
    source: (row.source as BabyLogSource) || "manual",
    rawTranscript: p.rawTranscript,
    confidence: p.confidence,
    flags: p.flags as BabyLogFlag[] | undefined,
    createdBy: row.created_by
      ? {
          // The relational column is protected by RLS and is authoritative.
          // Payload actor metadata is only a display snapshot.
          userId: row.created_by,
          name: p.createdBy?.name ?? "멤버",
          role: (p.createdBy?.role as import("../types/family").FamilyRole | undefined) ?? "editor",
        }
      : undefined,
  };
}

function entryToInsert(babyId: string, entry: BabyLogEntry, userId: string | null) {
  const dateKey = entry.dateKey ?? new Date().toISOString().slice(0, 10);
  const base = {
    baby_id: babyId,
    client_generated_id: entry.id,
    category: entry.cat,
    recorded_at: recordedAtFromDateKeyTime(dateKey, entry.time),
    date_key: dateKey,
    time_local: entry.time,
    payload: payloadFromEntry(entry),
    source: entry.source ?? (entry.voice ? "voice" : "manual"),
    created_by: userId,
  };
  if (isUuid(entry.id)) {
    return { ...base, id: entry.id };
  }
  return base;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export const CareLogRepository = {
  async createCareLog(
    babyId: string,
    entry: BabyLogEntry,
    options: { notifyFamily?: boolean } = {},
  ): Promise<BabyLogEntry> {
    const sb = requireSupabase();
    const user = await AuthRepository.getUser();
    const insert = entryToInsert(babyId, entry, user?.id ?? null);
    const { data, error } = await sb
      .from("care_logs")
      .upsert(insert, { onConflict: "baby_id,client_generated_id" })
      .select("*")
      .single();
    if (error) throw error;
    const created = careLogRowToEntry(data);
    if (options.notifyFamily) {
      void NotificationRepository.sendPushToBabyMembers({
        eventType: "new_shared_log",
        babyId,
        targetId: created.id,
        routeData: { route: "record", babyId, logId: created.id },
      }).catch(() => undefined);
    }
    return created;
  },

  async updateCareLog(
    babyId: string,
    id: string,
    entry: Omit<BabyLogEntry, "id">,
  ): Promise<BabyLogEntry> {
    const sb = requireSupabase();
    const dateKey = entry.dateKey ?? new Date().toISOString().slice(0, 10);
    const { data, error } = await sb
      .from("care_logs")
      .update({
        category: entry.cat,
        recorded_at: recordedAtFromDateKeyTime(dateKey, entry.time),
        date_key: dateKey,
        time_local: entry.time,
        payload: payloadFromEntry(entry),
        source: entry.source ?? (entry.voice ? "voice" : "manual"),
      })
      .eq("baby_id", babyId)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    return careLogRowToEntry(data);
  },

  async deleteCareLog(babyId: string, id: string): Promise<void> {
    const sb = requireSupabase();
    const { error } = await sb.from("care_logs").delete().eq("baby_id", babyId).eq("id", id);
    if (error) throw error;
  },

  async getCareLogsByBabyAndDateRange(
    babyId: string,
    fromDateKey: string,
    toDateKey: string,
  ): Promise<BabyLogEntry[]> {
    const sb = requireSupabase();
    const { data, error } = await sb
      .from("care_logs")
      .select("*")
      .eq("baby_id", babyId)
      .gte("date_key", fromDateKey)
      .lte("date_key", toDateKey)
      .order("recorded_at", { ascending: true });
    if (error) throw error;
    return (data ?? []).map(careLogRowToEntry);
  },

  async listCareLogsPage(
    babyId: string,
    offset: number,
    limit = CARE_LOG_HYDRATION_PAGE_SIZE,
  ): Promise<BabyLogEntry[]> {
    const sb = requireSupabase();
    const safeOffset = Math.max(0, offset);
    const safeLimit = Math.max(1, limit);
    const { data, error } = await sb
      .from("care_logs")
      .select("*")
      .eq("baby_id", babyId)
      .order("recorded_at", { ascending: true })
      .order("id", { ascending: true })
      .range(safeOffset, safeOffset + safeLimit - 1);
    if (error) throw error;
    return (data ?? []).map(careLogRowToEntry);
  },

  /**
   * Full server-authoritative hydrate in bounded requests. This avoids silently
   * truncating accounts that exceed the Supabase API row limit while keeping
   * the existing all-history context contract intact.
   */
  async hydrateCareLogs(babyId: string): Promise<BabyLogEntry[]> {
    const logs: BabyLogEntry[] = [];
    while (true) {
      const page = await this.listCareLogsPage(babyId, logs.length);
      logs.push(...page);
      if (page.length < CARE_LOG_HYDRATION_PAGE_SIZE) return logs;
    }
  },
};
