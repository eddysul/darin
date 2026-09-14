import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { PRODUCTION_PROJECT_REF, QA_PROJECT_REF, resolvePsqlBinary } from "./lib/qa-project-config.mjs";

const execute = process.argv.includes("--execute");
const targetVersion = "202609140001";
const targetName = "b04a_p0_authorization_hotfix";
const targetFilename = `${targetVersion}_${targetName}.sql`;
const allowedOlderPending = new Set([
  "202608220002_schedule_care_reminders.sql",
  "202608260003_notification_event_type_constraint_cleanup.sql",
]);
const confirmation = process.env.QA_B04A_P0_CONFIRM?.trim() ?? "";
const host = process.env.SUPABASE_DB_HOST?.trim() ?? "";
const user = process.env.SUPABASE_DB_USER?.trim() ?? "";
const password = process.env.SUPABASE_DB_PASSWORD ?? "";
if (!host || !user || !password) throw new Error("QA DB connection fields are incomplete");
if (!user.includes(QA_PROJECT_REF) || host.includes(PRODUCTION_PROJECT_REF) || user.includes(PRODUCTION_PROJECT_REF)) {
  throw new Error("QA DB project guard failed");
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
  if (result.status !== 0) throw new Error(`${label} failed:\n${(result.stderr || result.stdout).slice(0, 4000)}`);
  return { stdout: result.stdout.trim(), stderr: result.stderr.trim() };
}

const identity = psql(["-AtF", "|", "-c", "select current_database(),current_user"], "QA connection guard");
console.log(`QA B0.4a DB guard passed: ${identity.stdout}`);
const appliedRows = psql(["-At", "-c", "select version from supabase_migrations.schema_migrations order by version"], "migration history read");
const applied = new Set(appliedRows.stdout.split("\n").filter(Boolean));
const local = readdirSync("supabase/migrations").filter((name) => /^\d+_.+\.sql$/.test(name)).sort();
const pending = local.filter((name) => !applied.has(name.split("_")[0]));
const unexpectedPending = pending.filter((name) => name !== targetFilename && !allowedOlderPending.has(name));
if (unexpectedPending.length) throw new Error(`unexpected pending migrations: ${unexpectedPending.join(", ")}`);
if (applied.has(targetVersion)) throw new Error("target migration is already recorded; refusing to reapply");
for (const expected of allowedOlderPending) {
  if (!pending.includes(expected)) throw new Error(`expected intentionally skipped migration state changed: ${expected}`);
}
if (!pending.includes(targetFilename)) throw new Error("target migration is not pending");
console.log(`Target-only pending set confirmed: ${pending.join(", ")}`);
if (!execute) {
  console.log("Dry check only; target migration not applied");
  process.exit(0);
}
if (confirmation !== `APPLY_B04A_P0_${QA_PROJECT_REF}`) throw new Error("explicit QA B0.4a confirmation missing");

const targetPath = resolve("supabase/migrations", targetFilename);
if (!existsSync(targetPath)) throw new Error("target migration file missing");
const startedAt = performance.now();
const appliedResult = psql([
  "--single-transaction",
  "-c", "set lock_timeout='5s'; set statement_timeout='60s';",
  "-f", targetPath,
  "-c", `insert into supabase_migrations.schema_migrations(version,name) values ('${targetVersion}','${targetName}');`,
], "atomic target-only migration apply");
const elapsedMs = Math.round(performance.now() - startedAt);
console.log(JSON.stringify({ applied: targetVersion, elapsedMs, warnings: appliedResult.stderr || null }));

const afterRows = psql(["-AtF", "|", "-c", `select version,name from supabase_migrations.schema_migrations where version in ('202608220002','202608260003','202609140001') order by version`], "post-apply history read");
if (afterRows.stdout !== `${targetVersion}|${targetName}`) {
  throw new Error(`unexpected post-apply migration history: ${afterRows.stdout || "empty"}`);
}
console.log(`QA target-only migration applied; skipped migrations remain pending; productionTouched=false`);
