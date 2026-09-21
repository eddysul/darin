import { spawnSync } from "node:child_process";
import { PRODUCTION_PROJECT_REF, QA_PROJECT_REF, resolvePsqlBinary } from "./lib/qa-project-config.mjs";

if (process.env.SUPABASE_PROJECT_REF !== PRODUCTION_PROJECT_REF
  || process.env.SUPABASE_PROJECT_REF === QA_PROJECT_REF
  || !process.env.SUPABASE_DB_PASSWORD || !process.env.SUPABASE_ACCESS_TOKEN) {
  throw new Error("Production account deletion verification identity guard failed");
}
const env = {
  ...process.env,
  PGHOST: `db.${PRODUCTION_PROJECT_REF}.supabase.co`, PGUSER: "postgres",
  PGPASSWORD: process.env.SUPABASE_DB_PASSWORD,
  PGDATABASE: "postgres", PGSSLMODE: "require", PGCONNECT_TIMEOUT: "15",
  PGOPTIONS: "-c default_transaction_read_only=on -c statement_timeout=30000",
};
const sql = `select json_build_object(
  'migrations',(select count(*) from supabase_migrations.schema_migrations
    where version in ('202609170005','202609170006')),
  'nullable',(select is_nullable from information_schema.columns where table_schema='public'
    and table_name='baby_caution_foods' and column_name='created_by'),
  'fk',(select confdeltype::text from pg_constraint where conname='baby_caution_foods_created_by_fkey'),
  'legacyRetry',(position('v_is_legacy_orphan' in
    pg_get_functiondef('public.prepare_account_deletion()'::regprocedure))>0),
  'activeAdminless',(select count(*) from public.babies b where not exists (
    select 1 from public.baby_members m where m.baby_id=b.id and m.status='active' and m.permission_role='admin')
    and exists (select 1 from public.baby_members m where m.baby_id=b.id and m.status='active')),
  'publicPrivateBuckets',(select count(*) from storage.buckets where public and id in
    ('memories','diary-media','growth-book-media','baby-stickers','profile-media')),
  'cleanupSchedule',(select count(*) from cron.job where jobname='darin-storage-cleanup-every-15-minutes' and active)
)::text;`;
const db = spawnSync(resolvePsqlBinary(), ["-X", "-At", "-v", "ON_ERROR_STOP=1", "-c", sql], { env, encoding: "utf8" });
if (db.status !== 0) throw new Error(`Production read-only DB verification failed: ${(db.stderr || "").slice(0, 1200)}`);
const state = JSON.parse(db.stdout.trim());
if (state.migrations !== 2 || state.nullable !== "YES" || state.fk !== "n"
  || !state.legacyRetry || state.activeAdminless !== 0 || state.publicPrivateBuckets !== 0
  || state.cleanupSchedule !== 1) throw new Error(`Production DB contract mismatch: ${JSON.stringify(state)}`);

// CLI 'functions list' is a read-only management request; do not invoke deletion
// or the Storage cleanup worker against any Production account or object.
const list = spawnSync("pnpm", ["dlx", "supabase@latest", "functions", "list",
  "--project-ref", PRODUCTION_PROJECT_REF], { env: process.env, encoding: "utf8" });
if (list.status !== 0) throw new Error(`Production Edge list failed: ${(list.stderr || list.stdout).slice(-1200)}`);
const functions = JSON.parse(list.stdout).functions;
const edge = functions?.find((item) => item.slug === "delete-account");
if (edge?.status !== "ACTIVE") throw new Error("Production delete-account Edge Function is not active");
console.log(JSON.stringify({ target: "production", database: state,
  edge: { status: edge.status, version: edge.version, updatedAt: edge.updated_at,
    gatewayJwtVerification: edge.verify_jwt } }));
