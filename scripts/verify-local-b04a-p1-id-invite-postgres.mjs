import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn, spawnSync } from "node:child_process";

const postgresBin = process.env.POSTGRES_BIN?.trim() || "/opt/homebrew/opt/postgresql@16/bin";
const work = mkdtempSync(join(tmpdir(), "darin-b04a-p1-id-invite-pg-"));
const data = join(work, "data");
const socket = join("/tmp", `darin-b04a-p1-${process.pid}`);
const port = "55442";
rmSync(socket, { recursive: true, force: true });
mkdirSync(socket);

function command(name, args, options = {}) {
  return spawnSync(join(postgresBin, name), args, {
    cwd: process.cwd(),
    encoding: "utf8",
    ...options,
  });
}

function run(name, args) {
  const result = command(name, args, { stdio: "inherit" });
  if (result.status !== 0) throw new Error(`${name} failed with exit ${result.status}`);
}

function runCapture(name, args) {
  return command(name, args, { stdio: "pipe" });
}

function runAsync(name, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(join(postgresBin, name), args, {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout.on("data", (chunk) => { output += chunk; });
    child.stderr.on("data", (chunk) => { output += chunk; });
    child.on("error", reject);
    child.on("close", (status) => resolve({ status, output }));
  });
}

const connection = ["-h", socket, "-p", port, "-d", "postgres", "-v", "ON_ERROR_STOP=1"];
const psql = (sql, extra = []) => runCapture("psql", [...connection, ...extra, "-c", sql]);
const query = (sql) => {
  const result = psql(sql, ["-At"]);
  if (result.status !== 0) throw new Error(`query failed: ${result.stderr}`);
  return result.stdout.trim();
};

function expectFailure(sql, label, expected = /invite issuer no longer has permission|invite request expired|invite request unavailable/) {
  const result = psql(sql);
  const output = `${result.stdout}\n${result.stderr}`;
  if (result.status === 0) throw new Error(`${label} unexpectedly succeeded`);
  if (!expected.test(output)) throw new Error(`${label} failed for an unexpected reason: ${output}`);
  console.log(`PASS ${label}`);
}

const admin = "00000000-0000-4000-8000-000000000001";
const receiver = "00000000-0000-4000-8000-000000000004";
const secondAdmin = "00000000-0000-4000-8000-000000000006";
const baby = "10000000-0000-4000-8000-000000000001";
const otherBaby = "10000000-0000-4000-8000-000000000002";

const authSql = (userId, body) => `set role authenticated; select set_config('request.jwt.claim.sub', '${userId}', false); ${body}`;
const membershipSql = (role, status = "active", babyId = baby) => `update public.baby_members set permission_role='${role}', status='${status}' where baby_id='${babyId}' and user_id='${admin}';`;

function insertRequest(requestId, { babyId = baby, senderId = admin, receiverId = receiver, role = "admin", requestType = "family", expires = "now() + interval '30 days'" } = {}) {
  const requestRole = requestType === "friend" ? "viewer" : role;
  const relationship = requestType === "friend" ? "친구" : "가족";
  run("psql", [...connection, "-c", `insert into public.darin_invite_requests (id, baby_id, sender_id, receiver_id, request_type, permission_role, relationship_label, status, expires_at) values ('${requestId}', '${babyId}', '${senderId}', '${receiverId}', '${requestType}', '${requestRole}', '${relationship}', 'pending', ${expires});`]);
}

function resetMembership() {
  run("psql", [...connection, "-c", `delete from public.baby_members where baby_id='${baby}' and user_id='${receiver}'; insert into public.baby_members (baby_id, user_id, permission_role, relationship_label, status) values ('${baby}', '${admin}', 'admin', '가족', 'active') on conflict (baby_id, user_id) do update set permission_role='admin', status='active';`]);
}

let started = false;
try {
  run("initdb", ["-D", data, "--auth=trust", "--no-locale", "-E", "UTF8"]);
  run("pg_ctl", ["-D", data, "-o", `-k ${socket} -p ${port} -F -c listen_addresses=`, "-w", "start"]);
  started = true;

  run("psql", [...connection, "-f", "scripts/fixtures/b04a-p0-local-bootstrap.sql"]);
  run("psql", [...connection, "-f", "scripts/fixtures/b04a-p1-id-invite-local-bootstrap.sql"]);
  for (const migration of [
    "supabase/migrations/202608160001_darin_id_invite_requests.sql",
    "supabase/migrations/202608170001_build13_darin_invite_hardening.sql",
    "supabase/migrations/202608170004_darin_invite_response_ambiguity.sql",
  ]) run("psql", [...connection, "-f", migration]);

  // Reproduce the vulnerable sequence before applying the P1 migration.
  const createdOutput = query(authSql(admin, `select request_id from public.send_darin_id_invite_request('${baby}', 'Receiver#0004', 'family', 'admin', '가족');`));
  const created = createdOutput.split(/\r?\n/).filter((line) => /^[0-9a-f-]{36}$/.test(line)).at(-1);
  if (!created) throw new Error("baseline request was not created");
  run("psql", [...connection, "-c", membershipSql("editor")]);
  run("psql", [...connection, "-c", authSql(receiver, `select * from public.respond_darin_id_invite_request('${created}', true);`)]);
  if (query(`select permission_role::text from public.baby_members where baby_id='${baby}' and user_id='${receiver}';`) !== "admin") {
    throw new Error("baseline vulnerable sequence did not grant admin membership");
  }
  console.log("PASS original P1 vulnerable sequence reproduced before patch");
  run("psql", [...connection, "-c", `delete from public.baby_members where baby_id='${baby}' and user_id='${receiver}'; delete from public.darin_invite_requests where id='${created}'; update public.baby_members set permission_role='admin', status='active' where baby_id='${baby}' and user_id='${admin}';`]);

  run("psql", [...connection, "-f", "supabase/migrations/202609140002_b04a_p1_id_invite_current_authority.sql"]);
  run("psql", [...connection, "-f", "supabase/migrations/202609140002_b04a_p1_id_invite_current_authority.sql"]);
  console.log("PASS P1 migration apply 2/2 (idempotent local replay)");

  const cases = [
    ["demoted admin", "editor"],
    ["viewer", "viewer"],
    ["inactive admin", "admin", "inactive"],
  ];
  for (const [caseIndex, [label, role, status = "active"]] of cases.entries()) {
    resetMembership();
    const id = `60000000-0000-4000-8000-0000000000${10 + caseIndex}`;
    insertRequest(id);
    run("psql", [...connection, "-c", membershipSql(role, status)]);
    expectFailure(authSql(receiver, `select * from public.respond_darin_id_invite_request('${id}', true);`), `${label} issuer rejected`);
    if (query(`select count(*) from public.baby_members where baby_id='${baby}' and user_id='${receiver}';`) !== "0") throw new Error(`${label} issuer granted membership`);
    run("psql", [...connection, "-c", `delete from public.darin_invite_requests where id='${id}';`]);
  }

  resetMembership();
  const removedId = "60000000-0000-4000-8000-000000000020";
  insertRequest(removedId);
  run("psql", [...connection, "-c", `delete from public.baby_members where baby_id='${baby}' and user_id='${admin}';`]);
  expectFailure(authSql(receiver, `select * from public.respond_darin_id_invite_request('${removedId}', true);`), "removed issuer rejected");
  run("psql", [...connection, "-c", `delete from public.darin_invite_requests where id='${removedId}';`]);

  resetMembership();
  const noMembershipId = "60000000-0000-4000-8000-000000000021";
  insertRequest(noMembershipId);
  run("psql", [...connection, "-c", `delete from public.baby_members where baby_id='${baby}' and user_id='${admin}';`]);
  expectFailure(authSql(receiver, `select * from public.respond_darin_id_invite_request('${noMembershipId}', true);`), "missing issuer membership rejected");
  run("psql", [...connection, "-c", `delete from public.darin_invite_requests where id='${noMembershipId}';`]);

  resetMembership();
  run("psql", [...connection, "-c", `insert into public.babies (id, name) values ('${otherBaby}', 'Other baby') on conflict do nothing;`]);
  const wrongScopeId = "60000000-0000-4000-8000-000000000022";
  insertRequest(wrongScopeId, { babyId: otherBaby });
  expectFailure(authSql(receiver, `select * from public.respond_darin_id_invite_request('${wrongScopeId}', true);`), "wrong-baby issuer rejected");
  run("psql", [...connection, "-c", `delete from public.darin_invite_requests where id='${wrongScopeId}';`]);

  resetMembership();
  const validId = "60000000-0000-4000-8000-000000000023";
  insertRequest(validId, { role: "editor" });
  run("psql", [...connection, "-c", authSql(receiver, `select * from public.respond_darin_id_invite_request('${validId}', true);`)]);
  if (query(`select permission_role::text from public.baby_members where baby_id='${baby}' and user_id='${receiver}';`) !== "editor") throw new Error("valid admin did not grant requested editor role");
  console.log("PASS current admin positive control");

  resetMembership();
  const friendId = "60000000-0000-4000-8000-000000000030";
  insertRequest(friendId, { requestType: "friend" });
  run("psql", [...connection, "-c", authSql(receiver, `select * from public.respond_darin_id_invite_request('${friendId}', true);`)]);
  if (query(`select status from public.memory_friends where baby_id='${baby}' and user_id='${receiver}';`) !== "active") throw new Error("valid admin did not grant friend membership");
  run("psql", [...connection, "-c", `delete from public.memory_friends where baby_id='${baby}' and user_id='${receiver}'; delete from public.darin_invite_requests where id='${friendId}';`]);
  console.log("PASS current admin friend-request positive control");

  resetMembership();
  const friendRejectedId = "60000000-0000-4000-8000-000000000031";
  insertRequest(friendRejectedId, { requestType: "friend" });
  run("psql", [...connection, "-c", membershipSql("editor")]);
  expectFailure(authSql(receiver, `select * from public.respond_darin_id_invite_request('${friendRejectedId}', true);`), "demoted friend-request issuer rejected");
  run("psql", [...connection, "-c", `delete from public.darin_invite_requests where id='${friendRejectedId}';`]);

  resetMembership();
  const declineId = "60000000-0000-4000-8000-000000000024";
  insertRequest(declineId);
  run("psql", [...connection, "-c", `delete from public.baby_members where baby_id='${baby}' and user_id='${admin}';`]);
  run("psql", [...connection, "-c", authSql(receiver, `select * from public.respond_darin_id_invite_request('${declineId}', false);`)]);
  if (query(`select status from public.darin_invite_requests where id='${declineId}';`) !== "declined") throw new Error("decline after issuer removal did not complete");
  console.log("PASS decline remains available after issuer removal");

  resetMembership();
  const mismatchId = "60000000-0000-4000-8000-000000000025";
  insertRequest(mismatchId);
  expectFailure(authSql(secondAdmin, `select * from public.respond_darin_id_invite_request('${mismatchId}', true);`), "recipient mismatch rejected", /invite request unavailable/);
  run("psql", [...connection, "-c", `delete from public.darin_invite_requests where id='${mismatchId}';`]);
  const expiredId = "60000000-0000-4000-8000-000000000026";
  insertRequest(expiredId, { expires: "now() - interval '1 second'" });
  expectFailure(authSql(receiver, `select * from public.respond_darin_id_invite_request('${expiredId}', true);`), "expired request rejected");
  run("psql", [...connection, "-c", `delete from public.darin_invite_requests where id='${expiredId}';`]);

  // Response-first ordering: the authority row is held until response commit;
  // a concurrent demotion cannot slip between validation and grant.
  resetMembership();
  const responseFirstId = "60000000-0000-4000-8000-000000000027";
  insertRequest(responseFirstId);
  const responseFirst = runAsync("psql", [...connection, "-c", `begin; ${authSql(receiver, `select * from public.respond_darin_id_invite_request('${responseFirstId}', true); select pg_sleep(2);`)} commit;`]);
  await new Promise((resolve) => setTimeout(resolve, 300));
  const blockedDemotion = psql(`set lock_timeout='400ms'; ${authSql(secondAdmin, membershipSql('editor'))}`);
  const blockedOutput = `${blockedDemotion.stdout}\n${blockedDemotion.stderr}`;
  if (blockedDemotion.status === 0 || !/lock timeout|canceling statement due to lock timeout/.test(blockedOutput)) throw new Error("response-first demotion was not blocked by issuer authority lock");
  const responseFirstResult = await responseFirst;
  if (responseFirstResult.status !== 0) throw new Error(`response-first response failed: ${responseFirstResult.output}`);
  if (query(`select permission_role::text from public.baby_members where baby_id='${baby}' and user_id='${receiver}';`) !== "admin") throw new Error("response-first did not grant membership");
  run("psql", [...connection, "-c", membershipSql("editor")]);
  console.log("PASS response-first race: acceptance committed before later demotion");

  // Demotion-first ordering: acceptance waits for the row lock, then sees the
  // committed non-admin state and fails without creating membership.
  resetMembership();
  const demotionFirstId = "60000000-0000-4000-8000-000000000028";
  insertRequest(demotionFirstId);
  const demotionFirst = runAsync("psql", [...connection, "-c", `begin; ${authSql(secondAdmin, membershipSql('editor'))} select pg_sleep(1.5); commit;`]);
  await new Promise((resolve) => setTimeout(resolve, 250));
  const demotionFirstResponse = psql(authSql(receiver, `select * from public.respond_darin_id_invite_request('${demotionFirstId}', true);`));
  const demotionFirstOutput = `${demotionFirstResponse.stdout}\n${demotionFirstResponse.stderr}`;
  await demotionFirst;
  if (demotionFirstResponse.status === 0 || !/invite issuer no longer has permission/.test(demotionFirstOutput)) throw new Error(`demotion-first response did not fail closed: ${demotionFirstOutput}`);
  if (query(`select count(*) from public.baby_members where baby_id='${baby}' and user_id='${receiver}';`) !== "0") throw new Error("demotion-first created membership");
  console.log("PASS demotion-first race: committed demotion wins and acceptance rejects");
  run("psql", [...connection, "-c", `delete from public.darin_invite_requests where id='${demotionFirstId}';`]);

  resetMembership();
  const removalFirstId = "60000000-0000-4000-8000-000000000032";
  insertRequest(removalFirstId);
  const removalFirst = runAsync("psql", [...connection, "-c", `begin; ${authSql(secondAdmin, `delete from public.baby_members where baby_id='${baby}' and user_id='${admin}'; select pg_sleep(1.5);`)} commit;`]);
  await new Promise((resolve) => setTimeout(resolve, 250));
  const removalFirstResponse = psql(authSql(receiver, `select * from public.respond_darin_id_invite_request('${removalFirstId}', true);`));
  const removalFirstOutput = `${removalFirstResponse.stdout}\n${removalFirstResponse.stderr}`;
  await removalFirst;
  if (removalFirstResponse.status === 0 || !/invite issuer no longer has permission/.test(removalFirstOutput)) throw new Error(`removal-first response did not fail closed: ${removalFirstOutput}`);
  if (query(`select count(*) from public.baby_members where baby_id='${baby}' and user_id='${receiver}';`) !== "0") throw new Error("removal-first created membership");
  console.log("PASS removal-first race: committed removal wins and acceptance rejects");
  run("psql", [...connection, "-c", `delete from public.darin_invite_requests where id='${removalFirstId}';`]);

  resetMembership();
  const replayId = "60000000-0000-4000-8000-000000000029";
  insertRequest(replayId);
  run("psql", [...connection, "-c", authSql(receiver, `select * from public.respond_darin_id_invite_request('${replayId}', true);`)]);
  expectFailure(authSql(receiver, `select * from public.respond_darin_id_invite_request('${replayId}', true);`), "already-used request rejected", /invite request unavailable/);

  console.log("B0.4a-1 ID invite current-authority local PostgreSQL assertions passed");
} finally {
  if (started) run("pg_ctl", ["-D", data, "-m", "fast", "-w", "stop"]);
  rmSync(socket, { recursive: true, force: true });
  rmSync(work, { recursive: true, force: true });
}
