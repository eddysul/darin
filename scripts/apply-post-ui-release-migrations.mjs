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
  throw new Error("usage: apply-post-ui-release-migrations.mjs <qa|production> [--execute]");
}

const releaseFiles = [
  "202609170001_memory_video_media.sql",
  "202609170002_dismiss_notification_event.sql",
  "202609170004_search_invite_profiles.sql",
  "202609180002_delete_created_baby.sql",
  "202609200001_baby_scoped_permissions.sql",
  "202609200002_baby_scoped_extended_enforcement.sql",
  "202609200003_baby_scoped_account_lifecycle.sql",
  "202609210001_memory_video_baby_scope_compat.sql",
];
const migrations = releaseFiles.map((filename) => {
  const source = readFileSync(`supabase/migrations/${filename}`, "utf8");
  return {
    filename,
    version: filename.split("_")[0],
    name: filename.replace(/^\d+_|\.sql$/g, ""),
    source,
    sha256: createHash("sha256").update(source).digest("hex"),
  };
});
const manifestSha256 = createHash("sha256")
  .update(migrations.map(({ version, sha256 }) => `${version}:${sha256}`).join("\n"))
  .digest("hex");

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
      ...(readOnly ? { PGOPTIONS: "-c default_transaction_read_only=on -c statement_timeout=30000" } : {}),
    },
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(`${label} failed: ${(result.stderr || result.stdout).slice(0, 5000)}`);
  }
  return result.stdout.trim();
}

const identity = psql("select current_database()||'|'||current_user;", "database identity", true);
if (!identity.startsWith("postgres|")) throw new Error("unexpected database identity");

const applied = new Set(psql(
  "select version from supabase_migrations.schema_migrations order by version;",
  "migration history",
  true,
).split("\n").filter(Boolean));
for (const baseline of ["202609150010", "202609170003", "202609170005", "202609170006", "202609180001"]) {
  if (!applied.has(baseline)) throw new Error(`required baseline migration missing: ${baseline}`);
}

const localFiles = readdirSync("supabase/migrations")
  .filter((filename) => /^\d+_.+\.sql$/.test(filename))
  .sort();
const pending = localFiles.filter((filename) => !applied.has(filename.split("_")[0]));
const intentionallyPending = target === "qa"
  ? ["202608220002_schedule_care_reminders.sql", "202608260003_notification_event_type_constraint_cleanup.sql"]
  : [];
const expectedPending = new Set([
  ...intentionallyPending,
  ...migrations.filter(({ version }) => !applied.has(version)).map(({ filename }) => filename),
]);
if (pending.length !== expectedPending.size || pending.some((filename) => !expectedPending.has(filename))) {
  throw new Error(`unexpected pending migrations: ${pending.join(",")}`);
}

const preflight = JSON.parse(psql(`select json_build_object(
  'memoryMedia',to_regclass('public.memory_media') is not null,
  'notificationEvents',to_regclass('public.notification_events') is not null,
  'memoryBucket',(select count(*) from storage.buckets where id='memories' and not public),
  'storageObjects',to_regclass('storage.objects') is not null,
  'cleanupQueue',to_regclass('public.media_cleanup_queue') is not null,
  'requiredFunctions',(select count(*) from pg_proc where oid in (
    'public.can_view_memory_post(uuid)'::regprocedure,
    'public.can_view_diary_entry(uuid)'::regprocedure,
    'public.can_view_growth_book(uuid)'::regprocedure,
    'public.can_view_growth_book_page(uuid)'::regprocedure,
    'public.can_view_baby_sticker(uuid)'::regprocedure,
    'public.prepare_account_deletion()'::regprocedure
  )),
  'publicStorageBuckets',(select count(*) from storage.buckets where id in
    ('memories','diary-media','growth-book-media','baby-stickers','profile-media') and public),
  'activeAdminlessBabies',(select count(*) from public.babies b
    where exists(select 1 from public.baby_members m where m.baby_id=b.id and m.status::text='active')
      and not exists(select 1 from public.baby_members m where m.baby_id=b.id
        and m.status::text='active' and m.permission_role='admin'))
)::text;`, "release dependency/data preflight", true));
if (
  !preflight.memoryMedia || !preflight.notificationEvents || preflight.memoryBucket !== 1
  || !preflight.storageObjects || !preflight.cleanupQueue || preflight.requiredFunctions !== 6
  || preflight.publicStorageBuckets !== 0
  || (target === "production" && preflight.activeAdminlessBabies !== 0)
) {
  throw new Error(`release preflight blocked: ${JSON.stringify(preflight)}`);
}

console.log(JSON.stringify({
  target,
  projectRef,
  execute,
  identity,
  manifestSha256,
  migrations: migrations.map(({ version, sha256 }) => ({ version, sha256, applied: applied.has(version) })),
  pending,
  intentionallyPending,
  preflight,
}));
if (!execute) process.exit(0);

if (target === "production") {
  const approved = process.env.POST_UI_RELEASE_QA_APPROVED_MANIFEST_SHA256?.trim() ?? "";
  if (approved !== manifestSha256) {
    throw new Error("production source does not match the QA-approved release manifest");
  }
}
const confirmKey = target === "qa" ? "QA_POST_UI_RELEASE_CONFIRM" : "PRODUCTION_POST_UI_RELEASE_CONFIRM";
const expectedConfirm = target === "qa"
  ? `APPLY_POST_UI_RELEASE_${projectRef}`
  : `APPLY_POST_UI_RELEASE_PRODUCTION_${projectRef}`;
if (process.env[confirmKey]?.trim() !== expectedConfirm) {
  throw new Error(`${target} release apply confirmation missing`);
}

const stripTransactionWrapper = (source) => source
  .replace(/^([\s\S]*?)(^|\n)begin;\s*\n/i, "$1\n")
  .replace(/\ncommit;\s*$/i, "\n");
const toApply = migrations.filter(({ version }) => !applied.has(version));
let sql = "begin; set local lock_timeout='5s'; set local statement_timeout='180s';\n";
for (const migration of toApply) {
  sql += `${stripTransactionWrapper(migration.source)}\n`;
  sql += `insert into supabase_migrations.schema_migrations(version,name) values ('${migration.version}','${migration.name}');\n`;
}
sql += "commit;";
psql(sql, `atomic ${target} post-UI release migration apply`);

const post = JSON.parse(psql(`select json_build_object(
  'history',(select count(*) from supabase_migrations.schema_migrations where version=any(array[
    ${migrations.map(({ version }) => `'${version}'`).join(",")}
  ])),
  'durationColumn',(select count(*) from information_schema.columns where table_schema='public'
    and table_name='memory_media' and column_name='duration_ms'),
  'thumbnailColumn',(select count(*) from information_schema.columns where table_schema='public'
    and table_name='memory_media' and column_name='thumbnail_storage_path'),
  'videoConstraints',(select count(*) from pg_constraint where conname in
    ('memory_media_duration_check','memory_media_video_duration_check','memory_media_thumbnail_path_check')),
  'signerShape',pg_get_function_result('public.resolve_private_media_for_signing(text,uuid)'::regprocedure),
  'signerBabyCapabilities',position('has_baby_access' in
    pg_get_functiondef('public.resolve_private_media_for_signing(text,uuid)'::regprocedure))>0,
  'dismissRpc',to_regprocedure('public.dismiss_notification_event(uuid)') is not null,
  'dismissAuth',has_function_privilege('authenticated','public.dismiss_notification_event(uuid)','execute'),
  'dismissAnon',has_function_privilege('anon','public.dismiss_notification_event(uuid)','execute'),
  'searchRpc',to_regprocedure('public.search_invite_profiles(uuid,text)') is not null,
  'deleteBabyRpc',to_regprocedure('public.delete_created_baby(uuid)') is not null,
  'accessTable',to_regclass('public.baby_access_permissions') is not null,
  'setAccessRpc',to_regprocedure('public.set_baby_access_permissions(uuid,uuid,boolean,boolean,boolean,boolean,boolean,boolean)') is not null,
  'promoteRpc',to_regprocedure('public.promote_baby_full_admin(uuid,uuid)') is not null,
  'lifecycleAccess',position('baby_access_permissions' in
    pg_get_functiondef('public.prepare_account_deletion()'::regprocedure))>0,
  'invalidAccessRows',(select count(*) from public.baby_access_permissions where
    (care_write and not care_read) or (moments_write and not moments_read)
    or ((social_comment or social_react) and not moments_read))
)::text;`, "release post-apply contract", true));
if (
  post.history !== migrations.length || post.durationColumn !== 1 || post.thumbnailColumn !== 1
  || post.videoConstraints !== 3
  || post.signerShape !== "TABLE(bucket_id text, storage_path text, expires_in integer, thumbnail_storage_path text)"
  || !post.signerBabyCapabilities || !post.dismissRpc || !post.dismissAuth || post.dismissAnon
  || !post.searchRpc || !post.deleteBabyRpc || !post.accessTable || !post.setAccessRpc
  || !post.promoteRpc || !post.lifecycleAccess || post.invalidAccessRows !== 0
) {
  throw new Error(`release post-apply contract mismatch: ${JSON.stringify(post)}`);
}
console.log(JSON.stringify({ target, applied: toApply.map(({ version }) => version), manifestSha256, post }));
