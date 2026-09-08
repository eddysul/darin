import type { CareEvent } from "./transcribe";
import type { VoiceRequestScope } from "../utils/voiceRequestScope";

export type VoiceNote = {
  id: string;
  /** Local file URI kept only until STT succeeds (temp / retry). Null after discard. */
  uri: string | null;
  durationMs: number;
  transcript: string;
  savedAt: string;
  requestScope: VoiceRequestScope;
  events?: CareEvent[];
  transcribeDate?: string;
};
