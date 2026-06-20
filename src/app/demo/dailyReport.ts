import type { DailyReport } from "../types/dailyReport";

export const DEMO_VOICE_TRANSCRIPT =
  "Emma ate lunch well, took a one-hour nap, played outside, and had a slight cough after lunch. She also needs extra clothes tomorrow.";

const GENERATED_REPORT_EN =
  "Emma had a good day today. She finished her lunch well, took a one-hour nap, and enjoyed playing outside. She had a slight cough after lunch, so please keep an eye on her this evening. Also, please pack an extra set of clothes for tomorrow.";

const GENERATED_REPORT_KO =
  "Emma는 오늘 좋은 하루를 보냈습니다. 점심을 잘 먹었고 낮잠을 약 1시간 잤습니다. 오후에는 밖에서 즐겁게 놀았습니다. 점심 이후 기침이 조금 있었으니 오늘 저녁에 상태를 한 번 확인해주시면 좋겠습니다. 또한 내일 여벌 옷을 챙겨주세요.";

const PARENT_REPLY_DRAFT =
  "Hi, thank you for the update. Could you let me know when Emma started coughing and whether it continued throughout the afternoon?";

export function generateDailyReport(sourceNote: string): DailyReport {
  const note = sourceNote.trim() || DEMO_VOICE_TRANSCRIPT;

  return {
    id: crypto.randomUUID(),
    date: "June 20, 2025",
    child: "Emma",
    caregiver: "Ji-yeon Park",
    sourceNote: note,
    reportEn: GENERATED_REPORT_EN,
    reportKo: GENERATED_REPORT_KO,
    parentReplyDraft: PARENT_REPLY_DRAFT,
    items: [
      { type: "meal", label: "Meal", value: "Finished lunch well" },
      { type: "nap", label: "Nap", value: "One-hour nap · Fell asleep easily" },
      { type: "activity", label: "Activity", value: "Played outside · Happy and active" },
      { type: "health", label: "Health Note", value: "Slight cough after lunch · No fever" },
      { type: "reminder", label: "Reminder", value: "Extra clothes needed tomorrow" },
    ],
    savedAt: new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
  };
}

export function getDefaultDailyReport(): DailyReport {
  return generateDailyReport(DEMO_VOICE_TRANSCRIPT);
}
