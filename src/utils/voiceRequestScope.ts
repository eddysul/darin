import type { Locale } from "../i18n";
import type { LocalDataScope } from "./scopedLocalStorage";

function createVoiceRequestId(): string {
  return globalThis.crypto?.randomUUID?.()
    ?? `voice-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export type VoiceScopeSnapshot = {
  accountId: string;
  babyId: string;
  timezone: string;
  locale: Locale;
};

export type VoiceRequestScope = VoiceScopeSnapshot & {
  requestId: string;
  startedAt: string;
};

export function resolveVoiceScopeSnapshot(
  scope: LocalDataScope | null,
  locale: Locale,
  timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
): VoiceScopeSnapshot | null {
  if (!scope?.userId.trim() || !scope.babyId.trim()) return null;
  return {
    accountId: scope.userId,
    babyId: scope.babyId,
    timezone,
    locale,
  };
}

export function voiceScopeSnapshotKey(scope: VoiceScopeSnapshot | null): string {
  if (!scope) return "invalid";
  return JSON.stringify([scope.accountId, scope.babyId, scope.timezone, scope.locale]);
}

export function captureVoiceRequestScope(
  scope: VoiceScopeSnapshot,
  now = new Date(),
  requestId = createVoiceRequestId(),
): VoiceRequestScope {
  return { ...scope, requestId, startedAt: now.toISOString() };
}

export function isVoiceRequestScopeCurrent(
  request: VoiceRequestScope | null | undefined,
  current: VoiceScopeSnapshot | null,
): request is VoiceRequestScope {
  return !!request && !!current
    && request.accountId === current.accountId
    && request.babyId === current.babyId
    && request.timezone === current.timezone
    && request.locale === current.locale;
}

export function createVoiceRequestGate() {
  let activeRequestId: string | null = null;

  return {
    begin(scope: VoiceScopeSnapshot, now?: Date, requestId?: string) {
      const request = captureVoiceRequestScope(scope, now, requestId);
      activeRequestId = request.requestId;
      return request;
    },
    cancel() {
      activeRequestId = null;
    },
    isActive(request: VoiceRequestScope, current: VoiceScopeSnapshot | null) {
      return activeRequestId === request.requestId
        && isVoiceRequestScopeCurrent(request, current);
    },
  };
}

/** Serializes native recorder startup and cancellation without coupling it to React state. */
export function createVoiceOperationCoordinator() {
  let activeStartTask: Promise<void> | null = null;
  let queuedStartTask: Promise<void> | null = null;
  let cancelTask: Promise<void> | null = null;
  let generation = 0;

  return {
    runStart(task: () => Promise<void>): Promise<void> {
      if (queuedStartTask) return queuedStartTask;
      if (activeStartTask && !cancelTask) return activeStartTask;
      const queuedGeneration = generation;
      const pendingCancel = cancelTask;
      const operation = (async () => {
        if (pendingCancel) await pendingCancel;
        if (queuedGeneration !== generation) return;
        await task();
      })();
      if (pendingCancel) queuedStartTask = operation;
      else activeStartTask = operation;
      operation.then(
        () => {
          if (activeStartTask === operation) activeStartTask = null;
          if (queuedStartTask === operation) queuedStartTask = null;
        },
        () => {
          if (activeStartTask === operation) activeStartTask = null;
          if (queuedStartTask === operation) queuedStartTask = null;
        },
      );
      return operation;
    },
    runCancel(task: () => Promise<void>): Promise<void> {
      generation += 1;
      if (cancelTask) return cancelTask;
      const pendingStart = queuedStartTask ?? activeStartTask;
      const operation = (async () => {
        if (pendingStart) await pendingStart.catch(() => undefined);
        await task();
      })();
      cancelTask = operation;
      operation.then(
        () => { if (cancelTask === operation) cancelTask = null; },
        () => { if (cancelTask === operation) cancelTask = null; },
      );
      return operation;
    },
  };
}
