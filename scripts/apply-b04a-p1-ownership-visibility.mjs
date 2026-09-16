import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import {
  PRODUCTION_PROJECT_REF,
  QA_PROJECT_REF,
  resolvePsqlBinary,
} from "./lib/qa-project-config.mjs";
import {
  B04A_P1_EXPECTED_FUNCTION_CONTRACT,
  B04A_P1_EXPECTED_POLICY_CONTRACT,
  B04A_P1_FUNCTION_CONTRACT_SQL,
  B04A_P1_POLICY_CONTRACT_SQL,
  B04A_P1_POLICY_DIAGNOSTIC_SQL,
  B04A_P1_POLICY_ROW_CONTRACT_SQL,
} from "./lib/b04a-p1-ownership-visibility-contract.mjs";

const environment = process.argv[2];
const execute = process.argv.includes("--execute");
if (!new Set(["qa", "production"]).has(environment)) {
  throw new Error("usage: apply-b04a-p1-ownership-visibility.mjs <qa|production> [--execute]");
}

const targets = [
  ["202609140003", "b04a_p1_ownership_lifecycle"],
  ["202609140004", "b04a_p1_memory_visibility_social"],
  ["202609140005", "b04a_p1_memory_recipient_assignment"],
].map(([version, name]) => {
  const filename = `${version}_${name}.sql`;
  const path = resolve("supabase/migrations", filename);
  if (!existsSync(path)) throw new Error(`target migration missing: ${filename}`);
  const source = readFileSync(path);
  return {
    version,
    name,
    filename,
    path,
    sha256: createHash("sha256").update(source).digest("hex"),
  };
});
const manifestSha256 = createHash("sha256")
  .update(targets.map((target) => `${target.version}:${target.sha256}`).join("\n"))
  .digest("hex");

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
    throw new Error("QA B0.4a ownership/visibility database guard failed");
  }
} else {
  const configuredRef = process.env.SUPABASE_PROJECT_REF?.trim() ?? "";
  host = `db.${projectRef}.supabase.co`;
  user = "postgres";
  if (!password || configuredRef !== projectRef || configuredRef === otherRef) {
    throw new Error("production B0.4a ownership/visibility database guard failed");
  }
  const approvedManifest = process.env.B04A_P1_OWNERSHIP_VISIBILITY_QA_APPROVED_SHA256?.trim() ?? "";
  if (!approvedManifest || approvedManifest !== manifestSha256) {
    throw new Error("production source manifest does not match the QA-approved SHA-256");
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
    cwd: process.cwd(),
    encoding: "utf8",
    env: pgEnv,
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
if (!applied.has("202609140002")) throw new Error("B0.4a-1 provenance baseline migration is missing");
const targetApplied = targets.map((target) => applied.has(target.version));
const firstPendingIndex = targetApplied.findIndex((isApplied) => !isApplied);
const appliedPrefixLength = firstPendingIndex === -1 ? targetApplied.length : firstPendingIndex;
if (targetApplied.slice(appliedPrefixLength).some(Boolean)) {
  throw new Error("non-prefix B0.4a-2/B0.4a-3 migration state detected");
}

const localMigrations = readdirSync("supabase/migrations")
  .filter((name) => /^\d+_.+\.sql$/.test(name)).sort();
const pending = localMigrations.filter((name) => !applied.has(name.split("_")[0]));
const expectedPending = environment === "qa"
  ? new Set([
      "202608220002_schedule_care_reminders.sql",
      "202608260003_notification_event_type_constraint_cleanup.sql",
      ...targets.slice(appliedPrefixLength).map((target) => target.filename),
    ])
  : new Set(targets.slice(appliedPrefixLength).map((target) => target.filename));
if (pending.length !== expectedPending.size || pending.some((name) => !expectedPending.has(name))) {
  throw new Error(`unexpected ${environment} pending migrations: ${pending.join(", ") || "none"}`);
}

const preflight = psql([
  "-AtF", "|", "-c",
  `select
     (select count(*) from public.care_logs where created_by is null),
     (select count(*) from public.growth_records where created_by is null),
     (select count(*) from public.diary_entries diary_row where diary_row.deleted_at is null and not exists (
       select 1 from public.baby_members member_row where member_row.baby_id=diary_row.baby_id
         and member_row.user_id=diary_row.author_id and member_row.status::text='active'
     )),
     (select count(*) from public.memory_posts post_row where post_row.deleted_at is null and not exists (
       select 1 from public.baby_members member_row where member_row.baby_id=post_row.baby_id
         and member_row.user_id=post_row.author_id and member_row.status::text='active'
     )),
     (select count(*) from public.memory_tags tag_row join public.memory_posts post_row on post_row.id=tag_row.memory_post_id
       where tag_row.tag_type='family_member' and tag_row.status='approved' and not exists (
         select 1 from public.baby_members member_row where member_row.baby_id=post_row.baby_id
           and member_row.user_id=tag_row.tagged_user_id and member_row.status::text='active'
       )),
     (select count(*) from public.memory_selected_people selected_row join public.memory_posts post_row on post_row.id=selected_row.memory_post_id
       where not exists (
         select 1 from public.baby_members member_row where member_row.baby_id=post_row.baby_id
           and member_row.user_id=selected_row.user_id and member_row.status::text='active'
       ) and not exists (
         select 1 from public.memory_friends friend_row where friend_row.baby_id=post_row.baby_id
           and friend_row.user_id=selected_row.user_id and friend_row.status='active'
       ));`,
], "authorization preflight read");

function deployedState() {
  const functionSecurity = psql([
    "-AtF", "|", "-c",
    `select procedure_row.proname, procedure_row.prosecdef,
       coalesce(array_to_string(procedure_row.proconfig, ','), ''),
       has_function_privilege('authenticated', procedure_row.oid, 'EXECUTE'),
       has_function_privilege('anon', procedure_row.oid, 'EXECUTE')
     from pg_proc procedure_row
     where procedure_row.oid in (
       'public.current_baby_write_permission(uuid)'::regprocedure,
       'public.can_manage_care_log(uuid)'::regprocedure,
       'public.can_manage_growth_record(uuid)'::regprocedure,
       'public.can_manage_diary_entry(uuid)'::regprocedure,
       'public.can_manage_memory_post(uuid)'::regprocedure,
       'public.can_view_memory_post(uuid)'::regprocedure,
       'public.can_interact_with_memory_post(uuid)'::regprocedure,
       'public.can_assign_memory_recipient_for_write(uuid,uuid,boolean)'::regprocedure
     ) order by procedure_row.proname;`,
  ], "function security state");
  const policyCount = psql([
    "-At", "-c",
    `select count(*) from pg_policies where schemaname='public' and policyname in (
       'care_logs_insert_editor','care_logs_update_editor','care_logs_delete_editor',
       'growth_records_insert_editor','growth_records_update_editor','growth_records_delete_editor',
       'diary_entries_insert_admin_editor','diary_entries_update_author_admin',
       'memory_posts_insert_editor','memory_posts_select_visible','memory_posts_update_author_or_admin','memory_posts_delete_author_or_admin',
       'memory_tags_select_visible','memory_tags_insert_manager',
       'memory_selected_people_insert_manager',
       'memory_comments_insert_member','memory_comments_update_author','memory_comments_delete_author_or_post_owner',
       'memory_reactions_insert_member','memory_reactions_update_author','memory_reactions_delete_author'
     );`,
  ], "policy state");
  const functionLines = functionSecurity.stdout.split("\n").filter(Boolean);
  if (functionLines.length !== 8 || functionLines.some((line) => {
    const [, securityDefiner, config, authenticatedExecute, anonExecute] = line.split("|");
    return securityDefiner !== "t" || config !== "search_path=public"
      || authenticatedExecute !== "t" || anonExecute !== "f";
  })) {
    throw new Error(`unexpected function security state: ${functionSecurity.stdout}`);
  }
  if (policyCount.stdout !== "21") {
    throw new Error(`unexpected hardened policy count: ${policyCount.stdout}`);
  }
  const functionContract = psql([
    "-At", "-c", B04A_P1_FUNCTION_CONTRACT_SQL,
  ], "exact function contract");
  const policyContract = psql([
    "-At", "-c", B04A_P1_POLICY_CONTRACT_SQL,
  ], "exact policy contract");
  if (functionContract.stdout !== B04A_P1_EXPECTED_FUNCTION_CONTRACT) {
    throw new Error(`unexpected function contract: ${functionContract.stdout}`);
  }
  if (policyContract.stdout !== B04A_P1_EXPECTED_POLICY_CONTRACT) {
    const policyRows = psql([
      "-At", "-c", B04A_P1_POLICY_ROW_CONTRACT_SQL,
    ], "policy contract diagnostics");
    const policyDefinitions = psql([
      "-At", "-c", B04A_P1_POLICY_DIAGNOSTIC_SQL,
    ], "policy definition diagnostics");
    throw new Error(`unexpected policy contract: ${policyContract.stdout}\n${policyRows.stdout}\n${policyDefinitions.stdout}`);
  }
  return {
    functionSecurity: functionSecurity.stdout,
    policyCount: policyCount.stdout,
    functionContract: functionContract.stdout,
    policyContract: policyContract.stdout,
  };
}

if (targetApplied.every(Boolean)) {
  if (execute) throw new Error("target migrations are already applied; refusing to reapply");
  console.log(JSON.stringify({
    environment,
    projectRef,
    alreadyApplied: true,
    targets: targets.map(({ version, sha256 }) => ({ version, sha256 })),
    manifestSha256,
    pending,
    preflight: preflight.stdout,
    ...deployedState(),
  }));
  process.exit(0);
}

console.log(JSON.stringify({
  environment,
  projectRef,
  execute,
  targets: targets.map(({ version, sha256 }) => ({ version, sha256 })),
  manifestSha256,
  pending,
  preflight: preflight.stdout,
}));
if (!execute) process.exit(0);

const confirmationVariable = environment === "qa"
  ? "QA_B04A_P1_OWNERSHIP_VISIBILITY_CONFIRM"
  : "PRODUCTION_B04A_P1_OWNERSHIP_VISIBILITY_CONFIRM";
const expectedConfirmation = environment === "qa"
  ? `APPLY_B04A_P1_OWNERSHIP_VISIBILITY_${QA_PROJECT_REF}`
  : `APPLY_B04A_P1_OWNERSHIP_VISIBILITY_PRODUCTION_${PRODUCTION_PROJECT_REF}`;
if ((process.env[confirmationVariable]?.trim() ?? "") !== expectedConfirmation) {
  throw new Error(`${environment} B0.4a ownership/visibility explicit confirmation missing`);
}

const applyArgs = ["--single-transaction", "-c", "set lock_timeout='5s'; set statement_timeout='90s';"];
for (const target of targets.slice(appliedPrefixLength)) {
  applyArgs.push("-f", target.path);
  applyArgs.push(
    "-c",
    `insert into supabase_migrations.schema_migrations(version,name) values ('${target.version}','${target.name}');`,
  );
}
const startedAt = performance.now();
const applyResult = psql(applyArgs, `atomic ${environment} B0.4a ownership/visibility apply`);
const elapsedMs = Math.round(performance.now() - startedAt);

const history = psql([
  "-AtF", "|", "-c",
  `select version,name from supabase_migrations.schema_migrations where version in (${targets
    .map((target) => `'${target.version}'`).join(",")}) order by version`,
], "post-apply migration history read");
const expectedHistory = targets.map((target) => `${target.version}|${target.name}`).join("\n");
if (history.stdout !== expectedHistory) {
  throw new Error(`unexpected post-apply migration history: ${history.stdout || "empty"}`);
}

console.log(JSON.stringify({
  environment,
  applied: targets.slice(appliedPrefixLength).map((target) => target.version),
  targets: targets.map(({ version, sha256 }) => ({ version, sha256 })),
  manifestSha256,
  elapsedMs,
  warnings: applyResult.stderr || null,
  ...deployedState(),
}));
