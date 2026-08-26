import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { elapsedMinutesSince, feedingReminderProgress, feedingReminderStatusKey } from "../src/utils/careReminderStatus.ts";

const migration = [
  readFileSync("supabase/migrations/202608220001_care_reminders.sql", "utf8"),
  readFileSync("supabase/migrations/202608260002_build17_sleep_reminders_and_notification_locale.sql", "utf8"),
].join("\n");
const worker = readFileSync("supabase/functions/process-care-reminders/index.ts", "utf8");
const workerPolicy = readFileSync("supabase/functions/process-care-reminders/deliveryPolicy.ts", "utf8");
const workerSources = `${worker}\n${workerPolicy}`;
const schedule = readFileSync("supabase/migrations/202608220002_schedule_care_reminders.sql", "utf8");
const ui = readFileSync("src/components/babylog/FeedingReminderSettingsCard.tsx", "utf8");

assert.match(migration, /unique \(baby_id, reminder_type\)/);
assert.match(migration, /interval_minutes between 15 and 720/);
assert.match(migration, /array\['breast', 'formula', 'storedMilk'\]/);
assert.doesNotMatch(migration, /array\[[^\]]*'pump'/);
assert.match(migration, /care_reminder_feed_at/);
assert.match(migration, /overdue_not_scheduled/);
assert.match(migration, /after insert or update or delete on public\.care_logs/);
assert.match(migration, /baby_permission\(baby_id\) in \('admin', 'editor'\)/);
assert.match(migration, /user_id = auth\.uid\(\) and public\.is_baby_member\(baby_id\)/);
assert.match(migration, /claim_due_care_reminders/);
assert.match(migration, /feeding_reminder/);
assert.match(migration, /sleep_reminder/);
assert.match(migration, /care_reminder_log_at/);
assert.match(migration, /p_reminder_type = 'sleep' and l\.category = 'sleep'/);
assert.match(migration, /s\.reminder_type in \('feeding', 'sleep'\)/);
assert.match(migration, /localize_notification_event_copy/);

assert.match(workerSources, /skipped_quiet_hours/);
assert.match(workerSources, /skipped_no_token/);
assert.match(workerSources, /skipped_permission_or_disabled/);
assert.match(workerSources, /failed_retryable/);
assert.match(workerSources, /failed_permanent/);
assert.match(worker, /const dedupeKey = `\$\{eventType\}:\$\{state\.baby_id\}:\$\{state\.last_relevant_log_id\}:\$\{state\.version\}:\$\{member\.user_id\}`/);
assert.doesNotMatch(worker, /member\.user_id !==/);
assert.match(worker, /DeviceNotRegistered/);
assert.match(worker, /delivery_enabled/);
assert.match(worker, /currentClaimMatches/);
assert.match(workerPolicy, /current\.version === claim\.version/);
assert.match(workerPolicy, /current\.lastRelevantLogId === claim\.lastRelevantLogId/);
assert.match(workerPolicy, /current\.processingStartedAt === claim\.processingStartedAt/);
assert.match(workerPolicy, /current && enabled && current\.sendStatus === "scheduled"/);
assert.match(worker, /await assertCurrentDelivery\(\);\s*let deliveryStatus/);
assert.match(worker, /AbortSignal\.timeout\(10_000\)/);
assert.match(worker, /retryScheduled = counts\.failed_retryable > 0/);
assert.match(worker, /REMINDER_COPY\[localeFor\(profile\?\.preferred_language\)\]\[state\.reminder_type\]/);
assert.match(schedule, /process-care-reminders-every-minute/);
assert.match(schedule, /care_reminder_cron_secret/);
assert.doesNotMatch(schedule, /service_role_key/);

const now = new Date("2026-08-22T12:00:00.000Z");
assert.equal(feedingReminderProgress("2026-08-22T11:00:00.000Z", 180, now), 1 / 3);
assert.equal(feedingReminderStatusKey(0.39), "recent");
assert.equal(feedingReminderStatusKey(0.4), "comfortable");
assert.equal(feedingReminderStatusKey(0.8), "soon");
assert.equal(feedingReminderStatusKey(1), "due");
assert.equal(elapsedMinutesSince("2026-08-22T10:30:00.000Z", now), 90);

const prohibited = ["아기가 배고파요", "배불러요", "수유가 부족해요", "충분히 먹었어요", "반드시 먹이세요", "너무 적게 잤어요", "많이 잤어요", "깨워야 해요"];
for (const phrase of prohibited) {
  assert.ok(!worker.includes(phrase), `worker contains prohibited copy: ${phrase}`);
  assert.ok(!ui.includes(phrase), `UI contains prohibited copy: ${phrase}`);
}

console.log("care reminder QA smoke passed");
