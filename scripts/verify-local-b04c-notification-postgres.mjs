import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const postgresBin = process.env.POSTGRES_BIN?.trim() || "/opt/homebrew/opt/postgresql@16/bin";
const work = mkdtempSync(join(tmpdir(), "darin-b04c-notification-"));
const data = join(work, "data");
const socket = join(work, "socket");
const port = "55451";
mkdirSync(socket);

function run(command, args, capture = false) {
  const result = spawnSync(join(postgresBin, command), args, {
    cwd: process.cwd(), encoding: "utf8", stdio: capture ? "pipe" : "inherit",
  });
  if (result.status !== 0 && !capture) throw new Error(`${command} failed with exit ${result.status}`);
  return result;
}

const connection = ["-X", "-h", socket, "-p", port, "-d", "postgres", "-v", "ON_ERROR_STOP=1"];
const exec = (sql) => run("psql", [...connection, "-c", sql]);
const query = (sql) => {
  const result = run("psql", [...connection, "-At", "-c", sql], true);
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
  return result.stdout.trim().split(/\r?\n/).filter(Boolean).at(-1) ?? "";
};
const denied = (label, sql) => {
  const result = run("psql", [...connection, "-c", sql], true);
  if (result.status === 0) throw new Error(`${label}: unexpectedly succeeded`);
  console.log(`PASS ${label}`);
};
const uid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const baby = "10000000-0000-4000-8000-000000000001";
const memory = "20000000-0000-4000-8000-000000000001";
const event = "30000000-0000-4000-8000-000000000001";
const expired = "30000000-0000-4000-8000-000000000002";
const asUser = (id, sql) => `set role authenticated; select set_config('request.jwt.claim.sub','${id}',false); ${sql}`;
const physicalSecret = "physical-installation-secret-00000000000000000000000000000001";
const attackerSecret = "attacker-installation-secret-00000000000000000000000000000001";

let started = false;
try {
  run("initdb", ["-D", data, "--auth=trust", "--no-locale", "-E", "UTF8"]);
  run("pg_ctl", ["-D", data, "-o", `-k ${socket} -p ${port} -F -c listen_addresses=`, "-w", "start"]);
  started = true;
  exec(`
    create schema extensions;
    create extension if not exists pgcrypto with schema extensions;
    create schema auth;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid
    $$;
    create table public.babies(id uuid primary key);
    create table public.baby_members(baby_id uuid, user_id uuid, status text, primary key(baby_id,user_id));
    create table public.memory_access(memory_post_id uuid, user_id uuid, primary key(memory_post_id,user_id));
    create function public.is_baby_member(p_baby_id uuid) returns boolean language sql stable security definer set search_path=public as $$
      select exists(select 1 from baby_members where baby_id=p_baby_id and user_id=auth.uid() and status='active')
    $$;
    create function public.can_view_memory_post(p_memory_post_id uuid) returns boolean language sql stable security definer set search_path=public as $$
      select exists(select 1 from memory_access where memory_post_id=p_memory_post_id and user_id=auth.uid())
    $$;
    create table public.push_tokens(
      id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
      device_id text not null, expo_push_token text not null unique, platform text not null,
      app_version text, build_number text, last_seen_at timestamptz not null default now(),
      disabled_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
      unique(user_id,device_id)
    );
    create table public.notification_events(
      id uuid primary key default gen_random_uuid(), recipient_id uuid not null references auth.users(id), actor_id uuid,
      baby_id uuid references babies(id), event_type text not null, title text not null, body text not null default '',
      data jsonb not null default '{}'::jsonb, dedupe_key text, status text not null default 'pending',
      error_message text, sent_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
      constraint notification_events_status_check check(status in ('pending','sent','failed','skipped'))
    );
    alter table push_tokens enable row level security;
    alter table notification_events enable row level security;
    create policy push_tokens_select_own on push_tokens for select to authenticated using(user_id=auth.uid());
    create policy push_tokens_insert_own on push_tokens for insert to authenticated with check(user_id=auth.uid() and disabled_at is null);
    create policy push_tokens_update_own on push_tokens for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
    create policy push_tokens_delete_own on push_tokens for delete to authenticated using(user_id=auth.uid());
    create policy notification_events_select_recipient on notification_events for select to authenticated using(recipient_id=auth.uid());
    grant select,insert,update,delete on push_tokens to authenticated;
    grant select on notification_events to authenticated;
    grant all on push_tokens,notification_events to service_role;
    insert into auth.users values('${uid(1)}'),('${uid(2)}'),('${uid(3)}');
    insert into babies values('${baby}');
    insert into baby_members values('${baby}','${uid(1)}','active'),('${baby}','${uid(2)}','active');
    insert into memory_access values('${memory}','${uid(2)}');
    insert into push_tokens(user_id,device_id,expo_push_token,platform)
      values('${uid(3)}','legacy-device','ExpoPushToken[token-legacy]','ios');
  `);

  run("psql", [...connection, "-f", "supabase/migrations/202609160000_b04c_push_registration_compat.sql"]);
  if (query(`select count(*) from push_tokens where user_id='${uid(3)}' and disabled_at is null`) !== "1") {
    throw new Error("compatibility migration disabled a legacy token before mobile rollout");
  }
  exec(asUser(uid(3),
    `select register_current_push_token('legacy-device','ExpoPushToken[token-legacy]','ios','${physicalSecret}',null,null)`));
  if (query(`select count(*) from push_tokens where user_id='${uid(3)}' and disabled_at is null and installation_secret_hash is not null`) !== "1") {
    throw new Error("compatibility registration did not bind existing owner proof");
  }
  denied("compatibility RPC rejects cross-account claim", asUser(uid(2),
    `select register_current_push_token('legacy-device','ExpoPushToken[token-legacy]','ios','${attackerSecret}',null,null)`));
  run("psql", [...connection, "-f", "supabase/migrations/202609160002_b04c_push_same_account_rebind.sql"]);
  denied("private rebind implementation is not directly callable", asUser(uid(3),
    `select register_current_push_token_v2('replacement-device','ExpoPushToken[token-legacy]','ios','${physicalSecret}',null,null)`));
  exec(asUser(uid(3),
    `select register_current_push_token('replacement-device','ExpoPushToken[token-legacy]','ios','${physicalSecret}',null,null)`));
  if (query(`select count(*) from push_tokens where user_id='${uid(3)}' and device_id='replacement-device' and disabled_at is null`) !== "1"
      || query(`select count(*) from push_tokens where user_id='${uid(3)}' and device_id='legacy-device'`) !== "0") {
    throw new Error("same-account installation ID rotation did not retain one active token");
  }
  exec(asUser(uid(3),
    `select register_current_push_token('legacy-device','ExpoPushToken[token-legacy]','ios','${physicalSecret}',null,null)`));
  console.log("PASS same-account device ID rotation preserves one active token");
  if (query(`select count(*) from pg_policies where tablename='push_tokens' and cmd in ('INSERT','UPDATE','DELETE')`) !== "3") {
    throw new Error("compatibility migration changed old-client write policies");
  }
  exec(asUser(uid(2), `insert into push_tokens(user_id,device_id,expo_push_token,platform)
    values('${uid(2)}','unproven-device','ExpoPushToken[token-unproven]','ios')`));
  console.log("PASS compatibility bridge preserves old client and binds new client proof");

  for (let i = 1; i <= 2; i += 1) {
    run("psql", [...connection, "-f", "supabase/migrations/202609160001_b04c_notification_security.sql"]);
    console.log(`PASS B0.4c migration replay ${i}/2`);
  }
  run("psql", [...connection, "-f", "supabase/migrations/202609160003_b04c_push_rebind_post_cutover.sql"]);

  if (query(`select count(*) from push_tokens where user_id='${uid(2)}' and device_id='unproven-device' and disabled_at is not null`) !== "1") {
    throw new Error("legacy token without installation proof remained active");
  }
  if (query(`select count(*) from push_tokens where user_id='${uid(3)}' and disabled_at is null`) !== "1") {
    throw new Error("proof-bound token was disabled during final cutover");
  }
  console.log("PASS final cutover disables only unverifiable legacy token");
  denied("proof-bound token cannot be claimed cross-account", asUser(uid(2),
    `select register_current_push_token('legacy-device','ExpoPushToken[token-legacy]','ios','${attackerSecret}',null,null)`));
  exec(asUser(uid(3),
    `select register_current_push_token('legacy-device','ExpoPushToken[token-legacy]','ios','${physicalSecret}',null,null)`));
  if (query(`select count(*) from push_tokens where user_id='${uid(3)}' and device_id='legacy-device' and disabled_at is null and installation_secret_hash is not null`) !== "1") {
    throw new Error("legacy token owner could not re-register with installation proof");
  }
  console.log("PASS legacy owner can bind proof without cross-account reassignment");
  exec(asUser(uid(3),
    `select register_current_push_token('final-device','ExpoPushToken[token-legacy]','ios','${physicalSecret}',null,null)`));
  if (query(`select count(*) from push_tokens where user_id='${uid(3)}' and device_id='final-device' and disabled_at is null`) !== "1"
      || query(`select count(*) from push_tokens where user_id='${uid(3)}' and device_id='legacy-device'`) !== "0") {
    throw new Error("post-cutover same-account installation ID rotation failed");
  }
  console.log("PASS post-cutover same-account device ID rotation");

  denied("direct token insert revoked", asUser(uid(1), `insert into push_tokens(user_id,device_id,expo_push_token,platform) values('${uid(1)}','d','ExpoPushToken[token-direct]','ios')`));
  denied("direct token update revoked", asUser(uid(3), `update push_tokens set user_id='${uid(3)}' where device_id='legacy-device'`));
  denied("direct token delete revoked", asUser(uid(3), `delete from push_tokens where device_id='legacy-device'`));
  exec(asUser(uid(1), `select register_current_push_token('shared-device','ExpoPushToken[token-shared]','ios','${physicalSecret}',null,null)`));
  if (query(`select count(*) from push_tokens where user_id='${uid(1)}' and disabled_at is null`) !== "1") throw new Error("user A token registration failed");
  console.log("PASS authenticated token registration binds auth.uid");

  denied("known token cannot be reassigned without installation proof", asUser(uid(2),
    `select register_current_push_token('shared-device','ExpoPushToken[token-shared]','ios','${attackerSecret}',null,null)`));
  exec(asUser(uid(2), `select register_current_push_token('shared-device','ExpoPushToken[token-shared]','ios','${physicalSecret}',null,null)`));
  if (query(`select count(*) from push_tokens where user_id='${uid(1)}'`) !== "0" || query(`select count(*) from push_tokens where user_id='${uid(2)}' and disabled_at is null`) !== "1") {
    throw new Error("account-switch token ownership was not transferred atomically");
  }
  console.log("PASS account-switch token transfer is unique and atomic");

  exec(asUser(uid(1), `select register_current_push_token('rotated-device','ExpoPushToken[token-old]','ios','${physicalSecret}',null,null)`));
  denied("known device id cannot revoke token without installation proof", asUser(uid(2),
    `select register_current_push_token('rotated-device','ExpoPushToken[token-new]','ios','${attackerSecret}',null,null)`));
  exec(asUser(uid(2), `select register_current_push_token('rotated-device','ExpoPushToken[token-new]','ios','${physicalSecret}',null,null)`));
  if (query(`select count(*) from push_tokens where user_id='${uid(1)}' and device_id='rotated-device'`) !== "0"
      || query(`select count(*) from push_tokens where user_id='${uid(2)}' and device_id='rotated-device' and expo_push_token='ExpoPushToken[token-new]'`) !== "1") {
    throw new Error("rotated account-switch token was active for two users");
  }
  console.log("PASS account switch removes stale ownership after token rotation");

  exec(asUser(uid(1), `select unregister_current_push_token('shared-device')`));
  if (query(`select count(*) from push_tokens where user_id='${uid(2)}' and device_id='shared-device' and disabled_at is null`) !== "1") throw new Error("cross-user unregister disabled another account token");
  console.log("PASS cross-user unregister cannot revoke owner token");
  denied("invalid token rejected", asUser(uid(1), `select register_current_push_token('d','known-but-invalid','ios','${physicalSecret}',null,null)`));

  const secondPhysicalSecret = "second-installation-secret-00000000000000000000000000000002";
  exec(asUser(uid(1), `select register_current_push_token('multi-device-a','ExpoPushToken[token-multi-a]','ios','${physicalSecret}',null,null)`));
  exec(asUser(uid(1), `select register_current_push_token('multi-device-b','ExpoPushToken[token-multi-b]','android','${secondPhysicalSecret}',null,null)`));
  if (query(`select count(*) from push_tokens where user_id='${uid(1)}' and device_id like 'multi-device-%' and disabled_at is null`) !== "2") {
    throw new Error("valid multi-device registrations were not both active");
  }
  exec(asUser(uid(1), `select unregister_current_push_token('multi-device-a')`));
  if (query(`select count(*) from push_tokens where user_id='${uid(1)}' and device_id='multi-device-a' and disabled_at is not null`) !== "1"
      || query(`select count(*) from push_tokens where user_id='${uid(1)}' and device_id='multi-device-b' and disabled_at is null`) !== "1") {
    throw new Error("revoking one device changed another active device");
  }
  console.log("PASS multi-device registration and per-device revocation");

  exec(`insert into notification_events(id,recipient_id,baby_id,event_type,title,data,status,expires_at)
    values('${event}','${uid(2)}','${baby}','new_diary','generic','{}','pending',now()+interval '10 minutes'),
          ('${expired}','${uid(2)}','${baby}','new_diary','generic','{}','pending',now()-interval '1 second')`);
  if (query(`set role service_role; select count(*) from claim_notification_event_dispatch('${event}')`) !== "1") throw new Error("first dispatch claim failed");
  if (query(`set role service_role; select count(*) from claim_notification_event_dispatch('${event}')`) !== "0") throw new Error("duplicate dispatch claim succeeded");
  if (query(`select status||':'||attempt_count from notification_events where id='${event}'`) !== "dispatching:1") throw new Error("dispatch state mismatch");
  if (query(`set role service_role; select count(*) from claim_notification_event_dispatch('${expired}')`) !== "0") throw new Error("expired event was claimable");
  denied("authenticated dispatch claim denied", asUser(uid(2), `select * from claim_notification_event_dispatch('${expired}')`));
  console.log("PASS at-most-once and expiry dispatch gate");

  exec(`insert into notification_events(recipient_id,baby_id,event_type,title,data,status)
    values('${uid(2)}','${baby}','memory_comment','generic',jsonb_build_object('memoryPostId','${memory}'),'sent'),
          ('${uid(2)}','${baby}','memory_comment','generic',jsonb_build_object('memoryPostId','malformed-client-value'),'sent')`);
  if (query(asUser(uid(2), `select count(*) from notification_events where event_type='memory_comment'`)) !== "1") throw new Error("authorized memory event hidden");
  exec(`delete from memory_access where memory_post_id='${memory}' and user_id='${uid(2)}'`);
  if (query(asUser(uid(2), `select count(*) from notification_events where event_type='memory_comment'`)) !== "0") throw new Error("revoked memory event remained visible");
  exec(`update baby_members set status='removed' where baby_id='${baby}' and user_id='${uid(2)}'`);
  if (query(asUser(uid(2), `select count(*) from notification_events where event_type='new_diary'`)) !== "0") throw new Error("removed member retained event access");
  console.log("PASS inbox authorization follows current resource and membership");

  console.log("B0.4c local PostgreSQL notification security passed");
} finally {
  if (started) run("pg_ctl", ["-D", data, "-m", "fast", "-w", "stop"]);
  rmSync(work, { recursive: true, force: true });
}
