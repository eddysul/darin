import { spawnSync } from "node:child_process";
import {
  PRODUCTION_PROJECT_REF,
  QA_PROJECT_REF,
  qaConfirmation,
  resolvePsqlBinary,
} from "./lib/qa-project-config.mjs";

const REQUIRED_CONFIRMATION = qaConfirmation("VAULT");
const PSQL = resolvePsqlBinary();

const execute = process.argv.includes("--execute");
const host = process.env.SUPABASE_DB_HOST?.trim() ?? "";
const user = process.env.SUPABASE_DB_USER?.trim() ?? "";
const password = process.env.SUPABASE_DB_PASSWORD ?? "";
const projectUrl = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
const cronSecret = process.env.CARE_REMINDER_CRON_SECRET?.trim() ?? "";

if (!host || !user || !password || !projectUrl || !cronSecret) {
  throw new Error("QA Vault environment is incomplete");
}
if (!host.endsWith("pooler.supabase.com") || !user.includes(QA_PROJECT_REF)
    || !projectUrl.includes(QA_PROJECT_REF)) {
  throw new Error("QA Vault project guard failed");
}
if (host.includes(PRODUCTION_PROJECT_REF) || user.includes(PRODUCTION_PROJECT_REF) || projectUrl.includes(PRODUCTION_PROJECT_REF)) {
  throw new Error("Production target is blocked");
}

const pgEnv = {
  ...process.env,
  PGHOST: host,
  PGPORT: process.env.SUPABASE_DB_PORT || "5432",
  PGUSER: user,
  PGPASSWORD: password,
  PGDATABASE: process.env.SUPABASE_DB_NAME || "postgres",
  PGSSLMODE: "require",
  PGCONNECT_TIMEOUT: "15",
};

const args = [
  "-X", "-v", "ON_ERROR_STOP=1",
  "-v", `project_url=${projectUrl}`,
  "-v", `cron_secret=${cronSecret}`,
  "-f", "-",
];
const sql = execute ? `
begin;
delete from vault.secrets where name in ('project_url', 'care_reminder_cron_secret');
select vault.create_secret(:'project_url', 'project_url', 'Darin QA project URL');
select vault.create_secret(:'cron_secret', 'care_reminder_cron_secret', 'Darin QA care reminder worker secret');
commit;
` : `select count(*) from vault.secrets where name in ('project_url', 'care_reminder_cron_secret');`;

if (execute && process.env.QA_VAULT_CONFIRM !== REQUIRED_CONFIRMATION) {
  throw new Error(`Vault write blocked; set QA_VAULT_CONFIRM=${REQUIRED_CONFIRMATION}`);
}
const result = spawnSync(PSQL, args, { encoding: "utf8", env: pgEnv, input: sql });
if (result.status !== 0) throw new Error((result.stderr || result.stdout).slice(0, 3000));
console.log(execute ? "QA care reminder Vault secrets configured" : "QA Vault connection check passed");
