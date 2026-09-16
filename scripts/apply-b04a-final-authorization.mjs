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
  throw new Error("usage: apply-b04a-final-authorization.mjs <qa|production> [--execute]");
}

const targets = [
  ["202609150006", "b04a_p1_profile_baby_authorization"],
  ["202609150007", "b04a_p1_growthbook_caution_authorization"],
].map(([version, name]) => {
  const filename = `${version}_${name}.sql`;
  const path = resolve("supabase/migrations", filename);
  if (!existsSync(path)) throw new Error(`target migration missing: ${filename}`);
  const sha256 = createHash("sha256").update(readFileSync(path)).digest("hex");
  return { version, name, filename, path, sha256 };
});

const manifestSha256 = createHash("sha256")
  .update(targets.map(({ version, sha256 }) => `${version}:${sha256}`).join("\n"))
  .digest("hex");

const projectRef = environment === "qa" ? QA_PROJECT_REF : PRODUCTION_PROJECT_REF;
const otherRef = environment === "qa" ? PRODUCTION_PROJECT_REF : QA_PROJECT_REF;
const password = process.env.SUPABASE_DB_PASSWORD ?? "";
let host;
let user;
if (environment === "qa") {
  host = process.env.SUPABASE_DB_HOST?.trim() ?? "";
  user = process.env.SUPABASE_DB_USER?.trim() ?? "";
  if (!host || !user || !password || !user.includes(projectRef)
      || host.includes(otherRef) || user.includes(otherRef)) {
    throw new Error("QA B0.4a final authorization database guard failed");
  }
} else {
  const configuredRef = process.env.SUPABASE_PROJECT_REF?.trim() ?? "";
  host = `db.${projectRef}.supabase.co`;
  user = "postgres";
  if (!password || configuredRef !== projectRef || configuredRef === otherRef) {
    throw new Error("production B0.4a final authorization database guard failed");
  }
  const approvedManifest = process.env.B04A_FINAL_AUTHORIZATION_QA_APPROVED_SHA256?.trim() ?? "";
  if (approvedManifest !== manifestSha256) {
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
    throw new Error(`${label} failed:\n${(result.stderr || result.stdout).slice(0, 5000)}`);
  }
  return { stdout: result.stdout.trim(), stderr: result.stderr.trim() };
}

function query(sql, label) {
  return psql(["-At", "-c", sql], label).stdout;
}

function hashContract(parts) {
  return createHash("sha256").update(parts.join("\n")).digest("hex");
}

const identity = query(
  "select current_database()||'|'||current_user||'|'||current_setting('server_version_num')",
  `${environment} connection guard`,
);
if (!identity.startsWith("postgres|")) throw new Error(`unexpected ${environment} database identity`);

const appliedRows = query(
  "select version from supabase_migrations.schema_migrations order by version",
  "migration history read",
);
const applied = new Set(appliedRows.split("\n").filter(Boolean));
if (!applied.has("202609140005")) {
  throw new Error("B0.4a-2/3 provenance baseline migration is missing");
}
const targetApplied = targets.map(({ version }) => applied.has(version));
const firstPendingIndex = targetApplied.findIndex((value) => !value);
const appliedPrefixLength = firstPendingIndex === -1 ? targets.length : firstPendingIndex;
if (targetApplied.slice(appliedPrefixLength).some(Boolean)) {
  throw new Error("non-prefix B0.4a final migration state detected");
}

const localMigrations = readdirSync("supabase/migrations")
  .filter((name) => /^\d+_.+\.sql$/.test(name)).sort();
const pending = localMigrations.filter((name) => !applied.has(name.split("_")[0]));
const expectedPending = environment === "qa"
  ? new Set([
      "202608220002_schedule_care_reminders.sql",
      "202608260003_notification_event_type_constraint_cleanup.sql",
      ...targets.slice(appliedPrefixLength).map(({ filename }) => filename),
    ])
  : new Set(targets.slice(appliedPrefixLength).map(({ filename }) => filename));
if (pending.length !== expectedPending.size || pending.some((name) => !expectedPending.has(name))) {
  throw new Error(`unexpected ${environment} pending migrations: ${pending.join(", ") || "none"}`);
}

const dependencyState = query(`
  select jsonb_build_object(
    'requiredTables', (select count(*) from information_schema.tables where table_schema='public' and table_name in (
      'profiles','babies','baby_members','memory_friends','memory_posts','diary_entries',
      'growth_books','growth_book_pages','growth_book_media','growth_book_comments','baby_caution_foods'
    )),
    'requiredFunctions', (select count(*) from pg_proc where oid in (
      'public.baby_permission(uuid)'::regprocedure,
      'public.is_baby_member(uuid)'::regprocedure,
      'public.is_friend_visible_memory_contributor(uuid,uuid)'::regprocedure,
      'public.can_view_growth_book(uuid)'::regprocedure,
      'public.can_edit_growth_book(uuid)'::regprocedure,
      'public.can_view_growth_book_page(uuid)'::regprocedure
    )),
    'careReminderDependency', false,
    'notificationConstraintDependency', false
  )::text`, "dependency preflight");
const dependency = JSON.parse(dependencyState);
if (dependency.requiredTables !== 11 || dependency.requiredFunctions !== 6) {
  throw new Error(`target dependency preflight failed: ${dependencyState}`);
}

const anomalyState = query(`
  select jsonb_build_object(
    'pageBookMismatch', (select count(*) from public.growth_book_pages page_row left join public.growth_books book_row
      on book_row.id=page_row.growth_book_id and book_row.baby_id=page_row.baby_id where book_row.id is null),
    'pageDiaryMismatch', (select count(*) from public.growth_book_pages page_row left join public.diary_entries diary_row
      on diary_row.id=page_row.diary_entry_id and diary_row.baby_id=page_row.baby_id
      where page_row.diary_entry_id is not null and diary_row.id is null),
    'mediaBookMismatch', (select count(*) from public.growth_book_media media_row left join public.growth_books book_row
      on book_row.id=media_row.growth_book_id and book_row.baby_id=media_row.baby_id where book_row.id is null),
    'mediaPageMismatch', (select count(*) from public.growth_book_media media_row left join public.growth_book_pages page_row
      on page_row.id=media_row.page_id and page_row.baby_id=media_row.baby_id
      where media_row.page_id is not null and page_row.id is null),
    'commentBookMismatch', (select count(*) from public.growth_book_comments comment_row left join public.growth_books book_row
      on book_row.id=comment_row.growth_book_id and book_row.baby_id=comment_row.baby_id where book_row.id is null),
    'commentPageMismatch', (select count(*) from public.growth_book_comments comment_row left join public.growth_book_pages page_row
      on page_row.id=comment_row.page_id and page_row.baby_id=comment_row.baby_id
      where comment_row.page_id is not null and page_row.id is null),
    'commentDiaryMismatch', (select count(*) from public.growth_book_comments comment_row left join public.diary_entries diary_row
      on diary_row.id=comment_row.diary_entry_id and diary_row.baby_id=comment_row.baby_id
      where comment_row.diary_entry_id is not null and diary_row.id is null),
    'cautionBabyMismatch', (select count(*) from public.baby_caution_foods food_row left join public.babies baby_row
      on baby_row.id=food_row.baby_id where baby_row.id is null)
  )::text`, "data-integrity preflight");
const anomalies = JSON.parse(anomalyState);
if (Object.values(anomalies).some((value) => Number(value) !== 0)) {
  throw new Error(`existing data is incompatible with final authorization constraints: ${anomalyState}`);
}

const partialMarkers = Number(query(`
  select
    (select count(*) from pg_constraint where conname in (
      'growth_book_pages_book_baby_fk','growth_book_pages_diary_baby_fk',
      'growth_book_media_book_baby_fk','growth_book_media_page_baby_fk',
      'growth_book_comments_book_baby_fk','growth_book_comments_diary_baby_fk','growth_book_comments_page_baby_fk'
    ))
    + (case when to_regprocedure('public.list_visible_profile_display(uuid[])') is null then 0 else 1 end)
    + (select count(*) from pg_trigger where not tgisinternal and tgname='babies_profile_identity_guard')`,
  "partial-state preflight",
));
if (appliedPrefixLength === 0 && partialMarkers !== 0) {
  throw new Error(`partial B0.4a final deployment markers found without migration history: ${partialMarkers}`);
}

const functionNames = [
  "baby_caution_food_identity_guard", "baby_profile_identity_guard",
  "can_manage_growth_book_comment", "growth_book_comment_graph_guard",
  "growth_book_diary_parent_valid", "growth_book_identity_guard",
  "growth_book_media_graph_guard", "growth_book_page_graph_guard",
  "growth_book_page_identity_guard", "list_visible_profile_display",
  "prepare_account_deletion",
];
const policyNames = [
  "profiles_select_own", "babies_update_admin_or_editor",
  "growth_book_pages_select_member", "growth_book_pages_insert_editor", "growth_book_pages_update_editor",
  "growth_book_media_select_member", "growth_book_media_insert_editor", "growth_book_media_delete_editor",
  "growth_book_comments_select_member", "growth_book_comments_select_moderated",
  "growth_book_comments_insert_member", "growth_book_comments_update_author_admin",
  "baby_caution_foods_select_member", "baby_caution_foods_insert_member",
  "baby_caution_foods_update_member", "baby_caution_foods_delete_admin",
];
const constraintNames = [
  "growth_books_id_baby_key", "diary_entries_id_baby_key",
  "growth_book_pages_book_baby_fk", "growth_book_pages_diary_baby_fk",
  "growth_book_media_book_baby_fk", "growth_book_media_page_baby_fk",
  "growth_book_comments_book_baby_fk", "growth_book_comments_diary_baby_fk",
  "growth_book_comments_page_baby_fk",
];
const triggerNames = [
  "babies_profile_identity_guard", "growth_books_identity_guard", "growth_book_pages_identity_guard",
  "growth_book_pages_graph_guard", "growth_book_media_graph_guard",
  "growth_book_comments_graph_guard", "baby_caution_foods_identity_guard",
];

function sqlList(values) {
  return values.map((value) => `'${value}'`).join(",");
}

function deployedState() {
  const functions = query(`
    select coalesce(jsonb_agg(jsonb_build_object(
      'signature', procedure_row.oid::regprocedure::text,
      'securityDefiner', procedure_row.prosecdef,
      'config', coalesce(procedure_row.proconfig, '{}'::text[]),
      'definition', pg_get_functiondef(procedure_row.oid)
    ) order by procedure_row.oid::regprocedure::text), '[]'::jsonb)::text
    from pg_proc procedure_row join pg_namespace namespace_row on namespace_row.oid=procedure_row.pronamespace
    where namespace_row.nspname='public' and procedure_row.proname in (${sqlList(functionNames)})`,
  "function contract");
  const policies = query(`
    select coalesce(jsonb_agg(jsonb_build_object(
      'table', tablename, 'name', policyname, 'command', cmd, 'roles', roles,
      'using', coalesce(qual,''), 'check', coalesce(with_check,'')
    ) order by tablename,policyname), '[]'::jsonb)::text
    from pg_policies where schemaname='public' and policyname in (${sqlList(policyNames)})`,
  "policy contract");
  const constraints = query(`
    select coalesce(jsonb_agg(jsonb_build_object(
      'table', constraint_row.conrelid::regclass::text, 'name', constraint_row.conname,
      'type', constraint_row.contype, 'validated', constraint_row.convalidated,
      'definition', pg_get_constraintdef(constraint_row.oid, true)
    ) order by constraint_row.conname), '[]'::jsonb)::text
    from pg_constraint constraint_row where constraint_row.conname in (${sqlList(constraintNames)})`,
  "constraint contract");
  const triggers = query(`
    select coalesce(jsonb_agg(jsonb_build_object(
      'table', trigger_row.tgrelid::regclass::text, 'name', trigger_row.tgname,
      'function', trigger_row.tgfoid::regprocedure::text,
      'definition', pg_get_triggerdef(trigger_row.oid, true)
    ) order by trigger_row.tgname), '[]'::jsonb)::text
    from pg_trigger trigger_row where not trigger_row.tgisinternal
      and trigger_row.tgname in (${sqlList(triggerNames)})`,
  "trigger contract");
  const grants = query(`
    select jsonb_build_object(
      'profileAuthenticated', has_function_privilege('authenticated','public.list_visible_profile_display(uuid[])','EXECUTE'),
      'profileAnon', has_function_privilege('anon','public.list_visible_profile_display(uuid[])','EXECUTE'),
      'deletionAuthenticated', has_function_privilege('authenticated','public.prepare_account_deletion()','EXECUTE'),
      'deletionAnon', has_function_privilege('anon','public.prepare_account_deletion()','EXECUTE'),
      'commentAuthenticated', has_function_privilege('authenticated','public.can_manage_growth_book_comment(uuid,uuid,uuid)','EXECUTE'),
      'commentAnon', has_function_privilege('anon','public.can_manage_growth_book_comment(uuid,uuid,uuid)','EXECUTE'),
      'diaryAuthenticated', has_function_privilege('authenticated','public.growth_book_diary_parent_valid(uuid,uuid)','EXECUTE'),
      'diaryAnon', has_function_privilege('anon','public.growth_book_diary_parent_valid(uuid,uuid)','EXECUTE')
    )::text`, "execute grant contract");

  if (JSON.parse(functions).length !== functionNames.length) throw new Error("incomplete function contract");
  if (JSON.parse(policies).length !== policyNames.length) throw new Error("incomplete policy contract");
  if (JSON.parse(constraints).length !== constraintNames.length) throw new Error("incomplete constraint contract");
  if (JSON.parse(triggers).length !== triggerNames.length) throw new Error("incomplete trigger contract");
  const grantState = JSON.parse(grants);
  if (!grantState.profileAuthenticated || grantState.profileAnon
      || !grantState.deletionAuthenticated || grantState.deletionAnon
      || !grantState.commentAuthenticated || grantState.commentAnon
      || !grantState.diaryAuthenticated || grantState.diaryAnon) {
    throw new Error(`unexpected execute grants: ${grants}`);
  }
  return {
    functionContractSha256: hashContract([functions]),
    policyContractSha256: hashContract([policies]),
    constraintContractSha256: hashContract([constraints]),
    triggerContractSha256: hashContract([triggers]),
    grantContractSha256: hashContract([grants]),
    deployedContractSha256: hashContract([functions, policies, constraints, triggers, grants]),
  };
}

const common = {
  environment,
  projectRef,
  identity,
  targets: targets.map(({ version, sha256 }) => ({ version, sha256 })),
  manifestSha256,
  pending,
  dependency,
  anomalies,
};

if (targetApplied.every(Boolean)) {
  if (execute) throw new Error("target migrations are already applied; refusing to reapply");
  console.log(JSON.stringify({ ...common, alreadyApplied: true, ...deployedState() }));
  process.exit(0);
}

console.log(JSON.stringify({ ...common, execute, partialMarkers }));
if (!execute) process.exit(0);

const confirmationVariable = environment === "qa"
  ? "QA_B04A_FINAL_AUTHORIZATION_CONFIRM"
  : "PRODUCTION_B04A_FINAL_AUTHORIZATION_CONFIRM";
const expectedConfirmation = environment === "qa"
  ? `APPLY_B04A_FINAL_AUTHORIZATION_${QA_PROJECT_REF}`
  : `APPLY_B04A_FINAL_AUTHORIZATION_PRODUCTION_${PRODUCTION_PROJECT_REF}`;
if ((process.env[confirmationVariable]?.trim() ?? "") !== expectedConfirmation) {
  throw new Error(`${environment} B0.4a final authorization explicit confirmation missing`);
}

const applyArgs = ["--single-transaction", "-c", "set lock_timeout='5s'; set statement_timeout='90s';"];
for (const target of targets.slice(appliedPrefixLength)) {
  applyArgs.push("-f", target.path);
  applyArgs.push("-c", `insert into supabase_migrations.schema_migrations(version,name) values ('${target.version}','${target.name}');`);
}
const startedAt = performance.now();
const applyResult = psql(applyArgs, `atomic ${environment} B0.4a final authorization apply`);
const elapsedMs = Math.round(performance.now() - startedAt);

const history = query(`
  select version||'|'||name from supabase_migrations.schema_migrations
  where version in (${targets.map(({ version }) => `'${version}'`).join(",")}) order by version`,
"post-apply migration history");
const expectedHistory = targets.map(({ version, name }) => `${version}|${name}`).join("\n");
if (history !== expectedHistory) throw new Error(`unexpected post-apply migration history: ${history}`);

console.log(JSON.stringify({
  ...common,
  applied: targets.slice(appliedPrefixLength).map(({ version }) => version),
  elapsedMs,
  warnings: applyResult.stderr || null,
  ...deployedState(),
}));
