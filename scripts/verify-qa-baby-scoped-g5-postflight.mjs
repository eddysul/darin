import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { assertQaProjectEnvironment } from "./lib/qa-project-guard.mjs";
import { resolvePsqlBinary } from "./lib/qa-project-config.mjs";

const { ref } = assertQaProjectEnvironment();
const applied = ["202609170004", "202609180002", "202609200001", "202609200002", "202609200003"];
const intentionallyPending = ["202608220002", "202608260003", "202609170001", "202609170002"];

const sql = `
select json_build_object(
  'database', current_database(),
  'applied', coalesce((select json_agg(version order by version) from supabase_migrations.schema_migrations
    where version = any(array[${applied.map((v) => `'${v}'`).join(",")}])), '[]'::json),
  'unexpectedPendingApplied', coalesce((select json_agg(version order by version) from supabase_migrations.schema_migrations
    where version = any(array[${intentionallyPending.map((v) => `'${v}'`).join(",")}])), '[]'::json),
  'permissionTable', to_regclass('public.baby_access_permissions') is not null,
  'invalidPermissionRows', (select count(*) from public.baby_access_permissions
    where (care_write and not care_read) or (moments_write and not moments_read)
       or ((social_comment or social_react) and not moments_read)),
  'orphanPermissionRows', (select count(*) from public.baby_access_permissions access_row
    where not exists(select 1 from public.baby_members member_row
      where member_row.baby_id=access_row.baby_id and member_row.user_id=access_row.user_id
        and member_row.status::text='active')
      and not exists(select 1 from public.memory_friends friend_row
      where friend_row.baby_id=access_row.baby_id and friend_row.user_id=access_row.user_id
        and friend_row.status='active')),
  'searchRpc', to_regprocedure('public.search_invite_profiles(uuid,text)') is not null,
  'creatorDeleteRpc', to_regprocedure('public.delete_created_baby(uuid)') is not null,
  'setAccessRpc', to_regprocedure('public.set_baby_access_permissions(uuid,uuid,boolean,boolean,boolean,boolean,boolean,boolean)') is not null,
  'promoteRpc', to_regprocedure('public.promote_baby_full_admin(uuid,uuid)') is not null,
  'prepareLifecycle', position('baby_access_permissions' in pg_get_functiondef('public.prepare_account_deletion()'::regprocedure)) > 0,
  'internalHelpersPrivate',
    not has_function_privilege('authenticated','public.is_current_baby_link(uuid,uuid)','execute')
    and not has_function_privilege('authenticated','public.is_baby_full_admin(uuid,uuid)','execute')
    and not has_function_privilege('authenticated','public.user_has_baby_access(uuid,uuid,text)','execute'),
  'fixtureBabies', (select count(*) from public.babies where name ilike 'G5 baby scoped %'),
  'fixtureUsers', (select count(*) from auth.users where email ilike 'qa-g5%@darin.invalid'),
  'legacyOrphans', (select count(*) from public.babies baby_row where not exists(
    select 1 from public.baby_members member_row where member_row.baby_id=baby_row.id
      and member_row.status::text='active' and member_row.permission_role='admin'))
);
`;

const result = spawnSync(resolvePsqlBinary(), ["-X", "-At", "-v", "ON_ERROR_STOP=1", "-c", sql], {
  cwd: process.cwd(),
  encoding: "utf8",
  env: {
    ...process.env,
    PGHOST: process.env.SUPABASE_DB_HOST,
    PGPORT: process.env.SUPABASE_DB_PORT || "5432",
    PGUSER: process.env.SUPABASE_DB_USER,
    PGPASSWORD: process.env.SUPABASE_DB_PASSWORD,
    PGDATABASE: process.env.SUPABASE_DB_NAME || "postgres",
    PGSSLMODE: "require",
    PGOPTIONS: "-c default_transaction_read_only=on -c statement_timeout=30000",
  },
});
if (result.status !== 0) {
  throw new Error(`G5 QA postflight query failed: ${result.stderr.slice(0, 500)}`);
}
const state = JSON.parse(result.stdout.trim());
assert.equal(state.database, "postgres");
assert.deepEqual(state.applied, applied);
assert.deepEqual(state.unexpectedPendingApplied, []);
assert.equal(state.permissionTable, true);
assert.equal(state.invalidPermissionRows, 0);
assert.equal(state.orphanPermissionRows, 0);
assert.equal(state.searchRpc, true);
assert.equal(state.creatorDeleteRpc, true);
assert.equal(state.setAccessRpc, true);
assert.equal(state.promoteRpc, true);
assert.equal(state.prepareLifecycle, true);
assert.equal(state.internalHelpersPrivate, true);
assert.equal(state.fixtureBabies, 0);
assert.equal(state.fixtureUsers, 0);

console.log(`PASS QA project identity (${ref})`);
console.log(`PASS applied migration history (${applied.join(", ")})`);
console.log(`PASS intentionally pending migrations remain unapplied (${intentionallyPending.join(", ")})`);
console.log("PASS permission invariants and helper execution grants");
console.log("PASS G5 disposable fixture cleanup");
console.log(`INFO pre-existing legacy orphan babies remain fail-closed: ${state.legacyOrphans}`);
console.log("G5 QA postflight: 5 PASS / 0 skipped");
