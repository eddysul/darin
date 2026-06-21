import { Platform } from "react-native";
import type { CareEvent } from "../types/transcribe";

const STORAGE_KEY = "darin_daily_events";

type DayRecord = { events: CareEvent[] };
type EventStore = Record<string, DayRecord>;

function getStorage(): EventStore {
  if (Platform.OS !== "web") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as EventStore) : {};
  } catch {
    return {};
  }
}

function setStorage(store: EventStore): void {
  if (Platform.OS !== "web") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // ignore
  }
}

function todayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Append new events for today into the store. */
export function appendEventsForToday(events: CareEvent[]): void {
  if (!events.length) return;
  const store = getStorage();
  const key = todayKey();
  const existing = store[key]?.events ?? [];
  store[key] = { events: [...existing, ...events] };
  setStorage(store);
}

/** Read all stored events (merged with optional seed data). */
export function loadEventStore(): EventStore {
  return getStorage();
}
