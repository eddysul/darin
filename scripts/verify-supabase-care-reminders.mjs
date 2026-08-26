/** Live RLS and state-calculation verification. Requires the care-reminder migration. */
import { cleanupQaAccounts, createQaAccounts } from "./lib/qa-auth.mjs";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
if (!url || !key) throw new Error("Missing Supabase public client environment variables.");

const lines = [];
const pass = (message) => lines.push(`PASS  ${message}`);
const fail = (message) => lines.push(`FAIL  ${message}`);
const [admin, editor, viewer, outsider] = await createQaAccounts([
  "care-reminder-admin", "care-reminder-editor", "care-reminder-viewer", "care-reminder-outsider",
]);
let babyId = null;

try {
  const { error: tableError } = await admin.sb.from("care_reminder_settings").select("id").limit(1);
  if (tableError) throw new Error(`care reminder migration not applied: ${tableError.message}`);
  const { data: baby, error: babyError } = await admin.sb.rpc("create_baby_with_owner", {
    p_name: `수유알림QA-${Date.now()}`, p_child_status: "newborn", p_relationship_label: "보호자",
  });
  if (babyError || !baby?.id) throw new Error(`baby create: ${babyError?.message ?? "no baby"}`);
  babyId = baby.id;
  for (const [account, role] of [[editor, "editor"], [viewer, "viewer"]]) {
    const { error } = await admin.sb.from("baby_members").insert({
      baby_id: babyId, user_id: account.user.id, permission_role: role, relationship_label: "가족", status: "active",
    });
    if (error) throw error;
  }

  const { data: setting, error: settingError } = await editor.sb.from("care_reminder_settings").insert({
    baby_id: babyId, reminder_type: "feeding", enabled: true, interval_minutes: 180,
    included_log_types: ["breast", "formula", "storedMilk"], updated_by: editor.user.id,
  }).select("*").single();
  if (settingError || !setting) throw new Error(`editor setting create: ${settingError?.message}`);
  pass("admin/editor shared setting mutation allowed");

  const { data: defaults } = await editor.sb.from("care_reminder_member_preferences").select("user_id,delivery_enabled")
    .eq("baby_id", babyId).eq("reminder_type", "feeding");
  if (!defaults?.some((row) => row.user_id === editor.user.id && row.delivery_enabled)) throw new Error("editor default preference missing");
  const { data: viewerDefault } = await viewer.sb.from("care_reminder_member_preferences").select("*")
    .eq("baby_id", babyId).eq("user_id", viewer.user.id).maybeSingle();
  if (viewerDefault) throw new Error("viewer unexpectedly defaulted to delivery ON");
  pass("admin/editor default ON and viewer default OFF");

  const { data: viewerUpdateRows, error: viewerUpdateError } = await viewer.sb
    .from("care_reminder_settings")
    .update({ interval_minutes: 120, updated_by: viewer.user.id })
    .eq("id", setting.id)
    .select("id");
  if (viewerUpdateError || viewerUpdateRows?.length) throw new Error("viewer changed shared setting");
  const { data: outsiderRows } = await outsider.sb.from("care_reminder_settings").select("id").eq("baby_id", babyId);
  if (outsiderRows?.length) throw new Error("outsider read shared setting");
  pass("viewer mutation and outsider access blocked");

  const { error: viewerPreferenceError } = await viewer.sb.from("care_reminder_member_preferences").insert({
    baby_id: babyId, user_id: viewer.user.id, reminder_type: "feeding", delivery_enabled: true,
    timezone: "Asia/Seoul", user_modified_at: new Date().toISOString(),
  });
  if (viewerPreferenceError) throw viewerPreferenceError;
  pass("viewer can explicitly enable own delivery");

  const { data: crossPreferenceRows, error: crossPreferenceError } = await viewer.sb
    .from("care_reminder_member_preferences").update({ delivery_enabled: false })
    .eq("baby_id", babyId).eq("user_id", editor.user.id).eq("reminder_type", "feeding")
    .select("id");
  if (crossPreferenceError || crossPreferenceRows?.length) throw new Error("viewer changed another member preference");
  pass("member preference RLS blocks cross-user updates");

  const recordedAt = new Date(Date.now() + 5 * 60_000);
  const logId = crypto.randomUUID();
  const { error: logError } = await admin.sb.from("care_logs").insert({
    id: logId, baby_id: babyId, client_generated_id: `care-reminder-${Date.now()}`,
    category: "formula", recorded_at: recordedAt.toISOString(), date_key: recordedAt.toISOString().slice(0, 10),
    time_local: "12:00", payload: { duration: "10" }, source: "manual", created_by: admin.user.id,
  });
  if (logError) throw logError;
  const { data: state, error: stateError } = await admin.sb.from("care_reminder_state").select("*")
    .eq("baby_id", babyId).eq("reminder_type", "feeding").single();
  if (stateError || state.last_relevant_log_id !== logId || state.send_status !== "scheduled") throw new Error("feeding state not scheduled");
  const feedAt = new Date(state.last_relevant_log_at).getTime();
  if (Math.abs(feedAt - (recordedAt.getTime() + 10 * 60_000)) > 1000) throw new Error("duration was not applied");
  pass("formula creates scheduled state using recorded_at + duration");

  const { data: stateWriteRows, error: stateWriteError } = await viewer.sb.from("care_reminder_state")
    .update({ send_status: "sent" }).eq("id", state.id).select("id");
  if (stateWriteError || stateWriteRows?.length) throw new Error("authenticated member changed worker-owned state");
  pass("authenticated clients cannot mutate worker-owned state");

  const version = state.version;
  const { error: pumpError } = await admin.sb.from("care_logs").insert({
    baby_id: babyId, client_generated_id: `pump-${Date.now()}`, category: "pump",
    recorded_at: new Date(recordedAt.getTime() + 60_000).toISOString(), date_key: recordedAt.toISOString().slice(0, 10),
    time_local: "12:01", payload: { duration: "20" }, source: "manual", created_by: admin.user.id,
  });
  if (pumpError) throw pumpError;
  const { data: afterPump } = await admin.sb.from("care_reminder_state").select("version").eq("id", state.id).single();
  if (afterPump?.version !== version) throw new Error("pump changed feeding state");
  pass("pump is excluded from feeding state");

  const newerAt = new Date(recordedAt.getTime() + 20 * 60_000);
  const newerLogId = crypto.randomUUID();
  const { error: newerLogError } = await admin.sb.from("care_logs").insert({
    id: newerLogId, baby_id: babyId, client_generated_id: `care-reminder-newer-${Date.now()}`,
    category: "storedMilk", recorded_at: newerAt.toISOString(), date_key: newerAt.toISOString().slice(0, 10),
    time_local: "12:02", payload: {}, source: "manual", created_by: admin.user.id,
  });
  if (newerLogError) throw newerLogError;
  const { data: newestState } = await admin.sb.from("care_reminder_state").select("last_relevant_log_id")
    .eq("id", state.id).single();
  if (newestState?.last_relevant_log_id !== newerLogId) throw new Error("newest relevant feed was not selected");
  const { error: deleteNewerError } = await admin.sb.from("care_logs").delete().eq("id", newerLogId);
  if (deleteNewerError) throw deleteNewerError;
  const { data: restoredState } = await admin.sb.from("care_reminder_state").select("last_relevant_log_id")
    .eq("id", state.id).single();
  if (restoredState?.last_relevant_log_id !== logId) throw new Error("deleting latest feed did not restore previous feed");
  pass("deleting latest feed restores the previous relevant feed");

  await admin.sb.from("care_logs").update({ payload: { duration: "invalid" } }).eq("id", logId);
  const { data: fallback } = await admin.sb.from("care_reminder_state").select("last_relevant_log_at").eq("id", state.id).single();
  if (Math.abs(new Date(fallback.last_relevant_log_at).getTime() - recordedAt.getTime()) > 1000) throw new Error("invalid duration did not fall back");
  pass("invalid duration falls back to recorded_at");

  const oldAt = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
  await admin.sb.from("care_logs").update({ recorded_at: oldAt, date_key: oldAt.slice(0, 10), payload: {} }).eq("id", logId);
  const { data: overdue } = await admin.sb.from("care_reminder_state").select("send_status").eq("id", state.id).single();
  if (overdue?.send_status !== "overdue_not_scheduled") throw new Error("backdated log was scheduled immediately");
  pass("backdated log becomes overdue_not_scheduled");

  const { error: disableError } = await editor.sb.from("care_reminder_settings")
    .update({ enabled: false, updated_by: editor.user.id }).eq("id", setting.id);
  if (disableError) throw disableError;
  const { data: disabledState } = await admin.sb.from("care_reminder_state").select("send_status,next_due_at")
    .eq("id", state.id).single();
  if (disabledState?.send_status !== "disabled" || disabledState.next_due_at !== null) {
    throw new Error("setting OFF did not disable due state");
  }
  pass("setting OFF removes the reminder from due processing");

  const { data: sleepSetting, error: sleepSettingError } = await editor.sb.from("care_reminder_settings").insert({
    baby_id: babyId, reminder_type: "sleep", enabled: true, interval_minutes: 120,
    included_log_types: ["sleep"], updated_by: editor.user.id,
  }).select("*").single();
  if (sleepSettingError || !sleepSetting) throw new Error(`sleep setting create: ${sleepSettingError?.message}`);
  const { data: sleepDefaults } = await editor.sb.from("care_reminder_member_preferences")
    .select("user_id,delivery_enabled").eq("baby_id", babyId).eq("reminder_type", "sleep");
  if (!sleepDefaults?.some((row) => row.user_id === editor.user.id && row.delivery_enabled)) {
    throw new Error("sleep editor default preference missing");
  }

  const sleepBaseMs = Date.now();
  const firstSleepId = crypto.randomUUID();
  const secondSleepId = crypto.randomUUID();
  for (const [id, offsetMinutes, duration] of [[firstSleepId, 10, "30"], [secondSleepId, 30, "20"]]) {
    const at = new Date(sleepBaseMs + Number(offsetMinutes) * 60_000);
    const { error } = await admin.sb.from("care_logs").insert({
      id, baby_id: babyId, client_generated_id: `sleep-reminder-${id}`,
      category: "sleep", recorded_at: at.toISOString(), date_key: at.toISOString().slice(0, 10),
      time_local: "13:00", payload: { duration }, source: "manual", created_by: admin.user.id,
    });
    if (error) throw error;
  }
  const { data: sleepState, error: sleepStateError } = await admin.sb.from("care_reminder_state").select("*")
    .eq("baby_id", babyId).eq("reminder_type", "sleep").single();
  if (sleepStateError || sleepState.last_relevant_log_id !== secondSleepId || sleepState.send_status !== "scheduled") {
    throw new Error("sleep state not scheduled from latest sleep end");
  }
  const expectedSleepEnd = sleepBaseMs + 50 * 60_000;
  if (Math.abs(new Date(sleepState.last_relevant_log_at).getTime() - expectedSleepEnd) > 2_000) {
    throw new Error("sleep duration was not applied to the end time");
  }
  await admin.sb.from("care_logs").delete().eq("id", secondSleepId);
  const { data: restoredSleep } = await admin.sb.from("care_reminder_state").select("last_relevant_log_id")
    .eq("id", sleepState.id).single();
  if (restoredSleep?.last_relevant_log_id !== firstSleepId) throw new Error("deleting latest sleep did not restore previous sleep");
  const backdatedSleep = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
  await admin.sb.from("care_logs").update({ recorded_at: backdatedSleep, date_key: backdatedSleep.slice(0, 10), payload: {} }).eq("id", firstSleepId);
  const { data: overdueSleep } = await admin.sb.from("care_reminder_state").select("send_status").eq("id", sleepState.id).single();
  if (overdueSleep?.send_status !== "overdue_not_scheduled") throw new Error("backdated sleep was scheduled immediately");
  pass("sleep uses end time, restores prior log, and blocks backdated immediate delivery");
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
} finally {
  if (babyId) await admin.sb.from("babies").delete().eq("id", babyId);
  await cleanupQaAccounts([admin, editor, viewer, outsider]);
}

console.log(lines.join("\n"));
process.exit(lines.some((line) => line.startsWith("FAIL")) ? 1 : 0);
