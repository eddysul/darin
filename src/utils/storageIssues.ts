export type StorageOperation = "load" | "save" | "delete";

export type StorageIssue = {
  operation: StorageOperation;
  storageKey: string;
  occurredAt: string;
};

type Listener = (issue: StorageIssue | null) => void;

let currentIssue: StorageIssue | null = null;
const listeners = new Set<Listener>();

function publish(issue: StorageIssue | null) {
  currentIssue = issue;
  listeners.forEach((listener) => listener(issue));
}

/** Report persistence failures without exposing raw storage errors to the UI. */
export function reportStorageIssue(operation: StorageOperation, storageKey: string) {
  publish({ operation, storageKey, occurredAt: new Date().toISOString() });
}

export function clearStorageIssue() {
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
