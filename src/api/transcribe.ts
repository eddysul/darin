import { TRANSCRIBE_API_URL } from "../config/api";
import type { TranscribeResult } from "../types/transcribe";

function guessMimeType(uri: string) {
  const lower = uri.toLowerCase();
  if (lower.endsWith(".wav")) return "audio/wav";
  if (lower.endsWith(".caf")) return "audio/x-caf";
  if (lower.endsWith(".mp4")) return "audio/mp4";
  return "audio/m4a";
}

function guessFileName(uri: string) {
  const parts = uri.split("/");
  const last = parts[parts.length - 1];
  if (last.includes(".")) return last;
  return "recording.m4a";
}

export async function transcribeRecording(uri: string): Promise<TranscribeResult> {
  const formData = new FormData();
  formData.append("file", {
    uri,
    name: guessFileName(uri),
    type: guessMimeType(uri),
  } as unknown as Blob);

  const response = await fetch(`${TRANSCRIBE_API_URL}/transcribe`, {
    method: "POST",
    body: formData,
    headers: {
      Accept: "application/json",
      "ngrok-skip-browser-warning": "true",
    },
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `Transcribe failed (${response.status})`);
  }

  return (await response.json()) as TranscribeResult;
}

export type ReportResult = {
  reportEn: string;
  reportKo: string;
  parentReplyDraft: string;
  items: { type: "meal" | "nap" | "activity" | "health" | "reminder"; label: string; value: string }[];
};

export async function generateReport(
  transcript: string,
  events: Record<string, unknown>[] = [],
): Promise<ReportResult> {
  const response = await fetch(`${TRANSCRIBE_API_URL}/report`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "ngrok-skip-browser-warning": "true",
    },
    body: JSON.stringify({ transcript, events }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `Report generation failed (${response.status})`);
  }

  return (await response.json()) as ReportResult;
}

export async function checkTranscribeHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${TRANSCRIBE_API_URL}/health`, {
      headers: { "ngrok-skip-browser-warning": "true" },
    });
    return response.ok;
  } catch {
    return false;
  }
}
