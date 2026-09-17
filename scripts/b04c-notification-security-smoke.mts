import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { queuePushTokenOperation } from "../src/utils/pushTokenOperationQueue.ts";
import {
  canActorInteractWithMemory,
  dedupeRecipients,
  deriveMemoryRecipients,
  isClientEventType,
  isFreshResource,
  providerFailureCode,
  safeRouteData,
} from "../supabase/functions/send-push-notification/securityPolicy.ts";

const migration = readFileSync("supabase/migrations/202609160001_b04c_notification_security.sql", "utf8");
const push = readFileSync("supabase/functions/send-push-notification/index.ts", "utf8");
const reminder = readFileSync("supabase/functions/process-care-reminders/index.ts", "utf8");
const repository = readFileSync("src/repositories/NotificationRepository.ts", "utf8");
const memories = readFileSync("src/repositories/MemoriesRepository.ts", "utf8");
const pushLifecycle = readFileSync("src/utils/pushNotifications.ts", "utf8");
const app = readFileSync("App.tsx", "utf8");

const operationOrder: string[] = [];
let releaseFirst: (() => void) | undefined;
const firstBarrier = new Promise<void>((resolve) => { releaseFirst = resolve; });
const firstOperation = queuePushTokenOperation(async () => {
  operationOrder.push("register-start");
  await firstBarrier;
  operationOrder.push("register-end");
});
const secondOperation = queuePushTokenOperation(async () => { operationOrder.push("logout-revoke"); });
await Promise.resolve();
assert.deepEqual(operationOrder, ["register-start"]);
releaseFirst?.();
await Promise.all([firstOperation, secondOperation]);
assert.deepEqual(operationOrder, ["register-start", "register-end", "logout-revoke"]);

for (const [name, source] of [["push", push], ["reminder", reminder]] as const) {
  const parsed = ts.createSourceFile(`${name}.ts`, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  assert.deepEqual(parsed.parseDiagnostics, [], `${name} worker must parse as TypeScript`);
}

assert.equal(isClientEventType("new_diary"), true);
assert.equal(isClientEventType("family_joined"), false);
assert.equal(isClientEventType("daily_summary"), false);
assert.equal(isClientEventType("arbitrary"), false);
assert.equal(isFreshResource("2026-09-16T12:00:00.000Z", Date.parse("2026-09-16T12:10:00.000Z")), true);
assert.equal(isFreshResource("2026-09-16T11:00:00.000Z", Date.parse("2026-09-16T12:10:00.000Z")), false);
assert.deepEqual(dedupeRecipients([
  "00000000-0000-4000-8000-000000000002",
  "00000000-0000-4000-8000-000000000001",
  "00000000-0000-4000-8000-000000000002",
], "00000000-0000-4000-8000-000000000001"), ["00000000-0000-4000-8000-000000000002"]);
assert.deepEqual(safeRouteData("new_diary", {
  babyId: "10000000-0000-4000-8000-000000000001",
  targetId: "20000000-0000-4000-8000-000000000001",
}), {
  route: "diary",
  babyId: "10000000-0000-4000-8000-000000000001",
  diaryEntryId: "20000000-0000-4000-8000-000000000001",
});
assert.equal(providerFailureCode(), "provider_request_failed");

const admin = "00000000-0000-4000-8000-000000000001";
const editor = "00000000-0000-4000-8000-000000000002";
const viewer = "00000000-0000-4000-8000-000000000003";
const friend = "00000000-0000-4000-8000-000000000004";
const removed = "00000000-0000-4000-8000-000000000005";
const unrelated = "00000000-0000-4000-8000-000000000006";
const baseAudience = {
  privacyType: "family_circle", postAuthorId: admin,
  memberIds: [admin, editor, viewer], editorIds: [admin, editor], friendIds: [friend],
  taggedIds: [] as string[], selectedIds: [] as string[],
};
assert.equal(canActorInteractWithMemory(baseAudience, viewer), false);
assert.equal(canActorInteractWithMemory(baseAudience, editor), true);
assert.deepEqual(deriveMemoryRecipients(baseAudience, editor), [admin, viewer]);
const friendAudience = { ...baseAudience, privacyType: "friend_circle" };
assert.equal(canActorInteractWithMemory(friendAudience, friend), true);
assert.deepEqual(deriveMemoryRecipients(friendAudience, friend), [admin, editor, viewer]);
const taggedAudience = { ...baseAudience, privacyType: "tagged_family", taggedIds: [editor, removed] };
assert.equal(canActorInteractWithMemory(taggedAudience, editor), true);
assert.deepEqual(deriveMemoryRecipients(taggedAudience, editor), [admin]);
const selectedAudience = { ...baseAudience, privacyType: "selected_people", selectedIds: [editor, friend, unrelated] };
assert.equal(canActorInteractWithMemory(selectedAudience, friend), true);
assert.deepEqual(deriveMemoryRecipients(selectedAudience, friend), [admin, editor]);
assert.equal(canActorInteractWithMemory(selectedAudience, unrelated), false);
assert.equal(deriveMemoryRecipients({ ...baseAudience, privacyType: "only_me" }, admin).length, 0);

assert.doesNotMatch(push, /routeData\?:/);
assert.doesNotMatch(push, /body\.routeData/);
assert.match(push, /resolveClientDispatch\(service, auth\.user\.id, body\)/);
assert.match(push, /data\.created_by !== actorId/);
assert.match(push, /data\.author_id !== actorId/);
assert.match(push, /recipient_or_resource_stale/);
assert.match(push, /claimEvent\(service, event\.id, recipientId\)/);
assert.match(push, /PRIVATE_BODY/);
assert.doesNotMatch(push, /error_message: String\(error\)/);
assert.doesNotMatch(push, /console\.(?:log|error).*expo_push_token/);

assert.match(reminder, /assertCurrentRecipient/);
assert.match(reminder, /recipient_no_longer_authorized/);
assert.match(reminder, /claim_notification_event_dispatch/);
assert.match(reminder, /deliveryStatus = "failed_permanent"/);
assert.doesNotMatch(reminder, /console\.error\([^\n]*member\.user_id/);

assert.match(migration, /register_current_push_token/);
assert.match(migration, /v_user_id uuid := auth\.uid\(\)/);
assert.match(migration, /extensions\.digest\(p_installation_secret, 'sha256'\)/);
assert.match(migration, /where installation_secret_hash is null/);
assert.match(migration, /installation_secret_hash is distinct from v_secret_hash[\s\S]*raise exception 'push token ownership conflict'/);
assert.match(migration, /delete from public\.push_tokens[\s\S]*installation_secret_hash = v_secret_hash/);
assert.doesNotMatch(migration, /installation_secret_hash = v_secret_hash or disabled_at is not null/);
assert.match(migration, /revoke insert, update, delete on table public\.push_tokens from authenticated/);
assert.match(migration, /status = 'dispatching'[\s\S]*attempt_count = 1/);
assert.match(migration, /status = 'pending'[\s\S]*attempt_count = 0[\s\S]*expires_at > now\(\)/);
assert.match(migration, /case[\s\S]*data->>'memoryPostId'[\s\S]*public\.can_view_memory_post\(\(data->>'memoryPostId'\)::uuid\)[\s\S]*else false/);

assert.match(repository, /rpc\("register_current_push_token"/);
assert.match(push, /eventType, babyId: body\.babyId, targetId: body\.babyId, actorId/);
assert.doesNotMatch(push, /results\.push\(\{ recipientId/);
assert.doesNotMatch(push, /error: (?:inviteError|eventError|tokenError)\.message/);
assert.match(repository, /rpc\("unregister_current_push_token"/);
assert.doesNotMatch(repository, /from\("push_tokens"\)\.upsert/);
assert.match(repository, /captureSessionScope\(\)/);
assert.match(repository, /await scope\.assertCurrent\(\)/);
assert.match(repository, /scope\.client\.rpc\("unregister_current_push_token"/);
assert.match(pushLifecycle, /queuePushTokenOperation/);
assert.match(pushLifecycle, /if \(deviceId\) await NotificationRepository\.unregisterToken\(deviceId\)/);
assert.match(app, /await unregisterCurrentPushToken\(\);[\s\S]*await prepareForLogout\(\)/);
assert.match(memories, /targetId: reaction\.id/);

console.log("B0.4c notification security smoke passed");
