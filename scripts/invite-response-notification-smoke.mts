import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const rpc = readFileSync("supabase/migrations/202608170004_darin_invite_response_ambiguity.sql", "utf8");
const push = readFileSync("supabase/functions/send-push-notification/index.ts", "utf8");
const notificationRuntime = readFileSync("supabase/functions/_shared/notificationRuntime.ts", "utf8");
const repository = readFileSync("src/repositories/FamilyRepository.ts", "utf8");

assert.match(rpc, /v_request\.sender_id[\s\S]*'family_joined'/);
assert.match(rpc, /v_request\.sender_id[\s\S]*'invite_declined'/);
assert.match(rpc, /'darin-invite-response:' \|\| v_request\.id::text/g);

assert.match(push, /action: "sendToBabyMembers" \| "sendToUser" \| "sendInviteResponse"/);
assert.match(push, /invite\.receiver_id !== actorId/);
assert.match(push, /\["accepted", "declined"\]\.includes\(invite\.status\)/);
assert.match(push, /darin-invite-response:\$\{invite\.id\}/);
assert.match(push, /event\.status === "sent"/);
assert.match(push, /invite_activity_enabled !== false/);
assert.match(push, /no_active_token/);
assert.match(notificationRuntime, /DeviceNotRegistered/);
assert.match(notificationRuntime, /AbortSignal\.timeout\(10_000\)/);

assert.match(repository, /action: "sendInviteResponse", targetId: requestId/);
assert.match(repository, /void sb\.functions\.invoke/);
assert.match(repository, /if \(push\.error\) console\.warn/);
console.log("invite response notification smoke passed");
