import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import type { DailyReport } from "../types/dailyReport";

const STORAGE_KEY = "darin_daily_reports";
const MAX_REPORTS = 7;

let memoryReports: DailyReport[] = [];
let hydrated = false;
let hydratePromise: Promise<void> | null = null;

async function readPersistentReports(): Promise<DailyReport[]> {
  if (Platform.OS === "web") {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as DailyReport[]) : [];
    } catch {
      return [];
    }
  }

  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as DailyReport[]) : [];
  } catch {
    return [];
  }
}

async function writePersistentReports(reports: DailyReport[]): Promise<void> {
  const json = JSON.stringify(reports);

  if (Platform.OS === "web") {
    try {
      localStorage.setItem(STORAGE_KEY, json);
    } catch {
      // ignore
    }
    return;
  }

  try {
    await AsyncStorage.setItem(STORAGE_KEY, json);
  } catch {
    // ignore
  }
}

function persistReports(reports: DailyReport[]): void {
  memoryReports = reports;
  void writePersistentReports(reports);
}

/** Load persisted reports into memory (safe to call multiple times). */
export async function hydrateReportStore(): Promise<void> {
  if (hydrated) return;
  if (!hydratePromise) {
    hydratePromise = (async () => {
      memoryReports = await readPersistentReports();
      hydrated = true;
    })();
  }
  await hydratePromise;
}

/** Save or replace a daily report (same date replaces older entry). Newest first, max 7. */
export async function saveDailyReport(report: DailyReport): Promise<void> {
  await hydrateReportStore();

  const withoutSameDate = memoryReports.filter((r) => r.date !== report.date && r.id !== report.id);
  persistReports([report, ...withoutSameDate].slice(0, MAX_REPORTS));
}

/** Read saved report history, newest first. */
export function loadReportHistory(): DailyReport[] {
  return memoryReports;
}

export function getLatestSavedReport(): DailyReport | null {
  return memoryReports[0] ?? null;
}
