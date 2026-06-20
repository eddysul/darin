import { Platform } from "react-native";

const DEFAULT_HOST = Platform.OS === "android" ? "10.0.2.2" : "127.0.0.1";

export const TRANSCRIBE_API_URL =
  process.env.EXPO_PUBLIC_TRANSCRIBE_URL?.trim() || `http://${DEFAULT_HOST}:8000`;
