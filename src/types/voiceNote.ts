import type { CareEvent } from "./transcribe";

export type VoiceNote = {
  id: string;
  /** Local file URI kept only until STT succeeds (temp / retry). Null after discard. */
  uri: string | null;
  durationMs: number;
  transcript: string;
  savedAt: string;
  events?: CareEvent[];
  transcribeDate?: string;
};
