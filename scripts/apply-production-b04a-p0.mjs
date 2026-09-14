import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { PRODUCTION_PROJECT_REF, QA_PROJECT_REF, resolvePsqlBinary } from "./lib/qa-project-config.mjs";

const execute = process.argv.includes("--execute");
const targetVersion = "202609140001";
const targetName = "b04a_p0_authorization_hotfix";
const targetFilename = `${targetVersion}_${targetName}.sql`;
const qaApprovedSha256 = "fcb21f49d626101d532df3a00c1f730ef8cbf4c1ff29e3c42f5be39f2fd929e2";
const configuredRef = process.env.SUPABASE_PROJECT_REF?.trim() ?? "";
const password = process.env.SUPABASE_DB_PASSWORD ?? "";
const confirmation = process.env.PRODUCTION_B04A_P0_CONFIRM?.trim() ?? "";
const host = `db.${PRODUCTION_PROJECT_REF}.supabase.co`;

if (configuredRef !== PRODUCTION_PROJECT_REF || configuredRef === QA_PROJECT_REF || !password) {
  throw new Error("production B0.4a project guard failed");
}

const targetPath = resolve("supabase/migrations", targetFilename);
if (!existsSync(targetPath)) throw new Error("target migration file missing");
const sourceSha256 = createHash("sha256").update(readFileSync(targetPath)).digest("hex");
if (sourceSha256 !== qaApprovedSha256) {
  throw new Error(`target source changed after QA approval: ${sourceSha256}`);
}

const pgEnv = {
  ...process.env,
  PGHOST: host,
  PGPORT: "5432",
  PGUSER: "postgres",
  PGPASSWORD: password,
  PGDATABASE: "postgres",
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
], "production connection guard");
if (!/^postgres\|postgres\|\d+$/.test(identity.stdout)) {
  throw new Error(`unexpected production database identity: ${identity.stdout}`);
}
console.log(`Production DB guard passed; project=${PRODUCTION_PROJECT_REF}; sourceSha256=${sourceSha256}`);

const appliedRows = psql([
  "-At", "-c", "select version from supabase_migrations.schema_migrations order by version",
], "migration history read");
const applied = new Set(appliedRows.stdout.split("\n").filter(Boolean));
for (const required of ["202608220002", "202608260003"]) {
  if (!applied.has(required)) throw new Error(`expected production migration is not applied: ${required}`);
}
if (applied.has(targetVersion)) throw new Error("target migration is already applied; refusing to reapply");

const local = readdirSync("supabase/migrations")
  .filter((name) => /^\d+_.+\.sql$/.test(name)).sort();
const pending = local.filter((name) => !applied.has(name.split("_")[0]));
if (pending.length !== 1 || pending[0] !== targetFilename) {
  throw new Error(`unexpected production pending migrations: ${pending.join(", ") || "none"}`);
}
console.log(`Target-only pending set confirmed: ${targetFilename}`);

if (!execute) {
  console.log("Dry check only; production target migration not applied");
  process.exit(0);
}
if (confirmation !== `APPLY_B04A_P0_PRODUCTION_${PRODUCTION_PROJECT_REF}`) {
  throw new Error("explicit production B0.4a confirmation missing");
}

const startedAt = performance.now();
const appliedResult = psql([
  "--single-transaction",
  "-c", "set lock_timeout='5s'; set statement_timeout='60s';",
  "-f", targetPath,
  "-c", `insert into supabase_migrations.schema_migrations(version,name) values ('${targetVersion}','${targetName}');`,
], "atomic production target-only migration apply");
const elapsedMs = Math.round(performance.now() - startedAt);
console.log(JSON.stringify({ applied: targetVersion, elapsedMs, warnings: appliedResult.stderr || null }));

const afterRows = psql([
  "-AtF", "|", "-c",
  `select version,name from supabase_migrations.schema_migrations where version in ('202608220002','202608260003','202609140001') order by version`,
], "post-apply migration history read");
const lines = afterRows.stdout.split("\n");
if (!lines.includes(`${targetVersion}|${targetName}`)
    || !lines.some((line) => line.startsWith("202608220002|"))
    || !lines.some((line) => line.startsWith("202608260003|"))) {
  throw new Error(`unexpected post-apply migration history: ${afterRows.stdout || "empty"}`);
}
console.log("Production target-only migration applied; unrelated history unchanged");
