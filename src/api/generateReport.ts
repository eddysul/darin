import { TRANSCRIBE_API_URL } from "../config/api";
import type { DailyReport, DailyReportItem } from "../types/dailyReport";
import type { CareEvent } from "../types/transcribe";
import { normalizeDailyReport } from "../utils/reportPresentation";
import { fetchWithTimeout } from "../utils/fetchWithTimeout";
import { createId } from "../utils/id";

export type GenerateReportPayload = {
  rawText: string;
  events?: CareEvent[];
  quickNotes?: string;
  childName?: string;
  caregiverName?: string;
  sourceNote: string;
};

type GenerateReportResponse = {
  reportEn: string;
  reportKo: string;
  parentReplyDraft: string;
  careSummaryEn?: string;
  careSummaryKo?: string;
  mainCategories?: DailyReport["mainCategories"];
  details?: DailyReport["details"];
  items: DailyReportItem[];
};

export async function generateDailyReportFromApi(payload: GenerateReportPayload): Promise<DailyReport> {
  const response = await fetchWithTimeout(`${TRANSCRIBE_API_URL}/generate-report`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      raw_text: payload.rawText,
      events: payload.events ?? [],
      quick_notes: payload.quickNotes ?? "",
      child_name: payload.childName ?? "Emma",
      caregiver_name: payload.caregiverName ?? "Ji-yeon Park",
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `Generate report failed (${response.status})`);
  }

  const data = (await response.json()) as GenerateReportResponse;

  return normalizeDailyReport(
    {
      id: createId(),
      date: new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
      child: payload.childName ?? "Emma",
      caregiver: payload.caregiverName ?? "Ji-yeon Park",
      sourceNote: payload.sourceNote,
      careSummaryEn: data.careSummaryEn,
      careSummaryKo: data.careSummaryKo,
      reportEn: data.reportEn,
      reportKo: data.reportKo,
      parentReplyDraft: data.parentReplyDraft,
      mainCategories: data.mainCategories,
      details: data.details,
      items: data.items ?? [],
      savedAt: new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
    },
    { events: payload.events, rawText: payload.rawText },
  );
}
