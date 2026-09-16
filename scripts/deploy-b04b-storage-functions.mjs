import { createHash, randomBytes } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { QA_PROJECT_REF, PRODUCTION_PROJECT_REF, resolvePsqlBinary } from "./lib/qa-project-config.mjs";

const target=process.argv[2], execute=process.argv.includes("--execute");
if(!["qa","production"].includes(target)) throw new Error("usage: deploy-b04b-storage-functions.mjs <qa|production> [--execute]");
const ref=target==="qa"?QA_PROJECT_REF:PRODUCTION_PROJECT_REF;
const url=(process.env.EXPO_PUBLIC_SUPABASE_URL??`https://${ref}.supabase.co`).replace(/\/$/,"");
if(new URL(url).hostname!==`${ref}.supabase.co`||!process.env.SUPABASE_ACCESS_TOKEN?.trim()) throw new Error("function project guard failed");
const files=["supabase/functions/media-signed-url/index.ts","supabase/functions/storage-cleanup/index.ts",
  "supabase/functions/_shared/storageCleanup.ts","supabase/functions/delete-account/index.ts"];
const hashes=files.map(path=>({path,sha256:createHash("sha256").update(readFileSync(path)).digest("hex")}));
const manifestSha256=createHash("sha256").update(hashes.map(x=>`${x.path}:${x.sha256}`).join("\n")).digest("hex");
if(target==="production"&&process.env.B04B_QA_APPROVED_FUNCTION_MANIFEST_SHA256?.trim()!==manifestSha256) throw new Error("production functions differ from QA-approved manifest");
console.log(JSON.stringify({target,projectRef:ref,execute,manifestSha256,hashes}));
if(!execute) process.exit(0);
const confirmKey=target==="qa"?"QA_B04B_FUNCTIONS_CONFIRM":"PRODUCTION_B04B_FUNCTIONS_CONFIRM";
const expected=target==="qa"?`DEPLOY_B04B_FUNCTIONS_${ref}`:`DEPLOY_B04B_FUNCTIONS_PRODUCTION_${ref}`;
if(process.env[confirmKey]?.trim()!==expected) throw new Error("explicit function deployment confirmation missing");
function run(command,args,label,options={}){
  const r=spawnSync(command,args,{cwd:process.cwd(),env:process.env,encoding:"utf8",stdio:options.inherit?"inherit":"pipe",input:options.input});
  if(r.status!==0) throw new Error(`${label} failed: ${(r.stderr||r.stdout||"").slice(-3000)}`);
}
for(const [name,noJwt] of [["media-signed-url",false],["storage-cleanup",true],["delete-account",false]]){
  run("pnpm",["dlx","supabase@latest","functions","deploy",name,"--project-ref",ref,"--use-api",...(noJwt?["--no-verify-jwt"]:[])],`deploy ${name}`,{inherit:true});
}
const secret=randomBytes(32).toString("hex");
const temporary=mkdtempSync(join(tmpdir(),"darin-b04b-secret-"));
try{
  const envFile=join(temporary,"storage-cleanup.env");
  writeFileSync(envFile,`STORAGE_CLEANUP_CRON_SECRET=${secret}\n`,{mode:0o600});
  run("pnpm",["dlx","supabase@latest","secrets","set","--project-ref",ref,"--env-file",envFile],"set cleanup secret",{inherit:true});
}finally{rmSync(temporary,{recursive:true,force:true});}
const password=process.env.SUPABASE_DB_PASSWORD??"";
const host=target==="qa"?(process.env.SUPABASE_DB_HOST??"").trim():`db.${ref}.supabase.co`;
const user=target==="qa"?(process.env.SUPABASE_DB_USER??"").trim():"postgres";
if(!password||!host||!user||(target==="qa"&&!user.includes(ref))) throw new Error("scheduler DB guard failed");
const quote=value=>`'${value.replaceAll("'","''")}'`;
const scheduleSql=`begin;
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;
delete from vault.secrets where name in ('b04b_storage_project_url','b04b_storage_cleanup_cron_secret');
select vault.create_secret(${quote(url)},'b04b_storage_project_url','B0.4b Storage cleanup URL');
select vault.create_secret(${quote(secret)},'b04b_storage_cleanup_cron_secret','B0.4b Storage cleanup cron secret');
do $$ declare j bigint; begin for j in select jobid from cron.job where jobname='darin-storage-cleanup-every-15-minutes' loop perform cron.unschedule(j); end loop; end $$;
select cron.schedule('darin-storage-cleanup-every-15-minutes','*/15 * * * *',$job$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name='b04b_storage_project_url')||'/functions/v1/storage-cleanup',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret',(select decrypted_secret from vault.decrypted_secrets where name='b04b_storage_cleanup_cron_secret')),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
$job$); commit;`;
const db=spawnSync(resolvePsqlBinary(),["-X","-At","-v","ON_ERROR_STOP=1"],{input:scheduleSql,encoding:"utf8",env:{...process.env,
  PGHOST:host,PGUSER:user,PGPASSWORD:password,PGDATABASE:"postgres",PGSSLMODE:"require",PGCONNECT_TIMEOUT:"15"}});
if(db.status!==0) throw new Error(`cleanup schedule configuration failed: ${(db.stderr||db.stdout).slice(-3000)}`);
console.log(JSON.stringify({target,projectRef:ref,manifestSha256,deployed:["media-signed-url","storage-cleanup","delete-account"],schedule:"*/15 * * * *",secretPrinted:false}));
