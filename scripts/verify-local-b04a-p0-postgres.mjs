import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn, spawnSync } from "node:child_process";

const postgresBin = process.env.POSTGRES_BIN?.trim() || "/opt/homebrew/opt/postgresql@16/bin";
const work = mkdtempSync(join(tmpdir(), "darin-b04a-p0-pg-"));
const data = join(work, "data");
const socket = join(work, "socket");
const port = "55441";
mkdirSync(socket);

function run(command, args) {
  const result = spawnSync(join(postgresBin, command), args, {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: "inherit",
  });
  if (result.status !== 0) throw new Error(`${command} failed with exit ${result.status}`);
}

function runAsync(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(join(postgresBin, command), args, {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout.on("data", (chunk) => { output += chunk; });
    child.stderr.on("data", (chunk) => { output += chunk; });
    child.on("error", reject);
    child.on("close", (status) => status === 0
      ? resolve(output)
      : reject(new Error(`${command} failed with exit ${status}: ${output.slice(0, 1000)}`)));
  });
}

const connection = ["-h", socket, "-p", port, "-d", "postgres", "-v", "ON_ERROR_STOP=1"];
let started = false;
try {
  run("initdb", ["-D", data, "--auth=trust", "--no-locale", "-E", "UTF8"]);
  run("pg_ctl", ["-D", data, "-o", `-k ${socket} -p ${port} -F -c listen_addresses=`, "-w", "start"]);
  started = true;
  run("psql", [...connection, "-f", "scripts/fixtures/b04a-p0-local-bootstrap.sql"]);
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    run("psql", [...connection, "-f", "supabase/migrations/202609140001_b04a_p0_authorization_hotfix.sql"]);
    console.log(`PASS B0.4a P0 migration apply ${attempt}/2`);
  }

  const acceptSql = `
    begin;
    set role authenticated;
    select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000005', false);
    select * from public.accept_invite_code('DARIN-RACE', 'Race receiver', null, '가족');
    select pg_sleep(2);
    commit;
  `;
  const accepting = runAsync("psql", [...connection, "-c", acceptSql]);
  await new Promise((resolve) => setTimeout(resolve, 300));
  const demotion = spawnSync(join(postgresBin, "psql"), [
    ...connection,
    "-c",
    `set lock_timeout='400ms'; update public.baby_members set permission_role='editor' where baby_id='10000000-0000-4000-8000-000000000001' and user_id='00000000-0000-4000-8000-000000000001';`,
  ], { cwd: process.cwd(), encoding: "utf8", stdio: "pipe" });
  if (demotion.status === 0 || !`${demotion.stdout}${demotion.stderr}`.includes("lock timeout")) {
    throw new Error("issuer demotion was not blocked by the acceptance row lock");
  }
  await accepting;
  console.log("PASS concurrent issuer demotion blocked through invite acceptance commit");

  run("psql", [...connection, "-f", "scripts/fixtures/b04a-p0-local-assertions.sql"]);
  console.log("B0.4a P0 local PostgreSQL QA passed");
} finally {
  if (started) {
    spawnSync(join(postgresBin, "pg_ctl"), ["-D", data, "-m", "fast", "-w", "stop"], { stdio: "inherit" });
  }
  rmSync(work, { recursive: true, force: true });
}
