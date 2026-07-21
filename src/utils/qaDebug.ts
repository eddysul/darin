import AsyncStorage from "@react-native-async-storage/async-storage";
import { STORAGE_KEYS, type StorageKey } from "./storageKeys";
import {
  EMPTY_QA_FAULT_STATE,
  armQaFault,
  consumeQaFault,
  type QaFaultKind,
  type QaFaultState,
} from "./qaFaults";

const QA_CONTROL_KEY = "darin:qa-debug-control";
const QA_BACKUP_KEY = "darin:qa-debug-backup";
const EMPTY_DATA_KEYS: StorageKey[] = [
  STORAGE_KEYS.babyLogs,
  STORAGE_KEYS.diary,
  STORAGE_KEYS.consultChat,
  STORAGE_KEYS.familyMembers,
];

type QaBackup = {
  createdAt: string;
  entries: Array<[StorageKey, string | null]>;
};

type Listener = (state: QaFaultState) => void;

let state: QaFaultState = { ...EMPTY_QA_FAULT_STATE };
let loadPromise: Promise<void> | null = null;
let mutationQueue: Promise<void> = Promise.resolve();
const listeners = new Set<Listener>();

function emit() {
  listeners.forEach((listener) => listener(state));
}

function isFaultState(value: unknown): value is QaFaultState {
  if (!value || typeof value !== "object") return false;
  const item = value as QaFaultState;
  return (
    typeof item.ai === "boolean" &&
    typeof item.storageRead === "boolean" &&
    typeof item.storageWrite === "boolean"
  );
}

async function ensureLoaded() {
  if (!__DEV__) return;
  if (!loadPromise) {
    loadPromise = (async () => {
      const raw = await AsyncStorage.getItem(QA_CONTROL_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as unknown;
        if (isFaultState(parsed)) state = parsed;
      }
      emit();
    })();
  }
  await loadPromise;
}

async function mutateState(update: (current: QaFaultState) => QaFaultState): Promise<void> {
  if (!__DEV__) return;
  mutationQueue = mutationQueue.then(async () => {
    await ensureLoaded();
    state = update(state);
    await AsyncStorage.setItem(QA_CONTROL_KEY, JSON.stringify(state));
    emit();
  });
  await mutationQueue;
}

export async function getQaFaultState(): Promise<QaFaultState> {
  await ensureLoaded();
  return { ...state };
}

export function subscribeQaFaults(listener: Listener): () => void {
  listeners.add(listener);
  listener({ ...state });
  void ensureLoaded();
  return () => listeners.delete(listener);
}

export async function armQaFaultOnce(kind: QaFaultKind): Promise<void> {
  await mutateState((current) => armQaFault(current, kind));
}

export async function consumeQaFaultOnce(kind: QaFaultKind): Promise<boolean> {
  if (!__DEV__) return false;
  let consumed = false;
  await mutateState((current) => {
    const result = consumeQaFault(current, kind);
    consumed = result.consumed;
    return result.state;
  });
  return consumed;
}

export async function backupQaData(): Promise<QaBackup> {
  if (!__DEV__) throw new Error("QA backup is only available in development builds.");
  const keys = Object.values(STORAGE_KEYS);
  const entries = (await AsyncStorage.multiGet(keys)) as Array<[StorageKey, string | null]>;
  const backup: QaBackup = { createdAt: new Date().toISOString(), entries };
  await AsyncStorage.setItem(QA_BACKUP_KEY, JSON.stringify(backup));
  return backup;
}

export async function hasQaBackup(): Promise<boolean> {
  if (!__DEV__) return false;
  return Boolean(await AsyncStorage.getItem(QA_BACKUP_KEY));
}

export async function switchToQaEmptyData(): Promise<void> {
  if (!__DEV__) return;
  if (!(await hasQaBackup())) await backupQaData();
  await AsyncStorage.multiSet(EMPTY_DATA_KEYS.map((key) => [key, "[]"]));
  await AsyncStorage.removeItem(STORAGE_KEYS.diaryDraft);
}

export async function restoreQaBackup(): Promise<void> {
  if (!__DEV__) return;
  const raw = await AsyncStorage.getItem(QA_BACKUP_KEY);
  if (!raw) throw new Error("저장된 QA 백업이 없어요.");
  const backup = JSON.parse(raw) as QaBackup;
  const toSet = backup.entries.filter((entry): entry is [StorageKey, string] => entry[1] !== null);
  const toRemove = backup.entries.filter((entry) => entry[1] === null).map(([key]) => key);
  if (toSet.length) await AsyncStorage.multiSet(toSet);
  if (toRemove.length) await AsyncStorage.multiRemove(toRemove);
}
