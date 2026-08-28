import type { BabyLogCategoryId } from "../constants/babyLogCategories";
import { getCategory, isPregnancyLogCategoryId } from "../constants/babyLogCategories";
import { formatLogMeta } from "./formatLog";
import type { BabyLogFlag } from "../types/babyLog";
import type { CareEvent } from "../types/transcribe";
import { createId } from "./id";
import { formatHhMm, parseDurationMinutes, parseSleepSpan, parseVoiceTime } from "./voiceTime";

export type VoiceEventDraft = {
  id: string;
  cat: BabyLogCategoryId;
  time: string;
  dateKey?: string;
  chip?: string;
  chip2?: string;
  stoolState?: string;
  amount?: string;
  duration?: string;
  notes?: string;
  flags?: BabyLogFlag[];
  confidence: number;
  timeAmbiguous?: boolean;
  timeOptions?: string[];
  extraLabel: string;
};

export type VoiceSessionResult = {
  rawTranscript: string;
  events: VoiceEventDraft[];
};

export type VoiceParseOptions = {
  pregnancy?: boolean;
};

/** @deprecated use VoiceEventDraft */
export type VoiceParseResult = VoiceEventDraft & { text?: string };

function stripUnit(value: string | number | null | undefined): string | undefined {
  if (value == null) return undefined;
  const s = String(value).trim();
  const match = s.match(/([\d.]+)/);
  return match?.[1];
}

function buildExtraLabel(result: Omit<VoiceEventDraft, "id" | "extraLabel" | "confidence">): string {
  const meta = formatLogMeta({
    cat: result.cat,
    chip: result.chip,
    chip2: result.chip2,
    stoolState: result.stoolState,
    amount: result.amount,
    duration: result.duration,
  });
  const c = getCategory(result.cat);
  return meta === "기록됨" ? c.label : `${c.label} · ${meta}`;
}

function draft(
  partial: Omit<VoiceEventDraft, "id" | "extraLabel" | "confidence"> & { confidence?: number },
): VoiceEventDraft {
  const { confidence = 0.75, ...rest } = partial;
  return {
    id: createId(),
    confidence,
    ...rest,
    extraLabel: buildExtraLabel(rest),
  };
}

function mealCategoryId(event: CareEvent): BabyLogCategoryId {
  const type = String(event.type ?? "").toLowerCase();
  if (type.includes("모유") || type.includes("breast") || type.includes("직수")) return "breast";
  if (type.includes("분유") || type.includes("formula") || type.includes("맘마") || type.includes("젖병")) return "formula";
  if (type.includes("이유식") || type.includes("food") || type.includes("solid")) return "food";
  if (type.includes("유축") || type.includes("pump")) return "pump";
  return "formula";
}

function diaperChip(event: CareEvent): string | undefined {
  const type = String(event.type ?? "");
  if (/소변|쉬|pee|urine/i.test(type)) return "소변";
  if (/대변|응가|똥|poop|stool/i.test(type)) return "대변";
  if (/둘|혼합|both/i.test(type)) return "둘다";
  return type || undefined;
}

function diaperChip2(event: CareEvent): string | undefined {
  const color = String(event.color ?? "");
  const allowed = ["노란색", "황금색", "녹색", "갈색", "검정"];
  return allowed.find((c) => color.includes(c)) ?? (color || undefined);
}

function detectFlags(text: string): BabyLogFlag[] {
  const flags: BabyLogFlag[] = [];
  if (/토했|게웠|게움|분수토|역류|토함/.test(text)) flags.push("spit_up");
  if (/트림/.test(text)) flags.push("burp");
  if (/열|체온/.test(text)) flags.push("fever");
  if (/보챘|울었|칭얼/.test(text)) flags.push("fussy");
  return flags;
}

function pregnancyMoodChip(text: string): string | undefined {
  if (/힘들|별로|안\s*좋|우울|지쳐|짜증/.test(text)) return "힘듦";
  if (/좋|괜찮|개운/.test(text)) return "좋음";
  if (/보통|그냥|평범/.test(text)) return "보통";
  return undefined;
}

function pregnancyKickChip(text: string): string | undefined {
  if (/적|안\s*느껴|없|약하/.test(text)) return "적음";
  if (/활발|많이|세게|자주|쿵쿵/.test(text)) return "활발";
  return "느꼈어요";
}

function pregnancySymptomChip(text: string): string | undefined {
  if (/입덧|메스꺼|구역|토했|게웠|토할/.test(text)) return "입덧";
  if (/두통|머리\s*아/.test(text)) return "두통";
  if (/부종|부었|부어|붓/.test(text)) return "부종";
  if (/피로|피곤/.test(text)) return "피로";
  return "기타";
}

function pregnancyHospitalChip(text: string): string | undefined {
  if (/초음파/.test(text)) return "초음파";
  if (/검진|정기/.test(text)) return "검진";
  return "진료";
}

function pregnancyMedChip(text: string): string | undefined {
  if (/영양제|엽산|철분|칼슘|비타민/.test(text)) return "영양제";
  if (/약/.test(text)) return "약";
  return "기타";
}

function extractKgAmount(text: string): string | undefined {
  const explicit = text.match(/(\d+(?:\.\d+)?)\s*(?:kg|킬로)/i);
  if (explicit?.[1]) return explicit[1];
  const labeled = text.match(/(?:체중|몸무게)\s*(?:은|는|이)?\s*(\d+(?:\.\d+)?)/);
  return labeled?.[1];
}

function extractBpAmount(text: string): string | undefined {
  const match = text.match(/(\d{2,3})\s*[/／]\s*(\d{2,3})/);
  return match ? `${match[1]}/${match[2]}` : undefined;
}

function inferPregnancySegment(segment: string, now = new Date()): VoiceEventDraft | null {
  const text = segment.trim();
  if (!text) return null;
  const parsedTime = parseVoiceTime(text, now);
  const flags: BabyLogFlag[] = parsedTime.ambiguous ? ["time_ambiguous"] : [];
  if (/체중|몸무게|\d+(?:\.\d+)?\s*(?:kg|킬로)/i.test(text)) {
    return draft({
      cat: "pregWeight",
      time: parsedTime.time,
      dateKey: parsedTime.dateKey,
      amount: extractKgAmount(text),
      flags,
      confidence: 0.9,
      timeAmbiguous: parsedTime.ambiguous,
      timeOptions: parsedTime.options,
    });
  }

  if (/혈압|\d{2,3}\s*[/／]\s*\d{2,3}/.test(text)) {
    return draft({
      cat: "pregBp",
      time: parsedTime.time,
      dateKey: parsedTime.dateKey,
      amount: extractBpAmount(text),
      flags,
      confidence: 0.9,
      timeAmbiguous: parsedTime.ambiguous,
      timeOptions: parsedTime.options,
    });
  }

  if (/태동|발차|킥킥|발로\s*차|아기(?:가)?\s*(?:움직|놀|차)/.test(text)) {
    return draft({
      cat: "pregKick",
      time: parsedTime.time,
      dateKey: parsedTime.dateKey,
      chip: pregnancyKickChip(text),
      notes: text,
      flags,
      confidence: 0.9,
      timeAmbiguous: parsedTime.ambiguous,
      timeOptions: parsedTime.options,
    });
  }

  if (/산부인과|초음파|검진|진찰|병원\s*(?:갔|다녀|왔어|옴)|진료/.test(text)) {
    return draft({
      cat: "pregHospital",
      time: parsedTime.time,
      dateKey: parsedTime.dateKey,
      chip: pregnancyHospitalChip(text),
      notes: text,
      flags,
      confidence: 0.88,
      timeAmbiguous: parsedTime.ambiguous,
      timeOptions: parsedTime.options,
    });
  }

  if (/영양제|엽산|철분|칼슘|비타민|약\s*(?:먹|복용)|복용/.test(text)) {
    return draft({
      cat: "pregMed",
      time: parsedTime.time,
      dateKey: parsedTime.dateKey,
      chip: pregnancyMedChip(text),
      notes: text,
      flags,
      confidence: 0.86,
      timeAmbiguous: parsedTime.ambiguous,
      timeOptions: parsedTime.options,
    });
  }

  if (/입덧|메스꺼|구역|토했|게웠|토할|속쓰림|속이\s*안|두통|머리\s*아|부종|부었|부어|붓|피로|피곤|요통|허리\s*아|어지러/.test(text)) {
    return draft({
      cat: "pregSymptom",
      time: parsedTime.time,
      dateKey: parsedTime.dateKey,
      chip: pregnancySymptomChip(text),
      notes: text,
      flags,
      confidence: 0.86,
      timeAmbiguous: parsedTime.ambiguous,
      timeOptions: parsedTime.options,
    });
  }

  if (/컨디션|기분|힘들|우울|괜찮|별로|좋아|좋았/.test(text)) {
    return draft({
      cat: "pregMood",
      time: parsedTime.time,
      dateKey: parsedTime.dateKey,
      chip: pregnancyMoodChip(text),
      notes: text,
      flags,
      confidence: 0.82,
      timeAmbiguous: parsedTime.ambiguous,
      timeOptions: parsedTime.options,
    });
  }

  return null;
}

function fromPregnancyCareEvent(rawTranscript: string, event: CareEvent, now = new Date()): VoiceEventDraft | null {
  const category = String(event.category ?? "");
  const blob = `${category} ${event.type ?? ""} ${event.note ?? ""} ${rawTranscript}`;
  if (category === "진료" || /병원|검진|초음파|산부인과/.test(blob)) {
    const parsedTime = parseVoiceTime([String(event.time ?? ""), blob].join(" "), now);
    const note = typeof event.note === "string" ? event.note : undefined;
    return draft({
      cat: "pregHospital",
      time: typeof event.time === "string" && /^\d{1,2}:\d{2}$/.test(event.time) ? event.time : parsedTime.time,
      dateKey: parsedTime.dateKey,
      chip: pregnancyHospitalChip(blob),
      notes: note || undefined,
      confidence: 0.84,
      timeAmbiguous: parsedTime.ambiguous,
      timeOptions: parsedTime.options,
    });
  }
  if (category === "영양제" || category === "복용 약" || /영양제|엽산|철분|약/.test(String(event.type ?? ""))) {
    const parsedTime = parseVoiceTime([String(event.time ?? ""), blob].join(" "), now);
    const note = typeof event.note === "string" ? event.note : undefined;
    return draft({
      cat: "pregMed",
      time: typeof event.time === "string" && /^\d{1,2}:\d{2}$/.test(event.time) ? event.time : parsedTime.time,
      dateKey: parsedTime.dateKey,
      chip: pregnancyMedChip(blob),
      notes: note || undefined,
      confidence: 0.84,
      timeAmbiguous: parsedTime.ambiguous,
      timeOptions: parsedTime.options,
    });
  }
  return null;
}

function fromCareEvent(rawTranscript: string, event: CareEvent, now = new Date(), pregnancy = false): VoiceEventDraft | null {
  if (pregnancy) return fromPregnancyCareEvent(rawTranscript, event, now);
  const category = String(event.category ?? "");
  const noteBits = [event.note, event.type].filter(Boolean).map(String).join(" ");
  const timeSource = [String(event.time ?? ""), String(event.time_start ?? ""), noteBits, rawTranscript].join(" ");
  const parsedTime = parseVoiceTime(timeSource, now);
  const flags = detectFlags(`${rawTranscript} ${noteBits}`);
  if (parsedTime.ambiguous) flags.push("time_ambiguous");
  const baseNotes = [
    typeof event.note === "string" ? event.note : undefined,
  ]
    .filter(Boolean)
    .join(" · ");

  if (category === "배변") {
    return draft({
      cat: "diaper",
      time: typeof event.time === "string" && /^\d{1,2}:\d{2}$/.test(event.time) ? event.time : parsedTime.time,
      dateKey: parsedTime.dateKey,
      chip: diaperChip(event),
      chip2: diaperChip2(event),
      notes: baseNotes || undefined,
      flags,
      confidence: 0.9,
      timeAmbiguous: parsedTime.ambiguous,
      timeOptions: parsedTime.options,
    });
  }

  if (category === "수면") {
    const duration = stripUnit(event.duration_min) ?? parseDurationMinutes(rawTranscript);
    return draft({
      cat: "sleep",
      time:
        typeof event.time_start === "string" && /^\d{1,2}:\d{2}/.test(event.time_start)
          ? event.time_start.slice(0, 5)
          : parsedTime.time,
      dateKey: parsedTime.dateKey,
      duration,
      notes: baseNotes || undefined,
      flags,
      confidence: 0.88,
      timeAmbiguous: parsedTime.ambiguous,
      timeOptions: parsedTime.options,
    });
  }

  if (category === "식사") {
    const cat = mealCategoryId(event);
    return draft({
      cat,
      time: typeof event.time === "string" && /^\d{1,2}:\d{2}$/.test(event.time) ? event.time : parsedTime.time,
      dateKey: parsedTime.dateKey,
      amount: stripUnit(event.amount),
      chip: cat === "breast" ? inferBreastSide(`${rawTranscript} ${noteBits}`) : undefined,
      duration: cat === "breast" ? parseDurationMinutes(`${noteBits} ${rawTranscript}`) : undefined,
      notes: baseNotes || undefined,
      flags,
      confidence: 0.9,
      timeAmbiguous: parsedTime.ambiguous,
      timeOptions: parsedTime.options,
    });
  }

  if (category === "터미타임") {
    return draft({
      cat: "tummy",
      time: parsedTime.time,
      dateKey: parsedTime.dateKey,
      duration: stripUnit(event.duration_min),
      notes: baseNotes || undefined,
      flags,
      confidence: 0.8,
    });
  }

  if (category === "간식") {
    return draft({
      cat: "snack",
      time: parsedTime.time,
      amount: stripUnit(event.amount),
      notes: baseNotes || undefined,
      flags,
      confidence: 0.8,
    });
  }

  if (category === "목욕") {
    return draft({ cat: "bath", time: parsedTime.time, notes: baseNotes || undefined, flags, confidence: 0.85 });
  }

  if (category === "진료") {
    return draft({ cat: "doctor", time: parsedTime.time, notes: baseNotes || undefined, flags, confidence: 0.8 });
  }

  if (category === "온도/습도") {
    return draft({
      cat: "temp",
      time: parsedTime.time,
      amount: stripUnit(event.body_temp),
      notes: baseNotes || undefined,
      flags,
      confidence: 0.85,
    });
  }

  if (category === "영양제" || category === "복용 약") {
    return draft({ cat: "med", time: parsedTime.time, notes: baseNotes || undefined, flags, confidence: 0.8 });
  }

  return null;
}

/** Prefer volume after feeding words — never treat "2시 10분" hour as ml. */
function extractMlAmount(text: string): string | undefined {
  const explicit =
    text.match(/(\d+)\s*(?:ml|엠엘|밀리)/i) ||
    text.match(/(?:분유|맘마|젖병)\s*(\d{2,4})\b/) ||
    text.match(/\b(\d{2,4})\s*(?:먹|줬|마셨)/);
  if (explicit?.[1]) return explicit[1];
  // lone "분유 80" without verb
  const afterWord = text.match(/(?:분유|맘마|젖병)[^\d]{0,6}(\d{2,4})\b/);
  return afterWord?.[1];
}

function inferBreastSide(text: string): string | undefined {
  const left = /왼쪽|좌측|왼\s*쪽/.test(text);
  const right = /오른쪽|우측|오른\s*쪽/.test(text);
  if (left && right) return "양쪽";
  if (left) return "좌측";
  if (right) return "우측";
  if (/직수|모유수유|수유/.test(text)) return undefined;
  return undefined;
}

function inferSegment(segment: string, now = new Date()): VoiceEventDraft | null {
  const text = segment.trim();
  if (!text) return null;
  const parsedTime = parseVoiceTime(text, now);
  const flags = detectFlags(text);
  if (parsedTime.ambiguous) flags.push("time_ambiguous");

  // spit / burp as memo-ish flags preferably attached — also allow standalone notes
  if (/트림|토했|게웠|게움|분수토/.test(text) && !/(분유|모유|수유|먹)/.test(text)) {
    return draft({
      cat: "memo",
      time: parsedTime.time,
      dateKey: parsedTime.dateKey,
      notes: text,
      flags,
      confidence: 0.7,
      timeAmbiguous: parsedTime.ambiguous,
      timeOptions: parsedTime.options,
    });
  }

  if (/쉬\s*했|소변|배뇨|오줌/.test(text)) {
    return draft({
      cat: "diaper",
      time: parsedTime.time,
      dateKey: parsedTime.dateKey,
      chip: "소변",
      flags,
      confidence: 0.86,
      timeAmbiguous: parsedTime.ambiguous,
      timeOptions: parsedTime.options,
    });
  }

  if (/응가|대변|똥|변\s*봤|묽은\s*변/.test(text)) {
    const chip2 = ["노란색", "황금색", "녹색", "갈색", "검정"].find((c) => text.includes(c));
    const stoolState = ["보통", "묽음", "딱딱함", "설사", "변비"].find((c) => text.includes(c));
    return draft({
      cat: "diaper",
      time: parsedTime.time,
      dateKey: parsedTime.dateKey,
      chip: "대변",
      chip2,
      stoolState,
      flags,
      confidence: 0.86,
      timeAmbiguous: parsedTime.ambiguous,
      timeOptions: parsedTime.options,
    });
  }

  if (/기저귀/.test(text)) {
    const chip = /소변|쉬/.test(text) ? "소변" : /대변|응가|똥/.test(text) ? "대변" : undefined;
    return draft({
      cat: "diaper",
      time: parsedTime.time,
      dateKey: parsedTime.dateKey,
      chip,
      flags,
      confidence: 0.82,
      timeAmbiguous: parsedTime.ambiguous,
      timeOptions: parsedTime.options,
    });
  }

  if (/분유|맘마|젖병/.test(text) || (/\d+\s*(ml|엠엘)/i.test(text) && /먹/.test(text))) {
    return draft({
      cat: "formula",
      time: parsedTime.time,
      dateKey: parsedTime.dateKey,
      amount: extractMlAmount(text),
      flags,
      confidence: /분유|맘마|젖병/.test(text) ? 0.92 : 0.7,
      timeAmbiguous: parsedTime.ambiguous,
      timeOptions: parsedTime.options,
    });
  }

  if (/모유|직수|수유/.test(text) && !/분유/.test(text)) {
    const leftMin = text.match(/왼쪽\s*(\d+)\s*분/);
    const rightMin = text.match(/오른쪽\s*(\d+)\s*분/);
    let duration = parseDurationMinutes(text);
    let chip = inferBreastSide(text);
    if (leftMin && rightMin) {
      duration = String(Number(leftMin[1]) + Number(rightMin[1]));
      chip = "양쪽";
    } else if (leftMin) {
      duration = leftMin[1];
      chip = "좌측";
    } else if (rightMin) {
      duration = rightMin[1];
      chip = "우측";
    }
    return draft({
      cat: "breast",
      time: parsedTime.time,
      dateKey: parsedTime.dateKey,
      chip,
      duration,
      flags,
      confidence: 0.9,
      timeAmbiguous: parsedTime.ambiguous,
      timeOptions: parsedTime.options,
    });
  }

  if (/이유식/.test(text)) {
    const g = text.match(/(\d+)\s*g/i);
    return draft({
      cat: "food",
      time: parsedTime.time,
      amount: g?.[1],
      flags,
      confidence: 0.85,
    });
  }

  if (/낮잠|수면|잤|재웠|취침|Wake|깼/.test(text) || (/잠/.test(text) && /\d+\s*분/.test(text))) {
    const span = parseSleepSpan(text, now);
    const start = span?.start ?? parsedTime;
    return draft({
      cat: "sleep",
      time: start.time,
      dateKey: start.dateKey ?? parsedTime.dateKey,
      duration: span?.duration ?? parseDurationMinutes(text),
      flags: (() => {
        const f = [...flags];
        if (start.ambiguous) {
          if (!f.includes("time_ambiguous")) f.push("time_ambiguous");
        }
        return f;
      })(),
      confidence: 0.84,
      timeAmbiguous: start.ambiguous ?? parsedTime.ambiguous,
      timeOptions: start.options ?? parsedTime.options,
    });
  }

  if (/터미/.test(text)) {
    return draft({
      cat: "tummy",
      time: parsedTime.time,
      duration: parseDurationMinutes(text),
      flags,
      confidence: 0.8,
    });
  }

  if (/목욕/.test(text)) {
    return draft({ cat: "bath", time: parsedTime.time, flags, confidence: 0.85 });
  }

  if (/체온|열\s*났|열이/.test(text)) {
    const temp = text.match(/(\d{2}(?:\.\d)?)\s*도?/);
    return draft({
      cat: "temp",
      time: parsedTime.time,
      amount: temp?.[1],
      flags,
      confidence: 0.85,
    });
  }

  return null;
}

/** Split transcript into clauses for multi-event heuristic parsing. */
export function splitVoiceClauses(text: string): string[] {
  return text
    .split(/(?:,|，|、|그리고|및|또|다음에|그다음에|하고|했고|해서|했어\.|했습니다\.|\.|!|\?|\n)+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 2);
}

function fallbackVoiceDraft(rawTranscript: string, now: Date, pregnancy: boolean): VoiceEventDraft {
  return draft({
    cat: pregnancy ? "pregMood" : "memo",
    time: formatHhMm(now),
    notes: rawTranscript || undefined,
    confidence: 0.4,
    flags: ["low_confidence"],
  });
}

function heuristicEvents(rawTranscript: string, now = new Date(), pregnancy = false): VoiceEventDraft[] {
  const infer = pregnancy ? inferPregnancySegment : inferSegment;
  const clauses = splitVoiceClauses(rawTranscript);
  const events: VoiceEventDraft[] = [];
  for (const clause of clauses) {
    const item = infer(clause, now);
    if (item) events.push(item);
  }
  if (events.length) return events;

  const whole = infer(rawTranscript, now);
  if (whole) return [whole];

  return [fallbackVoiceDraft(rawTranscript, now, pregnancy)];
}

function dedupeKey(e: VoiceEventDraft): string {
  return `${e.cat}|${e.time}|${e.chip ?? ""}|${e.amount ?? ""}|${e.duration ?? ""}`;
}

export function buildVoiceSession(
  rawText: string,
  serverEvents: CareEvent[] = [],
  now = new Date(),
  options: VoiceParseOptions = {},
): VoiceSessionResult {
  const pregnancy = Boolean(options.pregnancy);
  const rawTranscript = rawText.trim();
  if (!rawTranscript) {
    return {
      rawTranscript: "",
      events: [fallbackVoiceDraft("", now, pregnancy)],
    };
  }

  const fromServer: VoiceEventDraft[] = [];
  for (const event of serverEvents) {
    const mapped = fromCareEvent(rawTranscript, event, now, pregnancy);
    if (mapped) fromServer.push(mapped);
  }

  const fromText = heuristicEvents(rawTranscript, now, pregnancy);

  // Prefer server events when present; supplement with text-only detections not covered
  const merged: VoiceEventDraft[] = [];
  const seen = new Set<string>();

  const push = (e: VoiceEventDraft) => {
    const key = dedupeKey(e);
    if (seen.has(key)) return;
    seen.add(key);
    if (e.confidence < 0.55) {
      e.flags = [...(e.flags ?? []), "low_confidence"];
    }
    merged.push(e);
  };

  if (pregnancy) {
    fromText.forEach(push);
    fromServer.forEach(push);
  } else if (fromServer.length) {
    fromServer.forEach(push);
    // Add spit/burp memo from text if feeding didn't carry flag
    for (const e of fromText) {
      if (e.flags?.includes("spit_up") || e.flags?.includes("burp")) {
        if (!merged.some((m) => m.flags?.includes("spit_up") || m.flags?.includes("burp"))) push(e);
      }
    }
  } else {
    fromText.forEach(push);
  }

  const events = pregnancy
    ? merged.filter((event) => isPregnancyLogCategoryId(event.cat)).filter((event, _, all) => {
        if (all.length === 1) return true;
        return !(event.cat === "pregMood" && event.flags?.includes("low_confidence"));
      })
    : coalesceRelatedDiaper(merged);
  return {
    rawTranscript,
    events: events.length ? events : [fallbackVoiceDraft(rawTranscript, now, pregnancy)],
  };
}

/** "기저귀 갈았어" + "소변이었어" → one diaper with chip. */
function coalesceRelatedDiaper(events: VoiceEventDraft[]): VoiceEventDraft[] {
  const out: VoiceEventDraft[] = [];
  for (const e of events) {
    const prev = out[out.length - 1];
    if (
      prev?.cat === "diaper" &&
      e.cat === "diaper" &&
      !prev.chip &&
      e.chip &&
      !e.amount &&
      !e.duration
    ) {
      out[out.length - 1] = {
        ...prev,
        chip: e.chip,
        chip2: e.chip2 ?? prev.chip2,
        stoolState: e.stoolState ?? prev.stoolState,
        notes: [prev.notes, e.notes].filter(Boolean).join(" · ") || undefined,
        confidence: Math.max(prev.confidence, e.confidence),
        extraLabel: buildExtraLabel({
          cat: prev.cat,
          time: prev.time,
          chip: e.chip,
          chip2: e.chip2 ?? prev.chip2,
          stoolState: e.stoolState ?? prev.stoolState,
          amount: prev.amount,
          duration: prev.duration,
        }),
      };
      continue;
    }
    out.push(e);
  }
  return out;
}

export function transcribeToVoiceResults(
  rawText: string,
  events: CareEvent[] = [],
  options: VoiceParseOptions = {},
): VoiceEventDraft[] {
  return buildVoiceSession(rawText, events, new Date(), options).events;
}

export function transcribeToVoiceResult(
  rawText: string,
  events: CareEvent[] = [],
  options: VoiceParseOptions = {},
): VoiceEventDraft {
  return buildVoiceSession(rawText, events, new Date(), options).events[0];
}

export function voiceEventToLogFields(event: VoiceEventDraft, rawTranscript: string) {
  return {
    cat: event.cat,
    time: event.time,
    dateKey: event.dateKey,
    chip: event.chip,
    chip2: event.chip2,
    stoolState: event.stoolState,
    amount: event.amount,
    duration: event.duration,
    notes: event.notes,
    voice: true as const,
    source: "voice" as const,
    rawTranscript,
    confidence: event.confidence,
    flags: event.flags,
  };
}

/** Keep API for overlay reclassify of a single edited card snippet */
export function reclassifyVoiceText(
  text: string,
  previous?: VoiceEventDraft | null,
  options: VoiceParseOptions = {},
): VoiceEventDraft {
  const session = buildVoiceSession(text.trim() || previous?.notes || "", [], new Date(), options);
  const next = session.events[0];
  if (previous) {
    return { ...next, id: previous.id };
  }
  return next;
}
