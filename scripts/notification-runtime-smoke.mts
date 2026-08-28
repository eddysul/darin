import assert from "node:assert/strict";
import {
  inQuietHours,
  isExpoPushToken,
  localeFor,
  summarizeExpoPushResponse,
} from "../supabase/functions/_shared/notificationRuntime.ts";

assert.equal(localeFor("ja"), "ja");
assert.equal(localeFor("unsupported"), "ko");
assert.equal(isExpoPushToken("ExponentPushToken[test]"), true);
assert.equal(isExpoPushToken("not-a-token"), false);
assert.equal(inQuietHours(new Date("2026-08-28T06:30:00Z"), "UTC", "22:00", "07:00"), true);
assert.equal(inQuietHours(new Date("2026-08-28T12:00:00Z"), "UTC", "22:00", "07:00"), false);

const summary = summarizeExpoPushResponse(true, { data: [
  { status: "ok" },
  { status: "error", details: { error: "DeviceNotRegistered" } },
] });
assert.equal(summary.successCount, 1);
assert.deepEqual(summary.deviceNotRegisteredIndexes, [1]);

console.log("Shared notification runtime smoke passed");

