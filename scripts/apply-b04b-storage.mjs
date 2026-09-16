import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { QA_PROJECT_REF, PRODUCTION_PROJECT_REF, resolvePsqlBinary } from "./lib/qa-project-config.mjs";

const target=process.argv[2], execute=process.argv.includes("--execute");
if(!["qa","production"].includes(target)) throw new Error("usage: apply-b04b-storage.mjs <qa|production> [--execute]");
const projectRef=target==="qa"?QA_PROJECT_REF:PRODUCTION_PROJECT_REF;
const otherRef=target==="qa"?PRODUCTION_PROJECT_REF:QA_PROJECT_REF;
const migrations=["202609150008_b04b_storage_boundary.sql","202609150009_b04b_storage_cleanup_queue.sql",
  "202609150010_b04b_storage_fk_cleanup_compatibility.sql"].map(filename=>{
  const source=readFileSync(`supabase/migrations/${filename}`,"utf8");
  return {filename,version:filename.split("_")[0],name:filename.replace(/^\d+_|\.sql$/g,""),source,
    sha256:createHash("sha256").update(source).digest("hex")};
});
const manifestSha256=createHash("sha256").update(migrations.map(x=>`${x.version}:${x.sha256}`).join("\n")).digest("hex");
const password=process.env.SUPABASE_DB_PASSWORD??"";
const host=target==="qa"?(process.env.SUPABASE_DB_HOST??"").trim():`db.${projectRef}.supabase.co`;
const user=target==="qa"?(process.env.SUPABASE_DB_USER??"").trim():"postgres";
const configured=(process.env.SUPABASE_PROJECT_REF??"").trim();
if(!password || !host || !user || (target==="qa"?(!user.includes(projectRef)||host.includes(otherRef)):(configured!==projectRef))) {
  throw new Error(`${target} B0.4b database identity guard failed`);
}
if(target==="production" && process.env.B04B_QA_APPROVED_MANIFEST_SHA256?.trim()!==manifestSha256) {
  throw new Error("production source does not match QA-approved B0.4b manifest");
}
const env={...process.env,PGHOST:host,PGUSER:user,PGPASSWORD:password,PGDATABASE:"postgres",PGSSLMODE:"require",PGCONNECT_TIMEOUT:"15"};
function psql(input,label,readOnly=false){
  const result=spawnSync(resolvePsqlBinary(),["-X","-At","-v","ON_ERROR_STOP=1"],{input,encoding:"utf8",env:{...env,
    ...(readOnly?{PGOPTIONS:"-c default_transaction_read_only=on -c statement_timeout=30000"}:{})},maxBuffer:8*1024*1024});
  if(result.status!==0) throw new Error(`${label} failed: ${(result.stderr||result.stdout).slice(0,4000)}`);
  return result.stdout.trim();
}
const identity=psql("select current_database()||'|'||current_user;","identity",true);
if(!identity.startsWith("postgres|")) throw new Error("unexpected database identity");
const applied=new Set(psql("select version from supabase_migrations.schema_migrations order by version;","migration history",true).split("\n").filter(Boolean));
if(!applied.has("202609150007")) throw new Error("B0.4a baseline missing");
const states=migrations.map(x=>applied.has(x.version));
if(states.some((state,index)=>state && states.slice(0,index).some(previous=>!previous))) {
  throw new Error("non-prefix B0.4b migration state");
}
const local=readdirSync("supabase/migrations").filter(x=>/^\d+_.+\.sql$/.test(x)).sort();
const pending=local.filter(x=>!applied.has(x.split("_")[0]));
const expected=new Set([...(target==="qa"?["202608220002_schedule_care_reminders.sql","202608260003_notification_event_type_constraint_cleanup.sql"]:[]),
  ...migrations.filter((_,i)=>!states[i]).map(x=>x.filename)]);
if(pending.length!==expected.size||pending.some(x=>!expected.has(x))) throw new Error(`unexpected pending migrations: ${pending.join(",")}`);
const preflight=JSON.parse(psql(`select json_build_object(
  'buckets',(select count(*) from storage.buckets where id in ('memories','diary-media','growth-book-media','baby-stickers','profile-media')),
  'requiredFunctions',(select count(*) from pg_proc where oid in ('public.current_baby_write_permission(uuid)'::regprocedure,
    'public.can_view_memory_post(uuid)'::regprocedure,'public.can_view_diary_entry(uuid)'::regprocedure,
    'public.can_view_growth_book(uuid)'::regprocedure,'public.can_view_baby_sticker(uuid)'::regprocedure)),
  'invalidBackfillOwners',(select count(*) from storage.objects o where o.bucket_id in ('memories','diary-media')
    and o.owner_id ~* '^[0-9a-f-]{36}$' and o.owner_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'),
  'publicBuckets',(select count(*) from storage.buckets where id in ('memories','diary-media','growth-book-media','baby-stickers','profile-media') and public)
)::text;`,"dependency/data preflight",true));
if(preflight.buckets!==5||preflight.requiredFunctions!==5||preflight.invalidBackfillOwners!==0||preflight.publicBuckets!==0) {
  throw new Error(`B0.4b preflight blocked: ${JSON.stringify(preflight)}`);
}
console.log(JSON.stringify({target,projectRef,execute,identity,manifestSha256,migrations:migrations.map(x=>({version:x.version,sha256:x.sha256})),pending,preflight}));
if(!execute) process.exit(0);
const confirmKey=target==="qa"?"QA_B04B_STORAGE_CONFIRM":"PRODUCTION_B04B_STORAGE_CONFIRM";
const expectedConfirm=target==="qa"?`APPLY_B04B_STORAGE_${projectRef}`:`APPLY_B04B_STORAGE_PRODUCTION_${projectRef}`;
if(process.env[confirmKey]?.trim()!==expectedConfirm) throw new Error(`${target} B0.4b confirmation missing`);
let sql="begin; set local lock_timeout='5s'; set local statement_timeout='120s';\n";
for(let i=0;i<migrations.length;i++) if(!states[i]) {
  const item=migrations[i];
  sql+=item.source.replace(/(^|\n)begin;\s*\n/i,"\n").replace(/\ncommit;\s*$/i,"\n");
  sql+=`\ninsert into supabase_migrations.schema_migrations(version,name) values ('${item.version}','${item.name}');\n`;
}
sql+="commit;";
psql(sql,`atomic ${target} B0.4b apply`);
const post=JSON.parse(psql(`select json_build_object(
 'history',(select count(*) from supabase_migrations.schema_migrations where version in ('202609150008','202609150009','202609150010')),
 'policies',(select count(*) from pg_policies where schemaname='storage' and policyname like 'b04b_%'),
 'queue',to_regclass('public.media_cleanup_queue') is not null,
 'resolver',to_regprocedure('public.resolve_private_media_for_signing(text,uuid)') is not null,
 'retire',to_regprocedure('public.retire_unattached_storage_upload(text,text)') is not null,
 'nativeSelectDenied',(select position('false' in lower(coalesce(qual,'')))>0 from pg_policies where schemaname='storage' and policyname='b04b_storage_select')
)::text;`,`post-apply verification`,true));
if(post.history!==3||post.policies<7||!post.queue||!post.resolver||!post.retire||!post.nativeSelectDenied) throw new Error(`post-apply contract mismatch: ${JSON.stringify(post)}`);
console.log(JSON.stringify({target,applied:migrations.filter((_,i)=>!states[i]).map(x=>x.version),manifestSha256,post}));
