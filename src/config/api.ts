import { Platform } from "react-native";

const DEFAULT_HOST = Platform.OS === "android" ? "10.0.2.2" : "127.0.0.1";
const DEFAULT_URL = `http://${DEFAULT_HOST}:8000`;

function normalizeTranscribeUrl(raw?: string) {
  const trimmed = raw?.trim();
  if (!trimmed) return DEFAULT_URL;
  // Common typo: http://127.0.0.1:800 (missing trailing 0)
  if (trimmed.endsWith(":800") && !trimmed.endsWith(":8000")) {
    return `${trimmed}0`;
  }
  return trimmed;
}

export const TRANSCRIBE_API_URL = normalizeTranscribeUrl(process.env.EXPO_PUBLIC_TRANSCRIBE_URL);
