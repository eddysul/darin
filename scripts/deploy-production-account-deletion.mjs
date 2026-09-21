import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { PRODUCTION_PROJECT_REF, QA_PROJECT_REF, resolvePsqlBinary } from "./lib/qa-project-config.mjs";

if (process.env.SUPABASE_PROJECT_REF !== PRODUCTION_PROJECT_REF
  || process.env.SUPABASE_PROJECT_REF === QA_PROJECT_REF
  || !process.env.SUPABASE_DB_PASSWORD) {
  throw new Error("Production account deletion database identity guard failed");
}
const migrations = [
  ["202609170005", "account_deletion_lifecycle"],
  ["202609170006", "account_deletion_legacy_retry"],
].map(([version, name]) => {
  const source = readFileSync(`supabase/migrations/${version}_${name}.sql`, "utf8");
  return { version, name, source, sha256: createHash("sha256").update(source).digest("hex") };
});
const manifestSha256 = createHash("sha256")
  .update(migrations.map(({ version, sha256 }) => `${version}:${sha256}`).join("\n"))
  .digest("hex");
const env = {
  ...process.env,
  PGHOST: `db.${PRODUCTION_PROJECT_REF}.supabase.co`,
  PGPORT: process.env.SUPABASE_DB_PORT || "5432",
  PGUSER: "postgres",
  PGPASSWORD: process.env.SUPABASE_DB_PASSWORD,
  PGDATABASE: process.env.SUPABASE_DB_NAME || "postgres",
  PGSSLMODE: "require",
  PGCONNECT_TIMEOUT: "15",
};
function psql(sql, readOnly = true) {
  const result = spawnSync(resolvePsqlBinary(), ["-X", "-At", "-v", "ON_ERROR_STOP=1"], {
    input: sql, encoding: "utf8",
    env: { ...env, ...(readOnly ? { PGOPTIONS: "-c default_transaction_read_only=on -c statement_timeout=30000" } : {}) },
  });
  if (result.status !== 0) throw new Error(`Production account deletion SQL failed: ${(result.stderr || result.stdout).slice(0, 1800)}`);
  return result.stdout.trim();
}
const preflight = JSON.parse(psql(`select json_build_object(
  'database',current_database(),'role',current_user,
  'baseline',(select count(*) from supabase_migrations.schema_migrations where version='202609150010'),
  'applied005',(select count(*) from supabase_migrations.schema_migrations where version='202609170005'),
  'applied006',(select count(*) from supabase_migrations.schema_migrations where version='202609170006'),
  'cautionFk',(select confdeltype::text from pg_constraint where conname='baby_caution_foods_created_by_fkey'),
  'activeAdminless',(select count(*) from public.babies b where not exists (
    select 1 from public.baby_members m where m.baby_id=b.id and m.status='active' and m.permission_role='admin')
    and exists (select 1 from public.baby_members m where m.baby_id=b.id)),
  'adminlessContent',(select count(*) from public.babies b where not exists (
    select 1 from public.baby_members m where m.baby_id=b.id and m.status='active' and m.permission_role='admin')
    and (exists (select 1 from public.care_logs c where c.baby_id=b.id)
      or exists (select 1 from public.diary_entries d where d.baby_id=b.id)
      or exists (select 1 from public.memory_posts p where p.baby_id=b.id)
      or exists (select 1 from public.growth_records g where g.baby_id=b.id))),
  'cleanupSchedule',(select count(*) from cron.job where jobname='darin-storage-cleanup-every-15-minutes' and active),
  'publicPrivateBuckets',(select count(*) from storage.buckets where public and id in
    ('memories','diary-media','growth-book-media','baby-stickers','profile-media'))
)::text;`));
if (preflight.database !== "postgres" || preflight.role !== "postgres"
  || preflight.baseline !== 1 || preflight.cleanupSchedule !== 1
  || preflight.activeAdminless !== 0 || preflight.adminlessContent !== 0
  || preflight.publicPrivateBuckets !== 0
  || (preflight.applied006 && !preflight.applied005)) {
  throw new Error(`Production account deletion preflight blocked: ${JSON.stringify(preflight)}`);
}
const pending = migrations.filter(({ version }) => !preflight[`applied${version.slice(-3)}`]);
if (pending.length && (preflight.cautionFk !== "r" || preflight.applied005 || preflight.applied006)) {
  throw new Error(`Unexpected partial Production migration state: ${JSON.stringify(preflight)}`);
}
console.log(JSON.stringify({ target: "production", execute: process.argv.includes("--execute"), manifestSha256,
  pending: pending.map(({ version }) => version), preflight }));
if (!process.argv.includes("--execute")) process.exit(0);
if (process.env.ACCOUNT_DELETION_QA_APPROVED_SHA256 !== manifestSha256
  || process.env.PRODUCTION_ACCOUNT_DELETION_CONFIRM !== `DEPLOY_ACCOUNT_DELETION_PRODUCTION_${PRODUCTION_PROJECT_REF}`) {
  throw new Error("QA manifest or explicit Production deployment confirmation missing");
}
if (pending.length) {
  let sql = "begin; set local lock_timeout='5s'; set local statement_timeout='120s';\n";
  for (const { version, name, source } of pending) {
    sql += source.replace(/\nbegin;\s*/i, "\n").replace(/\s*commit;\s*$/i, "");
    sql += `\ninsert into supabase_migrations.schema_migrations(version,name) values ('${version}','${name}');\n`;
  }
  psql(`${sql}\ncommit;`, false);
}
const verified = psql(`select (select is_nullable from information_schema.columns where table_schema='public'
  and table_name='baby_caution_foods' and column_name='created_by') || '|' ||
  (select confdeltype::text from pg_constraint where conname='baby_caution_foods_created_by_fkey') || '|' ||
  (position('v_is_legacy_orphan' in pg_get_functiondef('public.prepare_account_deletion()'::regprocedure))>0
    or position('v_creator_orphan' in pg_get_functiondef('public.prepare_account_deletion()'::regprocedure))>0)::text || '|' ||
  (select count(*)::text from supabase_migrations.schema_migrations where version in ('202609170005','202609170006'));`);
if (verified !== "YES|n|true|2") throw new Error(`Production post-apply contract mismatch: ${verified}`);
console.log(JSON.stringify({ target: "production", applied: pending.map(({ version }) => version), verified }));
