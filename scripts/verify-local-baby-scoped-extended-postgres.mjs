import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn, spawnSync } from "node:child_process";

const bin = process.env.POSTGRES_BIN?.trim() || "/opt/homebrew/opt/postgresql@16/bin";
const work = mkdtempSync(join(tmpdir(), "darin-baby-extended-"));
const data = join(work, "data");
const socket = join("/tmp", `darin-baby-extended-${process.pid}`);
const port = "55449";
rmSync(socket, { recursive: true, force: true });
mkdirSync(socket);

const command = (name, args, options = {}) => spawnSync(join(bin, name), args, {
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
const runAsync = (sql) => new Promise((resolve, reject) => {
  const child = spawn(join(bin, "psql"), [...connection, "-At", "-c", sql], {
    cwd: process.cwd(), encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout.on("data", (chunk) => { output += chunk; });
  child.stderr.on("data", (chunk) => { output += chunk; });
  child.on("error", reject);
  child.on("close", (status) => resolve({ status, output }));
});

const uid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const baby = "10000000-0000-4000-8000-000000000001";
const post = "21000000-0000-4000-8000-000000000001";
const memoryMedia = "31000000-0000-4000-8000-000000000001";
const diary = "40000000-0000-4000-8000-000000000001";
const diaryMedia = "50000000-0000-4000-8000-000000000001";
const book = "60000000-0000-4000-8000-000000000001";
const page = "70000000-0000-4000-8000-000000000001";
const bookMedia = "80000000-0000-4000-8000-000000000001";
const sticker = "90000000-0000-4000-8000-000000000001";
const admin = uid(1);
const friend = uid(3);
const careMember = uid(4);
let started = false;

try {
  run("initdb", ["-D", data, "--auth=trust", "--no-locale", "-E", "UTF8"]);
  run("pg_ctl", ["-D", data, "-o", `-k ${socket} -p ${port} -F -c listen_addresses=`, "-w", "start"]);
  started = true;
  run("psql", [...connection, "-f", "scripts/fixtures/b04a-p0-local-bootstrap.sql"]);
  run("psql", [...connection, "-c", "create role anon nologin; create role service_role nologin bypassrls; create schema storage; create schema storage_security;"]);
  run("psql", [...connection, "-f", "scripts/fixtures/b04a-p1-ownership-visibility-local-bootstrap.sql"]);
  run("psql", [...connection, "-c", `
    create or replace function public.set_updated_at() returns trigger language plpgsql as $$
    begin new.updated_at=now(); return new; end $$;
    alter table public.profiles add column avatar_storage_path text;
    alter table public.babies add column created_by uuid references public.profiles(id), add column avatar_storage_path text;
    update public.babies set created_by='${admin}' where id='${baby}';
    alter table public.memory_media add column upload_status text not null default 'ready';

    create table public.diary_media(
      id uuid primary key, diary_entry_id uuid not null references public.diary_entries(id) on delete cascade,
      baby_id uuid not null references public.babies(id) on delete cascade,
      storage_path text not null unique, upload_status text not null default 'ready'
    );
    create table public.growth_books(
      id uuid primary key, baby_id uuid not null references public.babies(id) on delete cascade,
      created_by uuid references public.profiles(id), deleted_at timestamptz
    );
    create table public.growth_book_pages(
      id uuid primary key, growth_book_id uuid not null references public.growth_books(id) on delete cascade,
      baby_id uuid not null references public.babies(id) on delete cascade,
      created_by uuid references public.profiles(id), deleted_at timestamptz
    );
    create table public.growth_book_media(
      id uuid primary key, growth_book_id uuid not null references public.growth_books(id) on delete cascade,
      page_id uuid references public.growth_book_pages(id) on delete cascade,
      baby_id uuid not null references public.babies(id) on delete cascade,
      storage_path text not null unique
    );
    create table public.baby_caution_foods(
      id uuid primary key default gen_random_uuid(), baby_id uuid not null references public.babies(id) on delete cascade,
      food_name text not null, normalized_food_name text not null, source text not null default 'custom',
      created_by uuid not null references public.profiles(id), archived_at timestamptz
    );
    create table public.baby_stickers(
      id uuid primary key, baby_id uuid not null references public.babies(id) on delete cascade,
      storage_path text not null unique, deleted_at timestamptz
    );
    create table public.media_temp_claims(
      id uuid primary key default gen_random_uuid(), bucket_id text not null, storage_path text not null,
      resource_id uuid, baby_id uuid references public.babies(id), uploader_id uuid references public.profiles(id),
      unique(bucket_id,storage_path)
    );
    create table storage.objects(
      bucket_id text not null, name text not null, owner_id text, created_at timestamptz not null default now(),
      primary key(bucket_id,name)
    );
    create or replace function public.storage_key_is_canonical(p_name text) returns boolean language sql immutable
      as $$ select p_name is not null and p_name !~ '(^|/)\\.\\.?(/|$)' $$;
    create or replace function public.is_temp_media_path(p_name text) returns boolean language sql immutable
      as $$ select p_name ~ '^[0-9a-f-]{36}/temp/' $$;
    create or replace function public.list_visible_profile_display(p_ids uuid[])
      returns table(id uuid,avatar_storage_path text) language sql stable security definer set search_path=public as $$
      select p.id,p.avatar_storage_path from profiles p where p.id=any(p_ids) and p.id=auth.uid() $$;
    alter table public.babies enable row level security;
    alter table public.baby_caution_foods enable row level security;
    grant usage on schema public,auth,storage,storage_security to authenticated;
    grant select,insert,update,delete on all tables in schema public to authenticated;
    grant select,insert,update,delete on storage.objects to authenticated;
    grant execute on all functions in schema public to authenticated;
  `]);

  for (const migration of [
    "supabase/migrations/202609140003_b04a_p1_ownership_lifecycle.sql",
    "supabase/migrations/202609140004_b04a_p1_memory_visibility_social.sql",
    "supabase/migrations/202609140005_b04a_p1_memory_recipient_assignment.sql",
    "supabase/migrations/202609200001_baby_scoped_permissions.sql",
  ]) run("psql", [...connection, "-f", migration]);
  run("psql", [...connection, "-c", `
    create or replace function public.can_view_baby_sticker(p_id uuid)
    returns boolean language sql stable security definer set search_path=public as $$
      select exists(select 1 from baby_stickers s where s.id=p_id and s.deleted_at is null
        and public.has_baby_access(s.baby_id,'moments.read')) $$;
    grant execute on function public.can_view_baby_sticker(uuid) to authenticated;
  `]);
  run("psql", [...connection, "-f", "supabase/migrations/202609200002_baby_scoped_extended_enforcement.sql"]);
  run("psql", [...connection, "-f", "supabase/migrations/202609200002_baby_scoped_extended_enforcement.sql"]);
  run("psql", [...connection, "-c", "alter table public.memory_media add column if not exists thumbnail_storage_path text;"]);
  run("psql", [...connection, "-f", "supabase/migrations/202609210001_memory_video_baby_scope_compat.sql"]);
  expect("forward migration upgrades signed-url descriptor without return-type conflict", query(`
    select pg_get_function_result('public.resolve_private_media_for_signing(text,uuid)'::regprocedure)
  `), "TABLE(bucket_id text, storage_path text, expires_in integer, thumbnail_storage_path text)");

  run("psql", [...connection, "-c", `
    insert into public.baby_members(baby_id,user_id,permission_role,status)
      values ('${baby}','${careMember}','viewer','active');
    insert into public.memory_friends(baby_id,user_id,invited_by,status)
      values ('${baby}','${friend}','${admin}','active');
  `]);
  expect("admin grants care-only capability set", query(actor(admin,
    `select (public.set_baby_access_permissions('${baby}','${careMember}',true,true,false,false,false,false)).care_write`)), "t");
  expect("admin grants moments-only capability set", query(actor(admin,
    `select (public.set_baby_access_permissions('${baby}','${friend}',false,false,true,true,true,true)).moments_write`)), "t");

  run("psql", [...connection, "-c", `
    update public.babies set avatar_storage_path='babies/${baby}/avatar.jpg' where id='${baby}';
    insert into public.memory_posts(id,baby_id,author_id,privacy_type,status,caption)
      values ('${post}','${baby}','${admin}','friend_circle','published','shared');
    insert into public.memory_media(id,memory_post_id,baby_id,storage_path,upload_status)
      values ('${memoryMedia}','${post}','${baby}','${baby}/${post}/${memoryMedia}.jpg','ready');
    insert into public.diary_entries(id,baby_id,author_id,entry_date,body)
      values ('${diary}','${baby}','${admin}',current_date,'private care note');
    insert into public.diary_media(id,diary_entry_id,baby_id,storage_path,upload_status)
      values ('${diaryMedia}','${diary}','${baby}','${baby}/temp/diary/${diaryMedia}.jpg','ready');
    insert into public.growth_books(id,baby_id,created_by) values ('${book}','${baby}','${admin}');
    insert into public.growth_book_pages(id,growth_book_id,baby_id,created_by) values ('${page}','${book}','${baby}','${admin}');
    insert into public.growth_book_media(id,growth_book_id,page_id,baby_id,storage_path)
      values ('${bookMedia}','${book}','${page}','${baby}','${baby}/${book}/${page}/${bookMedia}.jpg');
    insert into public.baby_stickers(id,baby_id,storage_path) values ('${sticker}','${baby}','${baby}/${sticker}.png');
  `]);

  expect("moments-only friend cannot select baby care profile", query(actor(friend, `select count(*) from babies where id='${baby}'`)), 0);
  expect("care reader can select baby profile", query(actor(careMember, `select count(*) from babies where id='${baby}'`)), 1);
  expect("moments reader receives memory signed-url descriptor", query(actor(friend,
    `select count(*) from resolve_private_media_for_signing('memory_media','${memoryMedia}')`)), 1);
  expect("memory signed-url TTL remains bounded", query(actor(friend,
    `select expires_in from resolve_private_media_for_signing('memory_media','${memoryMedia}')`)), 180);
  expect("moments-only friend cannot receive diary descriptor", query(actor(friend,
    `select count(*) from resolve_private_media_for_signing('diary_media','${diaryMedia}')`)), 0);
  expect("care reader receives diary descriptor", query(actor(careMember,
    `select count(*) from resolve_private_media_for_signing('diary_media','${diaryMedia}')`)), 1);
  expect("care reader receives growth-book descriptor", query(actor(careMember,
    `select count(*) from resolve_private_media_for_signing('growth_book_media','${bookMedia}')`)), 1);
  expect("moments reader receives baby avatar descriptor", query(actor(friend,
    `select count(*) from resolve_private_media_for_signing('baby_avatar','${baby}')`)), 1);

  expect("moments writer may upload memory temp object", query(actor(friend,
    `select storage_security.resource_access('memories','${baby}/temp/x/a.jpg','${friend}','insert')`)), "t");
  expect("moments-only user may not upload diary temp object", query(actor(friend,
    `select storage_security.resource_access('diary-media','${baby}/temp/x/a.jpg','${friend}','insert')`)), "f");
  expect("care writer may upload diary temp object", query(actor(careMember,
    `select storage_security.resource_access('diary-media','${baby}/temp/x/a.jpg','${careMember}','insert')`)), "t");
  expect("care-only user may not upload memory temp object", query(actor(careMember,
    `select storage_security.resource_access('memories','${baby}/temp/x/a.jpg','${careMember}','insert')`)), "f");

  expect("care reader sees caution records", query(actor(careMember,
    `with x as (insert into baby_caution_foods(baby_id,food_name,normalized_food_name,created_by)
      values ('${baby}','egg','egg','${careMember}') returning id) select count(*) from x`)), 1);
  expect("moments-only friend cannot see care caution record", query(actor(friend,
    `select count(*) from baby_caution_foods where baby_id='${baby}'`)), 0);

  const profileWriter = runAsync(actor(careMember, `begin; update babies set name='Serialized profile write' where id='${baby}'; select pg_sleep(1); commit;`));
  await new Promise((resolve) => setTimeout(resolve, 150));
  const revokeStarted = performance.now();
  const profileRevocation = runAsync(actor(admin,
    `select public.set_baby_access_permissions('${baby}','${careMember}',true,false,false,false,false,false);`));
  const profileRevocationResult = await profileRevocation;
  const revokeElapsed = performance.now()-revokeStarted;
  const profileWriterResult = await profileWriter;
  if (profileWriterResult.status !== 0 || profileRevocationResult.status !== 0 || revokeElapsed < 600) {
    throw new Error(`baby profile write/revocation serialization failed: ${profileWriterResult.output} ${profileRevocationResult.output}`);
  }
  console.log("PASS baby profile write serializes before care-write revocation");
  expect("revoked care writer cannot update baby profile", query(actor(careMember,
    `with changed as (update babies set name='Stale write denied' where id='${baby}' returning id) select count(*) from changed`)), 0);

  expect("admin revokes friend capabilities", query(actor(admin,
    `select not (public.set_baby_access_permissions('${baby}','${friend}',false,false,false,false,false,false)).moments_read`)), "t");
  expect("revocation immediately blocks new memory signing", query(actor(friend,
    `select count(*) from resolve_private_media_for_signing('memory_media','${memoryMedia}')`)), 0);
  expect("revocation immediately blocks new avatar signing", query(actor(friend,
    `select count(*) from resolve_private_media_for_signing('baby_avatar','${baby}')`)), 0);

  console.log("baby-scoped extended Storage/signed-url local PostgreSQL regression PASS");
} finally {
  if (started) command("pg_ctl", ["-D", data, "-m", "immediate", "-w", "stop"], { stdio: "ignore" });
  rmSync(work, { recursive: true, force: true });
  rmSync(socket, { recursive: true, force: true });
}
