/**
 * MVP domain model index.
 *
 * This file names the product entities without duplicating the existing
 * persistence models. Existing feature code should continue importing its
 * concrete types; new integrations can use these aliases as the boundary.
 */
import type { BabyLogEntry, ChatMessage, DiaryEntry } from "./babyLog";
import type { ChildProfile } from "./careSetup";
import type { FamilyMember } from "./family";
import type { TodaySummary } from "../utils/reportAggregates";

export type Baby = ChildProfile & {
  /** Local MVP uses one baby; reserved for server synchronization. */
  id: string;
};

/** Canonical timeline record persisted in AsyncStorage. */
export type CareLog = BabyLogEntry;

/** Canonical diary record, including frozen Care Log snapshot. */
export type Diary = DiaryEntry;

/**
 * Growth book is a curated projection of Diary in MVP.
 * No separate store exists: Diary.includedInGrowthBook is the source of truth.
 */
export type GrowthBookItem = {
  diaryId: Diary["id"];
  diary: Diary;
  orderKey: Diary["dateKey"];
};

/** Family/caregiver identity, role, invite state, and local sharing status. */
export type Caregiver = FamilyMember;

/**
 * Voice provenance attached to a CareLog.
 * Audio files are intentionally not persisted in the MVP.
 */
export type VoiceRecord = Pick<
  CareLog,
  "id" | "dateKey" | "time" | "rawTranscript" | "confidence" | "flags" | "createdBy"
> & {
  source: "voice";
  careLogId: CareLog["id"];
};

/** Derived, never independently persisted. */
export type ReportSummary = TodaySummary;

/** AI consultation history persisted in the consult chat store. */
export type AIConsultMessage = ChatMessage;
