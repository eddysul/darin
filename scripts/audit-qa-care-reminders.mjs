import { spawnSync } from "node:child_process";
import { PRODUCTION_PROJECT_REF, QA_PROJECT_REF, resolvePsqlBinary } from "./lib/qa-project-config.mjs";

const PSQL = resolvePsqlBinary();

const host = process.env.SUPABASE_DB_HOST?.trim() ?? "";
const user = process.env.SUPABASE_DB_USER?.trim() ?? "";
const password = process.env.SUPABASE_DB_PASSWORD ?? "";
const baseUrl = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");

if (!host || !user || !password || !baseUrl) throw new Error("QA environment is incomplete");
if (!host.endsWith("pooler.supabase.com") || !user.includes(QA_PROJECT_REF)) {
  throw new Error("QA DB target guard failed");
}
if (user.includes(PRODUCTION_PROJECT_REF) || host.includes(PRODUCTION_PROJECT_REF) || baseUrl.includes(PRODUCTION_PROJECT_REF)) {
  throw new Error("Production target is blocked");
}

const pgEnv = {
  ...process.env,
  PGHOST: host,
  PGPORT: process.env.SUPABASE_DB_PORT || "5432",
  PGUSER: user,
  PGPASSWORD: password,
  PGDATABASE: process.env.SUPABASE_DB_NAME || "postgres",
  PGSSLMODE: "require",
  PGCONNECT_TIMEOUT: "15",
};

function queryJson(sql) {
  const result = spawnSync(PSQL, ["-X", "-v", "ON_ERROR_STOP=1", "-Atqc", sql], {
    encoding: "utf8",
    env: pgEnv,
  });
  if (result.status !== 0) throw new Error((result.stderr || result.stdout).slice(0, 3000));
  return JSON.parse(result.stdout.trim());
}

const audit = queryJson(`
select json_build_object(
  'migrationRows', (select count(*) from supabase_migrations.schema_migrations),
  'build17MigrationRecorded', exists(select 1 from supabase_migrations.schema_migrations where version='202608260002'),
  'legacyRelations', (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname = any(array['User','Post','Ingredient','PipelineRun'])),
  'careTables', (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind in ('r','p')
      and c.relname = any(array['care_reminder_settings','care_reminder_member_preferences','care_reminder_state'])),
  'careTablesWithRls', (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relrowsecurity
      and c.relname = any(array['care_reminder_settings','care_reminder_member_preferences','care_reminder_state'])),
  'carePolicies', (select count(*) from pg_policies where schemaname='public'
    and tablename = any(array['care_reminder_settings','care_reminder_member_preferences','care_reminder_state'])),
  'careFunctions', (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname = any(array['care_reminder_feed_at','care_reminder_log_at','sync_care_reminder_state','claim_due_care_reminders'])),
  'careTriggers', (select count(*) from pg_trigger where not tgisinternal
    and tgname = any(array['care_logs_sync_care_reminders','care_reminder_settings_changed','baby_members_care_reminder_default'])),
  'careEventConstraint', exists(select 1 from pg_constraint c
    where c.conname='notification_events_event_type_check'
      and pg_get_constraintdef(c.oid) like '%feeding_reminder%'
      and pg_get_constraintdef(c.oid) like '%sleep_reminder%'),
  'authUsers', (select count(*) from auth.users),
  'storageBuckets', (select count(*) from storage.buckets),
  'unexpectedStorageBuckets', (select count(*) from storage.buckets
    where id <> all(array['baby-stickers','diary-media','growth-book-media','memories','profile-media'])),
  'storageObjects', (select count(*) from storage.objects),
  'cronSchema', to_regnamespace('cron') is not null,
  'vaultSchema', to_regnamespace('vault') is not null,
  'cronExtensionsAvailable', (select count(*) from pg_available_extensions
    where name in ('pg_cron', 'pg_net') and default_version is not null)
);
`);

audit.cronJobs = audit.cronSchema
  ? queryJson("select json_build_object('count', count(*)) from cron.job where jobname='process-care-reminders-every-minute'").count
  : 0;
audit.careVaultSecrets = audit.vaultSchema
  ? queryJson("select json_build_object('count', count(*)) from vault.secrets where name in ('project_url','care_reminder_cron_secret')").count
  : 0;
audit.decryptedCareVaultSecrets = audit.vaultSchema
  ? queryJson("select json_build_object('count', count(*)) from vault.decrypted_secrets where name in ('project_url','care_reminder_cron_secret') and decrypted_secret is not null").count
  : 0;

const functionResponse = await fetch(`${baseUrl}/functions/v1/process-care-reminders`, {
  method: "POST",
  headers: { "x-cron-secret": "intentionally-invalid-audit-secret" },
});
audit.workerHttpStatus = functionResponse.status;

const checks = [
  [audit.migrationRows >= 32 && audit.build17MigrationRecorded, "Build 17 non-cron migration is recorded"],
  [audit.legacyRelations === 0, "legacy public relations removed"],
  [audit.careTables === 3, "three care reminder tables exist"],
  [audit.careTablesWithRls === 3, "RLS enabled on all care reminder tables"],
  [audit.carePolicies === 8, "eight care reminder RLS policies exist"],
  [audit.careFunctions === 4, "feeding/sleep calculation and claim functions exist"],
  [audit.careTriggers === 3, "care reminder triggers exist"],
  [audit.careEventConstraint, "notification_events allows feeding_reminder and sleep_reminder"],
  [audit.authUsers === 0, "temporary QA Auth users cleaned up"],
  [audit.storageBuckets === 5 && audit.unexpectedStorageBuckets === 0,
    "only five Darin Storage buckets exist"],
  [audit.cronJobs === 0, "care reminder cron is not registered"],
  [audit.careVaultSecrets === 2, "care reminder Vault secrets are configured"],
  [audit.decryptedCareVaultSecrets === 2, "care reminder Vault secrets are decryptable"],
  [audit.cronExtensionsAvailable === 2, "pg_cron and pg_net are available for the final cron migration"],
  [audit.workerHttpStatus === 401, "process-care-reminders is deployed and rejects an invalid cron secret"],
];

for (const [passed, message] of checks) console.log(`${passed ? "PASS" : "FAIL"}  ${message}`);
console.log(`INFO  workerHttpStatus=${audit.workerHttpStatus} cronJobs=${audit.cronJobs} vaultSecrets=${audit.careVaultSecrets} storageObjects=${audit.storageObjects}`);
process.exit(checks.some(([passed]) => !passed) ? 1 : 0);
