import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import {
  PRODUCTION_PROJECT_REF,
  QA_PROJECT_REF,
  qaConfirmation,
  resolvePsqlBinary,
} from "./lib/qa-project-config.mjs";

const REQUIRED_CONFIRMATION = qaConfirmation("APPLY");
const CRON_MIGRATION = "202608220002_schedule_care_reminders.sql";
const PSQL = resolvePsqlBinary();

const execute = process.argv.includes("--execute");
const resetPublic = process.argv.includes("--reset-public");
const rerunCareReminder = process.argv.includes("--rerun-care-reminder");
const applyBuild17Care = process.argv.includes("--apply-build17-care");
const confirmation = process.env.QA_MIGRATION_CONFIRM?.trim() ?? "";
const host = process.env.SUPABASE_DB_HOST?.trim() ?? "";
const port = process.env.SUPABASE_DB_PORT?.trim() || "5432";
const user = process.env.SUPABASE_DB_USER?.trim() ?? "";
const password = process.env.SUPABASE_DB_PASSWORD ?? "";
const database = process.env.SUPABASE_DB_NAME?.trim() || "postgres";

if (!host || !user || !password) throw new Error("QA DB connection fields are incomplete");
if (!host.endsWith("pooler.supabase.com") && !host.startsWith("db.")) {
  throw new Error(`Unexpected QA DB host ${host}`);
}
if (!user.includes(QA_PROJECT_REF) || user.includes(PRODUCTION_PROJECT_REF) || host.includes(PRODUCTION_PROJECT_REF)) {
  throw new Error("QA DB project guard failed");
}

const pgEnv = {
  ...process.env,
  PGHOST: host,
  PGPORT: port,
  PGUSER: user,
  PGPASSWORD: password,
  PGDATABASE: database,
  PGSSLMODE: "require",
  PGCONNECT_TIMEOUT: "15",
};

function psql(args, { input, label }) {
  const result = spawnSync(PSQL, ["-X", "-v", "ON_ERROR_STOP=1", ...args], {
    encoding: "utf8",
    env: pgEnv,
    input,
  });
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || "unknown psql error").slice(0, 4000);
    throw new Error(`${label} failed:\n${detail}`);
  }
  return result.stdout.trim();
}

const connection = psql(
  ["-AtF", "|", "-c", "select current_database(), current_user, current_setting('server_version')"],
  { label: "connection check" },
);
console.log(`QA DB connection passed: ${connection}`);

if (!execute) {
  console.log("Dry check only; no schema changes applied");
  process.exit(0);
}
if (confirmation !== REQUIRED_CONFIRMATION) {
  throw new Error(`Migration apply blocked; set QA_MIGRATION_CONFIRM=${REQUIRED_CONFIRMATION}`);
}
if (rerunCareReminder || applyBuild17Care) {
  if (confirmation !== REQUIRED_CONFIRMATION) {
    throw new Error(`Migration apply blocked; set QA_MIGRATION_CONFIRM=${REQUIRED_CONFIRMATION}`);
  }
  const careReminderMigration = resolve(
    applyBuild17Care
      ? "supabase/migrations/202608260002_build17_sleep_reminders_and_notification_locale.sql"
      : "supabase/migrations/202608220001_care_reminders.sql",
  );
  psql(["-f", careReminderMigration], { label: applyBuild17Care ? "Build 17 care migration" : "care reminder migration rerun" });
  if (applyBuild17Care) {
    psql(["-f", "-"], {
      label: "Build 17 care migration history",
      input: "insert into supabase_migrations.schema_migrations(version, name) values ('202608260002', 'build17_sleep_reminders_and_notification_locale') on conflict (version) do update set name = excluded.name;",
    });
  }
  console.log(`${applyBuild17Care ? "QA Build 17 care migration" : "QA care reminder migration rerun"} passed; cronApplied=false`);
  process.exit(0);
}
if (!resetPublic) {
  throw new Error("Fresh QA conversion requires --reset-public");
}

psql(["-f", "-"], {
  label: "QA public schema reset",
  input: `
begin;
drop schema if exists public cascade;
create schema public authorization postgres;
grant all on schema public to postgres;
grant usage on schema public to anon, authenticated, service_role;
create schema if not exists supabase_migrations authorization postgres;
create table if not exists supabase_migrations.schema_migrations (
  version text primary key,
  statements text[],
  name text
);
truncate table supabase_migrations.schema_migrations;
commit;
`,
});
console.log("QA public schema and migration history reset");

const migrationDirectory = resolve("supabase/migrations");
const migrations = readdirSync(migrationDirectory)
  .filter((name) => /^\d+_.+\.sql$/.test(name))
  .filter((name) => name !== CRON_MIGRATION)
  .sort();

for (const filename of migrations) {
  const file = resolve(migrationDirectory, filename);
  psql(["-f", file], { label: filename });
  const version = filename.split("_")[0];
  const name = filename.replace(/^\d+_/, "").replace(/\.sql$/, "");
  psql(["-f", "-"], {
    label: `${filename} history record`,
    input: `insert into supabase_migrations.schema_migrations(version, name) values ('${version}', '${name}') on conflict (version) do update set name = excluded.name;`,
  });
  console.log(`Applied ${filename}`);
}

console.log(`QA migrations complete: applied=${migrations.length}, cronApplied=false`);
