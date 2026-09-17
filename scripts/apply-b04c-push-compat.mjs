import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { QA_PROJECT_REF, PRODUCTION_PROJECT_REF, resolvePsqlBinary } from "./lib/qa-project-config.mjs";

const target = process.argv[2];
const execute = process.argv.includes("--execute");
if (!["qa", "production"].includes(target)) throw new Error("usage: apply-b04c-push-compat.mjs <qa|production> [--execute]");
const projectRef = target === "qa" ? QA_PROJECT_REF : PRODUCTION_PROJECT_REF;
const otherRef = target === "qa" ? PRODUCTION_PROJECT_REF : QA_PROJECT_REF;
const filename = "202609160000_b04c_push_registration_compat.sql";
const version = "202609160000";
const source = readFileSync(`supabase/migrations/${filename}`, "utf8");
const sha256 = createHash("sha256").update(source).digest("hex");
const host = target === "qa" ? process.env.SUPABASE_DB_HOST?.trim() : `db.${projectRef}.supabase.co`;
const user = target === "qa" ? process.env.SUPABASE_DB_USER?.trim() : "postgres";
const password = process.env.SUPABASE_DB_PASSWORD;
const configuredRef = process.env.SUPABASE_PROJECT_REF?.trim();
if (!host || !user || !password || (target === "qa"
  ? (!user.includes(projectRef) || host.includes(otherRef))
  : configuredRef !== projectRef)) throw new Error(`${target} B0.4c compatibility database identity guard failed`);
if (target === "production" && process.env.B04C_COMPAT_QA_APPROVED_SHA256 !== sha256) {
  throw new Error("production compatibility source differs from QA-approved SHA-256");
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
if (history.has(version)) throw new Error("compatibility migration already applied; refusing to replay");
if (target === "qa" && !history.has("202609160001")) throw new Error("QA final migration must remain applied");
if (target === "production" && history.has("202609160001")) throw new Error("production final migration already applied");
const local = readdirSync("supabase/migrations").filter((item) => /^\d+_.+\.sql$/.test(item)).sort();
const pending = local.filter((item) => !history.has(item.split("_")[0]));
const expected = new Set([
  filename,
  ...(target === "qa" ? ["202608220002_schedule_care_reminders.sql", "202608260003_notification_event_type_constraint_cleanup.sql"]
    : ["202609160001_b04c_notification_security.sql"]),
]);
if (pending.length !== expected.size || pending.some((item) => !expected.has(item))) {
  throw new Error(`unexpected pending migrations: ${pending.join(",")}`);
}
const preflight = JSON.parse(psql(`select json_build_object(
  'digest',to_regprocedure('extensions.digest(text,text)') is not null,
  'tokenCount',(select count(*) from public.push_tokens),
  'activeCount',(select count(*) from public.push_tokens where disabled_at is null),
  'directWritePolicies',(select count(*) from pg_policies where schemaname='public' and tablename='push_tokens' and cmd in ('INSERT','UPDATE','DELETE'))
)::text;`, "compatibility preflight"));
if (!preflight.digest) throw new Error("pgcrypto digest dependency missing");
console.log(JSON.stringify({ target, projectRef, execute, version, sha256, pending, preflight }));
if (!execute) process.exit(0);
const confirm = target === "qa" ? "APPLY_B04C_COMPAT_QA" : "APPLY_B04C_COMPAT_PRODUCTION";
if (process.env.B04C_COMPAT_APPLY_CONFIRM !== confirm) throw new Error(`${target} compatibility explicit confirmation missing`);
const sql = `begin; set local lock_timeout='5s'; set local statement_timeout='120s';\n${source}\n`
  + `insert into supabase_migrations.schema_migrations(version,name) values ('${version}','b04c_push_registration_compat');\ncommit;`;
psql(sql, `atomic ${target} B0.4c compatibility apply`, false);
const post = JSON.parse(psql(`select json_build_object(
  'history',(select count(*) from supabase_migrations.schema_migrations where version='${version}'),
  'register',to_regprocedure('public.register_current_push_token(text,text,text,text,text,text)') is not null,
  'unregister',to_regprocedure('public.unregister_current_push_token(text)') is not null,
  'tokenCount',(select count(*) from public.push_tokens),
  'activeCount',(select count(*) from public.push_tokens where disabled_at is null),
  'directWritePolicies',(select count(*) from pg_policies where schemaname='public' and tablename='push_tokens' and cmd in ('INSERT','UPDATE','DELETE'))
)::text;`, "compatibility postflight"));
if (post.history !== 1 || !post.register || !post.unregister
  || post.tokenCount !== preflight.tokenCount || post.activeCount !== preflight.activeCount
  || post.directWritePolicies !== preflight.directWritePolicies) {
  throw new Error(`compatibility postflight mismatch: ${JSON.stringify(post)}`);
}
console.log(JSON.stringify({ target, applied: version, sha256, post }));
