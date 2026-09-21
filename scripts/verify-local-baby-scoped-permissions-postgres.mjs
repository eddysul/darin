import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn, spawnSync } from "node:child_process";

const postgresBin = process.env.POSTGRES_BIN?.trim() || "/opt/homebrew/opt/postgresql@16/bin";
const work = mkdtempSync(join(tmpdir(), "darin-baby-access-"));
const data = join(work, "data");
const socket = join("/tmp", `darin-baby-access-${process.pid}`);
const port = "55447";
rmSync(socket, { recursive: true, force: true });
mkdirSync(socket);

const command = (name, args, options = {}) => spawnSync(join(postgresBin, name), args, {
  cwd: process.cwd(), encoding: "utf8", ...options,
});
const run = (name, args) => {
  const result = command(name, args, { stdio: "inherit" });
  if (result.status !== 0) throw new Error(`${name} failed with exit ${result.status}`);
};
const connection = ["-X", "-q", "-h", socket, "-p", port, "-d", "postgres", "-v", "ON_ERROR_STOP=1"];
const psql = (sql, extra = []) => command("psql", [...connection, ...extra, "-c", sql], { stdio: "pipe" });
const query = (sql) => {
  const result = psql(sql, ["-At"]);
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
  return result.stdout.trim().split(/\r?\n/).filter(Boolean).at(-1) ?? "";
};
const actor = (userId, body) => `set role authenticated; select set_config('request.jwt.claim.sub','${userId}',false); ${body}`;
const expect = (label, actual, wanted) => {
  if (actual !== String(wanted)) throw new Error(`${label}: expected ${wanted}, got ${actual}`);
  console.log(`PASS ${label}`);
};
const denied = (label, userId, sql) => {
  const result = psql(actor(userId, sql));
  if (result.status === 0) throw new Error(`${label}: unexpectedly succeeded`);
  console.log(`PASS ${label}`);
};
const runAsync = (sql) => new Promise((resolve, reject) => {
  const child = spawn(join(postgresBin, "psql"), [...connection, "-At", "-c", sql], {
    cwd: process.cwd(), encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout.on("data", (chunk) => { output += chunk; });
  child.stderr.on("data", (chunk) => { output += chunk; });
  child.on("error", reject);
  child.on("close", (status) => resolve({ status, output }));
});

const admin = "00000000-0000-4000-8000-000000000001";
const outsider = "00000000-0000-4000-8000-000000000002";
const friend = "00000000-0000-4000-8000-000000000003";
const editor = "00000000-0000-4000-8000-000000000004";
const viewer = "00000000-0000-4000-8000-000000000005";
const concurrentAdminOne = "00000000-0000-4000-8000-000000000006";
const concurrentAdminTwo = "00000000-0000-4000-8000-000000000007";
const babyOne = "10000000-0000-4000-8000-000000000001";
const babyTwo = "10000000-0000-4000-8000-000000000002";
const babyThree = "10000000-0000-4000-8000-000000000003";
const babyFour = "10000000-0000-4000-8000-000000000004";
const careId = "41000000-0000-4000-8000-000000000001";
const friendPost = "71000000-0000-4000-8000-000000000001";

let started = false;
try {
  run("initdb", ["-D", data, "--auth=trust", "--no-locale", "-E", "UTF8"]);
  run("pg_ctl", ["-D", data, "-o", `-k ${socket} -p ${port} -F -c listen_addresses=`, "-w", "start"]);
  started = true;
  run("psql", [...connection, "-f", "scripts/fixtures/b04a-p0-local-bootstrap.sql"]);
  run("psql", [...connection, "-c", "create role anon nologin; create role service_role nologin bypassrls;"]);
  run("psql", [...connection, "-f", "scripts/fixtures/b04a-p1-ownership-visibility-local-bootstrap.sql"]);
  run("psql", [...connection, "-c", `
    create or replace function public.set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end $$;
    alter table public.babies add column created_by uuid references public.profiles(id);
    update public.babies set created_by=case when id='${babyOne}' then '${admin}'::uuid else '${outsider}'::uuid end;
    insert into public.baby_members(baby_id,user_id,permission_role,status) values
      ('${babyOne}','${editor}','editor','active'),('${babyOne}','${viewer}','viewer','active');
    insert into public.memory_friends(baby_id,user_id,invited_by,status) values ('${babyOne}','${friend}','${admin}','active');
    insert into public.care_logs(id,baby_id,category,recorded_at,date_key,time_local,payload,created_by)
      values ('${careId}','${babyOne}','feeding',now(),'2026-09-20','10:00','{}','${admin}');
    insert into public.memory_posts(id,baby_id,author_id,privacy_type,status,caption)
      values ('${friendPost}','${babyOne}','${admin}','friend_circle','published','friend moment');
  `]);
  for (const migration of [
    "supabase/migrations/202609140003_b04a_p1_ownership_lifecycle.sql",
    "supabase/migrations/202609140004_b04a_p1_memory_visibility_social.sql",
    "supabase/migrations/202609140005_b04a_p1_memory_recipient_assignment.sql",
    "supabase/migrations/202609200001_baby_scoped_permissions.sql",
    "supabase/migrations/202609200001_baby_scoped_permissions.sql",
  ]) run("psql", [...connection, "-f", migration]);

  expect("legacy admin backfill is full access", query(`select care_read and care_write and moments_read and moments_write and social_comment and social_react from baby_access_permissions where baby_id='${babyOne}' and user_id='${admin}'`), "t");
  expect("legacy editor backfill preserves write access", query(`select care_read and care_write and moments_read and moments_write and social_comment and social_react from baby_access_permissions where baby_id='${babyOne}' and user_id='${editor}'`), "t");
  expect("legacy viewer remains read-only", query(`select care_read and not care_write and moments_read and not moments_write and not social_comment and not social_react from baby_access_permissions where baby_id='${babyOne}' and user_id='${viewer}'`), "t");
  expect("legacy friend gets moments/social without care", query(`select not care_read and not care_write and moments_read and not moments_write and social_comment and social_react from baby_access_permissions where baby_id='${babyOne}' and user_id='${friend}'`), "t");

  expect("viewer can read care before custom change", query(actor(viewer, `select count(*) from care_logs where baby_id='${babyOne}'`)), 1);
  denied("viewer cannot create care", viewer, `insert into care_logs(id,baby_id,category,recorded_at,date_key,time_local,payload,created_by) values (gen_random_uuid(),'${babyOne}','sleep',now(),'2026-09-20','11:00','{}','${viewer}')`);
  expect("friend cannot read care", query(actor(friend, `select count(*) from care_logs where baby_id='${babyOne}'`)), 0);
  expect("friend can read friend-circle moment", query(actor(friend, `select count(*) from memory_posts where id='${friendPost}'`)), 1);
  expect("friend can comment when granted", query(actor(friend, `with x as (insert into memory_comments(memory_post_id,author_id,body) values ('${friendPost}','${friend}','ok') returning id) select count(*) from x`)), 1);
  expect("same user has no cross-baby care access", query(actor(viewer, `select public.has_baby_access('${babyTwo}','care.read')`)), "f");
  denied("authenticated user cannot query another user's raw baby link", outsider,
    `select public.is_current_baby_link('${babyOne}','${admin}')`);
  denied("authenticated user cannot query another user's raw admin role", outsider,
    `select public.is_baby_full_admin('${babyOne}','${admin}')`);
  denied("authenticated user cannot query another user's raw capabilities", outsider,
    `select public.user_has_baby_access('${babyOne}','${admin}','care.write')`);
  expect("current-user admin wrapper remains available to policy callers", query(actor(admin,
    `select public.is_current_baby_admin('${babyOne}')`)), "t");

  expect("admin can grant independent care write", query(actor(admin, `select (public.set_baby_access_permissions('${babyOne}','${viewer}',true,true,false,false,false,false)).care_write`)), "t");
  expect("granted viewer can create own care", query(actor(viewer, `with x as (insert into care_logs(id,baby_id,category,recorded_at,date_key,time_local,payload,created_by) values (gen_random_uuid(),'${babyOne}','sleep',now(),'2026-09-20','11:00','{}','${viewer}') returning id) select count(*) from x`)), 1);
  denied("invalid write without read is rejected", admin, `select public.set_baby_access_permissions('${babyOne}','${viewer}',false,true,false,false,false,false)`);

  run("psql", [...connection, "-c", `update baby_members set relationship_label='친구' where baby_id='${babyOne}' and user_id='${viewer}'`]);
  expect("relationship label change does not grant moments", query(`select not moments_read and care_write from baby_access_permissions where baby_id='${babyOne}' and user_id='${viewer}'`), "t");
  denied("direct role edit cannot create Full Admin", admin, `update baby_members set permission_role='admin' where baby_id='${babyOne}' and user_id='${viewer}'`);
  expect("dedicated current-admin approval promotes Full Admin", query(actor(admin, `select public.promote_baby_full_admin('${babyOne}','${viewer}')`)), "t");
  expect("promoted admin is full access", query(actor(viewer, `select public.has_baby_access('${babyOne}','care.write') and public.has_baby_access('${babyOne}','moments.write')`)), "t");
  run("psql", [...connection, "-c", actor(admin, `update baby_members set permission_role='viewer' where baby_id='${babyOne}' and user_id='${viewer}'`)]);

  expect("admin can remove comment capability", query(actor(admin, `select not (public.set_baby_access_permissions('${babyOne}','${friend}',false,false,true,false,false,true)).social_comment`)), "t");
  denied("friend cannot comment after targeted revocation", friend, `insert into memory_comments(memory_post_id,author_id,body) values ('${friendPost}','${friend}','denied')`);
  expect("friend may still react independently", query(actor(friend, `with x as (insert into memory_reactions(memory_post_id,author_id,reaction_type) values ('${friendPost}','${friend}','heart') returning id) select count(*) from x`)), 1);

  // A write holding current relation+permission locks must serialize removal.
  const writer = runAsync(actor(viewer, `begin; select public.current_baby_access_for_write('${babyOne}','care.read'); select pg_sleep(1); commit;`));
  await new Promise((resolve) => setTimeout(resolve, 150));
  const removalStarted = performance.now();
  const removal = runAsync(actor(admin, `delete from baby_members where baby_id='${babyOne}' and user_id='${viewer}';`));
  const [writerResult, removalResult] = await Promise.all([writer, removal]);
  if (writerResult.status !== 0 || removalResult.status !== 0 || performance.now()-removalStarted < 600) {
    throw new Error(`write/removal serialization failed: ${writerResult.output} ${removalResult.output}`);
  }
  console.log("PASS permission revocation serializes after in-flight authorized write");
  expect("removed member loses permission row", query(`select count(*) from baby_access_permissions where baby_id='${babyOne}' and user_id='${viewer}'`), 0);
  expect("removed member cannot reuse stale care access", query(actor(viewer, `select public.has_baby_access('${babyOne}','care.read')`)), "f");

  run("psql", [...connection, "-c", actor(admin, `insert into babies(id,name,created_by) values ('${babyThree}','Last admin baby','${admin}'); insert into baby_members(baby_id,user_id,permission_role,status) values ('${babyThree}','${admin}','admin','active');`)]);
  denied("last Full Admin cannot directly remove own authority", admin, `delete from baby_members where baby_id='${babyThree}' and user_id='${admin}'`);

  run("psql", [...connection, "-c", `
    insert into profiles(id,display_name) values
      ('${concurrentAdminOne}','Concurrent admin one'),
      ('${concurrentAdminTwo}','Concurrent admin two');
    insert into babies(id,name,created_by) values ('${babyFour}','Concurrent admin baby','${concurrentAdminOne}');
    select set_config('darin.admin_grant_approved','true',true);
    insert into baby_members(baby_id,user_id,permission_role,status) values
      ('${babyFour}','${concurrentAdminOne}','admin','active'),
      ('${babyFour}','${concurrentAdminTwo}','admin','active');
  `]);
  const firstAdminDeparture = runAsync(`begin; delete from baby_members where baby_id='${babyFour}' and user_id='${concurrentAdminOne}'; select pg_sleep(1); commit;`);
  await new Promise((resolve) => setTimeout(resolve, 150));
  const secondAdminDeparture = runAsync(`delete from baby_members where baby_id='${babyFour}' and user_id='${concurrentAdminTwo}';`);
  const [firstDepartureResult, secondDepartureResult] = await Promise.all([firstAdminDeparture, secondAdminDeparture]);
  const successfulDepartures = [firstDepartureResult, secondDepartureResult].filter((result) => result.status === 0).length;
  if (successfulDepartures !== 1) {
    throw new Error(`concurrent last-admin guard allowed ${successfulDepartures} departures: ${firstDepartureResult.output} ${secondDepartureResult.output}`);
  }
  expect("concurrent departures retain one active Full Admin", query(`select count(*) from baby_members where baby_id='${babyFour}' and status::text='active' and permission_role='admin'`), 1);

  console.log("baby-scoped permissions local PostgreSQL regression PASS");
} finally {
  if (started) command("pg_ctl", ["-D", data, "-m", "immediate", "-w", "stop"], { stdio: "ignore" });
  rmSync(work, { recursive: true, force: true });
  rmSync(socket, { recursive: true, force: true });
}
