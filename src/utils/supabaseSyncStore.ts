import { qaStorage } from "./qaStorage";
import { STORAGE_KEYS } from "./storageKeys";
import { reportStorageIssue } from "./storageIssues";

export type SupabaseSyncState = {
  userId: string | null;
  babyId: string | null;
  /** Local care logs detected as migration candidates (not auto-uploaded). */
  migrationCandidateCount: number;
  lastHydratedAt: string | null;
};

const DEFAULT_STATE: SupabaseSyncState = {
  userId: null,
  babyId: null,
  migrationCandidateCount: 0,
  lastHydratedAt: null,
};

let memory: SupabaseSyncState | null = null;
let hydrated = false;
let hydratePromise: Promise<boolean> | null = null;

function normalize(raw: unknown): SupabaseSyncState {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_STATE };
  const o = raw as Partial<SupabaseSyncState>;
  return {
    userId: typeof o.userId === "string" ? o.userId : null,
    babyId: typeof o.babyId === "string" ? o.babyId : null,
    migrationCandidateCount:
      typeof o.migrationCandidateCount === "number" ? o.migrationCandidateCount : 0,
    lastHydratedAt: typeof o.lastHydratedAt === "string" ? o.lastHydratedAt : null,
  };
}

export async function hydrateSupabaseSync(force = false): Promise<boolean> {
  if (force) {
    hydrated = false;
    hydratePromise = null;
  }
  if (hydrated) return true;
  if (!hydratePromise) {
    hydratePromise = (async () => {
      try {
        const raw = await qaStorage.getItem(STORAGE_KEYS.supabaseSync);
        memory = raw ? normalize(JSON.parse(raw)) : { ...DEFAULT_STATE };
        hydrated = true;
        return true;
      } catch {
        reportStorageIssue("load", STORAGE_KEYS.supabaseSync);
        memory = { ...DEFAULT_STATE };
        hydrated = true;
        return false;
      }
    })();
  }
  return hydratePromise;
}

export function getSupabaseSync(): SupabaseSyncState {
  return memory ?? { ...DEFAULT_STATE };
}

export async function saveSupabaseSync(next: SupabaseSyncState): Promise<void> {
  memory = next;
  hydrated = true;
  try {
    await qaStorage.setItem(STORAGE_KEYS.supabaseSync, JSON.stringify(next));
  } catch {
    reportStorageIssue("save", STORAGE_KEYS.supabaseSync);
  }
}

export async function clearSupabaseSync(): Promise<void> {
  memory = { ...DEFAULT_STATE };
  try {
    await qaStorage.removeItem(STORAGE_KEYS.supabaseSync);
  } catch {
    reportStorageIssue("save", STORAGE_KEYS.supabaseSync);
  }
}
