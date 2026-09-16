// Audit reproducer: assertions demonstrate EXISTING vulnerabilities, not security PASS.
// Local PostgreSQL only. Auth identities and notification sink are synthetic.
import {readFileSync,mkdtempSync,mkdirSync,rmSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
const root=process.cwd(), bin='/opt/homebrew/opt/postgresql@16/bin';
const catalog=JSON.parse(readFileSync('docs/security/evidence/b04a-authorization-catalog-20260914.json','utf8'));
const work=mkdtempSync(join(tmpdir(),'b04a-remaining-'));
const data=join(work,'data'),socket=join(work,'socket');mkdirSync(socket);
function run(name,args,input){const r=spawnSync(join(bin,name),args,{input,encoding:'utf8'});if(r.status!==0)throw Error((r.stderr+r.stdout).slice(-5000));return r.stdout.trim();}
const conn=['-X','-h',socket,'-p','55442','-d','postgres','-v','ON_ERROR_STOP=1','-Atq'];
const sql=q=>run('psql',conn,q);
function table(name,file){const text=readFileSync('supabase/migrations/'+file,'utf8');const match=text.match(new RegExp('create table if not exists public\\.'+name+' \\([\\s\\S]*?\\n\\);','i'));if(!match)throw Error('Missing table '+name);return match[0];}
const uid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const baby=n=>`10000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const actor=(n,q)=>`set role authenticated; set request.jwt.claim.sub='${uid(n)}'; ${q}`;
function check(label,n,q,expected){const got=sql(actor(n,q));if(got!==expected)throw Error(`${label}: expected ${expected}, got ${got}`);console.log('CONFIRMED '+label);}
let started=false;
try {
 run('initdb',['-D',data,'--auth=trust','--no-locale','-E','UTF8']);
 run('pg_ctl',['-D',data,'-l',join(work,'postgres.log'),'-o',`-k ${socket} -p 55442 -F -c listen_addresses=`,'-w','start']);started=true;
 sql(readFileSync('scripts/fixtures/b04a-p0-local-bootstrap.sql','utf8'));
 sql(`create type member_status as enum ('active','pending','inactive');
 alter table baby_members alter column status drop default;
 alter table baby_members alter column status type member_status using status::member_status;
 alter table baby_members alter column status set default 'active';
 alter table profiles add column darin_id text;
 alter table memory_posts add column privacy_type text not null default 'family_circle',add column status text not null default 'published',add column caption text,add column created_at timestamptz not null default now(),add column updated_at timestamptz default now();
 insert into profiles(id,display_name,darin_id) values ('${uid(6)}','Viewer','viewer'),('${uid(7)}','Receiver7','recv7');
 update profiles set darin_id='recv'||right(id::text,1);
 insert into baby_members(baby_id,user_id,permission_role) values ('${baby(1)}','${uid(5)}','editor'),('${baby(2)}','${uid(5)}','editor'),('${baby(1)}','${uid(6)}','viewer');`);
 sql(table('care_logs','202607250001_care_logs_slice.sql'));
 sql(table('diary_entries','202608030001_diary_vertical_slice.sql'));
 sql(table('memory_tags','202607310002_memories_foundation.sql'));
 sql(table('memory_selected_people','202607310002_memories_foundation.sql'));
 sql(table('darin_invite_requests','202608160001_darin_id_invite_requests.sql'));
 sql(`alter table darin_invite_requests add column expires_at timestamptz not null default now()+interval '30 days';
 create unique index darin_invite_requests_pending_uidx on darin_invite_requests(baby_id,sender_id,receiver_id,request_type) where status='pending';
 create table notification_events(recipient_id uuid,actor_id uuid,baby_id uuid,event_type text,title text,body text,data jsonb,dedupe_key text,status text,read_at timestamptz,created_at timestamptz default now());
 create unique index notification_events_dedupe on notification_events(recipient_id,dedupe_key) where dedupe_key is not null;`);
 const names=['baby_permission','is_baby_member','is_memory_friend','can_edit_care_logs','care_log_creator_unchanged','can_create_diary_entry','can_manage_diary_entry','can_view_diary_entry','can_manage_memory_post','can_delete_memory_post','can_view_memory_post','baby_member_role_guard','diary_entry_identity_unchanged','memory_post_identity_unchanged','soft_delete_diary_entry','soft_delete_memory_post','send_darin_id_invite_request','respond_darin_id_invite_request'];
 for(const n of names){const f=catalog.functions.find(f=>f.proname===n);if(!f)throw Error('Missing function '+n);sql(f.definition);}
 const ts=['baby_members','care_logs','diary_entries','memory_posts','memory_tags','memory_selected_people','darin_invite_requests'];
 for(const t of ts){sql(`alter table public.${t} enable row level security;`);for(const p of catalog.policies.filter(p=>p.tablename===t))sql(`create policy ${p.policyname} on public.${t} for ${p.cmd} to ${p.roles.join(',')} ${p.qual?'using ('+p.qual+')':''} ${p.with_check?'with check ('+p.with_check+')':''};`);}
 for(const n of ['baby_members_role_guard','diary_entries_identity_unchanged','memory_posts_identity_unchanged'])sql(catalog.triggers.find(t=>t.tgname===n).definition);
 sql('grant select,insert,update,delete on all tables in schema public to authenticated;');
 sql(`insert into care_logs(id,baby_id,created_by,category,recorded_at,date_key,time_local,payload,source) values ('${uid(101)}','${baby(1)}','${uid(1)}','feeding',now(),'2026-09-14','10:00','{}','manual');
 insert into diary_entries(id,baby_id,author_id,entry_date,body) values ('${uid(102)}','${baby(1)}','${uid(5)}',current_date,'synthetic');`);
 check('P1-1 editor updates another author Care row by ID',5,`with x as(update care_logs set payload='{"synthetic":true}' where id='${uid(101)}' returning id) select count(*) from x;`,'1');
 check('P1-1 editor moves Care row between two authorized babies',5,`with x as(update care_logs set baby_id='${baby(2)}' where id='${uid(101)}' returning id) select count(*) from x;`,'1');
 sql(`update care_logs set baby_id='${baby(1)}' where id='${uid(101)}';`);
 check('positive viewer reads Care row',6,`select count(*) from care_logs where id='${uid(101)}';`,'1');
 check('viewer Care update denied',6,`with x as(update care_logs set payload='{}' where id='${uid(101)}' returning id) select count(*) from x;`,'0');
 check('unrelated direct-ID Care read denied',2,`select count(*) from care_logs where id='${uid(101)}';`,'0');
 check('P1-1 editor deletes another author Care row by ID',5,`with x as(delete from care_logs where id='${uid(101)}' returning id) select count(*) from x;`,'1');
 sql(`update memory_posts set status='posting' where id='20000000-0000-4000-8000-000000000001';`);
 check('P1-4 viewer reads posting Memory before publish',6,`select count(*) from memory_posts where id='20000000-0000-4000-8000-000000000001';`,'1');
 check('unrelated family-only Memory read denied',2,`select count(*) from memory_posts where id='20000000-0000-4000-8000-000000000001';`,'0');
 sql(`update memory_posts set status='published',privacy_type='tagged_family' where id='20000000-0000-4000-8000-000000000001';`);
 check('P1-5 admin can tag unrelated profile as family',1,`with x as(insert into memory_tags(memory_post_id,tag_type,tagged_user_id,created_by) values ('20000000-0000-4000-8000-000000000001','family_member','${uid(2)}','${uid(1)}') returning id) select count(*) from x;`,'1');
 check('P1-5 unrelated tagged account reads tagged_family Memory',2,`select count(*) from memory_posts where id='20000000-0000-4000-8000-000000000001';`,'1');
 sql(`delete from baby_members where baby_id='${baby(1)}' and user_id='${uid(5)}';`);
 check('removed author Diary SELECT denied',5,`select count(*) from diary_entries where id='${uid(102)}';`,'0');
 sql(actor(5,`select public.soft_delete_diary_entry('${uid(102)}');`));
 if(sql(`select (deleted_at is not null)::text from diary_entries where id='${uid(102)}';`)!=='true')throw Error('Diary probe failed');
 console.log('CONFIRMED P1-3 removed author Diary soft-delete RPC succeeds');
 sql(`insert into memory_posts(id,baby_id,author_id,privacy_type) values ('${uid(103)}','${baby(1)}','${uid(5)}','only_me');`);
 check('P1-3 removed author reads only_me Memory',5,`select count(*) from memory_posts where id='${uid(103)}';`,'1');
 sql(actor(5,`select public.soft_delete_memory_post('${uid(103)}');`));
 if(sql(`select (deleted_at is not null)::text from memory_posts where id='${uid(103)}';`)!=='true')throw Error('Memory probe failed');
 console.log('CONFIRMED P1-3 removed author Memory soft-delete RPC succeeds');
 // Use the actual current sender RPC, then remove its authority before acceptance.
 const request=sql(actor(1,`select request_id from send_darin_id_invite_request('${baby(1)}','recv7','family','admin','가족');`));
 sql(`insert into baby_members(baby_id,user_id,permission_role) values ('${baby(1)}','${uid(4)}','admin');`);
 sql(actor(4,`update baby_members set permission_role='viewer' where baby_id='${baby(1)}' and user_id='${uid(1)}';`));
 sql(actor(7,`select * from respond_darin_id_invite_request('${request}',true);`));
 if(sql(`select permission_role from baby_members where baby_id='${baby(1)}' and user_id='${uid(7)}';`)!=='admin')throw Error('ID invite probe failed');
 console.log('CONFIRMED P1-8 targeted invite issued by valid admin still grants admin after issuer demotion');
 console.log('Audit reproduction completed; authorization fixes applied=0; remote mutations=0. Notification side effects use a local sink only; no Edge delivery tested.');
} finally {
 if(started)run('pg_ctl',['-D',data,'-m','fast','-w','stop']);
 rmSync(work,{recursive:true,force:true});
}
