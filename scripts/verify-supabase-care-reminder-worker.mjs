import { cleanupQaAccounts, createAdminClient, createQaAccounts } from "./lib/qa-auth.mjs";
import { assertQaProjectRef } from "./lib/qa-project-config.mjs";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const cronSecret = process.env.CARE_REMINDER_CRON_SECRET?.trim();
if (!url || !cronSecret) throw new Error("Missing QA worker environment");
assertQaProjectRef(url, "worker URL");

const accounts = await createQaAccounts([
  "CareWorkerOwner", "CareWorkerEditor", "CareWorkerViewer", "CareWorkerFriend",
]);
const [owner, editor, viewer, friend] = accounts;
const admin = createAdminClient();
let babyId = null;

function utcQuietWindow() {
  const now = new Date();
  const current = now.getUTCHours() * 60 + now.getUTCMinutes();
  const format = (minutes) => {
    const normalized = (minutes + 1440) % 1440;
    return `${String(Math.floor(normalized / 60)).padStart(2, "0")}:${String(normalized % 60).padStart(2, "0")}:00`;
  };
  return { start: format(current - 5), end: format(current + 5) };
}

async function invokeWorker() {
  const response = await fetch(`${url}/functions/v1/process-care-reminders`, {
    method: "POST",
    headers: { "x-cron-secret": cronSecret },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body) throw new Error(`worker HTTP ${response.status}`);
  return body;
}

try {
  const { data: baby, error: babyError } = await owner.sb.rpc("create_baby_with_owner", {
    p_name: `Worker QA ${Date.now()}`,
    p_child_status: "newborn",
    p_relationship_label: "보호자",
  });
  if (babyError || !baby?.id) throw babyError ?? new Error("baby creation failed");
  babyId = baby.id;

  for (const [account, role] of [[editor, "editor"], [viewer, "viewer"]]) {
    const { error } = await owner.sb.from("baby_members").insert({
      baby_id: babyId,
      user_id: account.user.id,
      permission_role: role,
      relationship_label: "가족",
      status: "active",
    });
    if (error) throw error;
  }
  const { error: friendError } = await owner.sb.from("memory_friends").insert({
    baby_id: babyId,
    user_id: friend.user.id,
    invited_by: owner.user.id,
    status: "active",
  });
  if (friendError) throw friendError;

  const { error: settingError } = await owner.sb.from("care_reminder_settings").insert({
    baby_id: babyId,
    reminder_type: "feeding",
    enabled: true,
    interval_minutes: 15,
    included_log_types: ["breast", "formula", "storedMilk"],
    updated_by: owner.user.id,
  });
  if (settingError) throw settingError;

  const quiet = utcQuietWindow();
  const { error: quietError } = await editor.sb.from("care_reminder_member_preferences").update({
    delivery_enabled: true,
    quiet_hours_enabled: true,
    quiet_start: quiet.start,
    quiet_end: quiet.end,
    timezone: "UTC",
    user_modified_at: new Date().toISOString(),
  }).eq("baby_id", babyId).eq("user_id", editor.user.id).eq("reminder_type", "feeding");
  if (quietError) throw quietError;

  const recordedAt = new Date();
  const { data: log, error: logError } = await owner.sb.from("care_logs").insert({
    baby_id: babyId,
    client_generated_id: `worker-${crypto.randomUUID()}`,
    category: "formula",
    recorded_at: recordedAt.toISOString(),
    date_key: recordedAt.toISOString().slice(0, 10),
    time_local: recordedAt.toISOString().slice(11, 16),
    payload: {},
    source: "manual",
    created_by: owner.user.id,
  }).select("id").single();
  if (logError || !log) throw logError ?? new Error("care log creation failed");

  const { data: dueState, error: dueError } = await admin.from("care_reminder_state").update({
    next_due_at: new Date(Date.now() - 60_000).toISOString(),
    send_status: "scheduled",
    processing_started_at: null,
  }).eq("baby_id", babyId).eq("reminder_type", "feeding").select("id").single();
  if (dueError || !dueState) throw dueError ?? new Error("due state missing");

  const first = await invokeWorker();
  const result = first.results?.find((candidate) => candidate.stateId === dueState.id);
  if (!result) throw new Error(`worker did not process target due state (claimed=${first.claimed})`);
  if (!result.processed || result.retryScheduled || result.stale) throw new Error("worker state result was not processed");
  if (result.counts?.skipped_no_token !== 1
      || result.counts?.skipped_quiet_hours !== 1
      || result.counts?.skipped_permission_or_disabled !== 1
      || result.counts?.sent !== 0
      || result.counts?.failed_retryable !== 0
      || result.counts?.failed_permanent !== 0) {
    throw new Error(`unexpected recipient counts ${JSON.stringify(result.counts)}`);
  }

  const { data: events, error: eventError } = await admin.from("notification_events")
    .select("recipient_id,delivery_status,dedupe_key")
    .eq("baby_id", babyId)
    .eq("event_type", "feeding_reminder");
  if (eventError) throw eventError;
  if (events?.length !== 3 || events.some((event) => event.recipient_id === friend.user.id)) {
    throw new Error("family fan-out or friend exclusion failed");
  }
  if (new Set(events.map((event) => event.dedupe_key)).size !== 3) {
    throw new Error("recipient dedupe keys are not unique");
  }

  const { data: state, error: stateError } = await admin.from("care_reminder_state")
    .select("send_status,processing_started_at,last_sent_for_log_id")
    .eq("baby_id", babyId).eq("reminder_type", "feeding").single();
  if (stateError || state?.send_status !== "processed" || state.processing_started_at !== null
      || state.last_sent_for_log_id !== log.id) {
    throw new Error("processed state was not finalized");
  }

  const second = await invokeWorker();
  if (second.results?.some((candidate) => candidate.stateId === dueState.id)) {
    throw new Error("processed target state was claimed twice");
  }

  await admin.from("profiles").update({ preferred_language: "en" }).eq("id", owner.user.id);
  const { error: sleepSettingError } = await owner.sb.from("care_reminder_settings").insert({
    baby_id: babyId, reminder_type: "sleep", enabled: true, interval_minutes: 15,
    included_log_types: ["sleep"], updated_by: owner.user.id,
  });
  if (sleepSettingError) throw sleepSettingError;
  const { error: sleepQuietError } = await editor.sb.from("care_reminder_member_preferences").update({
    delivery_enabled: true, quiet_hours_enabled: true, quiet_start: quiet.start,
    quiet_end: quiet.end, timezone: "UTC", user_modified_at: new Date().toISOString(),
  }).eq("baby_id", babyId).eq("user_id", editor.user.id).eq("reminder_type", "sleep");
  if (sleepQuietError) throw sleepQuietError;
  const sleepAt = new Date();
  const { data: sleepLog, error: sleepLogError } = await owner.sb.from("care_logs").insert({
    baby_id: babyId, client_generated_id: `worker-sleep-${crypto.randomUUID()}`,
    category: "sleep", recorded_at: sleepAt.toISOString(), date_key: sleepAt.toISOString().slice(0, 10),
    time_local: sleepAt.toISOString().slice(11, 16), payload: { duration: "5" },
    source: "manual", created_by: owner.user.id,
  }).select("id").single();
  if (sleepLogError || !sleepLog) throw sleepLogError ?? new Error("sleep log creation failed");
  const { data: sleepDue, error: sleepDueError } = await admin.from("care_reminder_state").update({
    next_due_at: new Date(Date.now() - 60_000).toISOString(), send_status: "scheduled", processing_started_at: null,
  }).eq("baby_id", babyId).eq("reminder_type", "sleep").select("id").single();
  if (sleepDueError || !sleepDue) throw sleepDueError ?? new Error("sleep due state missing");
  const sleepRun = await invokeWorker();
  const sleepResult = sleepRun.results?.find((candidate) => candidate.stateId === sleepDue.id);
  if (!sleepResult?.processed || sleepResult.counts?.skipped_no_token !== 1
      || sleepResult.counts?.skipped_quiet_hours !== 1
      || sleepResult.counts?.skipped_permission_or_disabled !== 1) {
    throw new Error(`unexpected sleep worker result ${JSON.stringify(sleepResult)}`);
  }
  const { data: sleepEvents, error: sleepEventError } = await admin.from("notification_events")
    .select("recipient_id,title,delivery_status,dedupe_key").eq("baby_id", babyId).eq("event_type", "sleep_reminder");
  if (sleepEventError || sleepEvents?.length !== 3 || sleepEvents.some((event) => event.recipient_id === friend.user.id)) {
    throw sleepEventError ?? new Error("sleep family fan-out or friend exclusion failed");
  }
  if (sleepEvents.find((event) => event.recipient_id === owner.user.id)?.title !== "Sleep log reminder") {
    throw new Error("recipient preferred_language did not localize sleep event");
  }
  console.log("PASS feeding/sleep worker fan-out, writer inclusion, recipient locale, quiet hours, viewer OFF, friend exclusion, no-token status, and dedupe");
} finally {
  if (babyId) await owner.sb.from("babies").delete().eq("id", babyId);
  await cleanupQaAccounts(accounts);
}
