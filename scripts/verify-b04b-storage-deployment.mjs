// Read-only deployment contract check, plus an optional normal maintenance
// invocation. Outputs aggregate state only; never reads object names or secrets.
import { spawnSync } from "node:child_process";
import { QA_PROJECT_REF, PRODUCTION_PROJECT_REF, resolvePsqlBinary } from "./lib/qa-project-config.mjs";

const target=process.argv[2],invoke=process.argv.includes("--invoke-worker");
if(!["qa","production"].includes(target)) throw new Error("expected qa or production");
const ref=target==="qa"?QA_PROJECT_REF:PRODUCTION_PROJECT_REF;
const host=target==="qa"?process.env.SUPABASE_DB_HOST:`db.${ref}.supabase.co`;
const user=target==="qa"?process.env.SUPABASE_DB_USER:"postgres";
if(!host||!user||!process.env.SUPABASE_DB_PASSWORD
  ||(target==="qa"?!user.includes(ref):process.env.SUPABASE_PROJECT_REF!==ref)) throw new Error("project guard failed");
const env={...process.env,PGHOST:host,PGUSER:user,PGPASSWORD:process.env.SUPABASE_DB_PASSWORD,
  PGDATABASE:"postgres",PGSSLMODE:"require",PGCONNECT_TIMEOUT:"15"};
function sql(input,readOnly=true) {
  const result=spawnSync(resolvePsqlBinary(),["-X","-At","-v","ON_ERROR_STOP=1"],{input,encoding:"utf8",
    env:{...env,...(readOnly?{PGOPTIONS:"-c default_transaction_read_only=on -c statement_timeout=30000"}:{})}});
  if(result.status!==0) throw new Error(`deployment verification failed: ${(result.stderr||"").slice(-1000)}`);
  return result.stdout.trim();
}
const endpoint=`https://${ref}.supabase.co/functions/v1`;
const unsigned=await fetch(`${endpoint}/media-signed-url`,{method:"POST",headers:{"content-type":"application/json"},
  body:JSON.stringify({kind:"memory_media",resourceId:"00000000-0000-4000-8000-000000000000"})});
if(unsigned.status!==401) throw new Error(`unsigned media function returned ${unsigned.status}`);
const maintenance=await fetch(`${endpoint}/storage-cleanup`,{method:"POST"});
if(maintenance.status!==401) throw new Error(`unauthorized cleanup function returned ${maintenance.status}`);
if(invoke) {
  sql(`select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name='b04b_storage_project_url')||'/functions/v1/storage-cleanup',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret',
      (select decrypted_secret from vault.decrypted_secrets where name='b04b_storage_cleanup_cron_secret')),
    body := '{}'::jsonb,timeout_milliseconds := 30000);`,false);
  await new Promise(resolve=>setTimeout(resolve,2000));
  for(let i=0;i<30;i++) {
    const active=Number(sql("select count(*) from media_cleanup_queue where state in ('pending','leased')"));
    if(active===0) break;
    await new Promise(resolve=>setTimeout(resolve,1000));
  }
}
const contract=JSON.parse(sql(`select json_build_object(
  'history',(select count(*) from supabase_migrations.schema_migrations where version in ('202609150008','202609150009','202609150010')),
  'policies',(select count(*) from pg_policies where schemaname='storage' and policyname like 'b04b_%'),
  'functions',(select count(*) from pg_proc where oid in (
    'public.resolve_private_media_for_signing(text,uuid)'::regprocedure,
    'public.retire_unattached_storage_upload(text,text)'::regprocedure,
    'public.claim_media_cleanup(uuid,integer)'::regprocedure,
    'public.finish_media_cleanup(text,text,uuid)'::regprocedure)),
  'schedule',(select count(*) from cron.job where jobname='darin-storage-cleanup-every-15-minutes' and active),
  'queue',(select json_build_object('pending',count(*) filter(where state='pending'),
    'leased',count(*) filter(where state='leased'),'done',count(*) filter(where state='done')) from media_cleanup_queue),
  'staleTemp',(select count(*) from storage.objects o where o.bucket_id in ('memories','diary-media')
    and public.is_temp_media_path(o.name) and o.created_at<now()-interval '24 hours'
    and not exists(select 1 from memory_media m where o.bucket_id='memories' and m.storage_path=o.name)
    and not exists(select 1 from diary_media m where o.bucket_id='diary-media' and m.storage_path=o.name))
)::text;`));
if(contract.history!==3||contract.policies<7||contract.functions!==4||contract.schedule!==1
  ||contract.queue.pending!==0||contract.queue.leased!==0) throw new Error(`contract mismatch: ${JSON.stringify(contract)}`);
console.log(JSON.stringify({target,projectRef:ref,unsignedMediaStatus:unsigned.status,
  unauthorizedWorkerStatus:maintenance.status,workerInvoked:invoke,contract}));
