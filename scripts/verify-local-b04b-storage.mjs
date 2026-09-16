// Real Storage API + disposable Postgres. No remote credentials or endpoints.
import { spawn, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createHmac, randomBytes } from 'node:crypto';
import assert from 'node:assert/strict';
const prefix = `darin-b04b-${process.pid}`;
const db = `${prefix}-db`, api = `${prefix}-api`, network = `${prefix}-net`;
const secret = randomBytes(40).toString('hex');
const password = randomBytes(24).toString('hex');
const read = (p) => readFileSync(p, 'utf8');
const migration = (name) => read(`supabase/migrations/${name}.sql`);
function docker(args, input) {
  const r = spawnSync('docker', args, { input, encoding:'utf8', maxBuffer: 16*1024*1024 });
  if(r.status) throw new Error(`docker ${args[0]} failed: ${r.stderr.slice(-2500)}`);
  return r.stdout.trim();
}
const sql = (s) => docker(['exec','-i',db,'psql','-h','127.0.0.1','-X','-U','postgres','-At','-v','ON_ERROR_STOP=1'],s);
const sqlAsync = (s) => new Promise((resolve,reject) => {
  const child=spawn('docker',['exec','-i',db,'psql','-h','127.0.0.1','-X','-U','postgres','-At','-v','ON_ERROR_STOP=1'],
    {stdio:['pipe','pipe','pipe']});
  let stdout='',stderr='';
  child.stdout.on('data',chunk=>{stdout+=chunk;});
  child.stderr.on('data',chunk=>{stderr+=chunk;});
  child.on('exit',code=>code===0?resolve(stdout.trim()):reject(new Error(stderr.slice(-2500))));
  child.stdin.end(s);
});
const asUser = (id,s) => sql(`begin; set local role authenticated; select set_config('request.jwt.claim.sub','${id}',true); ${s}; commit;`);
const uid = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const baby = n => `10000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const post = n => `20000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const mid = n => `30000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const temp = n => `${baby(1)}/temp/40000000-0000-4000-8000-000000000001/${mid(n)}.jpg`;
const owner=uid(4), other=uid(7), viewer=uid(5), friend=uid(3), outsider=uid(8), removed=uid(6), admin=uid(1);
function token(role, sub) {
  const encode = v => Buffer.from(JSON.stringify(v)).toString('base64url');
  const data=`${encode({alg:'HS256',typ:'JWT'})}.${encode({role,sub,iss:'supabase',exp:Math.floor(Date.now()/1000)+3600})}`;
  return `${data}.${createHmac('sha256',secret).update(data).digest('base64url')}`;
}
let apiWorker;
let replyBuffer='';
const replies=[];
function startApiWorker() {
  apiWorker=spawn('docker',['exec','-i',api,'node','-e',`
    const rl=require('node:readline').createInterface({input:process.stdin});
    rl.on('line',async line=>{try{const x=JSON.parse(line);
      const r=await fetch('http://127.0.0.1:5000'+x.path,{method:x.method,headers:x.headers,
        body:x.body ? Buffer.from(x.body,'base64'):undefined});const text=await r.text();let json;try{json=JSON.parse(text)}catch{}
      process.stdout.write(JSON.stringify({status:r.status,text,json})+'\\n');
    }catch{process.stdout.write(JSON.stringify({status:503,text:'local startup unavailable'})+'\\n');}});
  `],{stdio:['pipe','pipe','pipe']});
  apiWorker.stdout.on('data',chunk=>{
    replyBuffer+=chunk;
    while(replyBuffer.includes('\n')) {const i=replyBuffer.indexOf('\n'),line=replyBuffer.slice(0,i);replyBuffer=replyBuffer.slice(i+1);replies.shift()?.resolve(JSON.parse(line));}
  });
  apiWorker.on('error',error=>{while(replies.length)replies.shift().reject(error);});
  apiWorker.on('exit',()=>{while(replies.length)replies.shift().reject(new Error('local API worker stopped'));});
}
async function request(method,path,actor,body,extra={}) {
  return new Promise((resolve,reject)=>{replies.push({resolve,reject});apiWorker.stdin.write(JSON.stringify({method,path,headers:{Authorization:`Bearer ${token('authenticated',actor)}`,
    ...(body && !Buffer.isBuffer(body) ? {'Content-Type':'application/json'}:{}),...extra},
    body:body ? (Buffer.isBuffer(body)?body:Buffer.from(JSON.stringify(body))).toString('base64'):undefined})+'\n');});
}
const jpg=Buffer.from([0xff,0xd8,0xff,0xe0,0x00,0x10,0x4a,0x46,0x49,0x46,0xff,0xd9]);
const upload=(path,actor=owner,bucket='memories',headers={})=>request('POST',`/object/${bucket}/${path}`,actor,jpg,{'Content-Type':'image/jpeg',...headers});
async function gatewaySign(kind,resourceId,actor,width) {
  const raw=asUser(actor,`select coalesce((select row_to_json(r)::text from resolve_private_media_for_signing('${kind}','${resourceId}') r),'null')`);
  const jsonLine=raw.split('\n').find(line=>line==='null' || line.startsWith('{')) ?? 'null';
  const resolved=JSON.parse(jsonLine);
  if(!resolved) return {status:404,text:'MEDIA_NOT_FOUND'};
  const body={expiresIn:resolved.expires_in,...(width?{transform:{width,quality:75,resize:'contain'}}:{})};
  return request('POST',`/object/sign/${resolved.bucket_id}/${resolved.storage_path}`,actor,body,{Authorization:`Bearer ${token('service_role')}`});
}
let passes=0;
function pass(label){passes++;console.log(`PASS ${label}`);}
function ok(result,label){assert.equal(result.status,200,`${label}: ${result.status} ${result.text.slice(0,350)}`);pass(label);}
function denied(result,label){assert.ok(result.status>=400,`${label}: unexpectedly ${result.status}`);pass(label);}
const denySql=(label,actor,statement)=>{assert.throws(()=>asUser(actor,statement));pass(label);};
let madeNetwork=false, madeDb=false, madeApi=false;
try {
  docker(['network','create','--internal',network]);madeNetwork=true;
  docker(['run','-d','--name',db,'--network',network,'--tmpfs','/var/lib/postgresql/data',
    '-e',`POSTGRES_PASSWORD=${password}`,'postgres:16-alpine']);madeDb=true;
  for(let i=0;i<50;i++){try{sql('select 1');break;}catch{if(i===49)throw new Error('postgres startup failed');await new Promise(r=>setTimeout(r,200));}}
  sql(read('scripts/fixtures/b04a-p0-local-bootstrap.sql'));
  sql('create role anon nologin; create role service_role nologin bypassrls; create role supabase_storage_admin login superuser;');
  sql(read('scripts/fixtures/b04a-p1-ownership-visibility-local-bootstrap.sql'));
  const final=read('scripts/fixtures/b04a-final-authorization-local-bootstrap.sql');
  sql(final.slice(0,final.indexOf('create table public.diary_entries')));
  sql(final.slice(final.indexOf('create table public.growth_books'),final.indexOf('-- Minimal friend-visible memory graph')));
  sql(final.slice(final.indexOf('alter table public.growth_books enable row level security;')));
  sql(`alter table diary_entries add unique(id,baby_id);
    create table notification_events(id uuid,actor_id uuid,recipient_id uuid);
    create table push_tokens(user_id uuid); create table notification_settings(user_id uuid); create table contact_requests(user_id uuid);
    create table diary_media(id uuid primary key,diary_entry_id uuid,baby_id uuid,storage_path text unique,upload_status text default 'ready');
    create table baby_stickers(
      id uuid primary key,
      baby_id uuid not null,
      created_by uuid,
      storage_path text not null unique,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      deleted_at timestamptz,
      check (split_part(storage_path,'/',1)=baby_id::text and split_part(storage_path,'/',2)=id::text||'.png')
    );
    create function public.baby_sticker_identity_unchanged() returns trigger language plpgsql as $$
    begin
      if new.id<>old.id or new.baby_id<>old.baby_id or new.created_by is distinct from old.created_by
        or new.storage_path<>old.storage_path or new.created_at<>old.created_at then
        raise exception 'baby sticker identity columns are immutable';
      end if;
      return new;
    end$$;
    create trigger baby_stickers_identity_unchanged before update on baby_stickers
      for each row execute function public.baby_sticker_identity_unchanged();
    create or replace function auth.uid() returns uuid language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid$$;
    create function auth.role() returns text language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'role',current_user)$$;
    create function public.can_edit_care_logs(uuid) returns boolean language sql as $$select public.baby_permission($1) in ('admin','editor')$$;
    create function public.can_view_diary_entry(uuid) returns boolean language sql security definer set search_path=public as $$ select exists(select 1 from diary_entries where id=$1 and deleted_at is null and is_baby_member(baby_id)) $$;
    create function public.can_view_baby_sticker(uuid) returns boolean language sql security definer set search_path=public as $$select exists(select 1 from baby_stickers where id=$1 and deleted_at is null and is_baby_member(baby_id))$$;
  `);
  for(const file of ['202609140001_b04a_p0_authorization_hotfix','202609140003_b04a_p1_ownership_lifecycle',
    '202609140004_b04a_p1_memory_visibility_social','202609140005_b04a_p1_memory_recipient_assignment']) sql(migration(file));
  // Actual B0.4a helpers, not simplified authorization approximations.
  const vis=migration('202609140004_b04a_p1_memory_visibility_social');
  assert.ok(vis.includes('can_view_memory_post'));
  const projection=migration('202609150006_b04a_p1_profile_baby_authorization');
  const friendScope=migration('202608260001_friend_memory_ui_scope');
  sql(friendScope.slice(friendScope.indexOf('create or replace function public.has_friend_visible_memory'),friendScope.indexOf('create or replace function public.list_my_friend_memory_contexts')));
  sql(projection);
  sql(migration('202609150007_b04a_p1_growthbook_caution_authorization'));
  sql(`delete from memory_media; insert into profiles(id,display_name) values ('${owner}','owner'),('${removed}','removed'),('${other}','other'),('${outsider}','outsider') on conflict(id) do nothing;
    insert into auth.users(id) select id from profiles;
    insert into baby_members(baby_id,user_id,permission_role,status) values
    ('${baby(1)}','${owner}','editor','active'),('${baby(2)}','${owner}','editor','active'),
    ('${baby(1)}','${other}','editor','active'),('${baby(1)}','${viewer}','viewer','active'),('${baby(1)}','${removed}','editor','inactive');
    insert into memory_friends(baby_id,user_id,invited_by,status) values('${baby(1)}','${friend}','${admin}','active');
    insert into memory_posts(id,baby_id,author_id,privacy_type,status) values
    ('${post(3)}','${baby(1)}','${owner}','only_me','published'),
    ('${post(4)}','${baby(1)}','${other}','family_circle','published'),
    ('${post(5)}','${baby(2)}','${owner}','family_circle','published');
    grant usage on schema auth,public to anon,service_role;
    grant select,insert,update,delete on all tables in schema public to authenticated;
  `);
  const environment={DATABASE_URL:`postgresql://postgres:${password}@${db}:5432/postgres`,
    AUTH_JWT_SECRET:secret, ANON_KEY:token('anon'),SERVICE_KEY:token('service_role'),
    POSTGREST_URL:'http://127.0.0.1:1',STORAGE_BACKEND:'file',FILE_STORAGE_BACKEND_PATH:'/var/lib/storage',
    TENANT_ID:'b04b-local',REGION:'local',GLOBAL_S3_BUCKET:'local',FILE_SIZE_LIMIT:'26214400',
    ENABLE_IMAGE_TRANSFORMATION:'false',STORAGE_PUBLIC_URL:'http://127.0.0.1',LOG_LEVEL:'error'};
  docker(['run','-d','--name',api,'--network',network,'-p','127.0.0.1::5000','--tmpfs','/var/lib/storage',
    ...Object.entries(environment).flatMap(([k,v])=>['-e',`${k}=${v}`]),'supabase/storage-api@sha256:f1546fac6d1c7e345428ac904bfaa7be7cecd50a1f549fe1cf38c628a7b15c85']);madeApi=true;
  startApiWorker();
  for(let i=0;i<100;i++){try{if((await request('GET','/status',owner)).status===200)break;}catch{}if(i===99)throw new Error('storage startup failed');await new Promise(r=>setTimeout(r,300));}
  sql(`grant usage on schema storage to authenticated,anon,service_role; grant select,insert,update,delete on storage.objects to authenticated;
    grant all on all tables in schema storage to service_role; grant all on all sequences in schema storage to service_role;
    grant execute on all functions in schema storage to authenticated,anon,service_role; grant select on storage.buckets to authenticated;`);
  const profile=migration('202608070001_profile_settings_v1');
  sql(profile.slice(profile.indexOf('insert into storage.buckets')));
  const growth=migration('202608030002_growth_book_vertical_slice');
  sql(growth.slice(growth.indexOf('insert into storage.buckets')));
  const stickers=migration('202608060001_memories_v2b');
  sql(stickers.slice(stickers.indexOf('insert into storage.buckets'),stickers.indexOf('grant select, insert, update, delete on table public.memory_friends')));
  sql(`insert into storage.buckets(id,name,public,file_size_limit) values('memories','memories',false,26214400),('diary-media','diary-media',false,26214400);`);
  sql(migration('202608180001_eager_media_uploads'));
  sql(migration('202609010001_eager_media_temp_path_constraints'));
  // Storage bootstrap is loaded after the B0.4a fixtures. Restore the exact
  // deployed DB policy precedence rather than letting the historical eager
  // migration shadow the later P0 composite-parent UPDATE protection.
  const p0=migration('202609140001_b04a_p0_authorization_hotfix');
  sql(p0.slice(p0.indexOf('drop policy if exists memory_media_select_visible')));
  const growthPolicy=migration('202608030003_growth_book_policy_hardening');
  sql(growthPolicy.slice(growthPolicy.indexOf('drop policy if exists growth_book_media_objects_delete_editor')));
  const diary=migration('202608030001_diary_vertical_slice');
  sql(diary.slice(diary.indexOf('drop policy if exists diary_media_select_member'),diary.indexOf('-- Private object names:')));
  sql('alter table diary_media enable row level security');
  sql(stickers.slice(stickers.indexOf('create or replace function public.can_view_baby_sticker'),stickers.indexOf('create or replace function public.can_use_baby_sticker_on_post')));
  ok(await upload(temp(1)),'baseline owner upload');
  ok(await request('GET',`/object/authenticated/memories/${temp(1)}`,other),'REPRO baseline other editor downloads temp');
  asUser(other,`insert into memory_media(id,memory_post_id,baby_id,storage_path) values('${mid(1)}','${post(4)}','${baby(1)}','${temp(1)}')`);
  pass('REPRO baseline other editor claims temp');
  sql('delete from memory_media');
  sql(migration('202609150008_b04b_storage_boundary'));
  sql(migration('202609150009_b04b_storage_cleanup_queue'));
  sql(migration('202609150010_b04b_storage_fk_cleanup_compatibility'));
  for(const actor of [other,viewer,friend,outsider,removed]) {
    denied(await request('GET',`/object/authenticated/memories/${temp(1)}`,actor),`temp read denied ${actor.slice(-1)}`);
    denied(await upload(temp(1),actor,'memories',{'x-upsert':'true'}),`temp overwrite denied ${actor.slice(-1)}`);
    const listing=await request('POST','/object/list/memories',actor,{prefix:`${baby(1)}/temp/`,limit:100,offset:0});
    ok(listing,`list request ${actor.slice(-1)}`);assert.equal(listing.json.length,0);pass('no temp listing leak');
    denied(await request('POST',`/object/sign/memories/${temp(1)}`,actor,{expiresIn:180}),'unauthorized temp sign denied');
    await request('DELETE','/object/memories',actor,{prefixes:[temp(1)]});
    assert.equal(sql(`select count(*) from storage.objects where bucket_id='memories' and name='${temp(1)}'`),'1');pass('unauthorized temp remove unchanged');
  }
  denySql('cross-user claim denied',other,`insert into memory_media(id,memory_post_id,baby_id,storage_path) values('${mid(1)}','${post(4)}','${baby(1)}','${temp(1)}')`);
  denySql('cross-baby claim denied even dual member',owner,`insert into memory_media(id,memory_post_id,baby_id,storage_path) values('${mid(1)}','${post(5)}','${baby(2)}','${temp(1)}')`);
  denySql('missing upload readiness denied',owner,`insert into memory_media(id,memory_post_id,baby_id,storage_path) values('${mid(2)}','${post(3)}','${baby(1)}','${temp(2)}')`);
  asUser(owner,`insert into memory_media(id,memory_post_id,baby_id,storage_path) values('${mid(1)}','${post(3)}','${baby(1)}','${temp(1)}')`);pass('owner finalize');
  denied(await request('GET',`/object/authenticated/memories/${temp(1)}`,owner),'native authenticated download disabled');
  denied(await request('GET',`/object/authenticated/memories/${temp(1)}`,other),'only_me parent inherited');
  denied(await request('POST',`/object/sign/memories/${temp(1)}`,owner,{expiresIn:31536000}),'native long-lived signing disabled');
  const ownerSigned=await gatewaySign('memory_media',mid(1),owner,800);ok(ownerSigned,'server-owned owner signed URL');
  ok(await request('GET',ownerSigned.json.signedURL,outsider),'server-owned signed bearer works');
  denied(await request('POST','/object/move',other,{bucketId:'memories',sourceKey:temp(1),destinationKey:temp(8)}),'cross-user move');
  denied(await request('POST','/object/copy',other,{bucketId:'memories',sourceKey:temp(1),destinationKey:temp(8)}),'cross-user copy');
  asUser(owner,`update memory_posts set privacy_type='friend_circle' where id='${post(3)}'`);
  const signed=await gatewaySign('memory_media',mid(1),friend);ok(signed,'friend server signing before reduction');
  asUser(owner,`update memory_posts set privacy_type='family_circle' where id='${post(3)}'`);
  denied(await gatewaySign('memory_media',mid(1),friend),'friend family-only new sign denied');
  ok(await request('GET',signed.json.signedURL,outsider),'documented existing signed bearer survives permission reduction');
  denied(await request('GET',`/object/public/memories/${temp(1)}`,outsider),'private bucket public URL denied');
  sql(`update baby_members set status='inactive' where baby_id='${baby(1)}' and user_id='${owner}'`);
  denied(await gatewaySign('memory_media',mid(1),owner),'removed uploader new sign denied');
  sql(`update baby_members set status='active' where baby_id='${baby(1)}' and user_id='${owner}'`);
  asUser(owner,`delete from memory_media where id='${mid(1)}'`);
  denied(await request('GET',`/object/authenticated/memories/${temp(1)}`,owner),'DB delete does not resurrect temp read');
  await request('DELETE','/object/memories',owner,{prefixes:[temp(1)]});
  assert.equal(sql(`select count(*) from storage.objects where bucket_id='memories' and name='${temp(1)}'`),'1');pass('retired object requires cleanup worker');
  denySql('user cannot claim global cleanup',owner,'select * from claim_media_cleanup(null,50)');
  const intent=JSON.parse(sql(`select row_to_json(q) from claim_media_cleanup('${owner}',50) q`));
  assert.equal(intent.storage_path,temp(1));pass('durable authorized deletion intent');
  ok(await request('DELETE','/object/memories',owner,{prefixes:[intent.storage_path]},{Authorization:`Bearer ${token('service_role')}`}),'Storage API worker cleanup');
  assert.equal(sql(`select finish_media_cleanup('${intent.bucket_id}','${intent.storage_path}','${intent.lease_id}')`),'t');pass('worker acknowledgement');
  assert.equal(sql(`select count(*) from storage.objects where bucket_id='memories' and name='${temp(1)}'`),'0');pass('delete metadata confirmed');
  denied(await upload(temp(1)),'claimed key cannot be recreated');
  ok(await upload(temp(9)),'new temp upload');
  sql(`update storage.objects set created_at=now()-interval '25 hours' where name='${temp(9)}'`);
  denySql('expired temp cannot attach',owner,`insert into memory_media(id,memory_post_id,baby_id,storage_path) values('${mid(9)}','${post(3)}','${baby(1)}','${temp(9)}')`);
  denySql('global metadata cleanup RPC denied',owner,'select cleanup_orphan_temp_media()');
  assert.equal(sql(`select count(*) from storage.objects where name='${temp(9)}'`),'1');pass('cleanup cannot race-delete active bytes');
  assert.equal(sql('select queue_expired_temp_media(100)'),'1');pass('service queues only expired unreferenced object');
  assert.equal(sql(`select count(*) from storage.objects where name='${temp(9)}'`),'1');pass('sweep never deletes metadata directly');
  denied(await upload(`${baby(1)}/temp/40000000-0000-4000-8000-000000000001/bad%252fname.jpg`),'encoded key denied');
  denied(await request('POST',`/object/memories/${temp(10)}`,owner,Buffer.from('<html/>'),{'Content-Type':'text/html'}),'MIME allow-list enforced');
  const oversized=await request('POST',`/object/memories/${temp(10)}`,owner,Buffer.alloc(26214401),{'Content-Type':'image/jpeg'});
  denied(oversized,'bucket size enforced');

  // Additional resource categories, all seven actors at the actual API boundary.
  const did='60000000-0000-4000-8000-000000000001';
  const bid='a0000000-0000-4000-8000-000000000001';
  const pid='b0000000-0000-4000-8000-000000000001';
  const dpath=temp(20), gpath=`${baby(1)}/${bid}/${pid}/${mid(21)}.jpg`;
  const ppath=`users/${owner}/avatar.jpg`, bpath=`babies/${baby(1)}/avatar.jpg`;
  const spath=`${baby(1)}/${mid(22)}.png`;
  sql(`insert into diary_entries(id,baby_id,author_id,entry_date) values('${did}','${baby(1)}','${owner}',current_date);
    insert into growth_books(id,baby_id,created_by) values('${bid}','${baby(1)}','${owner}');
    insert into growth_book_pages(id,growth_book_id,baby_id,created_by) values('${pid}','${bid}','${baby(1)}','${owner}');`);
  ok(await upload(dpath,owner,'diary-media'),'diary upload');
  asUser(owner,`insert into diary_media(id,diary_entry_id,baby_id,storage_path) values('${mid(20)}','${did}','${baby(1)}','${dpath}')`);pass('diary finalize');
  ok(await upload(gpath,owner,'growth-book-media'),'growthbook upload');
  asUser(owner,`insert into growth_book_media(id,growth_book_id,page_id,baby_id,created_by,storage_path) values('${mid(21)}','${bid}','${pid}','${baby(1)}','${owner}','${gpath}')`);pass('growthbook finalize');
  ok(await upload(ppath,owner,'profile-media'),'profile upload');
  ok(await upload(bpath,owner,'profile-media'),'baby avatar upload');
  sql(`update profiles set avatar_storage_path='${ppath}' where id='${owner}';update babies set avatar_storage_path='${bpath}' where id='${baby(1)}';`);
  ok(await request('POST',`/object/baby-stickers/${spath}`,owner,jpg,{'Content-Type':'image/png'}),'sticker upload');
  sql(`insert into baby_stickers(id,baby_id,storage_path) values('${mid(22)}','${baby(1)}','${spath}')`);
  const ppath2=`users/${owner}/${mid(30)}.jpg`,bpath2=`babies/${baby(1)}/${mid(31)}.jpg`,spath2=`${baby(1)}/${mid(32)}.png`;
  ok(await upload(ppath2,owner,'profile-media'),'profile replacement uses immutable key');
  sql(`update profiles set avatar_storage_path='${ppath2}' where id='${owner}'`);
  assert.equal(sql(`select avatar_storage_path='${ppath2}' from profiles where id='${owner}'`),'t');
  assert.equal(sql(`select count(*) from media_cleanup_queue where bucket_id='profile-media' and storage_path='${ppath}'`),'1');pass('old profile avatar queued');
  ok(await upload(bpath2,owner,'profile-media'),'baby avatar replacement uses immutable key');
  sql(`update babies set avatar_storage_path='${bpath2}' where id='${baby(1)}'`);
  assert.equal(sql(`select count(*) from media_cleanup_queue where bucket_id='profile-media' and storage_path='${bpath}'`),'1');pass('old baby avatar queued');
  ok(await request('POST',`/object/baby-stickers/${spath2}`,owner,jpg,{'Content-Type':'image/png'}),'sticker replacement uses immutable key');
  asUser(owner,`update baby_stickers set storage_path='${spath2}' where id='${mid(22)}'`);
  assert.equal(sql(`select count(*) from media_cleanup_queue where bucket_id='baby-stickers' and storage_path='${spath}'`),'1');pass('old sticker queued');
  sql(`update media_cleanup_queue set state='done',completed_at=now() where storage_path in ('${ppath}','${bpath}','${spath}')`);
  const activePaths={profile_avatar:ppath2,baby_avatar:bpath2,baby_sticker:spath2};
  for (const [bucket,path] of [['profile-media',ppath2],['profile-media',bpath2],['growth-book-media',gpath],['baby-stickers',spath2]]) {
    assert.ok(asUser(other,`select retire_unattached_storage_upload('${bucket}','${path}')`).split('\n').includes('f'));
    pass(`${bucket} active reference cannot be retired`);
  }
  assert.throws(() => sql(`update profiles set avatar_storage_path='${ppath}' where id='${owner}'`));
  pass('retired profile avatar cannot be reattached');
  sql(`insert into media_cleanup_queue(bucket_id,storage_path,requested_by)
    values('profile-media','${ppath2}','${removed}') on conflict do nothing`);
  assert.equal(sql(`select count(*) from claim_media_cleanup('${removed}',10)`),'0');pass('worker lease rechecks active reference');
  sql(`delete from media_cleanup_queue where bucket_id='profile-media' and storage_path='${ppath2}'`);
  for(const [bucket,path,kind,id] of [
    ['diary-media',dpath,'diary_media',mid(20)],
    ['growth-book-media',gpath,'growth_book_media',mid(21)],
    ['profile-media',activePaths.profile_avatar,'profile_avatar',owner],
    ['profile-media',activePaths.baby_avatar,'baby_avatar',baby(1)],
    ['baby-stickers',activePaths.baby_sticker,'baby_sticker',mid(22)],
  ]) {
    ok(await gatewaySign(kind,id,owner),`${bucket} owner signs through server`);
    for(const actor of [admin,owner,other,viewer]) {
      denied(await request('GET',`/object/authenticated/${bucket}/${path}`,actor),`${bucket} native read disabled ${actor.slice(-1)}`);
      ok(await gatewaySign(kind,id,actor),`${bucket} authorized server sign ${actor.slice(-1)}`);
    }
    for(const actor of [outsider,removed,friend]) denied(await gatewaySign(kind,id,actor),`${bucket} unauthorized ${actor.slice(-1)} sign`);
    await request('DELETE',`/object/${bucket}`,viewer,{prefixes:[path]});
    assert.equal(sql(`select count(*) from storage.objects where bucket_id='${bucket}' and name='${path}'`),'1');pass(`${bucket} viewer delete unchanged`);
  }
  asUser(owner,`update baby_stickers set deleted_at=now() where id='${mid(22)}'`);
  assert.equal(sql(`select count(*) from media_cleanup_queue where bucket_id='baby-stickers' and storage_path='${spath2}'`),'1');
  pass('soft-deleted sticker queues immutable bytes');
  denied(await gatewaySign('baby_sticker',mid(22),owner),'soft-deleted sticker cannot be signed');
  asUser(owner,`update memory_posts set privacy_type='friend_circle' where id='${post(3)}'`);
  ok(await gatewaySign('profile_avatar',owner,friend),'friend-visible contributor avatar');
  ok(await gatewaySign('baby_avatar',baby(1),friend),'friend-visible baby avatar');
  asUser(owner,`update memory_posts set privacy_type='only_me' where id='${post(3)}'`);
  denied(await gatewaySign('profile_avatar',owner,friend),'avatar permission revoked with last shared resource');
  // Byte-first direct authorized deletion cannot manufacture readiness afterwards.
  await request('DELETE','/object/diary-media',owner,{prefixes:[dpath]});
  assert.equal(sql(`select count(*) from storage.objects where bucket_id='diary-media' and name='${dpath}'`),'1');pass('direct client byte deletion disabled');
  ok(await request('DELETE','/object/diary-media',owner,{prefixes:[dpath]},{Authorization:`Bearer ${token('service_role')}`}),'synthetic service-side byte loss');
  assert.equal(sql(`select count(*) from storage.objects where bucket_id='diary-media' and name='${dpath}'`),'0');
  denySql('missing object cannot be marked ready',owner,`update diary_media set upload_status='ready' where id='${mid(20)}'`);
  // Deterministic upload acknowledgement failure leaves an inaccessible orphan.
  const unlinked=`${baby(1)}/${post(3)}/${mid(23)}.jpg`;
  ok(await upload(unlinked),'final upload before DB');
  denied(await request('GET',`/object/authenticated/memories/${unlinked}`,other),'DB failure orphan not readable by other editor');
  // Cleanup lease expiry permits idempotent retry, not key reuse or early ack.
  const leaseProbe=`${baby(2)}/${post(5)}/${mid(99)}.jpg`;
  sql(`insert into media_cleanup_queue(bucket_id,storage_path,requested_by)
    values('memories','${leaseProbe}','${outsider}') on conflict do nothing`);
  const lease1=JSON.parse(sql(`select row_to_json(q) from claim_media_cleanup('${outsider}',1) q`));
  assert.equal(sql(`select count(*) from claim_media_cleanup('${outsider}',1)`),'0');pass('leased cleanup deduped');
  sql(`update media_cleanup_queue set lease_until=now()-interval '1 second' where lease_id='${lease1.lease_id}'`);
  const lease2=JSON.parse(sql(`select row_to_json(q) from claim_media_cleanup('${outsider}',1) q`));
  assert.notEqual(lease1.lease_id,lease2.lease_id);pass('expired lease safely retried');
  assert.equal(sql(`select finish_media_cleanup('${lease1.bucket_id}','${lease1.storage_path}','${lease1.lease_id}')`),'f');pass('stale worker cannot acknowledge current lease');
  ok(await upload(temp(41)),'visibility matrix upload');
  asUser(owner,`insert into memory_media(id,memory_post_id,baby_id,storage_path) values('${mid(41)}','${post(3)}','${baby(1)}','${temp(41)}');
    update memory_posts set privacy_type='selected_people' where id='${post(3)}';
    insert into memory_selected_people(memory_post_id,user_id) values('${post(3)}','${viewer}')`);
  ok(await gatewaySign('memory_media',mid(41),viewer),'selected recipient server sign');
  denied(await gatewaySign('memory_media',mid(41),other),'nonselected editor server sign denied');
  asUser(owner,`delete from memory_selected_people where memory_post_id='${post(3)}' and user_id='${viewer}'`);
  denied(await gatewaySign('memory_media',mid(41),viewer),'reduced selected list new sign denied');
  asUser(owner,`update memory_posts set privacy_type='tagged_family' where id='${post(3)}';
    insert into memory_tags(memory_post_id,tag_type,baby_id,tagged_user_id,created_by,status) values('${post(3)}','family_member','${baby(1)}','${viewer}','${owner}','approved')`);
  ok(await gatewaySign('memory_media',mid(41),viewer),'tagged current family member server sign');
  sql(`insert into memory_tags(memory_post_id,tag_type,baby_id,tagged_user_id,created_by,status) values('${post(3)}','family_member','${baby(1)}','${friend}','${owner}','approved')`);
  denied(await gatewaySign('memory_media',mid(41),friend),'external friend family-tag server sign denied');
  sql(`update storage.objects set created_at=now()-interval '25 hours' where name='${temp(41)}'`);
  assert.equal(sql('select queue_expired_temp_media(100)'),'0');pass('old linked temp is never expiry-swept');
  // Product deletion is soft-delete at the parent. The transition must create
  // durable byte cleanup intents atomically and the parent cannot be restored.
  const dsoft=temp(43), dunlinked=`${baby(1)}/${did}/${mid(45)}.jpg`;
  const pid2='b0000000-0000-4000-8000-000000000002';
  const gsoft=`${baby(1)}/${bid}/${pid2}/${mid(44)}.jpg`;
  const gunlinked=`${baby(1)}/${bid}/${pid2}/${mid(46)}.jpg`;
  ok(await upload(dsoft,owner,'diary-media'),'soft-delete diary media upload');
  asUser(owner,`insert into diary_media(id,diary_entry_id,baby_id,storage_path)
    values('${mid(43)}','${did}','${baby(1)}','${dsoft}')`);
  ok(await upload(dunlinked,owner,'diary-media'),'diary completed-unattached final upload');
  sql(`insert into growth_book_pages(id,growth_book_id,baby_id,created_by,page_order)
    values('${pid2}','${bid}','${baby(1)}','${owner}',1)`);
  ok(await upload(gsoft,owner,'growth-book-media'),'soft-delete growth page media upload');
  asUser(owner,`insert into growth_book_media(id,growth_book_id,page_id,baby_id,created_by,storage_path)
    values('${mid(44)}','${bid}','${pid2}','${baby(1)}','${owner}','${gsoft}')`);
  ok(await upload(gunlinked,owner,'growth-book-media'),'growth completed-unattached final upload');
  asUser(owner,`select soft_delete_memory_post('${post(3)}')`);
  assert.equal(sql(`select count(*) from media_cleanup_queue where bucket_id='memories' and storage_path='${temp(41)}'`),'1');
  assert.equal(sql(`select count(*) from media_cleanup_queue where bucket_id='memories' and storage_path='${unlinked}'`),'1');
  assert.equal(sql(`select storage_security.key_attached('memories','${temp(41)}')`),'f');pass('memory soft-delete queues bytes');
  assert.throws(()=>sql(`update memory_posts set deleted_at=null where id='${post(3)}'`));pass('deleted memory cannot restore queued bytes');
  asUser(owner,`select soft_delete_diary_entry('${did}')`);
  assert.equal(sql(`select count(*) from media_cleanup_queue where bucket_id='diary-media' and storage_path='${dsoft}'`),'1');
  assert.equal(sql(`select count(*) from media_cleanup_queue where bucket_id='diary-media' and storage_path='${dunlinked}'`),'1');
  assert.equal(sql(`select storage_security.key_attached('diary-media','${dsoft}')`),'f');pass('diary soft-delete queues bytes');
  sql(`update growth_book_pages set deleted_at=now() where id='${pid2}' and deleted_at is null`);
  assert.equal(sql(`select count(*) from media_cleanup_queue where bucket_id='growth-book-media' and storage_path='${gsoft}'`),'1');
  assert.equal(sql(`select count(*) from media_cleanup_queue where bucket_id='growth-book-media' and storage_path='${gunlinked}'`),'1');
  assert.equal(sql(`select storage_security.key_attached('growth-book-media','${gsoft}')`),'f');pass('growth page soft-delete queues bytes');
  sql(`update growth_books set deleted_at=now() where id='${bid}' and deleted_at is null`);
  assert.equal(sql(`select count(*) from media_cleanup_queue where bucket_id='growth-book-media' and storage_path='${gpath}'`),'1');
  assert.equal(sql(`select storage_security.key_attached('growth-book-media','${gpath}')`),'f');pass('growth book soft-delete queues bytes');
  // Real two-session regression: attachment takes FOR SHARE; parent deletion
  // must wait, then its trigger must observe and queue the committed child.
  const racePost=post(6), raceMedia=mid(60), raceFinal=`${baby(2)}/${racePost}/${raceMedia}.jpg`;
  sql(`insert into memory_posts(id,baby_id,author_id,privacy_type,status)
    values('${racePost}','${baby(2)}','${owner}','only_me','published')`);
  ok(await upload(raceFinal,owner),'concurrent attach final upload');
  const attaching=sqlAsync(`begin; set local role authenticated;
    select set_config('request.jwt.claim.sub','${owner}',true);
    insert into memory_media(id,memory_post_id,baby_id,storage_path)
      values('${raceMedia}','${racePost}','${baby(2)}','${raceFinal}');
    select pg_sleep(1); commit;`);
  await new Promise(resolve=>setTimeout(resolve,150));
  const deleting=sqlAsync(`update memory_posts set deleted_at=now() where id='${racePost}'`);
  await Promise.all([attaching,deleting]);
  assert.equal(sql(`select count(*) from media_cleanup_queue where bucket_id='memories' and storage_path='${raceFinal}'`),'1');
  pass('two-session attach versus soft-delete serializes and queues bytes');
  // A pre-deletion 'solo baby' snapshot is not authority to remove bytes.
  // Another active member arrives before B0.4a's authoritative transaction.
  const racePath=`${baby(3)}/temp/40000000-0000-4000-8000-000000000001/${mid(40)}.jpg`;
  sql(`insert into babies(id,name) values('${baby(3)}','synthetic race');
    insert into baby_members(baby_id,user_id,permission_role,status) values('${baby(3)}','${owner}','admin','active');`);
  ok(await upload(racePath),'account deletion race fixture upload');
  sql(`insert into baby_members(baby_id,user_id,permission_role,status) values('${baby(3)}','${outsider}','viewer','active')`);
  asUser(owner,'select prepare_account_deletion()');
  assert.equal(sql(`select count(*) from media_cleanup_queue where storage_path='${racePath}'`),'0');
  assert.equal(sql(`select count(*) from storage.objects where name='${racePath}'`),'1');pass('concurrent new member: no destructive cleanup intent');
  // Actual parent deletion captures even unlinked uploads. This uses a local
  // synthetic parent only; no cloud data is ever selected or mutated.
  sql(`delete from baby_members where baby_id='${baby(3)}'; delete from babies where id='${baby(3)}'`);
  assert.equal(sql(`select count(*) from media_cleanup_queue where storage_path='${racePath}'`),'1');pass('actual parent deletion queues unlinked upload');
  console.log(`B0.4b Storage API: ${passes} PASS / 0 skipped`);
} catch(error) {
  if(madeApi) {
    const logs=docker(['logs','--tail','12',api]).replaceAll(secret,'[LOCAL-REDACTED]').replaceAll(password,'[LOCAL-REDACTED]').replace(/eyJ[A-Za-z0-9_.-]+/g,'[JWT-REDACTED]');
    console.error(logs);
  }
  throw error;
} finally {
  apiWorker?.stdin.end();
  if(madeApi) docker(['rm','-f',api]);
  if(madeDb) docker(['rm','-f',db]);
  if(madeNetwork) docker(['network','rm',network]);
}
