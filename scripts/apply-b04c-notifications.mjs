import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { QA_PROJECT_REF, PRODUCTION_PROJECT_REF, resolvePsqlBinary } from "./lib/qa-project-config.mjs";

const target = process.argv[2];
const execute = process.argv.includes("--execute");
if (!["qa", "production"].includes(target)) throw new Error("usage: apply-b04c-notifications.mjs <qa|production> [--execute]");
const projectRef = target === "qa" ? QA_PROJECT_REF : PRODUCTION_PROJECT_REF;
const otherRef = target === "qa" ? PRODUCTION_PROJECT_REF : QA_PROJECT_REF;
const filename = "202609160001_b04c_notification_security.sql";
const version = "202609160001";
const source = readFileSync(`supabase/migrations/${filename}`, "utf8");
const sha256 = createHash("sha256").update(source).digest("hex");
const restoreFilename = "202609160003_b04c_push_rebind_post_cutover.sql";
const restoreSource = readFileSync(`supabase/migrations/${restoreFilename}`, "utf8");
const restoreSha256 = createHash("sha256").update(restoreSource).digest("hex");
const host = target === "qa" ? process.env.SUPABASE_DB_HOST?.trim() : `db.${projectRef}.supabase.co`;
const user = target === "qa" ? process.env.SUPABASE_DB_USER?.trim() : "postgres";
const password = process.env.SUPABASE_DB_PASSWORD;
const configuredRef = process.env.SUPABASE_PROJECT_REF?.trim();
if (!host || !user || !password || (target === "qa"
  ? (!user.includes(projectRef) || host.includes(otherRef))
  : configuredRef !== projectRef)) throw new Error(`${target} B0.4c database identity guard failed`);
if (target === "production" && process.env.B04C_QA_APPROVED_SHA256 !== sha256) {
  throw new Error("production migration source differs from QA-approved B0.4c SHA-256");
}
if (target === "production" && process.env.B04C_RESTORE_QA_APPROVED_SHA256 !== restoreSha256) {
  throw new Error("production post-cutover rebind source differs from QA-approved SHA-256");
}

const env = { ...process.env, PGHOST: host, PGUSER: user, PGPASSWORD: password,
  PGDATABASE: "postgres", PGSSLMODE: "require", PGCONNECT_TIMEOUT: "15" };
function psql(input, label, readOnly = true) {
  const result = spawnSync(resolvePsqlBinary(), ["-X", "-At", "-v", "ON_ERROR_STOP=1"], {
    input, encoding: "utf8", env: { ...env,
      ...(readOnly ? { PGOPTIONS: "-c default_transaction_read_only=on -c statement_timeout=30000" } : {}) },
    maxBuffer: 4 * 1024 * 1024,
  });
  if (result.status !== 0) throw new Error(`${label} failed: ${(result.stderr || "").slice(-1500)}`);
  return result.stdout.trim();
}

const identity = psql("select current_database()||'|'||current_user;", "identity");
if (!identity.startsWith("postgres|")) throw new Error("unexpected database identity");
const history = new Set(psql("select version from supabase_migrations.schema_migrations order by version;", "migration history").split("\n").filter(Boolean));
for (const dependency of ["202609140004", "202609150007", "202609150010"]) {
  if (!history.has(dependency)) throw new Error(`missing B0.4c dependency ${dependency}`);
}
if (!history.has("202609160000") || !history.has("202609160002")) {
  throw new Error("B0.4c compatibility and rebind migrations must be applied first");
}
if (target === "qa" && (!history.has(version) || !history.has("202609160003"))) {
  throw new Error("QA final security and rebind restore migrations must already be applied");
}
if (target === "production" && (history.has(version) || history.has("202609160003"))) {
  throw new Error("production final cutover already applied or inconsistent");
}
const local = readdirSync("supabase/migrations").filter((item) => /^\d+_.+\.sql$/.test(item)).sort();
const pending = local.filter((item) => !history.has(item.split("_")[0]));
const expected = new Set([
  ...(target === "qa" ? ["202608220002_schedule_care_reminders.sql", "202608260003_notification_event_type_constraint_cleanup.sql"] : []),
  ...(target === "production" ? [filename, restoreFilename] : []),
]);
if (pending.length !== expected.size || pending.some((item) => !expected.has(item))) {
  throw new Error(`unexpected pending migrations: ${pending.join(",")}`);
}
const preflight = JSON.parse(psql(`select json_build_object(
  'digest',to_regprocedure('extensions.digest(text,text)') is not null,
  'member',to_regprocedure('public.is_baby_member(uuid)') is not null,
  'memory',to_regprocedure('public.can_view_memory_post(uuid)') is not null,
  'legacyActiveTokens',(select count(*) from public.push_tokens where disabled_at is null),
  'unprovenActiveTokens',(select count(*) from public.push_tokens where disabled_at is null and installation_secret_hash is null),
  'existingEvents',(select count(*) from public.notification_events)
)::text;`, "dependency preflight"));
if (!preflight.digest || !preflight.member || !preflight.memory) throw new Error("B0.4c dependency preflight failed");
if (target === "production" && (preflight.legacyActiveTokens < 1 || preflight.unprovenActiveTokens !== 0)) {
  throw new Error("production real-device installation proof gate has not passed");
}
console.log(JSON.stringify({ target, projectRef, execute, identity, version, sha256,
  restoreSha256, pending, preflight }));
if (!execute) process.exit(0);
if (history.has(version)) throw new Error("B0.4c migration already applied; refusing to replay against remote project");
const confirm = target === "qa" ? "APPLY_B04C_QA" : "APPLY_B04C_PRODUCTION";
if (process.env.B04C_APPLY_CONFIRM !== confirm) throw new Error(`${target} B0.4c explicit confirmation missing`);
const name = "b04c_notification_security";
const sql = `begin; set local lock_timeout='5s'; set local statement_timeout='120s';\n${source}\n`
  + `insert into supabase_migrations.schema_migrations(version,name) values ('${version}','${name}');\n`
  + `${restoreSource}\ninsert into supabase_migrations.schema_migrations(version,name) values ('202609160003','b04c_push_rebind_post_cutover');\ncommit;`;
psql(sql, `atomic ${target} B0.4c apply`, false);
const post = JSON.parse(psql(`select json_build_object(
  'history',(select count(*) from supabase_migrations.schema_migrations where version='${version}'),
  'restoreHistory',(select count(*) from supabase_migrations.schema_migrations where version='202609160003'),
  'register',to_regprocedure('public.register_current_push_token(text,text,text,text,text,text)') is not null,
  'rebindWrapper',pg_get_functiondef('public.register_current_push_token(text,text,text,text,text,text)'::regprocedure) like '%register_current_push_token_v2%',
  'unregister',to_regprocedure('public.unregister_current_push_token(text)') is not null,
  'claim',to_regprocedure('public.claim_notification_event_dispatch(uuid)') is not null,
  'legacyUnprovenActive',(select count(*) from public.push_tokens where installation_secret_hash is null and disabled_at is null),
  'directTokenWritePolicies',(select count(*) from pg_policies where schemaname='public' and tablename='push_tokens' and cmd in ('INSERT','UPDATE','DELETE')),
  'statusConstraint',(select pg_get_constraintdef(oid) from pg_constraint where conrelid='public.notification_events'::regclass and conname='notification_events_status_check')
)::text;`, "post-apply verification"));
if (post.history !== 1 || post.restoreHistory !== 1 || !post.register || !post.rebindWrapper || !post.unregister || !post.claim
    || post.legacyUnprovenActive !== 0 || post.directTokenWritePolicies !== 0
    || !post.statusConstraint?.includes("dispatching")) throw new Error(`B0.4c post-apply contract mismatch: ${JSON.stringify(post)}`);
console.log(JSON.stringify({ target, applied: version, sha256, post }));
