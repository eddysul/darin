import type { DailyReport } from "../types/dailyReport";
import { normalizeDailyReport } from "../utils/reportPresentation";
import { createId } from "../utils/id";

export const DEMO_VOICE_TRANSCRIPT =
  "Emma ate lunch well, took a one-hour nap, played outside, and had a slight cough after lunch. She also needs extra clothes tomorrow.";

const GENERATED_REPORT_EN =
  "Emma had a good day today. She finished her lunch well, took a one-hour nap, and enjoyed playing outside. She had a slight cough after lunch, so please keep an eye on her this evening. Also, please pack an extra set of clothes for tomorrow.";

const GENERATED_REPORT_KO =
  "Emma는 오늘 좋은 하루를 보냈습니다. 점심을 잘 먹었고 낮잠을 약 1시간 잤습니다. 오후에는 밖에서 즐겁게 놀았습니다. 점심 이후 기침이 조금 있었으니 오늘 저녁에 상태를 한 번 확인해주시면 좋겠습니다. 또한 내일 여벌 옷을 챙겨주세요.";

const CARE_SUMMARY_EN =
  "Emma had a stable day. Meals, nap, bowel movement, and tummy time were recorded. No new health concerns were noted today.";

const CARE_SUMMARY_KO =
  "Emma는 안정적인 하루를 보냈습니다. 식사, 낮잠, 배변, 터미타임이 기록되었습니다. 오늘 새로운 건강 이슈는 없었습니다.";

const PARENT_REPLY_DRAFT =
  "Hi, thank you for the update. Could you let me know when Emma started coughing and whether it continued throughout the afternoon?";

const DEMO_DETAILS = [
  { type: "bowel" as const, value: "Morning · 1 time · Normal condition", recorded: true },
  { type: "meal" as const, value: "Lunch finished well · Light snack", recorded: true },
  { type: "sleep" as const, value: "Nap about 1 hour · Woke up in good spirits", recorded: true },
  { type: "growth" as const, value: "No major change from recent record", recorded: false },
  { type: "bath" as const, value: "Completed · Skin looked normal", recorded: false },
  { type: "clinic" as const, value: "No visit today", recorded: false },
  { type: "environment" as const, value: "Comfortable indoor environment", recorded: false },
  { type: "supplement" as const, value: "Given as instructed", recorded: false },
  { type: "tummy_time" as const, value: "Brief session · Good endurance", recorded: true },
  { type: "snack" as const, value: "Small amount · No reaction", recorded: false },
  { type: "medication" as const, value: "None / Given as instructed", recorded: false },
];

export function generateDailyReport(sourceNote: string): DailyReport {
  const note = sourceNote.trim() || DEMO_VOICE_TRANSCRIPT;
  const useDemo = note === DEMO_VOICE_TRANSCRIPT;

  const base: DailyReport = {
    id: createId(),
    date: new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
    child: "Emma",
    caregiver: "Ji-yeon Park",
    sourceNote: note,
    careSummaryEn: useDemo ? CARE_SUMMARY_EN : undefined,
    careSummaryKo: useDemo ? CARE_SUMMARY_KO : undefined,
    reportEn: useDemo ? GENERATED_REPORT_EN : note,
    reportKo: useDemo ? GENERATED_REPORT_KO : note,
    parentReplyDraft: useDemo
      ? PARENT_REPLY_DRAFT
      : "Thank you for the update. I'll review and follow up if needed.",
    mainCategories: useDemo ? ["bowel", "sleep", "meal"] : undefined,
    details: useDemo ? DEMO_DETAILS : undefined,
    items: useDemo
      ? [
          { type: "meal", label: "Meal", value: "Finished lunch well" },
          { type: "nap", label: "Nap", value: "One-hour nap · Fell asleep easily" },
          { type: "activity", label: "Activity", value: "Played outside · Happy and active" },
          { type: "health", label: "Health Note", value: "Slight cough after lunch · No fever" },
          { type: "reminder", label: "Reminder", value: "Extra clothes needed tomorrow" },
        ]
      : [{ type: "activity", label: "Care note", value: note.slice(0, 120) }],
    savedAt: new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
  };

  return normalizeDailyReport(base, { rawText: note });
}

export function getDefaultDailyReport(): DailyReport {
  return generateDailyReport(DEMO_VOICE_TRANSCRIPT);
}
