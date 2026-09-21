import { spawnSync } from "node:child_process";
import { PRODUCTION_PROJECT_REF, QA_PROJECT_REF, resolvePsqlBinary } from "./lib/qa-project-config.mjs";

if (process.env.SUPABASE_PROJECT_REF !== PRODUCTION_PROJECT_REF
  || process.env.SUPABASE_PROJECT_REF === QA_PROJECT_REF
  || !process.env.SUPABASE_DB_PASSWORD) {
  throw new Error("Production account deletion read-only identity guard failed");
}
const env = {
  ...process.env,
  PGHOST: `db.${PRODUCTION_PROJECT_REF}.supabase.co`,
  PGPORT: process.env.SUPABASE_DB_PORT || "5432",
  PGUSER: "postgres",
  PGPASSWORD: process.env.SUPABASE_DB_PASSWORD,
  PGDATABASE: process.env.SUPABASE_DB_NAME || "postgres",
  PGSSLMODE: "require",
  PGCONNECT_TIMEOUT: "15",
  PGOPTIONS: "-c default_transaction_read_only=on -c statement_timeout=30000",
};
const sql = `select json_build_object(
  'database', current_database(),
  'role', current_user,
  'baseline', (select count(*) from supabase_migrations.schema_migrations where version='202609150010'),
  'applied005', (select count(*) from supabase_migrations.schema_migrations where version='202609170005'),
  'applied006', (select count(*) from supabase_migrations.schema_migrations where version='202609170006'),
  'latestMigration', (select max(version) from supabase_migrations.schema_migrations),
  'cautionFk', (select confdeltype::text from pg_constraint where conname='baby_caution_foods_created_by_fkey'),
  'cautionAuthoredRows', (select count(*) from public.baby_caution_foods where created_by is not null),
  'adminlessBabies', (select count(*) from public.babies b where not exists (
    select 1 from public.baby_members m where m.baby_id=b.id and m.status='active' and m.permission_role='admin')),
  'adminlessWithActiveMembers', (select count(*) from public.babies b where not exists (
    select 1 from public.baby_members m where m.baby_id=b.id and m.status='active' and m.permission_role='admin')
    and exists (select 1 from public.baby_members m where m.baby_id=b.id and m.status='active')),
  'adminlessWithCreator', (select count(*) from public.babies b where b.created_by is not null and not exists (
    select 1 from public.baby_members m where m.baby_id=b.id and m.status='active' and m.permission_role='admin')),
  'adminlessWithAnyMembers', (select count(*) from public.babies b where not exists (
    select 1 from public.baby_members m where m.baby_id=b.id and m.status='active' and m.permission_role='admin')
    and exists (select 1 from public.baby_members m where m.baby_id=b.id)),
  'adminlessSyntheticNames', (select count(*) from public.babies b where
    (b.name like 'DeleteQA-%' or b.name like 'DeleteSolo-%' or b.name like 'DeleteShared-%')
    and not exists (select 1 from public.baby_members m where m.baby_id=b.id and m.status='active' and m.permission_role='admin')),
  'adminlessCareLogs', (select count(*) from public.care_logs c join public.babies b on b.id=c.baby_id where not exists (
    select 1 from public.baby_members m where m.baby_id=b.id and m.status='active' and m.permission_role='admin')),
  'adminlessDiaryEntries', (select count(*) from public.diary_entries d join public.babies b on b.id=d.baby_id where not exists (
    select 1 from public.baby_members m where m.baby_id=b.id and m.status='active' and m.permission_role='admin')),
  'adminlessMemoryPosts', (select count(*) from public.memory_posts p join public.babies b on b.id=p.baby_id where not exists (
    select 1 from public.baby_members m where m.baby_id=b.id and m.status='active' and m.permission_role='admin')),
  'adminlessGrowthRecords', (select count(*) from public.growth_records g join public.babies b on b.id=g.baby_id where not exists (
    select 1 from public.baby_members m where m.baby_id=b.id and m.status='active' and m.permission_role='admin')),
  'storageCleanupSchedule', (select count(*) from cron.job where jobname='darin-storage-cleanup-every-15-minutes' and active),
  'storageCleanupSecrets', (select count(*) from vault.secrets where name in
    ('b04b_storage_project_url','b04b_storage_cleanup_cron_secret')),
  'storageQueuePending', (select count(*) from public.media_cleanup_queue where state='pending'),
  'storageQueueLeased', (select count(*) from public.media_cleanup_queue where state='leased'),
  'storageQueueDone', (select count(*) from public.media_cleanup_queue where state='done'),
  'publicPrivateBuckets', (select count(*) from storage.buckets where public and id in
    ('memories','diary-media','growth-book-media','baby-stickers','profile-media'))
)::text;`;
const result = spawnSync(resolvePsqlBinary(), ["-X", "-At", "-v", "ON_ERROR_STOP=1", "-c", sql], {
  env, encoding: "utf8",
});
if (result.status !== 0) throw new Error(`Production read-only inspection failed: ${(result.stderr || result.stdout).slice(0, 1200)}`);
const data = JSON.parse(result.stdout.trim());
if (data.database !== "postgres" || data.role !== "postgres" || data.baseline !== 1) {
  throw new Error("Production database baseline contract mismatch");
}
console.log(JSON.stringify(data));
