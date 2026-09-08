import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { discardAudioFile, isDisposableAudioUri } from "../src/utils/audioFileLifecycle.ts";
import {
  createVoiceOperationCoordinator,
  createVoiceRequestGate,
  isVoiceRequestScopeCurrent,
  type VoiceScopeSnapshot,
} from "../src/utils/voiceRequestScope.ts";

const babyA: VoiceScopeSnapshot = { accountId: "account-x", babyId: "baby-a", locale: "ko", timezone: "Asia/Seoul" };
const babyB: VoiceScopeSnapshot = { ...babyA, babyId: "baby-b" };
const accountY: VoiceScopeSnapshot = { ...babyA, accountId: "account-y" };

// 1 & 2. Baby/account switches make the originating request stale.
{
  const gate = createVoiceRequestGate();
  const request = gate.begin(babyA, new Date("2026-09-07T00:00:00Z"), "request-a");
  assert.equal(gate.isActive(request, babyA), true);
  assert.equal(gate.isActive(request, babyB), false);
  assert.equal(gate.isActive(request, accountY), false);
}

// Native recorder startup and cancellation are serialized. Duplicate cancel runs cleanup once.
{
  const coordinator = createVoiceOperationCoordinator();
  let releaseStart!: () => void;
  let cancelCleanupCalls = 0;
  const start = coordinator.runStart(() => new Promise<void>((resolve) => { releaseStart = resolve; }));
  const cancel = coordinator.runCancel(async () => { cancelCleanupCalls += 1; });
  const duplicateCancel = coordinator.runCancel(async () => { cancelCleanupCalls += 1; });
  await Promise.resolve();
  assert.equal(cancelCleanupCalls, 0);
  releaseStart();
  await Promise.all([start, cancel, duplicateCancel]);
  assert.equal(cancelCleanupCalls, 1);
}

// A start queued behind cancellation is invalidated by a newer cancel instead of reopening audio.
{
  const coordinator = createVoiceOperationCoordinator();
  let releaseCancel!: () => void;
  let starts = 0;
  const cancel = coordinator.runCancel(() => new Promise<void>((resolve) => { releaseCancel = resolve; }));
  const staleStart = coordinator.runStart(async () => { starts += 1; });
  const duplicateCancel = coordinator.runCancel(async () => undefined);
  releaseCancel();
  await Promise.all([cancel, duplicateCancel, staleStart]);
  assert.equal(starts, 0);
  await coordinator.runStart(async () => { starts += 1; });
  assert.equal(starts, 1);
}

// A deliberate reopen during cancellation starts once the previous recorder has been cleaned up.
{
  const coordinator = createVoiceOperationCoordinator();
  let releaseStart!: () => void;
  let starts = 0;
  const oldStart = coordinator.runStart(() => new Promise<void>((resolve) => { releaseStart = resolve; }));
  const cancel = coordinator.runCancel(async () => undefined);
  const reopenedStart = coordinator.runStart(async () => { starts += 1; });
  const duplicateReopen = coordinator.runStart(async () => { starts += 1; });
  releaseStart();
  await Promise.all([oldStart, cancel, reopenedStart, duplicateReopen]);
  assert.equal(starts, 1);
}

// 3. Cancel permanently rejects a late result.
{
  const gate = createVoiceRequestGate();
  const request = gate.begin(babyA, undefined, "cancelled");
  gate.cancel();
  assert.equal(gate.isActive(request, babyA), false);
}

// 4. A newer request owns the gate; late A cannot overwrite B.
{
  const gate = createVoiceRequestGate();
  const requestA = gate.begin(babyA, undefined, "a");
  const requestB = gate.begin(babyA, undefined, "b");
  assert.equal(gate.isActive(requestA, babyA), false);
  assert.equal(gate.isActive(requestB, babyA), true);
}

// 5 & 6. Current success remains valid; a failure does not reactivate older work.
{
  const gate = createVoiceRequestGate();
  const request = gate.begin(babyA, undefined, "current");
  assert.equal(gate.isActive(request, babyA), true);
  gate.cancel();
  assert.equal(gate.isActive(request, babyA), false);
}

// 7. Confirmation is accepted only against the immutable originating scope.
{
  const gate = createVoiceRequestGate();
  const request = gate.begin(babyA, undefined, "confirm");
  assert.equal(isVoiceRequestScopeCurrent(request, babyA), true);
  assert.equal(isVoiceRequestScopeCurrent(request, babyB), false);
}

// 8. Recorder file URIs are physically unlinked with idempotent deletion.
{
  const deletions: Array<{ uri: string; idempotent: boolean }> = [];
  assert.equal(isDisposableAudioUri("file:///cache/recording.m4a"), true);
  assert.equal(isDisposableAudioUri("https://example.com/recording.m4a"), false);
  assert.equal(await discardAudioFile("file:///cache/recording.m4a", async (uri, options) => {
    deletions.push({ uri, idempotent: options.idempotent });
  }), true);
  assert.deepEqual(deletions, [{ uri: "file:///cache/recording.m4a", idempotent: true }]);
  assert.equal(await discardAudioFile("content://recording", async () => {
    throw new Error("must not run");
  }), false);
}

const provider = readFileSync("src/context/VoiceRecordingContext.tsx", "utf8");
const overlay = readFileSync("src/components/babylog/BabyLogVoiceOverlay.tsx", "utf8");
const tabs = readFileSync("src/screens/MainTabs.tsx", "utf8");
assert.match(provider, /requestGateRef\.current\.isActive\(request, currentScopeRef\.current\)/);
assert.match(provider, /const result = await transcribeRecording[\s\S]*if \(!isRequestActive\(request\)\)/);
assert.match(provider, /requestGateRef\.current\.cancel\(\)/);
assert.match(provider, /operationCoordinatorRef\.current\.runCancel/);
assert.match(provider, /if \(recordingRef\.current === recording\) recordingRef\.current = null/);
assert.match(provider, /FileSystem\.deleteAsync/);
assert.match(overlay, /requestScope: VoiceRequestScope/);
assert.match(tabs, /isVoiceRequestScopeCurrent\(requestScope, currentVoiceScope\)/);
assert.match(tabs, /addLogs\(stageEvents\.map/);

console.log("Voice request scope smoke passed");
