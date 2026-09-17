import { spawnSync } from "node:child_process";
import { PRODUCTION_PROJECT_REF, resolvePsqlBinary } from "./lib/qa-project-config.mjs";

const execute = process.argv.includes("--execute");
const approvedEmail = process.env.B04C_APPROVED_TESTER_EMAIL?.trim().toLowerCase() ?? "";
const approvedLastSeen = "2026-09-15 20:40:22.952+00";
if (process.env.SUPABASE_PROJECT_REF?.trim() !== PRODUCTION_PROJECT_REF
    || !process.env.SUPABASE_DB_PASSWORD
    || !/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(approvedEmail)) {
  throw new Error("Production identity or approved tester email guard failed");
}
const env = { ...process.env, PGHOST: `db.${PRODUCTION_PROJECT_REF}.supabase.co`, PGUSER: "postgres",
  PGPASSWORD: process.env.SUPABASE_DB_PASSWORD, PGDATABASE: "postgres",
  PGSSLMODE: "require", PGCONNECT_TIMEOUT: "15" };
function psql(input, label, readOnly = true) {
  const result = spawnSync(resolvePsqlBinary(), ["-X", "-At", "-v", "ON_ERROR_STOP=1"], {
    input, encoding: "utf8", env: { ...env,
      ...(readOnly ? { PGOPTIONS: "-c default_transaction_read_only=on -c statement_timeout=30000" } : {}) },
    maxBuffer: 4 * 1024 * 1024,
  });
  if (result.status !== 0) throw new Error(`${label} failed: ${(result.stderr || "").slice(-1000)}`);
  return result.stdout.trim();
}
const predicate = `p.disabled_at is not null and p.installation_secret_hash is null
  and p.last_seen_at='${approvedLastSeen}'::timestamptz
  and lower(u.email)=lower('${approvedEmail}')`;
const state = JSON.parse(psql(`select json_build_object(
  'migration001',(select count(*) from supabase_migrations.schema_migrations where version='202609160001'),
  'migration003',(select count(*) from supabase_migrations.schema_migrations where version='202609160003'),
  'allTokens',(select count(*) from public.push_tokens),
  'activeTokens',(select count(*) from public.push_tokens where disabled_at is null),
  'exactTarget',(select count(*) from public.push_tokens p join auth.users u on u.id=p.user_id where ${predicate}),
  'allDisabledTesterLegacy',(select count(*) from public.push_tokens p join auth.users u on u.id=p.user_id
    where p.disabled_at is not null and p.installation_secret_hash is null and lower(u.email)=lower('${approvedEmail}'))
)::text;`, "cleanup preflight"));
if (state.migration001 !== 1 || state.migration003 !== 1 || state.activeTokens !== 0
    || state.exactTarget !== 1 || state.allDisabledTesterLegacy !== 1) {
  throw new Error("exact disabled tester-token target is not unique");
}
console.log(JSON.stringify({ execute, projectRef: PRODUCTION_PROJECT_REF, state }));
if (!execute) process.exit(0);
if (process.env.B04C_TESTER_TOKEN_DELETE_CONFIRM !== "DELETE_EXACTLY_ONE_DISABLED_TESTER_TOKEN") {
  throw new Error("explicit tester token deletion confirmation missing");
}
psql(`begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
lock table public.push_tokens in share row exclusive mode;
do $b04c_cleanup$
declare v_deleted integer;
begin
  if (select count(*) from public.push_tokens where disabled_at is null) <> 0
     or (select count(*) from public.push_tokens p join auth.users u on u.id=p.user_id where ${predicate}) <> 1
     or (select count(*) from public.push_tokens p join auth.users u on u.id=p.user_id
       where p.disabled_at is not null and p.installation_secret_hash is null
         and lower(u.email)=lower('${approvedEmail}')) <> 1 then
    raise exception 'approved disabled tester token state changed';
  end if;
  delete from public.push_tokens p using auth.users u
    where p.user_id=u.id and ${predicate};
  get diagnostics v_deleted = row_count;
  if v_deleted <> 1 then raise exception 'expected exactly one disabled tester token deletion'; end if;
end;
$b04c_cleanup$;
commit;`, "atomic disabled tester-token deletion", false);
const post = JSON.parse(psql(`select json_build_object(
  'allTokens',(select count(*) from public.push_tokens),
  'activeTokens',(select count(*) from public.push_tokens where disabled_at is null),
  'remainingTarget',(select count(*) from public.push_tokens p join auth.users u on u.id=p.user_id where ${predicate})
)::text;`, "cleanup postflight"));
if (post.allTokens !== state.allTokens - 1 || post.activeTokens !== 0 || post.remainingTarget !== 0) {
  throw new Error(`tester-token cleanup postflight mismatch: ${JSON.stringify(post)}`);
}
console.log(JSON.stringify({ deleted: 1, post }));
