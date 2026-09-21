import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { assertQaProjectEnvironment } from "./lib/qa-project-guard.mjs";
import { PRODUCTION_PROJECT_REF, QA_PROJECT_REF, resolvePsqlBinary } from "./lib/qa-project-config.mjs";

const production = process.argv.includes("--production");
const execute = process.argv.includes("--execute");
const ref = production ? PRODUCTION_PROJECT_REF : QA_PROJECT_REF;
if (production) {
  assert.equal(process.env.SUPABASE_PROJECT_REF, ref, "Production identity guard");
} else {
  assertQaProjectEnvironment();
  assert.ok(process.env.SUPABASE_DB_USER?.includes(ref), "QA DB identity guard");
  assert.ok(!process.env.SUPABASE_DB_HOST?.includes(PRODUCTION_PROJECT_REF));
}
assert.ok(process.env.SUPABASE_DB_PASSWORD, "Missing DB credential");
const version = "202609180001";
const name = "account_deletion_reminder_cascade";
const source = readFileSync(`supabase/migrations/${version}_${name}.sql`, "utf8");
const sha256 = createHash("sha256").update(source).digest("hex");
const baseline = readFileSync("supabase/migrations/202608260002_build17_sleep_reminders_and_notification_locale.sql", "utf8");
const originalBody = baseline.split("create or replace function public.sync_care_reminder_state(")[1].split("$$")[1];
const fixedBody = source.split("$$")[1];
const env = { ...process.env,
  PGHOST: production ? `db.${ref}.supabase.co` : process.env.SUPABASE_DB_HOST,
  PGUSER: production ? "postgres" : process.env.SUPABASE_DB_USER,
  PGPORT: process.env.SUPABASE_DB_PORT || "5432", PGDATABASE: "postgres",
  PGPASSWORD: process.env.SUPABASE_DB_PASSWORD, PGSSLMODE: "require", PGCONNECT_TIMEOUT: "15" };
function sql(query, readOnly = true) {
  const result = spawnSync(resolvePsqlBinary(), ["-X", "-At", "-v", "ON_ERROR_STOP=1"], {
    input: query, encoding: "utf8", env: { ...env,
      PGOPTIONS: `${readOnly ? "-c default_transaction_read_only=on " : ""}-c statement_timeout=30000` },
  });
  if (result.status !== 0) throw new Error(`Reminder migration SQL failed: ${result.stderr.slice(0, 1500)}`);
  return result.stdout.trim();
}
function snapshot() {
  return JSON.parse(sql(`select json_build_object(
    'body',(select prosrc from pg_proc where oid='public.sync_care_reminder_state(uuid,text)'::regprocedure),
    'acl',(select proacl::text from pg_proc where oid='public.sync_care_reminder_state(uuid,text)'::regprocedure),
    'definer',(select prosecdef from pg_proc where oid='public.sync_care_reminder_state(uuid,text)'::regprocedure),
    'config',(select proconfig from pg_proc where oid='public.sync_care_reminder_state(uuid,text)'::regprocedure),
    'baseline',(select count(*) from supabase_migrations.schema_migrations where version='202609170006'),
    'applied',(select count(*) from supabase_migrations.schema_migrations where version='${version}'),
    'invariants',json_build_object(
      'rpc',pg_get_functiondef('public.prepare_account_deletion()'::regprocedure),
      'trigger',pg_get_functiondef('public.on_care_log_sync_reminders()'::regprocedure),
      'tables',(select json_agg(row_to_json(t) order by t.relname) from (
        select relname,relrowsecurity,relacl::text from pg_class
        where oid in ('public.care_reminder_state'::regclass,'public.care_reminder_settings'::regclass,
          'public.care_reminder_member_preferences'::regclass)) t),
      'constraints',(select json_agg(row_to_json(t) order by t.conname) from (
        select conname,pg_get_constraintdef(oid) as definition from pg_constraint
        where conrelid in ('public.care_reminder_state'::regclass,'public.care_reminder_settings'::regclass,
          'public.care_reminder_member_preferences'::regclass)) t)
    ))::text;`));
}
const before = snapshot();
assert.equal(before.baseline, 1, "Account deletion baseline missing");
assert.equal(before.definer, true);
assert.deepEqual(before.config, ["search_path=public"]);
assert.equal(before.acl, "{postgres=X/postgres,service_role=X/postgres}");
assert.equal(before.body, before.applied ? fixedBody : originalBody, "Unexpected deployed function drift");
console.log(JSON.stringify({ target: production ? "production" : "qa", version, sha256, execute, alreadyApplied: !!before.applied }));
if (!execute || before.applied) process.exit(0);
if (production) {
  assert.equal(process.env.ACCOUNT_DELETION_QA_APPROVED_SHA256, sha256, "QA-reviewed source hash required");
  assert.equal(process.env.PRODUCTION_ACCOUNT_DELETION_CONFIRM,
    `DEPLOY_ACCOUNT_DELETION_PRODUCTION_${ref}`, "Production deployment confirmation required");
}
const body = source.replace(/\nbegin;\s*/i, "\n").replace(/\s*commit;\s*$/i, "");
sql(`begin; set local lock_timeout='5s';\n${body}\ninsert into supabase_migrations.schema_migrations(version,name)
 values ('${version}','${name}');\ncommit;`, false);
const after = snapshot();
assert.equal(after.body, fixedBody);
assert.equal(after.applied, 1);
assert.equal(after.acl, before.acl);
assert.equal(after.definer, before.definer);
assert.deepEqual(after.config, before.config);
assert.deepEqual(after.invariants, before.invariants, "Authorization, FK or deletion policy changed unexpectedly");
console.log(JSON.stringify({ target: production ? "production" : "qa", applied: version,
  functionVerified: true, authorizationAndForeignKeysUnchanged: true, sha256 }));
