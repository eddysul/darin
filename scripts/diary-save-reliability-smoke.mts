import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createDiarySaveCoordinator } from "../src/utils/diarySaveTransaction.ts";
import { isUnownedEagerMedia } from "../src/utils/eagerMediaOwnership.ts";
import { createKeyedAsyncQueue } from "../src/utils/keyedAsyncQueue.ts";

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

// 1. Success: draft persistence precedes server persistence, and cleanup is last.
{
  const order: string[] = [];
  const coordinator = createDiarySaveCoordinator();
  const result = await coordinator.run({
    preserveDraft: async () => { order.push("draft"); },
    persist: async () => { order.push("server"); return true; },
    isCurrent: () => true,
    clearPersistedDraft: async () => { order.push("clear"); return true; },
  });
  assert.equal(result, "saved");
  assert.deepEqual(order, ["draft", "server", "clear"]);
}

// 2. Server failure keeps the draft and never enters cleanup.
{
  let cleared = false;
  const coordinator = createDiarySaveCoordinator();
  const result = await coordinator.run({
    preserveDraft: async () => undefined,
    persist: async () => false,
    isCurrent: () => true,
    clearPersistedDraft: async () => { cleared = true; return true; },
  });
  assert.equal(result, "failed");
  assert.equal(cleared, false);
}

// 3 & 4. A delayed request does not clear early and a duplicate tap is rejected.
{
  let release!: (value: boolean) => void;
  let cleared = false;
  let persistCalls = 0;
  const coordinator = createDiarySaveCoordinator();
  const first = coordinator.run({
    preserveDraft: async () => undefined,
    persist: async () => {
      persistCalls += 1;
      return new Promise<boolean>((resolve) => { release = resolve; });
    },
    isCurrent: () => true,
    clearPersistedDraft: async () => { cleared = true; return true; },
  });
  await tick();
  assert.equal(cleared, false);
  const duplicate = await coordinator.run({
    preserveDraft: async () => undefined,
    persist: async () => { persistCalls += 1; return true; },
    isCurrent: () => true,
    clearPersistedDraft: async () => true,
  });
  assert.equal(duplicate, "duplicate");
  assert.equal(persistCalls, 1);
  release(true);
  assert.equal(await first, "saved");
}

// 5. A failed attempt releases the guard so the same draft can be retried.
{
  let attempts = 0;
  const coordinator = createDiarySaveCoordinator();
  const input = {
    preserveDraft: async () => undefined,
    persist: async () => (++attempts === 2),
    isCurrent: () => true,
    clearPersistedDraft: async () => true,
  };
  assert.equal(await coordinator.run(input), "failed");
  assert.equal(await coordinator.run(input), "saved");
  assert.equal(attempts, 2);
}

// 6. A newer draft superseding the saved snapshot is not removed.
{
  const coordinator = createDiarySaveCoordinator();
  assert.equal(await coordinator.run({
    preserveDraft: async () => undefined,
    persist: async () => true,
    isCurrent: () => true,
    clearPersistedDraft: async () => false,
  }), "superseded");
}

// 7. Scope/navigation changes near a late completion cannot clear or report success.
{
  let current = true;
  let release!: (value: boolean) => void;
  let cleared = false;
  const coordinator = createDiarySaveCoordinator();
  const pending = coordinator.run({
    preserveDraft: async () => undefined,
    persist: async () => new Promise<boolean>((resolve) => { release = resolve; }),
    isCurrent: () => current,
    clearPersistedDraft: async () => { cleared = true; return true; },
  });
  await tick();
  current = false;
  release(true);
  assert.equal(await pending, "stale");
  assert.equal(cleared, false);
}

// 8. A cleanup already in progress cannot overtake and delete a newer write.
{
  const queue = createKeyedAsyncQueue();
  const order: string[] = [];
  let release!: () => void;
  const first = queue.run("account-x:baby-a", async () => {
    order.push("clear:start");
    await new Promise<void>((resolve) => { release = resolve; });
    order.push("clear:end");
  });
  const second = queue.run("account-x:baby-a", async () => {
    order.push("save:new");
  });
  await tick();
  assert.deepEqual(order, ["clear:start"]);
  release();
  await Promise.all([first, second]);
  assert.deepEqual(order, ["clear:start", "clear:end", "save:new"]);
}

// 9. Media already attached to a persistent owner is never temp-session cleanup.
{
  assert.equal(isUnownedEagerMedia({}), true);
  assert.equal(isUnownedEagerMedia({ diaryEntryId: "diary-1" }), false);
  assert.equal(isUnownedEagerMedia({ memoryPostId: "memory-1" }), false);
}

const diaryScreen = readFileSync("src/screens/tabs/DiaryScreen.tsx", "utf8");
const draftStore = readFileSync("src/utils/diaryDraftStore.ts", "utf8");
const compose = readFileSync("src/components/babylog/DiaryComposeModal.tsx", "utf8");
const context = readFileSync("src/context/BabyLogContext.tsx", "utf8");
const diaryToday = readFileSync("src/utils/diaryToday.ts", "utf8");
const eagerMedia = readFileSync("src/utils/eagerMediaUpload.ts", "utf8");
assert.match(diaryScreen, /createDiarySaveCoordinator/);
assert.match(diaryScreen, /await waitForEagerPhotosToSettle\(draft\.photos\)/);
assert.match(diaryScreen, /preserveDraft:[\s\S]*persist:[\s\S]*fullyPersisted/);
assert.match(diaryScreen, /clearDiaryDraft\(requestScope, \{[\s\S]*updatedAt: persistedDraft\.updatedAt/);
assert.match(draftStore, /draft\.updatedAt === expected\.updatedAt/);
assert.match(draftStore, /storageMutations\.run\(key/);
assert.match(draftStore, /activeScopeId === scopeId/);
assert.match(draftStore, /targetDiaryId/);
assert.match(diaryToday, /input\.draft\.targetDiaryId === saved\.id/);
assert.match(compose, /initialDraft \?\? entryToComposeDraft\(editingEntry\)/);
assert.match(compose, /const saved = await onSave\(draft\)/);
assert.match(compose, /initializedComposeRef\.current === composeKey/);
assert.match(compose, /dirtySignature\(\) === savingDraftSignatureRef\.current/);
assert.match(diaryScreen, /targetDiaryId: editingEntry\?\.id/);
assert.match(diaryScreen, /composeScopeKeyRef\.current !== localDataScopeKey/);
assert.match(compose, /if \(!saved\)[\s\S]*saveFailed/);
assert.match(context, /photoUploadFailed === 0/);
assert.match(eagerMedia, /job\.sessionId === sessionId && isUnownedEagerMedia\(job\)/);

console.log("Diary save reliability smoke passed");
