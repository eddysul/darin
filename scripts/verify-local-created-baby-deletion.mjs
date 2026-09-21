import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const bin = process.env.POSTGRES_BIN?.trim() || "/opt/homebrew/opt/postgresql@16/bin";
const work = mkdtempSync(join(tmpdir(), "darin-delete-baby-"));
const data = join(work, "data");
const socket = join(work, "socket");
const port = String(56000 + process.pid % 8000);
mkdirSync(socket);
const conn = ["-X", "-h", socket, "-p", port, "-d", "postgres", "-v", "ON_ERROR_STOP=1"];
const ids = {
  creator: "00000000-0000-4000-8000-000000000001",
  invitedAdmin: "00000000-0000-4000-8000-000000000002",
  editor: "00000000-0000-4000-8000-000000000003",
  outsider: "00000000-0000-4000-8000-000000000004",
  owned: "10000000-0000-4000-8000-000000000001",
  invited: "10000000-0000-4000-8000-000000000002",
  demoted: "10000000-0000-4000-8000-000000000003",
  blocked: "10000000-0000-4000-8000-000000000004",
};

function command(name, args) {
  return spawnSync(join(bin, name), args, { encoding: "utf8", timeout: 15_000 });
}
function run(name, args) {
  const result = command(name, args);
  if (result.status !== 0) throw new Error(`${name} failed: ${result.stderr || result.stdout}`);
  return result.stdout;
}
function sql(statement) {
  return run("psql", [...conn, "-At", "-c", statement]).trim().split(/\r?\n/).at(-1);
}
function as(actor, statement) {
  return command("psql", [...conn, "-At", "-c",
    `set role authenticated; select set_config('request.jwt.claim.sub', '${actor}', false); ${statement}`]);
}
function expect(label, actual, expected) {
  if (actual !== expected) throw new Error(`${label}: expected ${expected}, got ${actual}`);
  process.stdout.write(`PASS ${label}\n`);
}
function expectActor(label, actor, statement, expected) {
  const result = as(actor, statement);
  if (result.status !== 0) throw new Error(`${label}: ${result.stderr || result.stdout}`);
  expect(label, result.stdout.trim().split(/\r?\n/).at(-1), expected);
}
function expectDenied(label, actor, statement) {
  const result = as(actor, statement);
  if (result.status === 0) throw new Error(`${label}: unexpectedly succeeded`);
  expect(label, String(result.status), "1");
}

let started = false;
try {
  run("initdb", ["-D", data, "--auth=trust", "--no-locale", "-E", "UTF8", "-c", "shared_memory_type=mmap"]);
  run("pg_ctl", ["-D", data, "-o", `-k ${socket} -p ${port} -F -c listen_addresses= -c shared_memory_type=mmap`, "-w", "start"]);
  started = true;
  sql(`
    create schema auth;
    create schema storage;
    create role authenticated nologin;
    create role anon nologin;
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    create type public.permission_role as enum ('admin','editor','viewer');
    create table public.babies (
      id uuid primary key, created_by uuid, name text not null
    );
    create table public.baby_members (
      baby_id uuid not null references public.babies(id) on delete cascade,
      user_id uuid not null, permission_role public.permission_role not null,
      status text not null, primary key (baby_id,user_id)
    );
    create table public.care_logs (
      id integer primary key, baby_id uuid not null references public.babies(id) on delete cascade
    );
    create table public.memory_posts (
      id integer primary key, baby_id uuid not null references public.babies(id) on delete cascade
    );
    create table public.baby_stickers (
      id integer primary key, baby_id uuid not null references public.babies(id) on delete cascade
    );
    alter table public.memory_posts add column sticker_id integer
      references public.baby_stickers(id) on delete restrict;
    create table public.media_temp_claims (baby_id uuid not null, storage_path text not null);
    create table storage.objects (bucket_id text not null, name text not null);
    create table public.media_cleanup_queue (bucket_id text not null, storage_path text not null,
      primary key (bucket_id,storage_path));
    create function public.baby_permission(p_baby_id uuid) returns public.permission_role
    language sql stable security definer set search_path=public as $$
      select permission_role from public.baby_members
      where baby_id=p_baby_id and user_id=auth.uid() and status='active' limit 1
    $$;
    create function public.enqueue_test_baby_storage() returns trigger language plpgsql
    security definer set search_path=public as $$ begin
      insert into public.media_cleanup_queue(bucket_id,storage_path)
      select bucket_id,name from storage.objects
      where (bucket_id in ('memories','diary-media','growth-book-media','baby-stickers')
        and split_part(name,'/',1)=old.id::text)
        or (bucket_id='profile-media' and split_part(name,'/',1)='babies'
          and split_part(name,'/',2)=old.id::text)
      on conflict do nothing;
      return old;
    end $$;
    create trigger b04b_delete_baby_storage before delete on public.babies
      for each row execute function public.enqueue_test_baby_storage();
    alter table public.babies enable row level security;
    create policy babies_select_member on public.babies for select to authenticated
      using (public.baby_permission(id) is not null);
    create policy babies_delete_admin on public.babies for delete to authenticated
      using (public.baby_permission(id)='admin'::public.permission_role);
    grant usage on schema public,auth to authenticated;
    grant select,delete on public.babies to authenticated;
    grant execute on function auth.uid() to authenticated;
  `);
  run("psql", [...conn, "-f", "supabase/migrations/202609180002_delete_created_baby.sql"]);
  sql(`
    insert into public.babies(id,created_by,name) values
      ('${ids.owned}','${ids.creator}','Owned'),
      ('${ids.invited}','${ids.invitedAdmin}','Other owner'),
      ('${ids.demoted}','${ids.creator}','Demoted creator'),
      ('${ids.blocked}','${ids.creator}','Restricted child');
    insert into public.baby_members values
      ('${ids.owned}','${ids.creator}','admin','active'),
      ('${ids.owned}','${ids.invitedAdmin}','admin','active'),
      ('${ids.owned}','${ids.editor}','editor','active'),
      ('${ids.invited}','${ids.invitedAdmin}','admin','active'),
      ('${ids.invited}','${ids.creator}','admin','active'),
      ('${ids.demoted}','${ids.creator}','viewer','active'),
      ('${ids.blocked}','${ids.creator}','admin','active');
    insert into public.care_logs values (1,'${ids.owned}');
    insert into public.memory_posts(id,baby_id) values (1,'${ids.owned}');
    insert into public.baby_stickers values (1,'${ids.owned}');
    update public.memory_posts set sticker_id=1 where id=1;
    insert into public.media_temp_claims values
      ('${ids.owned}','${ids.owned}/draft'),
      ('${ids.invited}','${ids.invited}/draft'),
      ('${ids.blocked}','${ids.blocked}/draft');
    insert into storage.objects values
      ('memories','${ids.owned}/1/image.jpg'),
      ('diary-media','${ids.owned}/1/image.jpg'),
      ('profile-media','babies/${ids.owned}/image.jpg'),
      ('memories','${ids.invited}/1/image.jpg');
  `);
  expectActor("invited admin direct delete denied", ids.invitedAdmin,
    `with deleted as (delete from public.babies where id='${ids.owned}' returning id) select count(*) from deleted`, "0");
  expectDenied("invited admin RPC denied", ids.invitedAdmin,
    `select public.delete_created_baby('${ids.owned}')`);
  sql(`create function public.test_account_lifecycle_delete(p_baby_id uuid)
    returns void language plpgsql security definer set search_path=public as $$
    begin delete from public.babies where id=p_baby_id; end $$;
    grant execute on function public.test_account_lifecycle_delete(uuid) to authenticated`);
  expectDenied("security-definer account path cannot delete invited baby", ids.invitedAdmin,
    `select public.test_account_lifecycle_delete('${ids.owned}')`);
  expectActor("invited editor direct delete denied", ids.editor,
    `with deleted as (delete from public.babies where id='${ids.owned}' returning id) select count(*) from deleted`, "0");
  expectDenied("unrelated user RPC denied", ids.outsider,
    `select public.delete_created_baby('${ids.owned}')`);
  expectActor("creator cannot delete another owner's baby", ids.creator,
    `with deleted as (delete from public.babies where id='${ids.invited}' returning id) select count(*) from deleted`, "0");
  expectDenied("creator without active admin denied", ids.creator,
    `select public.delete_created_baby('${ids.demoted}')`);
  const creatorLifecycle = as(ids.creator,
    `select public.test_account_lifecycle_delete('${ids.demoted}')`);
  if (creatorLifecycle.status !== 0) throw new Error("creator account-lifecycle deletion was blocked");
  expect("creator account-lifecycle path remains valid", sql(`
    select count(*) from public.babies where id='${ids.demoted}'`), "0");
  expectActor("creator RPC deletes own baby", ids.creator,
    `select public.delete_created_baby('${ids.owned}')`, "t");
  expect("baby child rows and memberships cascade", sql(`
    select (select count(*) from public.babies where id='${ids.owned}') +
      (select count(*) from public.baby_members where baby_id='${ids.owned}') +
      (select count(*) from public.care_logs where baby_id='${ids.owned}') +
      (select count(*) from public.memory_posts where baby_id='${ids.owned}') +
      (select count(*) from public.baby_stickers where baby_id='${ids.owned}') +
      (select count(*) from public.media_temp_claims where baby_id='${ids.owned}')`), "0");
  expect("storage cleanup queued for all private buckets", sql(`
    select count(*) from public.media_cleanup_queue where storage_path like '%${ids.owned}%'`), "3");
  expect("other baby remains intact", sql(`select count(*) from public.babies where id='${ids.invited}'`), "1");
  expectActor("direct creator delete succeeds", ids.invitedAdmin,
    `with deleted as (delete from public.babies where id='${ids.invited}' returning id) select count(*) from deleted`, "1");
  expect("direct deletion clears unlinked claims", sql(`
    select count(*) from public.media_temp_claims where baby_id='${ids.invited}'`), "0");
  sql(`create table public.restrict_child (baby_id uuid references public.babies(id) on delete restrict);
    insert into public.restrict_child values ('${ids.blocked}')`);
  expectDenied("blocked cascade rolls back atomically", ids.creator,
    `select public.delete_created_baby('${ids.blocked}')`);
  expect("failed delete retains baby and claims", sql(`
    select (select count(*) from public.babies where id='${ids.blocked}') +
      (select count(*) from public.media_temp_claims where baby_id='${ids.blocked}')`), "2");
} finally {
  if (started) command("pg_ctl", ["-D", data, "-m", "immediate", "-w", "stop"]);
  rmSync(work, { recursive: true, force: true });
}
