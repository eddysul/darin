import assert from "node:assert/strict";
import {
  createWeeklyAiDisplayState,
  createScopedWeeklyAiCacheStore,
  createWeeklyAiCacheIdentity,
  getCurrentWeeklyAiDisplayValue,
  runWeeklyAiRequestOnce,
  weeklyAiCacheIdentityKey,
  weeklyAiCacheStorageKey,
  weeklyAiInputFingerprint,
  type WeeklyAiCacheIdentity,
  type WeeklyAiCacheScope,
  type WeeklyAiCacheStorage,
  type WeeklyAiDisplayState,
} from "../src/utils/weeklyAiCache.ts";

class MemoryStorage implements WeeklyAiCacheStorage {
  readonly values = new Map<string, string>();
  failNextRead = false;
  failNextWrite = false;

  async getItem(key: string): Promise<string | null> {
    if (this.failNextRead) {
      this.failNextRead = false;
      throw new Error("injected read failure");
    }
    return this.values.get(key) ?? null;
  }

  async setItem(key: string, value: string): Promise<void> {
    if (this.failNextWrite) {
      this.failNextWrite = false;
      throw new Error("injected write failure");
    }
    this.values.set(key, value);
  }

  async removeItem(key: string): Promise<void> {
    this.values.delete(key);
  }
}

class DelayedStorage extends MemoryStorage {
  delayedKey: string | null = null;
  private resolveDelayed: ((value: string | null) => void) | null = null;

  override async getItem(key: string): Promise<string | null> {
    if (key !== this.delayedKey) return super.getItem(key);
    return new Promise((resolve) => {
      this.resolveDelayed = resolve;
    });
  }

  releaseDelayed(): void {
    const key = this.delayedKey;
    const resolve = this.resolveDelayed;
    assert.ok(key && resolve, "the delayed read must be pending");
    this.delayedKey = null;
    this.resolveDelayed = null;
    resolve(this.values.get(key) ?? null);
  }
}

const scopeA: WeeklyAiCacheScope = { userId: "account-a", babyId: "baby-a" };
const scopeB: WeeklyAiCacheScope = { userId: "account-a", babyId: "baby-b" };
const scopeOtherAccount: WeeklyAiCacheScope = { userId: "account-b", babyId: "baby-a" };

function identity(
  scope: WeeklyAiCacheScope,
  patch: Partial<{
    fromDateKey: string;
    toDateKey: string;
    locale: "ko" | "en";
    facts: unknown;
    inputSchemaVersion: number;
    promptVersion: number;
  }> = {},
): WeeklyAiCacheIdentity {
  const result = createWeeklyAiCacheIdentity({
    operation: "weekly_narrative",
    scope,
    fromDateKey: patch.fromDateKey ?? "2025-12-27",
    toDateKey: patch.toDateKey ?? "2026-01-07",
    locale: patch.locale ?? "ko",
    inputFacts: patch.facts ?? { sleep: 480, feed: [6, 7] },
    inputSchemaVersion: patch.inputSchemaVersion ?? 1,
    promptVersion: patch.promptVersion ?? 5,
  });
  assert.ok(result);
  return result;
}

function insightIdentity(
  scope: WeeklyAiCacheScope,
  patch: Partial<{
    fromDateKey: string;
    toDateKey: string;
    locale: "ko" | "en";
    facts: unknown;
    inputSchemaVersion: number;
    promptVersion: number;
  }> = {},
): WeeklyAiCacheIdentity {
  const result = createWeeklyAiCacheIdentity({
    operation: "insight_phrase",
    scope,
    fromDateKey: patch.fromDateKey ?? "2026-08-01",
    toDateKey: patch.toDateKey ?? "2026-08-28",
    locale: patch.locale ?? "ko",
    inputFacts: patch.facts ?? { relation: "lastFeed-sleep", differenceMinutes: 60, sampleDays: 18 },
    inputSchemaVersion: patch.inputSchemaVersion ?? 1,
    promptVersion: patch.promptVersion ?? 3,
  });
  assert.ok(result);
  return result;
}

assert.equal(
  weeklyAiInputFingerprint({ b: 2, a: [1, 3] }),
  weeklyAiInputFingerprint({ a: [1, 3], b: 2 }),
  "object key order must not change the facts fingerprint",
);
assert.notEqual(
  weeklyAiInputFingerprint({ a: [1, 3], b: 2 }),
  weeklyAiInputFingerprint({ a: [1, 4], b: 2 }),
  "changed input facts must invalidate the cache",
);

const baseIdentity = identity(scopeA);
assert.equal(baseIdentity.fromDateKey, "2025-12-27", "the full range keeps its start year");
assert.equal(baseIdentity.toDateKey, "2026-01-07", "the full range keeps its end year");
assert.notEqual(weeklyAiCacheIdentityKey(baseIdentity), weeklyAiCacheIdentityKey(identity(scopeB)));
assert.notEqual(weeklyAiCacheIdentityKey(baseIdentity), weeklyAiCacheIdentityKey(identity(scopeOtherAccount)));
assert.notEqual(
  weeklyAiCacheIdentityKey(baseIdentity),
  weeklyAiCacheIdentityKey(identity(scopeA, { fromDateKey: "2026-12-27", toDateKey: "2027-01-07" })),
  "a different year or full date range must not reuse the cache",
);
assert.notEqual(weeklyAiCacheIdentityKey(baseIdentity), weeklyAiCacheIdentityKey(identity(scopeA, { locale: "en" })));
assert.notEqual(weeklyAiCacheIdentityKey(baseIdentity), weeklyAiCacheIdentityKey(identity(scopeA, { facts: { sleep: 479 } })));
assert.notEqual(weeklyAiCacheIdentityKey(baseIdentity), weeklyAiCacheIdentityKey(identity(scopeA, { inputSchemaVersion: 2 })));
assert.notEqual(weeklyAiCacheIdentityKey(baseIdentity), weeklyAiCacheIdentityKey(identity(scopeA, { promptVersion: 6 })));
const otherOperationIdentity = createWeeklyAiCacheIdentity({
  ...baseIdentity,
  operation: "insight_phrase",
  scope: scopeA,
  inputFacts: { sleep: 480, feed: [6, 7] },
});
assert.ok(otherOperationIdentity);
assert.notEqual(
  weeklyAiCacheIdentityKey(baseIdentity),
  weeklyAiCacheIdentityKey(otherOperationIdentity),
  "narrative and insight caches must remain distinct",
);

const relationKey = "lastFeedMinutes-sleepMinutes";
const oldInsightIdentity = insightIdentity(scopeA);
const editedInsightIdentity = insightIdentity(scopeA, {
  facts: { relation: "lastFeed-sleep", differenceMinutes: 45, sampleDays: 18 },
});
const deletedLogInsightIdentity = insightIdentity(scopeA, {
  facts: { relation: "lastFeed-sleep", differenceMinutes: 45, sampleDays: 17 },
});
const englishInsightIdentity = insightIdentity(scopeA, {
  locale: "en",
  facts: { relation: "lastFeed-sleep", differenceMinutes: 45, sampleDays: 18 },
});
const ruleFallback = { [relationKey]: "규칙 기반 문장" };
const oldKoreanPhrases = { [relationKey]: "지난 기록에서는 60분 더 잤어요." };
let displayState: WeeklyAiDisplayState<Record<string, string>> | null = createWeeklyAiDisplayState(
  oldInsightIdentity,
  oldKoreanPhrases,
);

assert.deepEqual(getCurrentWeeklyAiDisplayValue(oldInsightIdentity, displayState), oldKoreanPhrases);
for (const changedIdentity of [
  editedInsightIdentity,
  deletedLogInsightIdentity,
  englishInsightIdentity,
  insightIdentity(scopeB),
  insightIdentity(scopeOtherAccount),
  insightIdentity(scopeA, { fromDateKey: "2026-08-02" }),
  insightIdentity(scopeA, { inputSchemaVersion: 2 }),
  insightIdentity(scopeA, { promptVersion: 4 }),
]) {
  assert.equal(
    getCurrentWeeklyAiDisplayValue(changedIdentity, displayState),
    null,
    "a displayed phrase from any different complete identity must be excluded immediately",
  );
}
assert.equal(getCurrentWeeklyAiDisplayValue(null, displayState), null, "deleting all insights hides old AI copy");

let releaseEditedRequest: ((phrases: Record<string, string>) => void) | null = null;
const delayedEditedRequest = runWeeklyAiRequestOnce(editedInsightIdentity, () => new Promise((resolve) => {
  releaseEditedRequest = resolve;
}));
assert.deepEqual(
  getCurrentWeeklyAiDisplayValue(editedInsightIdentity, displayState) ?? ruleFallback,
  ruleFallback,
  "the deterministic fallback remains visible while the new identity request is delayed",
);

displayState = createWeeklyAiDisplayState(oldInsightIdentity, {
  [relationKey]: "늦게 도착한 이전 문장",
});
assert.deepEqual(
  getCurrentWeeklyAiDisplayValue(editedInsightIdentity, displayState) ?? ruleFallback,
  ruleFallback,
  "a late response from the previous identity cannot become visible",
);

assert.ok(releaseEditedRequest);
const editedPhrases = { [relationKey]: "새 기록에서는 45분 더 잤어요." };
releaseEditedRequest(editedPhrases);
displayState = createWeeklyAiDisplayState(editedInsightIdentity, await delayedEditedRequest);
assert.deepEqual(
  getCurrentWeeklyAiDisplayValue(editedInsightIdentity, displayState),
  editedPhrases,
  "the new AI phrase appears only after the current identity request succeeds",
);

const failedPhrases = await runWeeklyAiRequestOnce(englishInsightIdentity, async () => ({}));
if (!Object.keys(failedPhrases).length) displayState = null;
assert.deepEqual(
  getCurrentWeeklyAiDisplayValue(englishInsightIdentity, displayState) ?? { [relationKey]: "Rule-based sentence" },
  { [relationKey]: "Rule-based sentence" },
  "an invalid or failed replacement keeps the localized rule fallback visible",
);

const storage = new MemoryStorage();
const baseKey = "qa:weekly-ai-cache";
const store = createScopedWeeklyAiCacheStore<string>({
  baseKey,
  isValue: (value): value is string => typeof value === "string",
});

storage.values.set(baseKey, JSON.stringify({ periodLabel: "legacy-without-scope", value: "unsafe" }));
assert.equal(await store.hydrate(scopeA, storage), true);
assert.equal(storage.values.has(baseKey), false, "legacy unscoped cache must be invalidated, not claimed");
assert.equal(await store.save(baseIdentity, "baby-a copy", storage), true);
assert.equal(store.get(baseIdentity), "baby-a copy");

assert.equal(await store.hydrate(scopeB, storage), true);
assert.equal(store.get(baseIdentity), null, "baby B cannot read baby A memory");
assert.equal(await store.save(baseIdentity, "stale baby-a copy", storage), false, "stale scope cannot save");
const babyBIdentity = identity(scopeB);
assert.equal(await store.save(babyBIdentity, "baby-b copy", storage), true);

assert.equal(await store.hydrate(scopeOtherAccount, storage), true);
assert.equal(store.get(baseIdentity), null, "another account cannot read account A memory");
assert.equal(store.get(babyBIdentity), null, "another account cannot read account A's other baby");

assert.equal(await store.hydrate(scopeA, storage), true);
assert.equal(store.get(baseIdentity), "baby-a copy", "the correct scoped cache remains reusable");
const editedFactsIdentity = identity(scopeA, { facts: { sleep: 479 } });
assert.equal(store.get(editedFactsIdentity), null, "edited or deleted source facts must miss the old cache");
assert.equal(await store.save(editedFactsIdentity, "edited copy", storage), true);
assert.equal(store.get(baseIdentity), "baby-a copy", "separate facts versions do not overwrite each other");
assert.equal(store.get(editedFactsIdentity), "edited copy");

storage.failNextRead = true;
const retryStore = createScopedWeeklyAiCacheStore<string>({
  baseKey: "qa:retry-cache",
  isValue: (value): value is string => typeof value === "string",
});
assert.equal(await retryStore.hydrate(scopeA, storage), false, "a failed read is not marked hydrated");
assert.equal(await retryStore.hydrate(scopeA, storage), true, "the same scope can retry after failure");
storage.failNextWrite = true;
assert.equal(
  await retryStore.save(baseIdentity, "write failure", storage),
  false,
  "a failed write must be reported to the caller",
);
assert.equal(
  await retryStore.save(baseIdentity, "write retry", storage),
  true,
  "the same scoped write can retry after failure",
);

const corruptBaseKey = "qa:corrupt-cache";
storage.values.set(weeklyAiCacheStorageKey(corruptBaseKey, scopeA), "{not-json");
const corruptStore = createScopedWeeklyAiCacheStore<string>({
  baseKey: corruptBaseKey,
  isValue: (value): value is string => typeof value === "string",
});
assert.equal(await corruptStore.hydrate(scopeA, storage), true, "invalid scoped JSON becomes an empty cache");
assert.equal(corruptStore.get(baseIdentity), null);
assert.equal(await corruptStore.save(baseIdentity, "recovered copy", storage), true);

const delayedStorage = new DelayedStorage();
const delayedBaseKey = "qa:delayed-cache";
const primer = createScopedWeeklyAiCacheStore<string>({
  baseKey: delayedBaseKey,
  isValue: (value): value is string => typeof value === "string",
});
assert.equal(await primer.hydrate(scopeB, delayedStorage), true);
assert.equal(await primer.save(babyBIdentity, "new scope copy", delayedStorage), true);

const raceStore = createScopedWeeklyAiCacheStore<string>({
  baseKey: delayedBaseKey,
  isValue: (value): value is string => typeof value === "string",
});
delayedStorage.delayedKey = weeklyAiCacheStorageKey(delayedBaseKey, scopeA);
const oldHydration = raceStore.hydrate(scopeA, delayedStorage);
const newHydration = raceStore.hydrate(scopeB, delayedStorage);
assert.equal(await newHydration, true);
delayedStorage.releaseDelayed();
assert.equal(await oldHydration, false, "late hydration from the old scope must be rejected");
assert.equal(raceStore.get(babyBIdentity), "new scope copy");

let calls = 0;
let releaseRequest: ((value: string) => void) | null = null;
const first = runWeeklyAiRequestOnce(baseIdentity, () => {
  calls += 1;
  return new Promise<string>((resolve) => {
    releaseRequest = resolve;
  });
});
const duplicate = runWeeklyAiRequestOnce(baseIdentity, async () => {
  calls += 1;
  return "duplicate";
});
assert.equal(first, duplicate, "identical in-flight identities share one Promise");
assert.equal(calls, 1);
assert.ok(releaseRequest);
releaseRequest("shared result");
assert.equal(await duplicate, "shared result");

await assert.rejects(
  runWeeklyAiRequestOnce(editedFactsIdentity, async () => {
    throw new Error("injected request failure");
  }),
);
let retryCalls = 0;
assert.equal(await runWeeklyAiRequestOnce(editedFactsIdentity, async () => {
  retryCalls += 1;
  return "retry result";
}), "retry result");
assert.equal(retryCalls, 1, "a failed request must leave no in-flight lock");

console.log("Weekly AI cache scope smoke passed");
