export type StorageOperation = "load" | "save" | "delete";

/** local_cache = degraded offline cache; critical = user should retry before exit. */
export type StorageIssueSeverity = "local_cache" | "critical";

export type StorageIssue = {
  operation: StorageOperation;
  storageKey: string;
  occurredAt: string;
  severity: StorageIssueSeverity;
};

type Listener = (issue: StorageIssue | null) => void;

const DEDUPE_MS = 60_000;
const isDev = typeof __DEV__ !== "undefined" && __DEV__;

let currentIssue: StorageIssue | null = null;
let lastPublishedKey = "";
let lastPublishedAt = 0;
let dismissedKey = "";
let dismissedAt = 0;
const listeners = new Set<Listener>();

function issueIdentity(issue: Pick<StorageIssue, "operation" | "storageKey">): string {
  return `${issue.operation}:${issue.storageKey}`;
}

function publish(issue: StorageIssue | null) {
  currentIssue = issue;
  listeners.forEach((listener) => listener(issue));
}

/**
 * Report persistence failures without exposing raw storage errors to the UI.
 * Identical local-cache failures are throttled so banners do not loop on every effect save.
 */
export function reportStorageIssue(
  operation: StorageOperation,
  storageKey: string,
  severity: StorageIssueSeverity = "local_cache",
) {
  const next: StorageIssue = {
    operation,
    storageKey,
    occurredAt: new Date().toISOString(),
    severity,
  };
  const id = issueIdentity(next);
  const now = Date.now();

  if (currentIssue && issueIdentity(currentIssue) === id) {
    if (isDev) console.warn(`[storageIssues] suppressed duplicate banner for ${id}`);
    return;
  }

  if (dismissedKey === id && now - dismissedAt < DEDUPE_MS) {
    if (isDev) console.warn(`[storageIssues] suppressed recently dismissed ${id}`);
    return;
  }

  if (lastPublishedKey === id && now - lastPublishedAt < DEDUPE_MS && severity === "local_cache") {
    if (isDev) console.warn(`[storageIssues] throttled local_cache ${id}`);
    return;
  }

  if (isDev) console.warn(`[storageIssues] ${operation} failed for ${storageKey} (${severity})`);

  lastPublishedKey = id;
  lastPublishedAt = now;
  publish(next);
}

export function clearStorageIssue() {
  if (currentIssue) {
    dismissedKey = issueIdentity(currentIssue);
    dismissedAt = Date.now();
  }
  publish(null);
}

export function getStorageIssue(): StorageIssue | null {
  return currentIssue;
}

export function subscribeStorageIssues(listener: Listener): () => void {
  listeners.add(listener);
  listener(currentIssue);
  return () => listeners.delete(listener);
}
