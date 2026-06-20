import type { CareEvent } from "./transcribe";

export type VoiceNote = {
  id: string;
  uri: string | null;
  durationMs: number;
  transcript: string;
  savedAt: string;
  events?: CareEvent[];
  transcribeDate?: string;
  usedFallbackTranscript?: boolean;
};
