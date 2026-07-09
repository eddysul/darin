import type { BabyLogCategoryId } from "../constants/babyLogCategories";
import { formatLogMeta, getCategory } from "../constants/babyLogCategories";
import type { CareEvent } from "../types/transcribe";

export type VoiceParseResult = {
  text: string;
  cat: BabyLogCategoryId;
  chip?: string;
  chip2?: string;
  amount?: string;
  duration?: string;
  extraLabel: string;
};

function stripUnit(value: string | number | null | undefined): string | undefined {
  if (value == null) return undefined;
  const s = String(value).trim();
  const match = s.match(/([\d.]+)/);
  return match?.[1];
}

function mealCategoryId(event: CareEvent): BabyLogCategoryId {
  const type = String(event.type ?? "").toLowerCase();
  if (type.includes("모유") || type.includes("breast")) return "breast";
  if (type.includes("분유") || type.includes("formula")) return "formula";
  if (type.includes("이유식") || type.includes("food") || type.includes("solid")) return "food";
  if (type.includes("유축") || type.includes("pump")) return "pump";
  return "formula";
}

function diaperChip(event: CareEvent): string | undefined {
  const type = String(event.type ?? "");
  if (type.includes("소변")) return "소변";
  if (type.includes("대변")) return "대변";
  if (type.includes("둘")) return "둘다";
  return type || undefined;
}

function diaperChip2(event: CareEvent): string | undefined {
  const color = String(event.color ?? "");
  const allowed = ["황금색", "녹색", "갈색", "검정", "설사", "변비"];
  return allowed.find((c) => color.includes(c)) ?? (color || undefined);
}

function buildExtraLabel(result: Omit<VoiceParseResult, "extraLabel">): string {
  const meta = formatLogMeta({
    cat: result.cat,
    chip: result.chip,
    chip2: result.chip2,
    amount: result.amount,
    duration: result.duration,
  });
  const c = getCategory(result.cat);
  return meta === "기록됨" ? c.label : `${c.label} · ${meta}`;
}

function fromCareEvent(text: string, event: CareEvent): VoiceParseResult | null {
  const category = String(event.category ?? "");

  if (category === "배변") {
    const result = {
      text,
      cat: "diaper" as const,
      chip: diaperChip(event),
      chip2: diaperChip2(event),
    };
    return { ...result, extraLabel: buildExtraLabel(result) };
  }

  if (category === "수면") {
    const duration = stripUnit(event.duration_min);
    const result = {
      text,
      cat: "sleep" as const,
      duration,
    };
    return { ...result, extraLabel: buildExtraLabel(result) };
  }

  if (category === "식사") {
    const cat = mealCategoryId(event);
    const result = {
      text,
      cat,
      amount: stripUnit(event.amount),
      chip: cat === "food" ? inferFoodChip(text, event) : undefined,
    };
    return { ...result, extraLabel: buildExtraLabel(result) };
  }

  if (category === "터미타임") {
    const result = { text, cat: "tummy" as const, duration: stripUnit(event.duration_min) };
    return { ...result, extraLabel: buildExtraLabel(result) };
  }

  if (category === "간식") {
    const result = { text, cat: "snack" as const, amount: stripUnit(event.amount) };
    return { ...result, extraLabel: buildExtraLabel(result) };
  }

  if (category === "목욕") {
    const result = { text, cat: "bath" as const };
    return { ...result, extraLabel: buildExtraLabel(result) };
  }

  if (category === "진료") {
    const result = { text, cat: "doctor" as const };
    return { ...result, extraLabel: buildExtraLabel(result) };
  }

  if (category === "온도/습도") {
    const temp = stripUnit(event.body_temp);
    const result = { text, cat: "temp" as const, amount: temp };
    return { ...result, extraLabel: buildExtraLabel(result) };
  }

  if (category === "영양제" || category === "복용 약") {
    const result = { text, cat: "med" as const };
    return { ...result, extraLabel: buildExtraLabel(result) };
  }

  return null;
}

function inferFoodChip(text: string, event: CareEvent): string | undefined {
  const note = String(event.note ?? "");
  if (note.includes("잘") || text.includes("잘 먹")) return "잘 먹음";
  if (note.includes("거부") || text.includes("거부")) return "거부";
  if (note.includes("보통") || text.includes("보통")) return "보통";
  return undefined;
}

function inferFromText(text: string): VoiceParseResult {
  const lower = text.toLowerCase();

  if (/응가|대변|소변|기저귀|배변|변/.test(text)) {
    const result = {
      text,
      cat: "diaper" as const,
      chip: /소변/.test(text) ? "소변" : /대변|응가/.test(text) ? "대변" : undefined,
      chip2: ["황금색", "녹색", "갈색"].find((c) => text.includes(c)),
    };
    return { ...result, extraLabel: buildExtraLabel(result) };
  }

  if (/낮잠|수면|잤|재웠|취침|nap|sleep/.test(lower) || /잠/.test(text)) {
    const minMatch = text.match(/(\d+)\s*분/);
    const result = { text, cat: "sleep" as const, duration: minMatch?.[1] };
    return { ...result, extraLabel: buildExtraLabel(result) };
  }

  if (/모유|젖/.test(text)) {
    const minMatch = text.match(/(\d+)\s*분/);
    const side = /좌/.test(text) ? "좌측" : /우/.test(text) ? "우측" : /양쪽/.test(text) ? "양쪽" : undefined;
    const result = { text, cat: "breast" as const, chip: side, duration: minMatch?.[1] };
    return { ...result, extraLabel: buildExtraLabel(result) };
  }

  if (/분유/.test(text)) {
    const mlMatch = text.match(/(\d+)\s*ml/i);
    const result = { text, cat: "formula" as const, amount: mlMatch?.[1] };
    return { ...result, extraLabel: buildExtraLabel(result) };
  }

  if (/이유식/.test(text)) {
    const gMatch = text.match(/(\d+)\s*g/i);
    const result = { text, cat: "food" as const, amount: gMatch?.[1] };
    return { ...result, extraLabel: buildExtraLabel(result) };
  }

  if (/터미/.test(text)) {
    const minMatch = text.match(/(\d+)\s*분/);
    const result = { text, cat: "tummy" as const, duration: minMatch?.[1] };
    return { ...result, extraLabel: buildExtraLabel(result) };
  }

  if (/목욕/.test(text)) {
    const result = { text, cat: "bath" as const };
    return { ...result, extraLabel: buildExtraLabel(result) };
  }

  if (/체온|열/.test(text)) {
    const tempMatch = text.match(/(\d{2}(?:\.\d)?)\s*도?/);
    const result = { text, cat: "temp" as const, amount: tempMatch?.[1] };
    return { ...result, extraLabel: buildExtraLabel(result) };
  }

  const result = { text, cat: "memo" as const };
  return { ...result, extraLabel: buildExtraLabel(result) };
}

export function transcribeToVoiceResult(rawText: string, events: CareEvent[] = []): VoiceParseResult {
  const text = rawText.trim();
  if (!text) {
    const fallback = { text: "음성 기록", cat: "memo" as const };
    return { ...fallback, extraLabel: buildExtraLabel(fallback) };
  }

  for (const event of events) {
    const mapped = fromCareEvent(text, event);
    if (mapped) return mapped;
  }

  return inferFromText(text);
}
