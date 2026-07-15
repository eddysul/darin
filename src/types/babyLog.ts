import type { FamilyRole } from "./family";

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
  amount?: string;
  duration?: string;
  notes?: string;
  voice?: boolean;
  source?: BabyLogSource;
  /** Original STT text for the session this entry came from */
  rawTranscript?: string;
  confidence?: number;
  flags?: BabyLogFlag[];
  createdBy?: BabyLogActor;
};

export type DiaryEntry = {
  id: string;
  date: string;
  photoUri?: string | null;
  emoji: string;
  comment: string;
  createdBy?: BabyLogActor;
  source?: "diary" | "manual";
};

export type ChatMessage = {
  id: string;
  role: "user" | "ai";
  text: string;
};

export type CaregiverMember = {
  id: string;
  emoji: string;
  name: string;
  role: string;
  badge: string;
  isMe?: boolean;
};
