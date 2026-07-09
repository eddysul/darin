import type { BabyLogCategoryId } from "../constants/babyLogCategories";

export type BabyLogEntry = {
  id: string;
  cat: BabyLogCategoryId;
  time: string;
  chip?: string;
  chip2?: string;
  amount?: string;
  duration?: string;
  notes?: string;
  voice?: boolean;
};

export type DiaryEntry = {
  id: string;
  date: string;
  photoUri?: string | null;
  emoji: string;
  comment: string;
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
