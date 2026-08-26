import assert from "node:assert/strict";
import {
  currentClaimMatches,
  emptyCounts,
  expoDeliveryStatus,
  finalStateStatus,
  genericEventStatus,
  inQuietHours,
  unavailableTokenStatus,
} from "../supabase/functions/process-care-reminders/deliveryPolicy.ts";

assert.equal(unavailableTokenStatus(0, 0), "skipped_no_token");
assert.equal(unavailableTokenStatus(2, 0), "skipped_permission_or_disabled");
assert.equal(unavailableTokenStatus(2, 1), null);
assert.equal(expoDeliveryStatus(1, 1, 2), "sent");
assert.equal(expoDeliveryStatus(0, 2, 2), "failed_permanent");
assert.equal(expoDeliveryStatus(0, 0, 2), "failed_retryable");
assert.equal(genericEventStatus("failed_retryable"), "failed");
assert.equal(genericEventStatus("skipped_quiet_hours"), "skipped");

const counts = emptyCounts();
counts.skipped_no_token = 2;
assert.equal(finalStateStatus(counts), "processed");
counts.sent = 1;
assert.equal(finalStateStatus(counts), "sent");
counts.failed_retryable = 1;
assert.equal(finalStateStatus(counts), "scheduled");

const laMorning = new Date("2026-08-25T14:30:00.000Z");
const laNight = new Date("2026-08-25T07:30:00.000Z");
assert.equal(inQuietHours(laMorning, "America/Los_Angeles", "22:00", "07:00"), false);
assert.equal(inQuietHours(laNight, "America/Los_Angeles", "22:00", "07:00"), true);
assert.equal(inQuietHours(laNight, "Invalid/Timezone", "22:00", "07:00"), false);

const claim = { version: 7, lastRelevantLogId: "log-a", processingStartedAt: "2026-08-25T10:00:00Z" };
const current = { version: 7, lastRelevantLogId: "log-a", processingStartedAt: "2026-08-25T10:00:00Z", sendStatus: "scheduled" };
assert.equal(currentClaimMatches(claim, current, true), true);
assert.equal(currentClaimMatches(claim, { ...current, version: 8 }, true), false);
assert.equal(currentClaimMatches(claim, { ...current, lastRelevantLogId: "log-b" }, true), false);
assert.equal(currentClaimMatches(claim, current, false), false);

console.log("care reminder worker policy smoke passed");
