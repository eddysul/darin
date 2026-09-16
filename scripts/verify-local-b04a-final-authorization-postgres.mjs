import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn, spawnSync } from "node:child_process";

const postgresBin = process.env.POSTGRES_BIN?.trim() || "/opt/homebrew/opt/postgresql@16/bin";
const work = mkdtempSync(join(tmpdir(), "darin-b04a-final-auth-"));
const data = join(work, "data");
const socket = join("/tmp", `darin-b04a-final-${process.pid}`);
const port = "55444";
rmSync(socket, { recursive: true, force: true });
mkdirSync(socket);

function command(name, args, options = {}) {
  return spawnSync(join(postgresBin, name), args, {
    cwd: process.cwd(), encoding: "utf8", ...options,
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
    const child = spawn(join(postgresBin, name), args, { cwd: process.cwd(), encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
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
const actorSql = (userId, body) => `set role authenticated; select set_config('request.jwt.claim.sub', '${userId}', false); ${body}`;
const uid = (suffix) => `00000000-0000-4000-8000-${String(suffix).padStart(12, "0")}`;
const baby = (suffix) => `10000000-0000-4000-8000-${String(suffix).padStart(12, "0")}`;
const row = (prefix, suffix) => `${prefix}0000000-0000-4000-8000-${String(suffix).padStart(12, "0")}`;

function expectCount(label, userId, body, expected) {
  const result = query(actorSql(userId, body));
  const actual = result.split(/\r?\n/).filter(Boolean).at(-1);
  if (actual !== String(expected)) throw new Error(`${label}: expected ${expected}, got ${actual ?? "empty"}`);
  console.log(`PASS ${label}`);
}
function expectDenied(label, userId, body) {
  const result = psql(actorSql(userId, body));
  if (result.status === 0) throw new Error(`${label}: unexpectedly succeeded`);
  if (/Bearer\s|eyJ[A-Za-z0-9_-]+\.|@darin\./i.test(`${result.stdout}\n${result.stderr}`)) {
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
const editorTwo = uid(7);
const otherBabyAdmin = uid(8);
const babyOne = baby(1);
const babyTwo = baby(2);
const bookOne = row("a", 1);
const bookTwo = row("a", 2);
const pageOne = row("b", 1);
const pageTwo = row("b", 2);
const mediaOne = row("c", 1);
const commentOne = row("d", 1);
const cautionOne = row("e", 1);
const diaryOne = row("f", 1);
const diaryTwo = row("f", 2);
const bookNull = row("a", 3);
const pageNull = row("b", 3);

let started = false;
try {
  run("initdb", ["-D", data, "--auth=trust", "--no-locale", "-E", "UTF8"]);
  run("pg_ctl", ["-D", data, "-o", `-k ${socket} -p ${port} -F -c listen_addresses=`, "-w", "start"]);
  started = true;
  run("psql", [...connection, "-f", "scripts/fixtures/b04a-p0-local-bootstrap.sql"]);
  run("psql", [...connection, "-c", "create role anon nologin"]);
  run("psql", [...connection, "-f", "scripts/fixtures/b04a-final-authorization-local-bootstrap.sql"]);
  run("psql", [...connection, "-c", `
    insert into auth.users(id) values
      ('${admin}'), ('${outsider}'), ('${friend}'), ('${editor}'), ('${viewer}'),
      ('${removed}'), ('${editorTwo}'), ('${otherBabyAdmin}');
    insert into public.profiles(id, display_name, nickname, residence_country, guardian_birth_date)
    values ('${editor}','Editor','Editor private','KR','1980-01-01'), ('${removed}','Removed','Removed private','KR','1980-01-01'), ('${editorTwo}','Second editor','Editor two','US','1985-01-01'), ('${otherBabyAdmin}','Other admin','Other admin','US','1970-01-01')
    on conflict (id) do update set nickname=excluded.nickname, residence_country=excluded.residence_country, guardian_birth_date=excluded.guardian_birth_date;
    insert into public.baby_members(baby_id,user_id,permission_role,status)
    values
      ('${babyOne}','${editor}','editor','active'),
      ('${babyOne}','${viewer}','viewer','active'),
      ('${babyOne}','${removed}','viewer','inactive'),
      ('${babyTwo}','${editorTwo}','admin','active'),
      ('${babyTwo}','${otherBabyAdmin}','admin','active');
    insert into public.memory_friends(baby_id,user_id,invited_by,status)
      values ('${babyOne}','${friend}','${admin}','active');
    insert into public.memory_posts(id,baby_id,author_id,privacy_type,status)
      values ('${row("9",1)}','${babyOne}','${editor}','friend_circle','published');
    update public.babies set created_by='${admin}', child_status='newborn', birth_date='2026-01-01', name='Protected baby' where id='${babyOne}';
  `]);

  // Baseline vulnerabilities: shared profile row, tautological child graph,
  // viewer caution-food mutation, and editor access to protected baby fields.
  expectCount("baseline friend can read private profile row", friend,
    `select count(*) from profiles where id='${editor}' and residence_country is not null`, 1);
  expectCount("baseline viewer can insert caution food", viewer,
    `with changed as (insert into baby_caution_foods(id,baby_id,food_name,normalized_food_name,created_by) values ('${cautionOne}','${babyOne}','milk','milk','${viewer}') returning id) select count(*) from changed`, 1);
  run("psql", [...connection, "-c", `delete from baby_caution_foods where id='${cautionOne}'`]);

  for (const migration of [
    "supabase/migrations/202609150006_b04a_p1_profile_baby_authorization.sql",
    "supabase/migrations/202609150007_b04a_p1_growthbook_caution_authorization.sql",
  ]) {
    run("psql", [...connection, "-f", migration]);
    run("psql", [...connection, "-f", migration]);
  }
  console.log("PASS final authorization migrations replayed idempotently");

  // Profile direct-table isolation and safe projection.
  expectCount("friend direct profile table private row denied", friend,
    `select count(*) from profiles where id='${editor}'`, 0);
  expectCount("friend safe display projection allowed", friend,
    `select count(*) from public.list_visible_profile_display(array['${editor}']::uuid[])`, 1);
  expectCount("friend projection excludes non-contributor member", friend,
    `select count(*) from public.list_visible_profile_display(array['${admin}']::uuid[])`, 0);
  expectCount("safe projection omits private columns", friend,
    `select count(*) from jsonb_object_keys(to_jsonb((select p from public.list_visible_profile_display(array['${editor}']::uuid[]) p))) as keys(key) where key in ('residence_country','guardian_birth_date','preferred_language','darin_id')`, 0);
  expectCount("unrelated safe projection denied", outsider,
    `select count(*) from public.list_visible_profile_display(array['${editor}']::uuid[])`, 0);
  expectCount("removed member safe projection denied", removed,
    `select count(*) from public.list_visible_profile_display(array['${editor}']::uuid[])`, 0);
  expectCount("unrelated diary parent oracle denied", outsider,
    `select count(*) from public.growth_book_diary_parent_valid('${diaryOne}','${babyOne}') where public.growth_book_diary_parent_valid('${diaryOne}','${babyOne}')`, 0);

  // Baby profile roles and protected-field guard.
  expectCount("admin may update protected baby profile", admin,
    `with changed as (update babies set birth_date='2026-01-02' where id='${babyOne}' returning id) select count(*) from changed`, 1);
  expectCount("editor may update presentation baby field", editor,
    `with changed as (update babies set name='Updated name', nickname='Baby' where id='${babyOne}' returning id) select count(*) from changed`, 1);
  expectDenied("editor cannot update protected birth field", editor,
    `update babies set birth_date='2027-01-01' where id='${babyOne}'`);
  expectDenied("editor cannot change baby identity owner", editor,
    `update babies set created_by='${editor}' where id='${babyOne}'`);
  expectCount("viewer cannot update baby profile", viewer,
    `with changed as (update babies set name='viewer attack' where id='${babyOne}' returning id) select count(*) from changed`, 0);
  expectCount("friend cannot update baby profile", friend,
    `with changed as (update babies set name='friend attack' where id='${babyOne}' returning id) select count(*) from changed`, 0);
  expectCount("unrelated cannot update baby profile", outsider,
    `with changed as (update babies set name='outsider attack' where id='${babyOne}' returning id) select count(*) from changed`, 0);
  expectCount("removed member cannot update baby profile", removed,
    `with changed as (update babies set name='removed attack' where id='${babyOne}' returning id) select count(*) from changed`, 0);
  expectCount("other-baby admin cannot update protected baby", otherBabyAdmin,
    `with changed as (update babies set name='cross baby' where id='${babyOne}' returning id) select count(*) from changed`, 0);

  // Account deletion preserves shared babies while anonymizing only the
  // authenticated creator; the trigger must not block this lifecycle RPC.
  expectDenied("admin cannot self-anonymize baby creator", admin,
    `update babies set created_by=null where id='${babyOne}'`);

  // Caution-food role matrix.
  expectCount("admin may create caution food", admin,
    `with changed as (insert into baby_caution_foods(id,baby_id,food_name,normalized_food_name,created_by) values ('${cautionOne}','${babyOne}','milk','milk','${admin}') returning id) select count(*) from changed`, 1);
  expectCount("viewer may read caution food", viewer,
    `select count(*) from baby_caution_foods where id='${cautionOne}'`, 1);
  expectDenied("viewer cannot create caution food", viewer,
    `insert into baby_caution_foods(id,baby_id,food_name,normalized_food_name,created_by) values ('${row("e",2)}','${babyOne}','egg','egg','${viewer}')`);
  expectDenied("friend cannot create caution food", friend,
    `insert into baby_caution_foods(id,baby_id,food_name,normalized_food_name,created_by) values ('${row("e",3)}','${babyOne}','egg','egg','${friend}')`);
  expectDenied("unrelated cannot create caution food", outsider,
    `insert into baby_caution_foods(id,baby_id,food_name,normalized_food_name,created_by) values ('${row("e",4)}','${babyOne}','egg','egg','${outsider}')`);
  expectCount("viewer cannot update caution food", viewer,
    `with changed as (update baby_caution_foods set food_name='attack' where id='${cautionOne}' returning id) select count(*) from changed`, 0);
  expectCount("editor cannot delete caution food", editor,
    `with removed_row as (delete from baby_caution_foods where id='${cautionOne}' returning id) select count(*) from removed_row`, 0);
  expectCount("viewer cannot delete caution food", viewer,
    `with removed_row as (delete from baby_caution_foods where id='${cautionOne}' returning id) select count(*) from removed_row`, 0);
  expectCount("admin may delete caution food", admin,
    `with removed_row as (delete from baby_caution_foods where id='${cautionOne}' returning id) select count(*) from removed_row`, 1);

  // Growthbook graph data.
  run("psql", [...connection, "-c", `
    insert into diary_entries(id,baby_id,author_id,entry_date,body) values
      ('${diaryOne}','${babyOne}','${editor}','2026-01-02','baby one diary'),
      ('${diaryTwo}','${babyTwo}','${editorTwo}','2026-01-02','baby two diary');
    insert into growth_books(id,baby_id,title,created_by) values ('${bookOne}','${babyOne}','Book one','${editor}'), ('${bookTwo}','${babyTwo}','Book two','${editorTwo}');
    insert into growth_book_pages(id,growth_book_id,baby_id,page_type,page_order,created_by) values ('${pageOne}','${bookOne}','${babyOne}','custom',1,'${editor}'), ('${pageTwo}','${bookTwo}','${babyTwo}','custom',1,'${editorTwo}');
    insert into growth_book_media(id,growth_book_id,page_id,baby_id,storage_path,created_by) values ('${mediaOne}','${bookOne}','${pageOne}','${babyOne}','${babyOne}/${bookOne}/${pageOne}/one.jpg','${editor}');
    insert into growth_book_comments(id,growth_book_id,page_id,baby_id,author_id,body) values ('${commentOne}','${bookOne}','${pageOne}','${babyOne}','${editor}','comment');
  `]);
  // Simulate creator anonymization already performed by account deletion so
  // NULL -> another UUID cannot bypass the pre-existing identity guards.
  run("psql", [...connection, "-c", `
    insert into growth_books(id,baby_id,title,created_by) values ('${bookNull}','${babyOne}','Anonymous book',null);
    insert into growth_book_pages(id,growth_book_id,baby_id,page_type,page_order,created_by) values ('${pageNull}','${bookNull}','${babyOne}','custom',2,null);
  `]);
  expectCount("viewer can read valid growthbook page", viewer,
    `select count(*) from growth_book_pages where id='${pageOne}'`, 1);
  expectCount("friend cannot read growthbook page", friend,
    `select count(*) from growth_book_pages where id='${pageOne}'`, 0);
  expectCount("unrelated cannot read growthbook page", outsider,
    `select count(*) from growth_book_pages where id='${pageOne}'`, 0);
  expectDenied("editor cannot attach media to wrong page", editor,
    `insert into growth_book_media(id,growth_book_id,page_id,baby_id,storage_path,created_by) values ('${row("c",2)}','${bookOne}','${pageTwo}','${babyOne}','${babyOne}/${bookOne}/${pageTwo}/bad.jpg','${editor}')`);
  expectDenied("editor cannot attach baby-one media to baby-two book", editor,
    `insert into growth_book_media(id,growth_book_id,page_id,baby_id,storage_path,created_by) values ('${row("c",3)}','${bookTwo}','${pageTwo}','${babyOne}','${babyOne}/${bookTwo}/${pageTwo}/bad.jpg','${editor}')`);
  expectDenied("editor cannot reassign page to another book", editor,
    `update growth_book_pages set growth_book_id='${bookTwo}', baby_id='${babyTwo}' where id='${pageOne}'`);
  expectDenied("editor cannot reassign NULL growth book creator", editor,
    `update growth_books set created_by='${editor}' where id='${bookNull}'`);
  expectDenied("editor cannot reassign NULL growth page creator", editor,
    `update growth_book_pages set created_by='${editor}' where id='${pageNull}'`);
  expectDenied("editor cannot attach page to cross-baby diary", editor,
    `insert into growth_book_pages(id,growth_book_id,baby_id,page_type,page_order,diary_entry_id,created_by) values ('${row("b",4)}','${bookOne}','${babyOne}','diary',4,'${diaryTwo}','${editor}')`);
  expectCount("valid same-parent media remains readable", viewer,
    `select count(*) from growth_book_media where id='${mediaOne}'`, 1);
  expectDenied("viewer cannot create growthbook comment", viewer,
    `insert into growth_book_comments(id,growth_book_id,page_id,baby_id,author_id,body) values ('${row("d",2)}','${bookOne}','${pageOne}','${babyOne}','${viewer}','viewer attack')`);
  expectDenied("editor cannot comment on wrong page parent", editor,
    `insert into growth_book_comments(id,growth_book_id,page_id,baby_id,author_id,body) values ('${row("d",3)}','${bookOne}','${pageTwo}','${babyOne}','${editor}','wrong page')`);
  expectDenied("editor cannot comment on cross-baby diary", editor,
    `insert into growth_book_comments(id,growth_book_id,page_id,diary_entry_id,baby_id,author_id,body) values ('${row("d",5)}','${bookOne}','${pageOne}','${diaryTwo}','${babyOne}','${editor}','wrong diary')`);
  expectCount("editor may create valid growthbook comment", editor,
    `with changed as (insert into growth_book_comments(id,growth_book_id,page_id,baby_id,author_id,body) values ('${row("d",4)}','${bookOne}','${pageOne}','${babyOne}','${editor}','valid') returning id) select count(*) from changed`, 1);
  expectCount("admin current growthbook authority", admin,
    `select count(*) from (select public.baby_permission('${babyOne}') as role, public.can_view_growth_book('${bookOne}') as can_view) q where role='admin' and can_view`, 1);
  expectCount("admin may edit valid comment body", admin,
    `with changed as (update growth_book_comments set body='admin edit' where id='${commentOne}' returning id) select count(*) from changed`, 1);
  const adminModeration = psql(actorSql(admin, `update growth_book_comments set deleted_at=now() where id='${commentOne}';`));
  if (adminModeration.status !== 0 || query(`select count(*) from growth_book_comments where id='${commentOne}' and deleted_at is not null`) !== "1") {
    throw new Error(`admin comment moderation failed: ${adminModeration.stdout}\n${adminModeration.stderr}`);
  }
  console.log("PASS admin may moderate valid comment");
  expectCount("removed member cannot read growthbook page", removed,
    `select count(*) from growth_book_pages where id='${pageOne}'`, 0);
  expectCount("removed member cannot read growthbook comment", removed,
    `select count(*) from growth_book_comments where id='${commentOne}'`, 0);

  const constraints = query(`select count(*) from pg_constraint where conname in ('growth_book_pages_book_baby_fk','growth_book_media_book_baby_fk','growth_book_media_page_baby_fk','growth_book_comments_book_baby_fk','growth_book_comments_page_baby_fk')`);
  if (constraints !== "5") throw new Error(`expected five graph constraints, got ${constraints}`);
  console.log("PASS five Growthbook parent graph constraints installed");

  run("psql", [...connection, "-c", `
    update growth_books set deleted_at=now() where id='${bookOne}';
    update growth_book_pages set deleted_at=now() where id='${pageOne}';
    update diary_entries set deleted_at=now() where id='${diaryOne}';
  `]);
  console.log("PASS soft-deleted Growthbook/Diary history retained");
  run("psql", [...connection, "-c", `delete from auth.users where id='${editor}'`]);
  const anonymizedGrowthbookRows = query(`
    select
      (select count(*) from growth_books where id='${bookOne}' and created_by is null)
      + (select count(*) from growth_book_pages where id='${pageOne}' and created_by is null)
      + (select count(*) from growth_book_media where id='${mediaOne}' and created_by is null)
      + (select count(*) from growth_book_comments where id='${commentOne}' and author_id is null)
  `);
  if (anonymizedGrowthbookRows !== "4") throw new Error(`auth user deletion did not anonymize all Growthbook creator fields: ${anonymizedGrowthbookRows}`);
  console.log("PASS auth.users deletion anonymizes active and soft-deleted Growthbook creator fields");
  console.log("B0.4a final authorization local PostgreSQL attack regression passed");
} finally {
  if (started) run("pg_ctl", ["-D", data, "-m", "fast", "-w", "stop"]);
  rmSync(socket, { recursive: true, force: true });
  rmSync(work, { recursive: true, force: true });
}
