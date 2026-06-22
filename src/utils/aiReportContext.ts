import type { DailyReport, ReportDetailCategory } from "../types/dailyReport";
import type { CareEvent } from "../types/transcribe";
import type { Locale } from "../i18n";
import { normalizeDailyReport } from "./reportPresentation";

const DETAIL_LABELS: Record<ReportDetailCategory, string> = {
  bowel: "Bowel",
  meal: "Meal",
  sleep: "Sleep",
  growth: "Growth",
  bath: "Bath",
  clinic: "Clinic visit",
  environment: "Temperature / humidity",
  supplement: "Supplement",
  tummy_time: "Tummy time",
  snack: "Snack",
  medication: "Medication",
};

/** Extract structured text from one daily report for the AI system prompt. */
export function formatReportForAI(report: DailyReport, isLatest = false): string {
  const normalized = normalizeDailyReport(report);
  const lines: string[] = [];
  const latestTag = isLatest ? " [LATEST — use this first for today/recent questions]" : "";

  lines.push(`--- Report ${normalized.date}${latestTag} ---`);
  lines.push(`Child: ${normalized.child}`);
  lines.push(`Caregiver: ${normalized.caregiver}`);
  lines.push(`Saved at: ${normalized.savedAt}`);

  if (normalized.careSummaryEn?.trim()) {
    lines.push(`Care summary (EN): ${normalized.careSummaryEn.trim()}`);
  }
  if (normalized.careSummaryKo?.trim()) {
    lines.push(`Care summary (KO): ${normalized.careSummaryKo.trim()}`);
  }

  lines.push(`Full report (EN): ${normalized.reportEn}`);
  lines.push(`Full report (KO): ${normalized.reportKo}`);

  const recorded = (normalized.details ?? []).filter((row) => row.recorded && row.value.trim());
  if (recorded.length > 0) {
    lines.push("Structured care details:");
    for (const row of recorded) {
      lines.push(`  • ${DETAIL_LABELS[row.type]}: ${row.value.trim()}`);
    }
  }

  if (normalized.mainCategories?.length) {
    lines.push(`Active categories: ${normalized.mainCategories.join(", ")}`);
  }

  if (normalized.items?.length) {
    lines.push("Care highlights:");
    for (const item of normalized.items) {
      lines.push(`  • ${item.label} (${item.type}): ${item.value}`);
    }
  }

  if (normalized.sourceNote?.trim()) {
    lines.push(`Caregiver source note: ${normalized.sourceNote.trim()}`);
  }

  if (normalized.parentReplyDraft?.trim()) {
    lines.push(`Suggested parent reply draft: ${normalized.parentReplyDraft.trim()}`);
  }

  return lines.join("\n");
}

export function mergeReportsForAI(
  latestReport: DailyReport | null,
  history: DailyReport[],
): DailyReport[] {
  const seen = new Set<string>();
  const merged: DailyReport[] = [];

  const add = (report: DailyReport | null | undefined) => {
    if (!report || seen.has(report.id)) return;
    seen.add(report.id);
    merged.push(report);
  };

  add(latestReport);
  for (const report of history) add(report);

  return merged.slice(0, 7);
}

export function buildReportsContextBlock(reports: DailyReport[]): string {
  if (reports.length === 0) return "";

  return reports
    .map((report, index) => formatReportForAI(report, index === 0))
    .join("\n\n");
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const DEMO_EVENTS = require("../demo/daily-events.json") as Record<string, { events: CareEvent[] }>;

export function formatEventLogForAI(store: Record<string, { events: CareEvent[] }>): string {
  const merged: Record<string, { events: CareEvent[] }> = { ...DEMO_EVENTS, ...store };
  const sortedDates = Object.keys(merged).sort().reverse().slice(0, 7);
  if (sortedDates.length === 0) return "";

  return sortedDates
    .map((date) => {
      const events = merged[date]?.events ?? [];
      if (events.length === 0) return null;
      const lines = events
        .filter((e) => e.category)
        .map((e) => {
          const rest = Object.entries(e)
            .filter(([k]) => k !== "category")
            .map(([k, v]) => `${k}: ${String(v ?? "")}`)
            .join(", ");
          return `  - ${e.category}${rest ? ` (${rest})` : ""}`;
        })
        .join("\n");
      return `[${date}]\n${lines}`;
    })
    .filter(Boolean)
    .join("\n\n");
}

export function buildAIChatSystemPrompt(input: {
  reports: DailyReport[];
  eventStore: Record<string, { events: CareEvent[] }>;
  locale: Locale;
}): string {
  const isKo = input.locale === "ko";
  const langInstruction = isKo
    ? "Always respond in Korean (한국어로만 답변하세요)."
    : "Always respond in English.";

  const base = `You are Darin AI, a friendly childcare advisor built into the Darin app.
You help parents understand their child's daily care reports and give practical childcare advice.
Keep responses concise (2-4 sentences). ${langInstruction}`;

  const reportBlock = buildReportsContextBlock(input.reports);
  const eventData = formatEventLogForAI(input.eventStore);

  const reportSection = reportBlock
    ? `\nYou have access to the child's saved daily care reports (newest first). The first report is the most recent — always prioritize it when answering about today or the latest care update:\n\n${reportBlock}\n\nBase your answers on these report facts. Do not invent details not present in the reports or event log.`
    : "";

  const eventSection = eventData
    ? `\nYou also have a detailed care event log (last 7 days):\n${eventData}\n\nCross-reference events with reports when helpful.`
    : "";

  if (!reportBlock && !eventData) {
    const noDataNote = isKo
      ? "현재 아이에 대한 리포트가 부족합니다. 정확한 상담을 원하시면 Log 탭에서 리포트를 작성해 주세요."
      : "There is currently not enough report data for your child. For accurate advice, please create a report in the Log tab.";

    return `${base}

IMPORTANT: You do NOT have any report or event data for this child yet.
Always start every response with exactly this sentence: "${noDataNote}"
Then provide a helpful general answer after that.`;
  }

  return `${base}${reportSection}${eventSection}`;
}
