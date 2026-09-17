import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { QA_PROJECT_REF, PRODUCTION_PROJECT_REF, resolvePsqlBinary } from "./lib/qa-project-config.mjs";

const target = process.argv[2];
const execute = process.argv.includes("--execute");
if (!["qa", "production"].includes(target)) {
  throw new Error("usage: apply-b04c-push-legacy-device-release.mjs <qa|production> [--execute]");
}
const projectRef = target === "qa" ? QA_PROJECT_REF : PRODUCTION_PROJECT_REF;
const otherRef = target === "qa" ? PRODUCTION_PROJECT_REF : QA_PROJECT_REF;
const filenames = [
  "202609160004_b04c_release_disabled_legacy_device_ids.sql",
  "202609160005_b04c_recover_disabled_unproven_legacy_tokens.sql",
];
const host = target === "qa" ? process.env.SUPABASE_DB_HOST?.trim() : `db.${projectRef}.supabase.co`;
const user = target === "qa" ? process.env.SUPABASE_DB_USER?.trim() : "postgres";
if (!host || !user || !process.env.SUPABASE_DB_PASSWORD || (target === "qa"
  ? (!user.includes(projectRef) || host.includes(otherRef))
  : process.env.SUPABASE_PROJECT_REF?.trim() !== projectRef)) {
  throw new Error(`${target} B0.4c legacy-device release identity guard failed`);
}
const env = { ...process.env, PGHOST: host, PGUSER: user,
  PGPASSWORD: process.env.SUPABASE_DB_PASSWORD, PGDATABASE: "postgres",
  PGSSLMODE: "require", PGCONNECT_TIMEOUT: "15" };
function psql(input, label, readOnly = true) {
  const result = spawnSync(resolvePsqlBinary(), ["-X", "-At", "-v", "ON_ERROR_STOP=1"], {
    input, encoding: "utf8", env: { ...env,
      ...(readOnly ? { PGOPTIONS: "-c default_transaction_read_only=on -c statement_timeout=30000" } : {}) },
    maxBuffer: 4 * 1024 * 1024,
  });
  if (result.status !== 0) throw new Error(`${label} failed: ${(result.stderr || "").slice(-1200)}`);
  return result.stdout.trim();
}
const history = new Set(psql("select version from supabase_migrations.schema_migrations order by version", "history")
  .split("\n").filter(Boolean));
for (const dependency of ["202609160001", "202609160002", "202609160003"]) {
  if (!history.has(dependency)) throw new Error(`missing B0.4c dependency ${dependency}`);
}
const pendingSources = filenames
  .map((filename) => ({ filename, version: filename.slice(0, 12), source: readFileSync(`supabase/migrations/${filename}`, "utf8") }))
  .filter(({ version }) => !history.has(version));
if (!pendingSources.length) throw new Error("legacy-device recovery migrations already applied");
if (pendingSources[0].version === "202609160005" && !history.has("202609160004")) {
  throw new Error("legacy-device recovery migration order is invalid");
}
const sha256 = createHash("sha256").update(pendingSources.map(({ source }) => source).join("\n")).digest("hex");
if (target === "production" && process.env.B04C_LEGACY_DEVICE_QA_APPROVED_SHA256 !== sha256) {
  throw new Error("production source differs from QA-approved SHA-256");
}
const preflight = JSON.parse(psql(`select json_build_object(
  'tokenCount',(select count(*) from public.push_tokens),
  'activeCount',(select count(*) from public.push_tokens where disabled_at is null),
  'unprovenDisabled',(select count(*) from public.push_tokens where disabled_at is not null and installation_secret_hash is null),
  'wrapper',pg_get_functiondef('public.register_current_push_token(text,text,text,text,text,text)'::regprocedure) like '%register_current_push_token_v2%'
)::text`, "preflight"));
if (!preflight.wrapper) throw new Error("expected v2 registration wrapper is missing");
console.log(JSON.stringify({ target, projectRef, execute, sha256,
  pending: pendingSources.map(({ version }) => version), preflight }));
if (!execute) process.exit(0);
const expected = target === "qa" ? "APPLY_B04C_LEGACY_DEVICE_RELEASE_QA" : "APPLY_B04C_LEGACY_DEVICE_RELEASE_PRODUCTION";
if (process.env.B04C_LEGACY_DEVICE_APPLY_CONFIRM !== expected) throw new Error("explicit apply confirmation missing");
psql(`begin;
set local lock_timeout='5s';
set local statement_timeout='120s';
${pendingSources.map(({ source, version, filename }) => `${source}
insert into supabase_migrations.schema_migrations(version,name)
values ('${version}','${filename.slice(13, -4)}');`).join("\n")}
commit;`, `atomic ${target} legacy-device release`, false);
const post = JSON.parse(psql(`select json_build_object(
  'history',(select count(*) from supabase_migrations.schema_migrations where version in (${pendingSources.map(({ version }) => `'${version}'`).join(",")})),
  'tokenCount',(select count(*) from public.push_tokens),
  'activeCount',(select count(*) from public.push_tokens where disabled_at is null),
  'unprovenDisabled',(select count(*) from public.push_tokens where disabled_at is not null and installation_secret_hash is null),
  'releaseRule',pg_get_functiondef('public.register_current_push_token_v2(text,text,text,text,text,text)'::regprocedure)
    like '%Consume only the exact provider token from inert proofless legacy state%',
  'privateV2',not has_function_privilege('authenticated','public.register_current_push_token_v2(text,text,text,text,text,text)','EXECUTE')
)::text`, "postflight"));
if (post.history !== pendingSources.length || post.tokenCount !== preflight.tokenCount || post.activeCount !== preflight.activeCount
    || post.unprovenDisabled !== preflight.unprovenDisabled || !post.releaseRule || !post.privateV2) {
  throw new Error(`legacy-device release postflight mismatch: ${JSON.stringify(post)}`);
}
console.log(JSON.stringify({ target, applied: pendingSources.map(({ version }) => version), sha256, post }));
