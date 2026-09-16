import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import {
  B04A_P1_EXPECTED_FUNCTION_CONTRACT,
  B04A_P1_EXPECTED_POLICY_CONTRACT,
  B04A_P1_FUNCTION_CONTRACT_SQL,
  B04A_P1_POLICY_CONTRACT_SQL,
  B04A_P1_POLICY_DIAGNOSTIC_SQL,
  B04A_P1_POLICY_ROW_CONTRACT_SQL,
} from "./lib/b04a-p1-ownership-visibility-contract.mjs";

const postgresBin = process.env.POSTGRES_BIN?.trim() || "/opt/homebrew/opt/postgresql@16/bin";
const work = mkdtempSync(join(tmpdir(), "darin-b04a-p1-ownership-visibility-"));
const data = join(work, "data");
const socket = join("/tmp", `darin-b04a-p1-ov-${process.pid}`);
const port = "55443";
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

const connection = ["-X", "-h", socket, "-p", port, "-d", "postgres", "-v", "ON_ERROR_STOP=1"];
const psql = (sql, extra = []) => runCapture("psql", [...connection, ...extra, "-c", sql]);
const query = (sql) => {
  const result = psql(sql, ["-At"]);
  if (result.status !== 0) throw new Error(`query failed: ${result.stderr || result.stdout}`);
  return result.stdout.trim();
};

const uid = (suffix) => `00000000-0000-4000-8000-${String(suffix).padStart(12, "0")}`;
const baby = (suffix) => `10000000-0000-4000-8000-${String(suffix).padStart(12, "0")}`;
const row = (prefix, suffix) => `${prefix}0000000-0000-4000-8000-${String(suffix).padStart(12, "0")}`;
const actorSql = (userId, body) => `set role authenticated; select set_config('request.jwt.claim.sub', '${userId}', false); ${body}`;

function expectCount(label, userId, body, expected) {
  const result = query(actorSql(userId, body));
  const actual = result.split(/\r?\n/).filter(Boolean).at(-1);
  if (actual !== String(expected)) throw new Error(`${label}: expected ${expected}, got ${actual ?? "empty"}`);
  console.log(`PASS ${label}`);
}

function expectDenied(label, userId, body) {
  const result = psql(actorSql(userId, body));
  if (result.status === 0) throw new Error(`${label}: unexpectedly succeeded`);
  const output = `${result.stdout}\n${result.stderr}`;
  if (/Bearer\s|eyJ[A-Za-z0-9_-]+\.|@darin\./i.test(output)) {
    throw new Error(`${label}: denial exposed credential material`);
  }
  console.log(`PASS ${label}`);
}

const admin = uid(1);
const outsider = uid(2);
const friend = uid(3);
const editor = uid(4);
const viewer = uid(5);
const removed = uid(6);
const selectedMember = uid(7);
const taggedMember = uid(8);
const babyOne = baby(1);
const babyTwo = baby(2);

const ids = {
  careOther: row("4", 101),
  careOwn: row("4", 102),
  careNull: row("4", 103),
  careRace: row("4", 104),
  growthOther: row("5", 201),
  growthOwn: row("5", 202),
  diaryOwn: row("6", 301),
  diaryRemoved: row("6", 302),
  diaryViewer: row("6", 303),
  memoryFamily: row("7", 401),
  memoryRemovedOnly: row("7", 402),
  memoryPosting: row("7", 403),
  memoryFriend: row("7", 404),
  memoryTagged: row("7", 405),
  memorySelected: row("7", 406),
  memoryFailed: row("7", 407),
  memoryOwnOnly: row("7", 408),
  commentEditor: row("8", 501),
  commentFriend: row("8", 502),
  commentRemoved: row("8", 503),
  reactionFriend: row("9", 601),
  reactionRemoved: row("9", 602),
};

let started = false;
try {
  run("initdb", ["-D", data, "--auth=trust", "--no-locale", "-E", "UTF8"]);
  run("pg_ctl", ["-D", data, "-o", `-k ${socket} -p ${port} -F -c listen_addresses=`, "-w", "start"]);
  started = true;

  run("psql", [...connection, "-f", "scripts/fixtures/b04a-p0-local-bootstrap.sql"]);
  run("psql", [...connection, "-c", "create role anon nologin"]);
  run("psql", [...connection, "-f", "scripts/fixtures/b04a-p1-ownership-visibility-local-bootstrap.sql"]);

  run("psql", [...connection, "-c", `
    insert into public.profiles(id, display_name) values
      ('${removed}', 'Removed author'),
      ('${selectedMember}', 'Selected member'),
      ('${taggedMember}', 'Tagged member');
    insert into public.baby_members(baby_id,user_id,permission_role,status) values
      ('${babyOne}','${editor}','editor','active'),
      ('${babyTwo}','${editor}','editor','active'),
      ('${babyOne}','${viewer}','viewer','active'),
      ('${babyOne}','${selectedMember}','viewer','active'),
      ('${babyOne}','${taggedMember}','viewer','active');
    insert into public.memory_friends(baby_id,user_id,invited_by,status)
      values ('${babyOne}','${friend}','${admin}','active');

    insert into public.care_logs(id,baby_id,category,recorded_at,date_key,time_local,payload,created_by) values
      ('${ids.careOther}','${babyOne}','feeding',now(),'2026-09-14','10:00','{}','${admin}'),
      ('${ids.careOwn}','${babyOne}','sleep',now(),'2026-09-14','11:00','{}','${editor}'),
      ('${ids.careNull}','${babyOne}','diaper',now(),'2026-09-14','12:00','{}',null),
      ('${ids.careRace}','${babyOne}','feeding',now(),'2026-09-14','13:00','{}','${editor}');
    insert into public.growth_records(id,baby_id,measured_at,weight_kg,created_by) values
      ('${ids.growthOther}','${babyOne}',current_date,5.1,'${admin}'),
      ('${ids.growthOwn}','${babyOne}',current_date,5.2,'${editor}');
    insert into public.diary_entries(id,baby_id,author_id,entry_date,body) values
      ('${ids.diaryOwn}','${babyOne}','${editor}',current_date,'editor diary'),
      ('${ids.diaryRemoved}','${babyOne}','${removed}',current_date,'removed diary'),
      ('${ids.diaryViewer}','${babyOne}','${viewer}',current_date,'viewer diary');

    insert into public.memory_posts(id,baby_id,author_id,privacy_type,status,caption) values
      ('${ids.memoryFamily}','${babyOne}','${editor}','family_circle','published','family'),
      ('${ids.memoryRemovedOnly}','${babyOne}','${removed}','only_me','published','removed private'),
      ('${ids.memoryPosting}','${babyOne}','${editor}','family_circle','posting','posting'),
      ('${ids.memoryFriend}','${babyOne}','${editor}','friend_circle','published','friend'),
      ('${ids.memoryTagged}','${babyOne}','${editor}','tagged_family','published','tagged'),
      ('${ids.memorySelected}','${babyOne}','${editor}','selected_people','published','selected'),
      ('${ids.memoryFailed}','${babyOne}','${editor}','family_circle','failed','failed'),
      ('${ids.memoryOwnOnly}','${babyOne}','${editor}','only_me','published','private');
    insert into public.memory_tags(memory_post_id,tag_type,tagged_user_id,status,created_by)
      values ('${ids.memoryTagged}','family_member','${taggedMember}','approved','${editor}');
    insert into public.memory_selected_people(memory_post_id,user_id)
      values ('${ids.memorySelected}','${selectedMember}');
    insert into public.memory_comments(id,memory_post_id,author_id,body) values
      ('${ids.commentEditor}','${ids.memoryFamily}','${editor}','editor comment'),
      ('${ids.commentFriend}','${ids.memoryFriend}','${friend}','friend comment'),
      ('${ids.commentRemoved}','${ids.memoryFamily}','${removed}','removed comment');
    insert into public.memory_reactions(id,memory_post_id,author_id,reaction_type) values
      ('${ids.reactionFriend}','${ids.memoryFriend}','${friend}','heart'),
      ('${ids.reactionRemoved}','${ids.memoryFamily}','${removed}','heart');
  `]);

  // Prove the isolated fixture still contains the original vulnerable contracts.
  expectCount("baseline editor can update another author's Care row", editor,
    `with changed as (update care_logs set payload='{"baseline":true}' where id='${ids.careOther}' returning id) select count(*) from changed`, 1);
  run("psql", [...connection, "-c", `update care_logs set payload='{}' where id='${ids.careOther}'`]);
  expectCount("baseline viewer can read unpublished family Memory", viewer,
    `select count(*) from memory_posts where id='${ids.memoryPosting}'`, 1);
  expectCount("baseline removed author can read only_me Memory", removed,
    `select count(*) from memory_posts where id='${ids.memoryRemovedOnly}'`, 1);
  run("psql", [...connection, "-c", actorSql(removed, `select public.soft_delete_diary_entry('${ids.diaryRemoved}')`)]);
  run("psql", [...connection, "-c", `update diary_entries set deleted_at=null where id='${ids.diaryRemoved}'`]);
  console.log("PASS baseline removed-author Diary RPC vulnerability reproduced");

  for (const migration of [
    "supabase/migrations/202609140003_b04a_p1_ownership_lifecycle.sql",
    "supabase/migrations/202609140004_b04a_p1_memory_visibility_social.sql",
    "supabase/migrations/202609140005_b04a_p1_memory_recipient_assignment.sql",
  ]) {
    run("psql", [...connection, "-f", migration]);
    run("psql", [...connection, "-f", migration]);
  }
  console.log("PASS B0.4a-2/B0.4a-3 migrations replayed 2/2");

  expectCount("editor cannot update another author's Care row", editor,
    `with changed as (update care_logs set payload='{"attack":true}' where id='${ids.careOther}' returning id) select count(*) from changed`, 0);
  expectCount("editor cannot delete another author's Care row", editor,
    `with changed as (delete from care_logs where id='${ids.careOther}' returning id) select count(*) from changed`, 0);
  expectCount("editor can update own Care row", editor,
    `with changed as (update care_logs set payload='{"own":true}' where id='${ids.careOwn}' returning id) select count(*) from changed`, 1);
  expectDenied("editor cannot move own Care row to another authorized baby", editor,
    `update care_logs set baby_id='${babyTwo}' where id='${ids.careOwn}'`);
  if (query(`select baby_id::text from care_logs where id='${ids.careOwn}'`) !== babyOne) throw new Error("Care baby_id changed after denied reassignment");
  expectCount("editor cannot modify NULL-owner Care row", editor,
    `with changed as (update care_logs set payload='{"attack":true}' where id='${ids.careNull}' returning id) select count(*) from changed`, 0);
  expectCount("admin can repair NULL-owner Care row", admin,
    `with changed as (update care_logs set payload='{"admin":true}' where id='${ids.careNull}' returning id) select count(*) from changed`, 1);

  expectCount("editor cannot update another author's Growth row", editor,
    `with changed as (update growth_records set weight_kg=9 where id='${ids.growthOther}' returning id) select count(*) from changed`, 0);
  expectCount("editor cannot delete another author's Growth row", editor,
    `with changed as (delete from growth_records where id='${ids.growthOther}' returning id) select count(*) from changed`, 0);
  expectCount("editor can update own Growth row", editor,
    `with changed as (update growth_records set weight_kg=5.3 where id='${ids.growthOwn}' returning id) select count(*) from changed`, 1);
  expectDenied("editor cannot move own Growth row", editor,
    `update growth_records set baby_id='${babyTwo}' where id='${ids.growthOwn}'`);

  expectDenied("removed author cannot soft-delete Diary", removed,
    `select public.soft_delete_diary_entry('${ids.diaryRemoved}')`);
  expectCount("viewer author cannot update Diary", viewer,
    `with changed as (update diary_entries set body='attack' where id='${ids.diaryViewer}' returning id) select count(*) from changed`, 0);
  expectCount("editor can update own Diary", editor,
    `with changed as (update diary_entries set body='own edit' where id='${ids.diaryOwn}' returning id) select count(*) from changed`, 1);
  expectCount("admin can update another author's Diary", admin,
    `with changed as (update diary_entries set body='admin edit' where id='${ids.diaryOwn}' returning id) select count(*) from changed`, 1);

  expectCount("removed author cannot read only_me Memory", removed,
    `select count(*) from memory_posts where id='${ids.memoryRemovedOnly}'`, 0);
  expectDenied("removed author cannot soft-delete Memory", removed,
    `select public.soft_delete_memory_post('${ids.memoryRemovedOnly}')`);
  expectCount("viewer author cannot update Memory", viewer,
    `with changed as (update memory_posts set caption='attack' where id='${ids.memoryFamily}' returning id) select count(*) from changed`, 0);
  expectCount("editor can update own Memory", editor,
    `with changed as (update memory_posts set caption='own edit' where id='${ids.memoryFamily}' returning id) select count(*) from changed`, 1);

  run("psql", [...connection, "-c", `update baby_members set permission_role='viewer' where baby_id='${babyOne}' and user_id='${editor}'`]);
  expectCount("demoted editor cannot update own Care", editor,
    `with changed as (update care_logs set payload='{"stale":true}' where id='${ids.careOwn}' returning id) select count(*) from changed`, 0);
  expectCount("demoted editor cannot update own Diary", editor,
    `with changed as (update diary_entries set body='stale' where id='${ids.diaryOwn}' returning id) select count(*) from changed`, 0);
  expectCount("demoted editor cannot update own Memory", editor,
    `with changed as (update memory_posts set caption='stale' where id='${ids.memoryFamily}' returning id) select count(*) from changed`, 0);
  run("psql", [...connection, "-c", `update baby_members set permission_role='editor' where baby_id='${babyOne}' and user_id='${editor}'`]);

  expectCount("family viewer sees published family_circle", viewer,
    `select count(*) from memory_posts where id='${ids.memoryFamily}'`, 1);
  expectCount("family viewer cannot see posting Memory", viewer,
    `select count(*) from memory_posts where id='${ids.memoryPosting}'`, 0);
  expectCount("family viewer cannot see failed Memory", viewer,
    `select count(*) from memory_posts where id='${ids.memoryFailed}'`, 0);
  expectCount("current author sees own posting Memory", editor,
    `select count(*) from memory_posts where id='${ids.memoryPosting}'`, 1);
  expectCount("current author sees own failed Memory", editor,
    `select count(*) from memory_posts where id='${ids.memoryFailed}'`, 1);
  expectCount("friend sees published friend_circle", friend,
    `select count(*) from memory_posts where id='${ids.memoryFriend}'`, 1);
  expectCount("friend cannot see family_circle", friend,
    `select count(*) from memory_posts where id='${ids.memoryFamily}'`, 0);
  expectCount("outsider cannot see family_circle", outsider,
    `select count(*) from memory_posts where id='${ids.memoryFamily}'`, 0);
  expectCount("only_me visible to current author", editor,
    `select count(*) from memory_posts where id='${ids.memoryOwnOnly}'`, 1);
  expectCount("only_me hidden from other family member", viewer,
    `select count(*) from memory_posts where id='${ids.memoryOwnOnly}'`, 0);

  expectCount("active tagged family recipient sees tagged_family", taggedMember,
    `select count(*) from memory_posts where id='${ids.memoryTagged}'`, 1);
  expectDenied("manager cannot family-tag unrelated account", editor,
    `insert into memory_tags(memory_post_id,tag_type,tagged_user_id,status,created_by) values ('${ids.memoryTagged}','family_member','${outsider}','approved','${editor}')`);
  run("psql", [...connection, "-c", `update baby_members set status='inactive' where baby_id='${babyOne}' and user_id='${taggedMember}'`]);
  expectCount("removed tag recipient loses tagged_family access", taggedMember,
    `select count(*) from memory_posts where id='${ids.memoryTagged}'`, 0);
  run("psql", [...connection, "-c", `update baby_members set status='active' where baby_id='${babyOne}' and user_id='${taggedMember}'`]);

  expectCount("active selected family recipient sees selected_people", selectedMember,
    `select count(*) from memory_posts where id='${ids.memorySelected}'`, 1);
  expectDenied("manager cannot select unrelated account", editor,
    `insert into memory_selected_people(memory_post_id,user_id) values ('${ids.memorySelected}','${outsider}')`);
  run("psql", [...connection, "-c", `update baby_members set status='inactive' where baby_id='${babyOne}' and user_id='${selectedMember}'`]);
  expectCount("removed selected recipient loses selected_people access", selectedMember,
    `select count(*) from memory_posts where id='${ids.memorySelected}'`, 0);
  run("psql", [...connection, "-c", `update baby_members set status='active' where baby_id='${babyOne}' and user_id='${selectedMember}'`]);
  expectCount("manager may explicitly select active Memory friend", editor,
    `with changed as (insert into memory_selected_people(memory_post_id,user_id) values ('${ids.memorySelected}','${friend}') returning id) select count(*) from changed`, 1);
  expectCount("selected active Memory friend sees selected_people", friend,
    `select count(*) from memory_posts where id='${ids.memorySelected}'`, 1);

  expectDenied("viewer cannot create comment", viewer,
    `insert into memory_comments(memory_post_id,author_id,body) values ('${ids.memoryFamily}','${viewer}','viewer attack')`);
  run("psql", [...connection, "-c", `insert into memory_friends(baby_id,user_id,invited_by,status) values ('${babyOne}','${viewer}','${admin}','active')`]);
  expectDenied("viewer plus Memory-friend cannot comment on family_circle", viewer,
    `insert into memory_comments(memory_post_id,author_id,body) values ('${ids.memoryFamily}','${viewer}','mixed authority')`);
  run("psql", [...connection, "-c", `insert into memory_friends(baby_id,user_id,invited_by,status) values ('${babyOne}','${taggedMember}','${admin}','active')`]);
  expectCount("tagged family plus Memory-friend can still view tagged_family", taggedMember,
    `select count(*) from memory_posts where id='${ids.memoryTagged}'`, 1);
  expectDenied("tagged family plus Memory-friend cannot comment on tagged_family", taggedMember,
    `insert into memory_comments(memory_post_id,author_id,body) values ('${ids.memoryTagged}','${taggedMember}','mixed tagged authority')`);
  expectDenied("viewer plus Memory-friend cannot react on family_circle", viewer,
    `insert into memory_reactions(memory_post_id,author_id,reaction_type) values ('${ids.memoryFamily}','${viewer}','heart')`);
  run("psql", [...connection, "-c", `delete from memory_friends where baby_id='${babyOne}' and user_id='${viewer}'`]);
  run("psql", [...connection, "-c", `delete from memory_friends where baby_id='${babyOne}' and user_id='${taggedMember}'`]);
  expectCount("editor may comment on visible family post", editor,
    `with changed as (insert into memory_comments(memory_post_id,author_id,body) values ('${ids.memoryFamily}','${editor}','allowed') returning id) select count(*) from changed`, 1);
  expectCount("friend may comment on visible friend post", friend,
    `with changed as (insert into memory_comments(memory_post_id,author_id,body) values ('${ids.memoryFriend}','${friend}','allowed friend') returning id) select count(*) from changed`, 1);
  expectDenied("friend cannot comment on family post", friend,
    `insert into memory_comments(memory_post_id,author_id,body) values ('${ids.memoryFamily}','${friend}','cross-scope')`);
  expectCount("removed comment author cannot update stale comment", removed,
    `with changed as (update memory_comments set body='stale' where id='${ids.commentRemoved}' returning id) select count(*) from changed`, 0);
  expectCount("removed comment author cannot delete stale comment", removed,
    `with changed as (delete from memory_comments where id='${ids.commentRemoved}' returning id) select count(*) from changed`, 0);
  expectCount("admin can moderate comment", admin,
    `with changed as (delete from memory_comments where id='${ids.commentRemoved}' returning id) select count(*) from changed`, 1);
  expectCount("removed reaction author cannot update stale reaction", removed,
    `with changed as (update memory_reactions set reaction_type='wow' where id='${ids.reactionRemoved}' returning id) select count(*) from changed`, 0);
  expectCount("removed reaction author cannot delete stale reaction", removed,
    `with changed as (delete from memory_reactions where id='${ids.reactionRemoved}' returning id) select count(*) from changed`, 0);

  // Social writes must serialize with parent publication/privacy changes.
  const unpublishInteractionFirstComment = row("8", 510);
  const unpublishInteractionFirst = runAsync("psql", [...connection, "-At", "-c", actorSql(friend,
    `begin; insert into memory_comments(id,memory_post_id,author_id,body) values ('${unpublishInteractionFirstComment}','${ids.memoryFriend}','${friend}','interaction first'); select pg_sleep(1.0); commit; select 'interaction-first-done'`)]);
  await new Promise((resolve) => setTimeout(resolve, 200));
  const unpublishAfterStartedAt = performance.now();
  const unpublishAfter = runAsync("psql", [...connection, "-At", "-c", actorSql(editor,
    `update memory_posts set status='posting' where id='${ids.memoryFriend}'; select 'unpublished-after'`)]);
  const [unpublishInteractionFirstResult, unpublishAfterResult] = await Promise.all([unpublishInteractionFirst, unpublishAfter]);
  if (unpublishInteractionFirstResult.status !== 0 || unpublishAfterResult.status !== 0
      || performance.now() - unpublishAfterStartedAt < 500
      || query(`select count(*) from memory_comments where id='${unpublishInteractionFirstComment}'`) !== "1"
      || query(`select status from memory_posts where id='${ids.memoryFriend}'`) !== "posting") {
    throw new Error(`interaction-first unpublish race failed: ${unpublishInteractionFirstResult.output} ${unpublishAfterResult.output}`);
  }
  console.log("PASS interaction-first social write commits before unpublish");
  run("psql", [...connection, "-c", actorSql(editor, `update memory_posts set status='published' where id='${ids.memoryFriend}'`)]);

  const unpublishFirstComment = row("8", 511);
  const unpublishFirst = runAsync("psql", [...connection, "-At", "-c", actorSql(editor,
    `begin; update memory_posts set status='posting' where id='${ids.memoryFriend}'; select pg_sleep(1.0); commit; select 'unpublish-first-done'`)]);
  await new Promise((resolve) => setTimeout(resolve, 200));
  const interactionAfterUnpublish = runAsync("psql", [...connection, "-At", "-c", actorSql(friend,
    `insert into memory_comments(id,memory_post_id,author_id,body) values ('${unpublishFirstComment}','${ids.memoryFriend}','${friend}','stale interaction')`)]);
  const [unpublishFirstResult, interactionAfterUnpublishResult] = await Promise.all([unpublishFirst, interactionAfterUnpublish]);
  if (unpublishFirstResult.status !== 0 || interactionAfterUnpublishResult.status === 0
      || query(`select count(*) from memory_comments where id='${unpublishFirstComment}'`) !== "0") {
    throw new Error(`unpublish-first race failed: ${unpublishFirstResult.output} ${interactionAfterUnpublishResult.output}`);
  }
  console.log("PASS unpublish-first race rejects stale social write");
  run("psql", [...connection, "-c", actorSql(editor, `update memory_posts set status='published' where id='${ids.memoryFriend}'`)]);

  // Selected grant row is part of the authorization lock set.
  const selectedInteractionFirstComment = row("8", 512);
  const selectedInteractionFirst = runAsync("psql", [...connection, "-At", "-c", actorSql(friend,
    `begin; insert into memory_comments(id,memory_post_id,author_id,body) values ('${selectedInteractionFirstComment}','${ids.memorySelected}','${friend}','selected interaction'); select pg_sleep(1.0); commit; select 'selected-interaction-first-done'`)]);
  await new Promise((resolve) => setTimeout(resolve, 200));
  const selectedDeleteAfterStartedAt = performance.now();
  const selectedDeleteAfter = runAsync("psql", [...connection, "-At", "-c", actorSql(editor,
    `delete from memory_selected_people where memory_post_id='${ids.memorySelected}' and user_id='${friend}'; select 'selected-deleted-after'`)]);
  const [selectedInteractionFirstResult, selectedDeleteAfterResult] = await Promise.all([selectedInteractionFirst, selectedDeleteAfter]);
  if (selectedInteractionFirstResult.status !== 0 || selectedDeleteAfterResult.status !== 0
      || performance.now() - selectedDeleteAfterStartedAt < 500
      || query(`select count(*) from memory_comments where id='${selectedInteractionFirstComment}'`) !== "1"
      || query(`select count(*) from memory_selected_people where memory_post_id='${ids.memorySelected}' and user_id='${friend}'`) !== "0") {
    throw new Error(`selected interaction-first race failed: ${selectedInteractionFirstResult.output} ${selectedDeleteAfterResult.output}`);
  }
  console.log("PASS selected interaction-first write commits before grant deletion");
  run("psql", [...connection, "-c", actorSql(editor,
    `insert into memory_selected_people(memory_post_id,user_id) values ('${ids.memorySelected}','${friend}')`)]);

  const selectedDeleteFirstComment = row("8", 513);
  const selectedDeleteFirst = runAsync("psql", [...connection, "-At", "-c", actorSql(editor,
    `begin; delete from memory_selected_people where memory_post_id='${ids.memorySelected}' and user_id='${friend}'; select pg_sleep(1.0); commit; select 'selected-delete-first-done'`)]);
  await new Promise((resolve) => setTimeout(resolve, 200));
  const selectedInteractionAfterDelete = runAsync("psql", [...connection, "-At", "-c", actorSql(friend,
    `insert into memory_comments(id,memory_post_id,author_id,body) values ('${selectedDeleteFirstComment}','${ids.memorySelected}','${friend}','stale selected')`)]);
  const [selectedDeleteFirstResult, selectedInteractionAfterDeleteResult] = await Promise.all([selectedDeleteFirst, selectedInteractionAfterDelete]);
  if (selectedDeleteFirstResult.status !== 0 || selectedInteractionAfterDeleteResult.status === 0
      || query(`select count(*) from memory_comments where id='${selectedDeleteFirstComment}'`) !== "0") {
    throw new Error(`selected delete-first race failed: ${selectedDeleteFirstResult.output} ${selectedInteractionAfterDeleteResult.output}`);
  }
  console.log("PASS selected grant deletion-first rejects stale social write");

  // Tagged entitlement is also locked for an active editor who is not author.
  run("psql", [...connection, "-c", `update baby_members set permission_role='editor' where baby_id='${babyOne}' and user_id='${taggedMember}'`]);
  const tagInteractionFirstComment = row("8", 514);
  const tagInteractionFirst = runAsync("psql", [...connection, "-At", "-c", actorSql(taggedMember,
    `begin; insert into memory_comments(id,memory_post_id,author_id,body) values ('${tagInteractionFirstComment}','${ids.memoryTagged}','${taggedMember}','tag interaction'); select pg_sleep(1.0); commit; select 'tag-interaction-first-done'`)]);
  await new Promise((resolve) => setTimeout(resolve, 200));
  const tagDeleteAfterStartedAt = performance.now();
  const tagDeleteAfter = runAsync("psql", [...connection, "-At", "-c", actorSql(editor,
    `delete from memory_tags where memory_post_id='${ids.memoryTagged}' and tagged_user_id='${taggedMember}'; select 'tag-deleted-after'`)]);
  const [tagInteractionFirstResult, tagDeleteAfterResult] = await Promise.all([tagInteractionFirst, tagDeleteAfter]);
  if (tagInteractionFirstResult.status !== 0 || tagDeleteAfterResult.status !== 0
      || performance.now() - tagDeleteAfterStartedAt < 500
      || query(`select count(*) from memory_comments where id='${tagInteractionFirstComment}'`) !== "1"
      || query(`select count(*) from memory_tags where memory_post_id='${ids.memoryTagged}' and tagged_user_id='${taggedMember}'`) !== "0") {
    throw new Error(`tag interaction-first race failed: ${tagInteractionFirstResult.output} ${tagDeleteAfterResult.output}`);
  }
  console.log("PASS tag interaction-first write commits before tag deletion");
  run("psql", [...connection, "-c", actorSql(editor,
    `insert into memory_tags(memory_post_id,tag_type,tagged_user_id,status,created_by) values ('${ids.memoryTagged}','family_member','${taggedMember}','approved','${editor}')`)]);

  const tagDeleteFirstComment = row("8", 515);
  const tagDeleteFirst = runAsync("psql", [...connection, "-At", "-c", actorSql(editor,
    `begin; delete from memory_tags where memory_post_id='${ids.memoryTagged}' and tagged_user_id='${taggedMember}'; select pg_sleep(1.0); commit; select 'tag-delete-first-done'`)]);
  await new Promise((resolve) => setTimeout(resolve, 200));
  const tagInteractionAfterDelete = runAsync("psql", [...connection, "-At", "-c", actorSql(taggedMember,
    `insert into memory_comments(id,memory_post_id,author_id,body) values ('${tagDeleteFirstComment}','${ids.memoryTagged}','${taggedMember}','stale tag')`)]);
  const [tagDeleteFirstResult, tagInteractionAfterDeleteResult] = await Promise.all([tagDeleteFirst, tagInteractionAfterDelete]);
  if (tagDeleteFirstResult.status !== 0 || tagInteractionAfterDeleteResult.status === 0
      || query(`select count(*) from memory_comments where id='${tagDeleteFirstComment}'`) !== "0") {
    throw new Error(`tag delete-first race failed: ${tagDeleteFirstResult.output} ${tagInteractionAfterDeleteResult.output}`);
  }
  console.log("PASS tag deletion-first rejects stale social write");
  run("psql", [...connection, "-c", `update baby_members set permission_role='viewer' where baby_id='${babyOne}' and user_id='${taggedMember}'`]);

  // Update-first: the write locks current membership, so a concurrent demotion
  // waits and the already-authorized write commits before the role transition.
  const updateFirst = runAsync("psql", [...connection, "-At", "-c", actorSql(editor,
    `begin; update care_logs set payload='{"race":"update-first"}' where id='${ids.careRace}'; select pg_sleep(1.2); commit; select 'update-first-done'`)]);
  await new Promise((resolve) => setTimeout(resolve, 200));
  const updateFirstDemotionStartedAt = performance.now();
  const demoteAfterUpdate = runAsync("psql", [...connection, "-At", "-c",
    `update baby_members set permission_role='viewer' where baby_id='${babyOne}' and user_id='${editor}'; select 'demoted'`]);
  const [updateFirstResult, demoteAfterResult] = await Promise.all([updateFirst, demoteAfterUpdate]);
  const updateFirstDemotionElapsedMs = performance.now() - updateFirstDemotionStartedAt;
  if (updateFirstResult.status !== 0 || demoteAfterResult.status !== 0
      || !updateFirstResult.output.includes("update-first-done") || !demoteAfterResult.output.includes("demoted")
      || updateFirstDemotionElapsedMs < 700
      || query(`select payload->>'race' from care_logs where id='${ids.careRace}'`) !== "update-first") {
    throw new Error(`update-first race failed: ${updateFirstResult.output} ${demoteAfterResult.output}`);
  }
  console.log("PASS update-first role-transition race is serialized");

  run("psql", [...connection, "-c", `update baby_members set permission_role='editor' where baby_id='${babyOne}' and user_id='${editor}'`]);
  const demotionFirst = runAsync("psql", [...connection, "-At", "-c",
    `begin; update baby_members set permission_role='viewer' where baby_id='${babyOne}' and user_id='${editor}'; select pg_sleep(1.2); commit; select 'demotion-first-done'`]);
  await new Promise((resolve) => setTimeout(resolve, 200));
  const staleWrite = runAsync("psql", [...connection, "-At", "-c", actorSql(editor,
    `with changed as (update care_logs set payload='{"race":"stale"}' where id='${ids.careRace}' returning id) select count(*) from changed`)]);
  const [demotionFirstResult, staleWriteResult] = await Promise.all([demotionFirst, staleWrite]);
  const staleCount = staleWriteResult.output.trim().split(/\r?\n/).filter(Boolean).at(-1);
  if (demotionFirstResult.status !== 0 || staleWriteResult.status !== 0 || staleCount !== "0") {
    throw new Error(`demotion-first race failed: ${demotionFirstResult.output} ${staleWriteResult.output}`);
  }
  console.log("PASS demotion-first role-transition race rejects stale writer");

  // INSERT uses the same membership lock. Check both commit orders and verify
  // the durable row result rather than accepting either outcome.
  run("psql", [...connection, "-c", `update baby_members set permission_role='editor' where baby_id='${babyOne}' and user_id='${editor}'`]);
  const insertFirstId = row("4", 105);
  const insertFirst = runAsync("psql", [...connection, "-At", "-c", actorSql(editor,
    `begin; insert into care_logs(id,baby_id,category,recorded_at,date_key,time_local,payload,source,created_by) values ('${insertFirstId}','${babyOne}','feeding',now(),'2026-09-14','14:00','{}','manual','${editor}'); select pg_sleep(1.2); commit; select 'insert-first-done'`)]);
  await new Promise((resolve) => setTimeout(resolve, 200));
  const insertFirstDemotionStartedAt = performance.now();
  const insertFirstDemotion = runAsync("psql", [...connection, "-At", "-c",
    `update baby_members set permission_role='viewer' where baby_id='${babyOne}' and user_id='${editor}'; select 'demoted-after-insert'`]);
  const [insertFirstResult, insertFirstDemotionResult] = await Promise.all([insertFirst, insertFirstDemotion]);
  const insertFirstDemotionElapsedMs = performance.now() - insertFirstDemotionStartedAt;
  if (insertFirstResult.status !== 0 || insertFirstDemotionResult.status !== 0
      || !insertFirstResult.output.includes("insert-first-done")
      || !insertFirstDemotionResult.output.includes("demoted-after-insert")
      || insertFirstDemotionElapsedMs < 700
      || query(`select count(*) from care_logs where id='${insertFirstId}'`) !== "1") {
    throw new Error(`insert-first race failed: ${insertFirstResult.output} ${insertFirstDemotionResult.output}`);
  }
  console.log("PASS insert-first role-transition race commits then demotes");

  run("psql", [...connection, "-c", `update baby_members set permission_role='editor' where baby_id='${babyOne}' and user_id='${editor}'`]);
  const demotionFirstInsertId = row("4", 106);
  const demotionFirstInsert = runAsync("psql", [...connection, "-At", "-c",
    `begin; update baby_members set permission_role='viewer' where baby_id='${babyOne}' and user_id='${editor}'; select pg_sleep(1.2); commit; select 'demotion-before-insert-done'`]);
  await new Promise((resolve) => setTimeout(resolve, 200));
  const rejectedInsert = runAsync("psql", [...connection, "-At", "-c", actorSql(editor,
    `insert into care_logs(id,baby_id,category,recorded_at,date_key,time_local,payload,source,created_by) values ('${demotionFirstInsertId}','${babyOne}','feeding',now(),'2026-09-14','15:00','{}','manual','${editor}')`)]);
  const [demotionFirstInsertResult, rejectedInsertResult] = await Promise.all([demotionFirstInsert, rejectedInsert]);
  if (demotionFirstInsertResult.status !== 0 || rejectedInsertResult.status === 0
      || query(`select count(*) from care_logs where id='${demotionFirstInsertId}'`) !== "0") {
    throw new Error(`demotion-first insert race failed: ${demotionFirstInsertResult.output} ${rejectedInsertResult.output}`);
  }
  console.log("PASS demotion-first role-transition race rejects stale INSERT");

  const functionContract = query(B04A_P1_FUNCTION_CONTRACT_SQL);
  const policyContract = query(B04A_P1_POLICY_CONTRACT_SQL);
  if (functionContract !== B04A_P1_EXPECTED_FUNCTION_CONTRACT) {
    throw new Error(`function contract mismatch: ${functionContract}`);
  }
  if (policyContract !== B04A_P1_EXPECTED_POLICY_CONTRACT) {
    throw new Error(`policy contract mismatch: ${policyContract}\n${query(B04A_P1_POLICY_ROW_CONTRACT_SQL)}`);
  }
  console.log(`LOCAL_FUNCTION_CONTRACT=${functionContract}`);
  console.log(`LOCAL_POLICY_CONTRACT=${policyContract}`);
  if (process.env.B04A_PRINT_POLICY_ROWS === "1") {
    console.log(query(B04A_P1_POLICY_ROW_CONTRACT_SQL));
    console.log(query(B04A_P1_POLICY_DIAGNOSTIC_SQL));
  }

  console.log("B0.4a-2/B0.4a-3 local PostgreSQL attack regression passed");
} finally {
  if (started) run("pg_ctl", ["-D", data, "-m", "fast", "-w", "stop"]);
  rmSync(socket, { recursive: true, force: true });
  rmSync(work, { recursive: true, force: true });
}
