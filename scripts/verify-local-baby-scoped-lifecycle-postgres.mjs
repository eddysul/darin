import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn, spawnSync } from "node:child_process";

const bin = process.env.POSTGRES_BIN?.trim() || "/opt/homebrew/opt/postgresql@16/bin";
const work = mkdtempSync(join(tmpdir(), "darin-baby-lifecycle-"));
const data = join(work, "data");
const socket = join("/tmp", `darin-baby-lifecycle-${process.pid}`);
const port = "55448";
rmSync(socket, { recursive: true, force: true }); mkdirSync(socket);
const cmd = (name,args,options={}) => spawnSync(join(bin,name),args,{cwd:process.cwd(),encoding:"utf8",...options});
const run = (name,args) => { const r=cmd(name,args,{stdio:"inherit"}); if(r.status!==0) throw new Error(`${name} failed ${r.status}`); };
const conn=["-X","-q","-h",socket,"-p",port,"-d","postgres","-v","ON_ERROR_STOP=1"];
const psql=(sql,extra=[])=>cmd("psql",[...conn,...extra,"-c",sql],{stdio:"pipe"});
const query=(sql)=>{const r=psql(sql,["-At"]);if(r.status!==0)throw new Error(r.stderr||r.stdout);return r.stdout.trim().split(/\r?\n/).filter(Boolean).at(-1)??"";};
const actor=(id,body)=>`set role authenticated; select set_config('request.jwt.claim.sub','${id}',false); ${body}`;
const expect=(label,actual,wanted)=>{if(actual!==String(wanted))throw new Error(`${label}: expected ${wanted}, got ${actual}`);console.log(`PASS ${label}`);};
const denied=(label,id,sql)=>{const r=psql(actor(id,sql));if(r.status===0)throw new Error(`${label}: unexpectedly succeeded`);console.log(`PASS ${label}`);};
const asyncSql=(sql)=>new Promise((resolve,reject)=>{const child=spawn(join(bin,"psql"),[...conn,"-At","-c",sql],{cwd:process.cwd(),encoding:"utf8",stdio:["ignore","pipe","pipe"]});let output="";child.stdout.on("data",c=>output+=c);child.stderr.on("data",c=>output+=c);child.on("error",reject);child.on("close",status=>resolve({status,output}));});
const u=(n)=>`00000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
const b=(n)=>`10000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
let started=false;
try {
  run("initdb",["-D",data,"--auth=trust","--no-locale","-E","UTF8"]);
  run("pg_ctl",["-D",data,"-o",`-k ${socket} -p ${port} -F -c listen_addresses=`,"-w","start"]);started=true;
  run("psql",[...conn,"-c",`
    create schema auth; create schema storage; create schema storage_security;
    create role anon nologin; create role authenticated nologin;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create type public.permission_role as enum('admin','editor','viewer');
    create table profiles(id uuid primary key);
    create table babies(id uuid primary key,name text,created_by uuid references profiles(id));
    create table baby_members(baby_id uuid references babies(id) on delete cascade,user_id uuid references profiles(id),permission_role permission_role,status text,primary key(baby_id,user_id));
    create table memory_friends(baby_id uuid references babies(id) on delete cascade,user_id uuid references profiles(id),status text,primary key(baby_id,user_id));
    create table baby_access_permissions(baby_id uuid references babies(id) on delete cascade,user_id uuid references profiles(id),primary key(baby_id,user_id));
    create function is_baby_full_admin(p_baby_id uuid,p_user_id uuid default auth.uid()) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from baby_members where baby_id=p_baby_id and user_id=p_user_id and status='active' and permission_role='admin') $$;
    create table media_temp_claims(id uuid primary key default gen_random_uuid(),baby_id uuid,uploader_id uuid);
    create table media_cleanup_queue(bucket_id text,storage_path text,requested_by uuid,primary key(bucket_id,storage_path));
    create table storage.objects(bucket_id text,name text,owner_id text,primary key(bucket_id,name));
    create function storage_key_is_canonical(text) returns boolean language sql immutable as $$ select true $$;
    create function storage_security.key_attached(text,text) returns boolean language sql stable as $$ select false $$;
    create table care_logs(id uuid primary key default gen_random_uuid(),created_by uuid);
    create table growth_records(id uuid primary key default gen_random_uuid(),created_by uuid);
    create table invite_codes(id uuid primary key default gen_random_uuid(),created_by uuid,used_by uuid);
    create table notification_events(id uuid primary key default gen_random_uuid(),actor_id uuid,recipient_id uuid);
    create table contact_requests(id uuid primary key default gen_random_uuid(),user_id uuid);
    create table push_tokens(id uuid primary key default gen_random_uuid(),user_id uuid);
    create table notification_settings(id uuid primary key default gen_random_uuid(),user_id uuid);
    create function guard_created_baby_delete() returns trigger language plpgsql as $$ begin return old; end $$;
    create trigger guard_created_baby_delete before delete on babies for each row execute function guard_created_baby_delete();
    grant usage on schema public,auth to authenticated;
    grant select,insert,update,delete on all tables in schema public to authenticated;
    grant execute on all functions in schema public to authenticated;
    insert into profiles select ('00000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid from generate_series(1,8) i;
  `]);
  run("psql",[...conn,"-f","supabase/migrations/202609200003_baby_scoped_account_lifecycle.sql"]);
  run("psql",[...conn,"-f","supabase/migrations/202609200003_baby_scoped_account_lifecycle.sql"]);

  run("psql",[...conn,"-c",`
    insert into babies values ('${b(1)}','shared last admin','${u(1)}');
    insert into baby_members values ('${b(1)}','${u(2)}','admin','active');
    insert into baby_members values ('${b(1)}','${u(7)}','viewer','active');
    insert into baby_access_permissions values ('${b(1)}','${u(2)}'),('${b(1)}','${u(7)}');
    insert into media_temp_claims(baby_id,uploader_id) values ('${b(1)}','${u(2)}');
    insert into storage.objects values ('memories','${b(1)}/temp/private.jpg','${u(2)}');
  `]);
  denied("non-creator cannot directly delete shared baby",u(2),`delete from babies where id='${b(1)}'`);
  expect("last non-creator Full Admin account deletion succeeds",query(actor(u(2),`select public.prepare_account_deletion(); select count(*) from babies where id='${b(1)}'`)),0);
  expect("last-admin deletion cascades permission and membership graph",query(`select (select count(*) from baby_members where baby_id='${b(1)}')+(select count(*) from baby_access_permissions where baby_id='${b(1)}')`),0);
  expect("account-owned unattached Storage object is queued",query(`select count(*) from media_cleanup_queue where requested_by='${u(2)}'`),1);

  run("psql",[...conn,"-c",`
    insert into babies values ('${b(2)}','two admins','${u(3)}');
    insert into baby_members values ('${b(2)}','${u(3)}','admin','active'),('${b(2)}','${u(4)}','admin','active');
    insert into baby_access_permissions values ('${b(2)}','${u(3)}'),('${b(2)}','${u(4)}');
  `]);
  query(actor(u(4),`select public.prepare_account_deletion()`));
  expect("departure preserves baby when another Full Admin remains",query(`select count(*) from babies where id='${b(2)}'`),1);
  expect("departing admin access is removed",query(`select count(*) from baby_members where baby_id='${b(2)}' and user_id='${u(4)}'`),0);
  expect("remaining admin is preserved",query(`select count(*) from baby_members where baby_id='${b(2)}' and user_id='${u(3)}'`),1);

  run("psql",[...conn,"-c",`
    insert into babies values ('${b(3)}','concurrent admins','${u(5)}');
    insert into baby_members values ('${b(3)}','${u(5)}','admin','active'),('${b(3)}','${u(6)}','admin','active');
    insert into baby_access_permissions values ('${b(3)}','${u(5)}'),('${b(3)}','${u(6)}');
  `]);
  const first=asyncSql(actor(u(5),`begin; select public.prepare_account_deletion(); select pg_sleep(1); commit;`));
  await new Promise(r=>setTimeout(r,150));
  const startedAt=performance.now();
  const second=asyncSql(actor(u(6),`select public.prepare_account_deletion();`));
  const [a,z]=await Promise.all([first,second]);
  if(a.status!==0||z.status!==0||performance.now()-startedAt<600)throw new Error(`concurrent departure failed: ${a.output} ${z.output}`);
  expect("concurrent admin departures leave no orphan baby",query(`select count(*) from babies where id='${b(3)}'`),0);
  console.log("PASS concurrent departures serialize on baby lock");

  console.log("baby-scoped account lifecycle local PostgreSQL regression PASS");
} finally {
  if(started)cmd("pg_ctl",["-D",data,"-m","immediate","-w","stop"],{stdio:"ignore"});
  rmSync(work,{recursive:true,force:true});rmSync(socket,{recursive:true,force:true});
}
