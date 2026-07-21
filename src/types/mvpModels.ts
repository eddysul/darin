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
 * Growth book edit copy is persisted separately from Diary.
 * Diary.includedInGrowthBook still decides which diaries appear in the book.
 */
export type GrowthBookDocument = import("./growthBook").GrowthBookEdit;
export type GrowthBookPageEdit = import("./growthBook").GrowthBookPageEdit;
export type GrowthBookComment = import("./growthBook").GrowthBookComment;
export type GrowthBookLetter = import("./growthBook").GrowthBookLetter;

/**
 * Growth book item projection from an included diary.
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
