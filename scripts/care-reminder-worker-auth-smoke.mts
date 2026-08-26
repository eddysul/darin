import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const worker = readFileSync("supabase/functions/process-care-reminders/index.ts", "utf8");
const schedule = readFileSync("supabase/migrations/202608220002_schedule_care_reminders.sql", "utf8");
const runbook = readFileSync("docs/qa/CARE-REMINDER-QA-SETUP.md", "utf8");

assert.match(worker, /!url \|\| !serviceKey \|\| !cronSecret/);
assert.match(worker, /request\.headers\.get\("x-cron-secret"\) !== cronSecret/);
assert.doesNotMatch(worker, /Bearer \$\{serviceKey\}/);
assert.match(schedule, /'x-cron-secret'/);
assert.match(schedule, /care_reminder_cron_secret/);
assert.doesNotMatch(schedule, /service_role_key/);
assert.match(runbook, /--no-verify-jwt/);

console.log("care reminder worker auth smoke passed");
