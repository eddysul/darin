import type { LogEntry, LogPrimaryCategory } from "../types/log";
import { PRIMARY_CATEGORY_META } from "../types/log";

const LEGACY_CATEGORY_MAP: Record<string, LogPrimaryCategory> = {
  diaper: "bowel",
  nap: "sleep",
  medical: "clinic",
  health: "clinic",
  activity: "growth",
  reminder: "clinic",
};

export function normalizeLogCategory(value: string): LogPrimaryCategory {
  const key = value.toLowerCase().trim();
  if (key in LEGACY_CATEGORY_MAP) return LEGACY_CATEGORY_MAP[key];
  if (["bowel", "sleep", "meal", "growth", "clinic"].includes(key)) {
    return key as LogPrimaryCategory;
  }
  return categorizeLog(value);
}

export function categorizeLog(text: string): LogPrimaryCategory {
  const t = text.toLowerCase();
  if (/배변|기저귀|대변|소변|변|응가|poop|diaper|bowel/i.test(t)) return "bowel";
  if (/수면|잠|자|sleep|낮잠|nap/i.test(t)) return "sleep";
  if (/식사|밥|수유|분유|모유|먹|eat|meal|feed|snack/i.test(t)) return "meal";
  if (/키|몸무게|체중|신장|cm|kg|growth|성장|tummy/i.test(t)) return "growth";
  if (/병원|진료|의사|약|medical|hospital|clinic|열|medication/i.test(t)) return "clinic";
  return "meal";
}

export function extractSummary(text: string): string {
  const trimmed = text.trim();
  const firstSentence = trimmed.split(/[.。！!?？]/)[0].trim();
  return firstSentence.length > 70 ? `${firstSentence.slice(0, 68)}…` : firstSentence;
}

export function buildLogSourceNote(entries: LogEntry[], locale: "en" | "ko"): string {
  if (entries.length === 0) return "";

  const sorted = [...entries].sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  const lines = sorted.map((entry) => {
    const time = new Date(entry.timestamp).toLocaleTimeString(locale === "ko" ? "ko-KR" : "en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
    const meta = PRIMARY_CATEGORY_META[entry.category];
    const label = locale === "ko" ? meta.labelKo : meta.labelEn;
    return `[${time}] ${label}: ${entry.rawText}`;
  });

  if (locale === "ko") {
    return `오늘의 구조화된 돌봄 기록\n\n${lines.join("\n")}\n\n총 ${entries.length}건`;
  }

  return `Structured care log for today\n\n${lines.join("\n")}\n\n${entries.length} entries recorded.`;
}
