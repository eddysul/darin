import type { LogCategory } from "../types/log";

// Local keyword categorizer — mirrors what the bizcrush API will return.
// To wire in the real API: replace this function's body with an async API call.
export function categorizeLog(text: string): LogCategory {
  const t = text.toLowerCase();
  if (/배변|기저귀|대변|소변|색|변|응가|노란|초록|poop|diaper/i.test(t)) return "diaper";
  if (/수면|잠|자|sleep|낮잠|눈감|일어|일어나|깼|깨어/i.test(t)) return "sleep";
  if (/식사|밥|수유|분유|모유|먹|eat|meal|feed|ml|cc|oz|보리|쌀죽/i.test(t)) return "meal";
  if (/키|몸무게|체중|신장|cm|kg|growth|몸|성장/i.test(t)) return "growth";
  if (/병원|진료|의사|약|치료|medical|hospital|클리닉|열|발열|체온/i.test(t)) return "medical";
  return "meal"; // default
}

export function extractSummary(text: string, category: LogCategory): string {
  const t = text.trim();
  // Return a short first sentence or first 60 chars
  const firstSentence = t.split(/[.。！!?？]/)[0].trim();
  return firstSentence.length > 70 ? firstSentence.slice(0, 68) + "…" : firstSentence;
}

export function buildDailyReportText(
  entries: { category: LogCategory; rawText: string; timestamp: string }[],
  locale: "en" | "ko",
): string {
  if (entries.length === 0) return "";

  const sorted = [...entries].sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  if (locale === "ko") {
    const lines = sorted.map((e) => {
      const time = new Date(e.timestamp).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
      const labelMap: Record<LogCategory, string> = {
        diaper: "배변", sleep: "수면", meal: "식사", growth: "키/몸무게", medical: "병원진료",
      };
      return `[${time}] ${labelMap[e.category]}: ${e.rawText}`;
    });
    return `오늘의 돌봄 기록\n\n${lines.join("\n")}\n\n총 ${entries.length}건의 기록이 작성되었습니다.`;
  }

  const lines = sorted.map((e) => {
    const time = new Date(e.timestamp).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    const labelMap: Record<LogCategory, string> = {
      diaper: "Diaper", sleep: "Sleep", meal: "Meal/Feed", growth: "Growth", medical: "Medical",
    };
    return `[${time}] ${labelMap[e.category]}: ${e.rawText}`;
  });
  return `Daily Care Log\n\n${lines.join("\n")}\n\n${entries.length} entries recorded today.`;
}
