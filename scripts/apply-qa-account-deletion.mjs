import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { assertQaProjectEnvironment } from "./lib/qa-project-guard.mjs";
import { QA_PROJECT_REF, PRODUCTION_PROJECT_REF, resolvePsqlBinary } from "./lib/qa-project-config.mjs";

assertQaProjectEnvironment();
const legacyRetry = process.argv.includes("--legacy-retry");
const version = legacyRetry ? "202609170006" : "202609170005";
const name = legacyRetry ? "account_deletion_legacy_retry" : "account_deletion_lifecycle";
const filename = `supabase/migrations/${version}_${name}.sql`;
const execute = process.argv.includes("--execute");
const host = process.env.SUPABASE_DB_HOST ?? "";
const user = process.env.SUPABASE_DB_USER ?? "";
if (!user.includes(QA_PROJECT_REF) || user.includes(PRODUCTION_PROJECT_REF)
  || host.includes(PRODUCTION_PROJECT_REF) || !process.env.SUPABASE_DB_PASSWORD) {
  throw new Error("QA database identity guard failed");
}
const env = {
  ...process.env,
  PGHOST: host,
  PGPORT: process.env.SUPABASE_DB_PORT || "5432",
  PGUSER: user,
  PGPASSWORD: process.env.SUPABASE_DB_PASSWORD,
  PGDATABASE: process.env.SUPABASE_DB_NAME || "postgres",
  PGSSLMODE: "require",
  PGCONNECT_TIMEOUT: "15",
};
function psql(sql, readOnly = false) {
  const result = spawnSync(resolvePsqlBinary(), ["-X", "-At", "-v", "ON_ERROR_STOP=1"], {
    input: sql,
    encoding: "utf8",
    env: { ...env, ...(readOnly ? { PGOPTIONS: "-c default_transaction_read_only=on -c statement_timeout=30000" } : {}) },
  });
  if (result.status !== 0) throw new Error((result.stderr || result.stdout).slice(0, 2000));
  return result.stdout.trim();
}
const identity = psql("select current_database() || '|' || current_user", true);
if (!identity.startsWith("postgres|")) throw new Error("Unexpected QA database identity");
const baseline = legacyRetry ? "202609170005" : "202609150010";
const history = psql(`select version from supabase_migrations.schema_migrations where version in ('${baseline}','${version}') order by version`, true).split("\n");
if (!history.includes(baseline)) throw new Error("Account deletion migration baseline missing on QA");
function verifyApplied() {
  const verified = legacyRetry
    ? psql(`select (position('v_is_legacy_orphan' in pg_get_functiondef('public.prepare_account_deletion()'::regprocedure))>0
        or position('v_creator_orphan' in pg_get_functiondef('public.prepare_account_deletion()'::regprocedure))>0)::text
        || '|' || (select count(*)::text from supabase_migrations.schema_migrations where version='${version}')`, true)
    : psql(`select (select is_nullable from information_schema.columns where table_schema='public' and table_name='baby_caution_foods' and column_name='created_by') || '|' || (select confdeltype::text from pg_constraint where conname='baby_caution_foods_created_by_fkey') || '|' || (select count(*)::text from supabase_migrations.schema_migrations where version='${version}')`, true);
  if (verified !== (legacyRetry ? "true|1" : "YES|n|1")) throw new Error(`QA post-apply contract mismatch: ${verified}`);
}
if (history.includes(version)) {
  verifyApplied();
  console.log(`QA ${version} already applied and verified`);
  process.exit(0);
}
if (!execute) {
  console.log(`QA preflight passed: pending ${version}; pass --execute to apply`);
  process.exit(0);
}
if (process.env.QA_ACCOUNT_DELETION_CONFIRM !== `APPLY_ACCOUNT_DELETION_${QA_PROJECT_REF}`) {
  throw new Error("QA account deletion apply confirmation missing");
}
const source = readFileSync(filename, "utf8")
  .replace(/\nbegin;\s*/i, "\n")
  .replace(/\s*commit;\s*$/i, "");
psql(`begin; set local lock_timeout='5s'; set local statement_timeout='120s';\n${source}\ninsert into supabase_migrations.schema_migrations(version,name) values ('${version}','${name}');\ncommit;`);
verifyApplied();
console.log(`QA ${version} applied and verified`);
