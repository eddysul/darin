import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import {
  PRODUCTION_PROJECT_REF,
  QA_PROJECT_REF,
  resolvePsqlBinary,
} from "./lib/qa-project-config.mjs";

const target = process.argv[2];
const execute = process.argv.includes("--execute");
if (!['qa', 'production'].includes(target)) {
  throw new Error("usage: apply-memory-author-display.mjs <qa|production> [--execute]");
}

const filename = "202609170003_memory_author_display.sql";
const version = "202609170003";
const name = "memory_author_display";
const source = readFileSync(`supabase/migrations/${filename}`, "utf8");
const sha256 = createHash("sha256").update(source).digest("hex");
const projectRef = target === "qa" ? QA_PROJECT_REF : PRODUCTION_PROJECT_REF;
const otherRef = target === "qa" ? PRODUCTION_PROJECT_REF : QA_PROJECT_REF;
const password = process.env.SUPABASE_DB_PASSWORD?.trim() ?? "";
const host = target === "qa"
  ? process.env.SUPABASE_DB_HOST?.trim() ?? ""
  : `db.${projectRef}.supabase.co`;
const user = target === "qa" ? process.env.SUPABASE_DB_USER?.trim() ?? "" : "postgres";
const configuredRef = process.env.SUPABASE_PROJECT_REF?.trim() ?? "";

if (
  !password || !host || !user
  || (target === "qa" && (!user.includes(projectRef) || host.includes(otherRef)))
  || (target === "production" && configuredRef !== projectRef)
) {
  throw new Error(`${target} database identity guard failed`);
}
if (
  target === "production"
  && process.env.MEMORY_AUTHOR_QA_APPROVED_SHA256?.trim() !== sha256
) {
  throw new Error("production source does not match the QA-approved migration SHA-256");
}

const env = {
  ...process.env,
  PGHOST: host,
  PGUSER: user,
  PGPASSWORD: password,
  PGDATABASE: target === "qa" ? process.env.SUPABASE_DB_NAME?.trim() || "postgres" : "postgres",
  PGSSLMODE: "require",
  PGCONNECT_TIMEOUT: "15",
};

function psql(input, label, readOnly = false) {
  const result = spawnSync(resolvePsqlBinary(), ["-X", "-At", "-v", "ON_ERROR_STOP=1"], {
    input,
    encoding: "utf8",
    env: {
      ...env,
      ...(readOnly
        ? { PGOPTIONS: "-c default_transaction_read_only=on -c statement_timeout=30000" }
        : {}),
    },
    maxBuffer: 8 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(`${label} failed: ${(result.stderr || result.stdout).slice(0, 4000)}`);
  }
  return result.stdout.trim();
}

const identity = psql("select current_database()||'|'||current_user;", "database identity", true);
if (!identity.startsWith("postgres|")) throw new Error("unexpected database identity");

const applied = new Set(
  psql(
    "select version from supabase_migrations.schema_migrations order by version;",
    "migration history",
    true,
  ).split("\n").filter(Boolean),
);
const localMigrations = readdirSync("supabase/migrations")
  .filter((item) => /^\d+_.+\.sql$/.test(item))
  .sort();
const pending = localMigrations.filter((item) => !applied.has(item.split("_")[0]));
const expectedPending = new Set([
  ...(target === "qa"
    ? [
      "202608220002_schedule_care_reminders.sql",
      "202608260003_notification_event_type_constraint_cleanup.sql",
    ]
    : []),
  ...["202609170001_memory_video_media.sql", "202609170002_dismiss_notification_event.sql",
    "202609210001_memory_video_baby_scope_compat.sql"]
    .filter((item) => !applied.has(item.split("_")[0])),
  ...(applied.has(version) ? [] : [filename]),
]);
if (
  pending.length !== expectedPending.size
  || pending.some((item) => !expectedPending.has(item))
) {
  throw new Error(`unexpected pending migrations: ${pending.join(",")}`);
}

const preflight = JSON.parse(psql(`select json_build_object(
  'profiles',to_regclass('public.profiles') is not null,
  'posts',to_regclass('public.memory_posts') is not null,
  'comments',to_regclass('public.memory_comments') is not null,
  'tags',to_regclass('public.memory_tags') is not null,
  'displayName',(select count(*)=1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='display_name'),
  'avatarPath',(select count(*)=1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='avatar_storage_path'),
  'visibility',to_regprocedure('public.can_view_memory_post(uuid)') is not null,
  'targetHistory',(select count(*) from supabase_migrations.schema_migrations where version='${version}'),
  'nameConflict',(select count(*) from pg_proc where pronamespace='public'::regnamespace and proname='list_memory_author_display')
)::text;`, "dependency preflight", true));
if (
  !preflight.profiles || !preflight.posts || !preflight.comments || !preflight.tags
  || !preflight.displayName || !preflight.avatarPath || !preflight.visibility
  || ![0, 1].includes(preflight.targetHistory)
  || ![0, 1].includes(preflight.nameConflict)
) {
  throw new Error(`preflight contract mismatch: ${JSON.stringify(preflight)}`);
}
if (preflight.targetHistory === 1 && preflight.nameConflict !== 1) {
  throw new Error("migration history/function state mismatch");
}
if (preflight.targetHistory === 0 && preflight.nameConflict !== 0) {
  throw new Error("untracked function name conflict");
}

console.log(JSON.stringify({
  target,
  projectRef,
  execute,
  identity,
  version,
  sha256,
  pending,
  preflight,
}));
if (!execute) process.exit(0);

const confirmKey = target === "qa"
  ? "QA_MEMORY_AUTHOR_CONFIRM"
  : "PRODUCTION_MEMORY_AUTHOR_CONFIRM";
const expectedConfirm = target === "qa"
  ? `APPLY_MEMORY_AUTHOR_${projectRef}`
  : `APPLY_MEMORY_AUTHOR_PRODUCTION_${projectRef}`;
if (preflight.targetHistory === 0 && process.env[confirmKey]?.trim() !== expectedConfirm) {
  throw new Error(`${target} apply confirmation missing`);
}

if (preflight.targetHistory === 0) {
  psql(
    `begin; set local lock_timeout='5s'; set local statement_timeout='60s';\n${source}\n`
      + `insert into supabase_migrations.schema_migrations(version,name) values ('${version}','${name}');\ncommit;`,
    `atomic ${target} memory author display apply`,
  );
}

const post = JSON.parse(psql(`select json_build_object(
  'history',(select count(*) from supabase_migrations.schema_migrations where version='${version}'),
  'functionCount',(select count(*) from pg_proc where oid='public.list_memory_author_display(uuid[])'::regprocedure),
  'securityDefiner',(select prosecdef from pg_proc where oid='public.list_memory_author_display(uuid[])'::regprocedure),
  'volatility',(select provolatile from pg_proc where oid='public.list_memory_author_display(uuid[])'::regprocedure),
  'searchPath',(select proconfig from pg_proc where oid='public.list_memory_author_display(uuid[])'::regprocedure),
  'authenticatedExecute',has_function_privilege('authenticated','public.list_memory_author_display(uuid[])','execute'),
  'anonExecute',has_function_privilege('anon','public.list_memory_author_display(uuid[])','execute'),
  'returnShape',(select pg_get_function_result('public.list_memory_author_display(uuid[])'::regprocedure))
)::text;`, "post-apply contract", true));
if (
  post.history !== 1 || post.functionCount !== 1 || !post.securityDefiner
  || post.volatility !== "s" || !post.searchPath?.includes("search_path=public")
  || !post.authenticatedExecute || post.anonExecute
  || post.returnShape !== "TABLE(user_id uuid, display_name text, avatar_storage_path text)"
) {
  throw new Error(`post-apply contract mismatch: ${JSON.stringify(post)}`);
}
console.log(JSON.stringify({ target, applied: version, sha256, post }));
