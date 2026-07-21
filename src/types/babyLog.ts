import type { FamilyRole } from "./family";
import type { DiaryMoodId, DiarySkyId } from "../constants/diaryCompose";

export type BabyLogFlag = "spit_up" | "burp" | "fever" | "fussy" | "low_confidence" | "time_ambiguous";

/** Who created the log — role aligned with family sharing. */
export type BabyLogActor = {
  userId: string;
  name: string;
  role: FamilyRole;
};

export type BabyLogSource = "manual" | "voice" | "diary" | "caregiver";

export type BabyLogEntry = {
  id: string;
  cat: import("./logCategory").LogCategoryKey;
  /** HH:MM local wall clock */
  time: string;
  /** YYYY-MM-DD (device local). Required for new writes; legacy may omit (= today). */
  dateKey?: string;
  chip?: string;
  chip2?: string;
  /** Stool consistency/state, kept separate from stool color. */
  stoolState?: string;
  amount?: string;
  duration?: string;
  notes?: string;
  /** User-editable short label, used by other/doctor/custom-like records. */
  title?: string;
  /** Structured detail kept separate from the free-form memo. */
  details?: string;
  /** Optional next appointment or follow-up date/time. */
  nextAt?: string;
  voice?: boolean;
  source?: BabyLogSource;
  /** Original STT text for the session this entry came from */
  rawTranscript?: string;
  confidence?: number;
  flags?: BabyLogFlag[];
  createdBy?: BabyLogActor;
};

/** How the diary was opened / created */
export type DiarySource = "manual" | "notification";

export type DiaryDraftStatus = "draft" | "saved";

/**
 * Canonical Diary model (육아일기).
 * careLogSummarySnapshot is frozen at save time and must not change when Care Logs are edited later.
 */
export type DiaryEntry = {
  id: string;
  babyId: string;
  /** Display label e.g. "7월 17일 (금)" */
  date: string;
  /** YYYY-MM-DD local */
  dateKey: string;
  photos: string[];
  comment: string;
  weatherStamp: DiarySkyId | null;
  moodStamp: DiaryMoodId | null;
  /** Frozen Care Log summary at save time */
  careLogSummarySnapshot: string;
  /** Moment suggestion ids the parent tapped while composing */
  momentSuggestionsUsed: string[];
  /** Preset milestone e.g. "첫 목욕" */
  milestoneTag: string | null;
  /** Free-text milestone when not a preset */
  customMilestoneTag: string | null;
  includedInGrowthBook: boolean;
  /** Baby sticker ids attached to this diary (not free-layout). */
  stickerIds?: string[];
  createdBy?: BabyLogActor;
  createdAt: string;
  updatedAt: string;
  source: DiarySource;
  draftStatus: DiaryDraftStatus;
};

export type ChatMessage = {
  id: string;
  role: "user" | "ai";
  text: string;
  /** Optional baby sticker attached to a chat bubble. */
  stickerId?: string;
};
