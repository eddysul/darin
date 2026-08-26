import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { PRODUCTION_PROJECT_REF, QA_PROJECT_REF, resolvePsqlBinary } from "./lib/qa-project-config.mjs";

const PSQL = resolvePsqlBinary();
const execute = process.argv.includes("--execute");
const confirmation = process.env.QA_FRIEND_MEMORY_CONFIRM?.trim() ?? "";
const host = process.env.SUPABASE_DB_HOST?.trim() ?? "";
const user = process.env.SUPABASE_DB_USER?.trim() ?? "";
const password = process.env.SUPABASE_DB_PASSWORD ?? "";

if (!host || !user || !password) throw new Error("QA DB connection fields are incomplete");
if (!user.includes(QA_PROJECT_REF) || host.includes(PRODUCTION_PROJECT_REF) || user.includes(PRODUCTION_PROJECT_REF)) {
  throw new Error("QA DB project guard failed");
}

const env = {
  ...process.env,
  PGHOST: host,
  PGPORT: process.env.SUPABASE_DB_PORT?.trim() || "5432",
  PGUSER: user,
  PGPASSWORD: password,
  PGDATABASE: process.env.SUPABASE_DB_NAME?.trim() || "postgres",
  PGSSLMODE: "require",
  PGCONNECT_TIMEOUT: "15",
};

function psql(args, label, input) {
  const result = spawnSync(PSQL, ["-X", "-v", "ON_ERROR_STOP=1", ...args], { encoding: "utf8", env, input });
  if (result.status !== 0) throw new Error(`${label} failed:\n${(result.stderr || result.stdout).slice(0, 4000)}`);
  return result.stdout.trim();
}

const identity = psql(["-AtF", "|", "-c", "select current_database(), current_user"], "connection check");
console.log(`QA friend-memory DB guard passed: ${identity}`);
if (!execute) {
  console.log("Dry check only; no schema changes applied");
  process.exit(0);
}
if (confirmation !== `APPLY_FRIEND_MEMORY_${QA_PROJECT_REF}`) throw new Error("Explicit QA friend-memory confirmation missing");

const migration = resolve("supabase/migrations/202608260001_friend_memory_ui_scope.sql");
psql(["-f", migration], "friend memory migration first run");
psql(["-f", migration], "friend memory migration rerun");
psql(["-f", "-"], "migration history", `
insert into supabase_migrations.schema_migrations(version, name)
values ('202608260001', 'friend_memory_ui_scope')
on conflict (version) do update set name = excluded.name;
`);
console.log("QA friend-memory migration applied and rerun successfully; productionTouched=false");
