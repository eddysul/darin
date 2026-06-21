import type { DailyReport } from "../types/dailyReport";
import { normalizeDailyReport } from "../utils/reportPresentation";

export type ReportTimelineEntry = {
  dateLabel: string;
  report: DailyReport | null;
};

const JUNE_19_REPORT = normalizeDailyReport({
  id: "report-june-19",
  date: "June 19, 2025",
  child: "Emma",
  caregiver: "Ji-yeon Park",
  sourceNote: "Emma had a shorter nap today but ate both meals well. One soft bowel movement in the afternoon.",
  careSummaryEn:
    "Emma had a calm day. Meals and bowel movement were recorded. Nap was slightly shorter than usual.",
  careSummaryKo:
    "Emma는 차분한 하루를 보냈습니다. 식사와 배변 기록이 있습니다. 낮잠은 평소보다 조금 짧았습니다.",
  reportEn:
    "Emma ate breakfast and lunch well today. She napped for about 45 minutes and woke up a little fussy, but settled after playtime. One soft bowel movement was recorded in the afternoon.",
  reportKo:
    "Emma는 오늘 아침과 점심을 잘 먹었습니다. 낮잠은 약 45분 정도 잤고, 일어난 뒤 잠시 보챘지만 놀이 후 안정되었습니다. 오후에 부드러운 배변 1회가 기록되었습니다.",
  parentReplyDraft:
    "Thank you for the update. Was Emma fussy for long after the nap, or did she settle quickly?",
  mainCategories: ["bowel", "sleep", "meal"],
  details: [
    { type: "bowel", value: "Afternoon · 1 time · Soft", recorded: true },
    { type: "meal", value: "Breakfast and lunch finished well", recorded: true },
    { type: "sleep", value: "Nap about 45 min · Brief fussiness after waking", recorded: true },
    { type: "growth", value: "No major change from recent record", recorded: false },
    { type: "bath", value: "Not recorded today", recorded: false },
    { type: "clinic", value: "No visit today", recorded: false },
    { type: "environment", value: "Comfortable indoor environment", recorded: false },
    { type: "supplement", value: "Given as instructed", recorded: false },
    { type: "tummy_time", value: "Short play session after nap", recorded: true },
    { type: "snack", value: "Light snack · No reaction", recorded: false },
    { type: "medication", value: "None", recorded: false },
  ],
  items: [
    { type: "meal", label: "Meal", value: "Breakfast and lunch finished well" },
    { type: "nap", label: "Nap", value: "45-minute nap" },
    { type: "health", label: "Health Note", value: "Brief fussiness after nap" },
  ],
  savedAt: "5:38 PM",
});

const JUNE_18_REPORT = normalizeDailyReport({
  id: "report-june-18",
  date: "June 18, 2025",
  child: "Emma",
  caregiver: "Ji-yeon Park",
  sourceNote: "Emma visited the clinic for a routine check. Good appetite and long nap afterward.",
  careSummaryEn:
    "Emma had a routine clinic visit and a stable rest of the day. Meals, nap, and clinic visit were recorded.",
  careSummaryKo:
    "Emma는 정기 진료를 다녀온 뒤 안정적인 하루를 보냈습니다. 식사, 수면, 진료 기록이 있습니다.",
  reportEn:
    "Emma had a routine wellness visit this morning and remained in good spirits afterward. She ate lunch well and took a longer nap in the afternoon.",
  reportKo:
    "Emma는 오늘 오전 정기 건강검진을 다녀왔고 이후에도 기분이 좋았습니다. 점심을 잘 먹었고 오후에 낮잠을 길게 잤습니다.",
  parentReplyDraft: "Thanks for taking Emma to the clinic. Were there any follow-up instructions?",
  mainCategories: ["meal", "sleep", "clinic"],
  details: [
    { type: "bowel", value: "Normal condition · No concerns noted", recorded: true },
    { type: "meal", value: "Lunch finished well", recorded: true },
    { type: "sleep", value: "Long nap · Woke up calm", recorded: true },
    { type: "growth", value: "Routine check · No concerns noted", recorded: true },
    { type: "bath", value: "Completed · Skin looked normal", recorded: false },
    { type: "clinic", value: "Routine wellness visit · Good spirits afterward", recorded: true },
    { type: "environment", value: "Comfortable indoor environment", recorded: false },
    { type: "supplement", value: "Given as instructed", recorded: false },
    { type: "tummy_time", value: "Calm play after clinic visit", recorded: true },
    { type: "snack", value: "Small amount · No reaction", recorded: false },
    { type: "medication", value: "None", recorded: false },
  ],
  items: [
    { type: "meal", label: "Meal", value: "Lunch finished well" },
    { type: "nap", label: "Nap", value: "Long afternoon nap" },
    { type: "health", label: "Clinic", value: "Routine wellness visit" },
  ],
  savedAt: "5:15 PM",
});

export function buildReportTimeline(todayReport: DailyReport | null): ReportTimelineEntry[] {
  return [
    { dateLabel: "June 20", report: todayReport },
    { dateLabel: "June 19", report: JUNE_19_REPORT },
    { dateLabel: "June 18", report: JUNE_18_REPORT },
  ];
}

export function getSelectableReports(entries: ReportTimelineEntry[]): DailyReport[] {
  return entries.flatMap((entry) => (entry.report ? [entry.report] : []));
}
