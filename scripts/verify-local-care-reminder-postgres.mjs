import { mkdtempSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const postgresBin = process.env.POSTGRES_BIN?.trim() || "/opt/homebrew/opt/postgresql@16/bin";
const work = mkdtempSync(join(tmpdir(), "darin-care-reminder-pg-"));
const data = join(work, "data");
const socket = join(work, "socket");
const port = "55439";
mkdirSync(socket);

function run(command, args, options = {}) {
  const result = spawnSync(join(postgresBin, command), args, {
    cwd: process.cwd(), encoding: "utf8", stdio: options.capture ? "pipe" : "inherit",
  });
  if (result.status !== 0) {
    if (options.capture) process.stderr.write(`${result.stdout ?? ""}${result.stderr ?? ""}`);
    throw new Error(`${command} failed with exit ${result.status}`);
  }
  return result.stdout ?? "";
}

const connection = ["-h", socket, "-p", port, "-d", "postgres", "-v", "ON_ERROR_STOP=1"];
let started = false;
try {
  run("initdb", ["-D", data, "--auth=trust", "--no-locale", "-E", "UTF8"]);
  run("pg_ctl", ["-D", data, "-o", `-k ${socket} -p ${port} -F -c listen_addresses=`, "-w", "start"]);
  started = true;

  run("psql", [...connection, "-f", "scripts/fixtures/care-reminder-local-bootstrap.sql"]);
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    run("psql", [...connection, "-f", "supabase/migrations/202608220001_care_reminders.sql"]);
    console.log(`PASS care reminder migration apply ${attempt}/2`);
  }
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    run("psql", [...connection, "-f", "supabase/migrations/202608260002_build17_sleep_reminders_and_notification_locale.sql"]);
    console.log(`PASS Build 17 sleep/locale migration apply ${attempt}/2`);
  }
  run("psql", [...connection, "-f", "scripts/fixtures/care-reminder-local-assertions.sql"]);

  const worker = readFileSync("supabase/functions/process-care-reminders/index.ts", "utf8");
  if (!worker.includes('request.headers.get("x-cron-secret") !== cronSecret')) {
    throw new Error("worker custom cron authentication check is missing");
  }
  console.log("PASS worker custom-secret source check");
  console.log("local care reminder PostgreSQL QA passed");
} finally {
  if (started) {
    spawnSync(join(postgresBin, "pg_ctl"), ["-D", data, "-m", "fast", "-w", "stop"], { stdio: "inherit" });
  }
  rmSync(work, { recursive: true, force: true });
}
