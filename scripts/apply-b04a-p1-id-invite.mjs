import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import {
  PRODUCTION_PROJECT_REF,
  QA_PROJECT_REF,
  resolvePsqlBinary,
} from "./lib/qa-project-config.mjs";

const environment = process.argv[2];
const execute = process.argv.includes("--execute");
if (!new Set(["qa", "production"]).has(environment)) {
  throw new Error("usage: apply-b04a-p1-id-invite.mjs <qa|production> [--execute]");
}

const targetVersion = "202609140002";
const targetName = "b04a_p1_id_invite_current_authority";
const targetFilename = `${targetVersion}_${targetName}.sql`;
const targetPath = resolve("supabase/migrations", targetFilename);
if (!existsSync(targetPath)) throw new Error("target migration file missing");
const sourceSha256 = createHash("sha256").update(readFileSync(targetPath)).digest("hex");

const projectRef = environment === "qa" ? QA_PROJECT_REF : PRODUCTION_PROJECT_REF;
const otherRef = environment === "qa" ? PRODUCTION_PROJECT_REF : QA_PROJECT_REF;
const password = process.env.SUPABASE_DB_PASSWORD ?? "";
let host = "";
let user = "";
if (environment === "qa") {
  host = process.env.SUPABASE_DB_HOST?.trim() ?? "";
  user = process.env.SUPABASE_DB_USER?.trim() ?? "";
  if (!host || !user || !password || !user.includes(projectRef)
      || host.includes(otherRef) || user.includes(otherRef)) {
    throw new Error("QA B0.4a P1 database guard failed");
  }
} else {
  const configuredRef = process.env.SUPABASE_PROJECT_REF?.trim() ?? "";
  host = `db.${projectRef}.supabase.co`;
  user = "postgres";
  if (!password || configuredRef !== projectRef || configuredRef === otherRef) {
    throw new Error("production B0.4a P1 database guard failed");
  }
  const qaApprovedSha = process.env.B04A_P1_QA_APPROVED_SHA256?.trim() ?? "";
  if (!qaApprovedSha || qaApprovedSha !== sourceSha256) {
    throw new Error("production source does not match the QA-approved SHA-256");
  }
}

const pgEnv = {
  ...process.env,
  PGHOST: host,
  PGPORT: process.env.SUPABASE_DB_PORT?.trim() || "5432",
  PGUSER: user,
  PGPASSWORD: password,
  PGDATABASE: process.env.SUPABASE_DB_NAME?.trim() || "postgres",
  PGSSLMODE: "require",
  PGCONNECT_TIMEOUT: "15",
};
const psqlBin = resolvePsqlBinary();
function psql(args, label) {
  const result = spawnSync(psqlBin, ["-X", "-v", "ON_ERROR_STOP=1", ...args], {
    cwd: process.cwd(), encoding: "utf8", env: pgEnv,
  });
  if (result.status !== 0) {
    throw new Error(`${label} failed:\n${(result.stderr || result.stdout).slice(0, 4000)}`);
  }
  return { stdout: result.stdout.trim(), stderr: result.stderr.trim() };
}

const identity = psql([
  "-AtF", "|", "-c",
  "select current_database(),current_user,current_setting('server_version_num')",
], `${environment} connection guard`);
if (!identity.stdout.startsWith("postgres|")) {
  throw new Error(`unexpected ${environment} database identity`);
}

const appliedRows = psql([
  "-At", "-c", "select version from supabase_migrations.schema_migrations order by version",
], "migration history read");
const applied = new Set(appliedRows.stdout.split("\n").filter(Boolean));
if (!applied.has("202609140001")) throw new Error("B0.4a P0 baseline migration is missing");

const local = readdirSync("supabase/migrations")
  .filter((name) => /^\d+_.+\.sql$/.test(name)).sort();
const pending = local.filter((name) => !applied.has(name.split("_")[0]));
const expectedPending = environment === "qa"
  ? new Set([
      "202608220002_schedule_care_reminders.sql",
      "202608260003_notification_event_type_constraint_cleanup.sql",
      ...(applied.has(targetVersion) ? [] : [targetFilename]),
    ])
  : new Set(applied.has(targetVersion) ? [] : [targetFilename]);
if (pending.length !== expectedPending.size || pending.some((name) => !expectedPending.has(name))) {
  throw new Error(`unexpected ${environment} pending migrations: ${pending.join(", ") || "none"}`);
}

const requestStats = psql([
  "-AtF", "|", "-c",
  `select
     count(*) filter (where request_row.status='pending'),
     count(*) filter (
       where request_row.status='pending'
         and not exists (
           select 1 from public.baby_members issuer
           where issuer.baby_id=request_row.baby_id
             and issuer.user_id=request_row.sender_id
             and issuer.status::text='active'
             and issuer.permission_role::text='admin'
         )
     ),
     count(*) filter (where request_row.status='pending' and request_row.expires_at<=now())
   from public.darin_invite_requests request_row`,
], "invite request aggregate read");
const functionSecurity = psql([
  "-AtF", "|", "-c",
  `select
     procedure_row.prosecdef,
     coalesce(array_to_string(procedure_row.proconfig, ','), ''),
     has_function_privilege('authenticated', procedure_row.oid, 'EXECUTE'),
     has_function_privilege('anon', procedure_row.oid, 'EXECUTE')
   from pg_proc procedure_row
   where procedure_row.oid='public.respond_darin_id_invite_request(uuid,boolean)'::regprocedure`,
], "function security contract read");
if (functionSecurity.stdout !== "t|search_path=public|t|f") {
  throw new Error(`unexpected function security contract: ${functionSecurity.stdout}`);
}
if (applied.has(targetVersion)) {
  if (execute) throw new Error("target migration is already applied; refusing to reapply");
  const definition = psql([
    "-At", "-c",
    "select md5(pg_get_functiondef('public.respond_darin_id_invite_request(uuid,boolean)'::regprocedure))",
  ], "existing function definition hash");
  console.log(JSON.stringify({ environment, projectRef, targetVersion, alreadyApplied: true, sourceSha256, functionDefinitionMd5: definition.stdout, functionSecurity: functionSecurity.stdout, pending, requestStats: requestStats.stdout }));
  process.exit(0);
}

console.log(JSON.stringify({ environment, projectRef, targetVersion, sourceSha256, functionSecurity: functionSecurity.stdout, pending, requestStats: requestStats.stdout, execute }));
if (!execute) process.exit(0);

const confirmationVariable = environment === "qa"
  ? "QA_B04A_P1_CONFIRM"
  : "PRODUCTION_B04A_P1_CONFIRM";
const expectedConfirmation = environment === "qa"
  ? `APPLY_B04A_P1_ID_INVITE_${QA_PROJECT_REF}`
  : `APPLY_B04A_P1_ID_INVITE_PRODUCTION_${PRODUCTION_PROJECT_REF}`;
if ((process.env[confirmationVariable]?.trim() ?? "") !== expectedConfirmation) {
  throw new Error(`${environment} B0.4a P1 explicit confirmation missing`);
}

const startedAt = performance.now();
const appliedResult = psql([
  "--single-transaction",
  "-c", "set lock_timeout='5s'; set statement_timeout='60s';",
  "-f", targetPath,
  "-c", `insert into supabase_migrations.schema_migrations(version,name) values ('${targetVersion}','${targetName}');`,
], `atomic ${environment} B0.4a P1 apply`);
const elapsedMs = Math.round(performance.now() - startedAt);

const after = psql([
  "-AtF", "|", "-c",
  `select version,name from supabase_migrations.schema_migrations where version='${targetVersion}'`,
], "post-apply migration history read");
if (after.stdout !== `${targetVersion}|${targetName}`) {
  throw new Error(`unexpected post-apply migration state: ${after.stdout || "empty"}`);
}
const definition = psql([
  "-At", "-c",
  "select md5(pg_get_functiondef('public.respond_darin_id_invite_request(uuid,boolean)'::regprocedure))",
], "post-apply function definition hash");

console.log(JSON.stringify({
  environment,
  applied: targetVersion,
  sourceSha256,
  functionDefinitionMd5: definition.stdout,
  functionSecurity: functionSecurity.stdout,
  elapsedMs,
  warnings: appliedResult.stderr || null,
}));
