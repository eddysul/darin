import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const source = readFileSync("supabase/functions/send-push-notification/index.ts", "utf8");
const sharedSource = readFileSync("supabase/functions/_shared/notificationRuntime.ts", "utf8");
const parsed = ts.createSourceFile(
  "send-push-notification/index.ts",
  source,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TS,
);
assert.deepEqual(parsed.parseDiagnostics, [], "send-push-notification must parse as TypeScript");

assert.match(source, /NOTIFICATION_SETTINGS_COLUMNS/);
assert.doesNotMatch(source, /from\("notification_settings"\)\.select\("\*"\)/);
assert.match(source, /settingsResult\.error \|\| profileResult\.error/);
assert.match(source, /error_message: "recipient_preferences_unavailable"/);
assert.match(source, /error: tokenError/);
assert.match(source, /error_message: "push_token_lookup_failed"/);
assert.ok((source.match(/if \(!validTokens\.length\)/g) ?? []).length >= 2);
assert.match(source, /validTokens\[index\]\.id/);
assert.doesNotMatch(source, /tokens\[index\]\.id/);
assert.ok((source.match(/sendExpoPush\(/g) ?? []).length >= 2);
assert.match(sharedSource, /AbortSignal\.timeout\(10_000\)/);
assert.match(sharedSource, /DeviceNotRegistered/);

console.log("push notification worker smoke passed");
