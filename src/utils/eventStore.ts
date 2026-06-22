import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import type { CareEvent } from "../types/transcribe";

const STORAGE_KEY = "darin_daily_events";

type DayRecord = { events: CareEvent[] };
type EventStore = Record<string, DayRecord>;

let memoryStore: EventStore = {};
let hydrated = false;
let hydratePromise: Promise<void> | null = null;

async function readPersistentStore(): Promise<EventStore> {
  if (Platform.OS === "web") {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as EventStore) : {};
    } catch {
      return {};
    }
  }

  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as EventStore) : {};
  } catch {
    return {};
  }
}

async function writePersistentStore(store: EventStore): Promise<void> {
  const json = JSON.stringify(store);

  if (Platform.OS === "web") {
    try {
      localStorage.setItem(STORAGE_KEY, json);
    } catch {
      // ignore quota / private mode errors
    }
    return;
  }

  try {
    await AsyncStorage.setItem(STORAGE_KEY, json);
  } catch {
    // ignore persistence errors
  }
}

function todayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Load persisted events into memory (safe to call multiple times). */
export async function hydrateEventStore(): Promise<void> {
  if (hydrated) return;
  if (!hydratePromise) {
    hydratePromise = (async () => {
      memoryStore = await readPersistentStore();
      hydrated = true;
    })();
  }
  await hydratePromise;
}

function persistStore(store: EventStore): void {
  memoryStore = store;
  void writePersistentStore(store);
}

/** Append new events for today into the store. */
export function appendEventsForToday(events: CareEvent[]): void {
  if (!events.length) return;

  const append = () => {
    const store = { ...memoryStore };
    const key = todayKey();
    const existing = store[key]?.events ?? [];
    store[key] = { events: [...existing, ...events] };
    persistStore(store);
  };

  if (hydrated) {
    append();
    return;
  }

  void hydrateEventStore().then(append);
}

/** Read all stored events from memory (call hydrateEventStore first on native). */
export function loadEventStore(): EventStore {
  return memoryStore;
}
