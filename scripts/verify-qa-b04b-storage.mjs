// Hosted QA-only B0.4b attack regression. Creates disposable users/resources,
// uses the real Storage and Edge Function APIs, then removes every exact fixture.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { assertQaProjectEnvironment } from "./lib/qa-project-guard.mjs";
import { cleanupQaAccounts, createAdminClient, createQaAccounts } from "./lib/qa-auth.mjs";
import { resolvePsqlBinary } from "./lib/qa-project-config.mjs";

assertQaProjectEnvironment();
const service=createAdminClient();
const accounts=await createQaAccounts([
  "B04bAdmin","B04bEditor","B04bOtherEditor","B04bViewer",
  "B04bFriend","B04bRemoved","B04bOutsider","B04bOtherBabyAdmin",
]);
const [admin,editor,otherEditor,viewer,friend,removed,outsider,otherBabyAdmin]=accounts;
const babies=[];
const objects=[];
let passes=0;
const pass=label=>{passes++;console.log(`PASS ${label}`);};
const fail=(condition,label)=>{assert.ok(condition,label);pass(label);};
const errorText=r=>`${r?.error?.message??""} ${r?.error?.context?.status??""}`;
const denied=(r,label)=>{assert.ok(r?.error,`${label}: unexpectedly allowed`);assert.doesNotMatch(errorText(r),/Bearer\s|eyJ[A-Za-z0-9_-]+\./);pass(label);};
const image=new Blob([Uint8Array.from([0xff,0xd8,0xff,0xe0,0,0x10,0x4a,0x46,0x49,0x46,0xff,0xd9])],{type:"image/jpeg"});
const png=new Blob([Uint8Array.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a])],{type:"image/png"});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

function psql(sql) {
  const result=spawnSync(resolvePsqlBinary(),["-X","-At","-v","ON_ERROR_STOP=1"],{
    input:sql,encoding:"utf8",maxBuffer:2*1024*1024,
    env:{...process.env,PGHOST:process.env.SUPABASE_DB_HOST,PGUSER:process.env.SUPABASE_DB_USER,
      PGPASSWORD:process.env.SUPABASE_DB_PASSWORD,PGDATABASE:"postgres",PGSSLMODE:"require",PGCONNECT_TIMEOUT:"15"},
  });
  if(result.status!==0) throw new Error(`QA database assertion failed: ${(result.stderr||"").slice(-800)}`);
  return result.stdout.trim();
}
async function createBaby(actor,label) {
  const result=await actor.sb.rpc("create_baby_with_owner",{p_name:`B04b storage ${label} ${crypto.randomUUID()}`,
    p_child_status:"newborn",p_relationship_label:"보호자"});
  if(result.error||!result.data?.id) throw result.error??new Error("baby creation failed");
  babies.push(result.data.id);return result.data.id;
}
async function upload(actor,bucket,path,body=image) {
  const result=await actor.sb.storage.from(bucket).upload(path,body,{contentType:body.type,upsert:false});
  if(result.error) throw new Error(`fixture upload ${bucket}: ${result.error.message}`);
  objects.push([bucket,path]);
  return result;
}
async function sign(actor,kind,resourceId) {
  return actor.sb.functions.invoke("media-signed-url",{body:{kind,resourceId}});
}
async function invokeWorker() {
  psql(`select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name='b04b_storage_project_url')||'/functions/v1/storage-cleanup',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret',
      (select decrypted_secret from vault.decrypted_secrets where name='b04b_storage_cleanup_cron_secret')),
    body := '{}'::jsonb, timeout_milliseconds := 30000);`);
}
async function waitQueue(path) {
  for(let i=0;i<20;i++) {
    if(psql(`select coalesce((select state from media_cleanup_queue where storage_path='${path}' limit 1),'missing')`)==="done") return;
    await sleep(500);
  }
  throw new Error("cleanup worker did not finish synthetic object");
}
async function cleanup() {
  for(const [bucket,path] of objects.reverse()) { try { await service.storage.from(bucket).remove([path]); } catch {} }
  if(babies.length) { try { await service.from("babies").delete().in("id",babies); } catch {} }
  await cleanupQaAccounts(accounts);
}
async function expectRemoveDenied(actor,bucket,path,label) {
  await actor.sb.storage.from(bucket).remove([path]);
  const remains=await service.storage.from(bucket).download(path);
  fail(!remains.error,label);
}

try {
  const currentIds=new Set(accounts.map(account=>account.user.id));
  const listed=await service.auth.admin.listUsers({page:1,perPage:1000});
  if(!listed.error) for(const user of listed.data.users) {
    if(!currentIds.has(user.id) && user.email?.startsWith("qa-b04b") && user.email.endsWith("@darin.invalid")) {
      await service.auth.admin.deleteUser(user.id);
    }
  }
  const staleBabies=await service.from("babies").select("id").ilike("name","B04b storage %");
  if(!staleBabies.error && staleBabies.data?.length) await service.from("babies").delete().in("id",staleBabies.data.map(row=>row.id));
  const baby=await createBaby(admin,"primary"), otherBaby=await createBaby(otherBabyAdmin,"secondary");
  const memberships=await service.from("baby_members").insert([
    {baby_id:baby,user_id:editor.user.id,permission_role:"editor",relationship_label:"가족",status:"active"},
    {baby_id:baby,user_id:otherEditor.user.id,permission_role:"editor",relationship_label:"가족",status:"active"},
    {baby_id:baby,user_id:viewer.user.id,permission_role:"viewer",relationship_label:"가족",status:"active"},
    {baby_id:baby,user_id:removed.user.id,permission_role:"viewer",relationship_label:"가족",status:"inactive"},
  ]); if(memberships.error) throw memberships.error;
  const friendLink=await service.from("memory_friends").insert({baby_id:baby,user_id:friend.user.id,invited_by:admin.user.id,status:"active"});
  if(friendLink.error) throw friendLink.error;

  const post=crypto.randomUUID(),memoryId=crypto.randomUUID();
  const diary=crypto.randomUUID(),diaryId=crypto.randomUUID();
  const book=crypto.randomUUID(),page=crypto.randomUUID(),growthId=crypto.randomUUID();
  const sticker=crypto.randomUUID();
  const postInsert=await editor.sb.from("memory_posts").insert({id:post,baby_id:baby,author_id:editor.user.id,
    privacy_type:"friend_circle",status:"published",caption:"synthetic B0.4b fixture"});if(postInsert.error)throw postInsert.error;
  const diaryInsert=await editor.sb.from("diary_entries").insert({id:diary,baby_id:baby,author_id:editor.user.id,
    entry_date:"2026-09-16",body:"synthetic",client_generated_id:crypto.randomUUID()});if(diaryInsert.error)throw diaryInsert.error;
  const bookInsert=await editor.sb.from("growth_books").insert({id:book,baby_id:baby,title:"synthetic",created_by:editor.user.id});if(bookInsert.error)throw bookInsert.error;
  const pageInsert=await editor.sb.from("growth_book_pages").insert({id:page,growth_book_id:book,baby_id:baby,
    page_type:"custom",page_order:0,content_json:{fixture:true},created_by:editor.user.id});if(pageInsert.error)throw pageInsert.error;

  const paths={
    memory:`${baby}/${post}/${memoryId}.jpg`,diary:`${baby}/${diary}/${diaryId}.jpg`,
    growth:`${baby}/${book}/${page}/${growthId}.jpg`,sticker:`${baby}/${crypto.randomUUID()}.png`,
    profile:`users/${editor.user.id}/${crypto.randomUUID()}.jpg`,babyAvatar:`babies/${baby}/${crypto.randomUUID()}.jpg`,
  };
  await upload(editor,"memories",paths.memory);await upload(editor,"diary-media",paths.diary);
  await upload(editor,"growth-book-media",paths.growth);await upload(editor,"baby-stickers",paths.sticker,png);
  await upload(editor,"profile-media",paths.profile);await upload(editor,"profile-media",paths.babyAvatar);
  const inserts=[
    await editor.sb.from("memory_media").insert({id:memoryId,memory_post_id:post,baby_id:baby,storage_path:paths.memory,media_type:"image",upload_status:"ready"}),
    await editor.sb.from("diary_media").insert({id:diaryId,diary_entry_id:diary,baby_id:baby,storage_path:paths.diary,media_type:"image",upload_status:"ready"}),
    await editor.sb.from("growth_book_media").insert({id:growthId,growth_book_id:book,page_id:page,baby_id:baby,storage_path:paths.growth,media_type:"image",created_by:editor.user.id}),
    await editor.sb.from("baby_stickers").insert({id:sticker,baby_id:baby,created_by:editor.user.id,label:"synthetic",storage_path:paths.sticker,source:"qa"}),
    await editor.sb.from("profiles").update({avatar_storage_path:paths.profile}).eq("id",editor.user.id),
    await editor.sb.from("babies").update({avatar_storage_path:paths.babyAvatar}).eq("id",baby),
  ];for(const result of inserts)if(result.error)throw result.error;
  pass("six private resource fixtures finalized through QA APIs");

  const resources=[
    ["memories",paths.memory,"memory_media",memoryId],
    ["diary-media",paths.diary,"diary_media",diaryId],
    ["growth-book-media",paths.growth,"growth_book_media",growthId],
    ["baby-stickers",paths.sticker,"baby_sticker",sticker],
    ["profile-media",paths.profile,"profile_avatar",editor.user.id],
    ["profile-media",paths.babyAvatar,"baby_avatar",baby],
  ];
  for(const [bucket,path,kind,id] of resources) {
    for(const actor of [admin,editor,otherEditor,viewer]) {
      const signed=await sign(actor,kind,id);fail(!signed.error&&signed.data?.signedUrl,`${bucket} authorized Edge sign`);
      denied(await actor.sb.storage.from(bucket).download(path),`${bucket} native authenticated read denied`);
      denied(await actor.sb.storage.from(bucket).createSignedUrl(path,86400),`${bucket} client TTL signing denied`);
    }
    for(const actor of [removed,outsider,otherBabyAdmin]) denied(await sign(actor,kind,id),`${bucket} cross-scope Edge sign denied`);
    await expectRemoveDenied(viewer,bucket,path,`${bucket} viewer byte delete denied`);
  }
  for(const [kind,id] of [["memory_media",memoryId],["profile_avatar",editor.user.id],["baby_avatar",baby]]) {
    const result=await sign(friend,kind,id);fail(!result.error&&result.data?.signedUrl,`${kind} friend-visible signed positive control`);
  }
  for(const [kind,id] of [["diary_media",diaryId],["growth_book_media",growthId],["baby_sticker",sticker]])
    denied(await sign(friend,kind,id),`${kind} friend non-memory access denied`);

  const temp=`${baby}/temp/${crypto.randomUUID()}/${crypto.randomUUID()}.jpg`;
  await upload(editor,"memories",temp);
  for(const actor of [admin,otherEditor,viewer,friend,removed,outsider,otherBabyAdmin]) {
    denied(await actor.sb.storage.from("memories").download(temp),"foreign temp read denied");
    denied(await actor.sb.storage.from("memories").createSignedUrl(temp,86400),"foreign temp signing denied");
    await expectRemoveDenied(actor,"memories",temp,"foreign temp delete denied");
    const listing=await actor.sb.storage.from("memories").list(`${baby}/temp`);
    fail(Boolean(listing.error)||(listing.data??[]).every(row=>row.name!==temp.split("/").at(-1)),"foreign temp listing leak denied");
  }
  denied(await editor.sb.storage.from("memories").download(temp),"uploader native temp read denied");
  denied(await editor.sb.storage.from("memories").createSignedUrl(temp,86400),"uploader client temp sign denied");

  const stale=await sign(friend,"memory_media",memoryId);if(stale.error)throw stale.error;
  const revoke=await service.from("memory_friends").update({status:"revoked"}).eq("baby_id",baby).eq("user_id",friend.user.id);if(revoke.error)throw revoke.error;
  denied(await sign(friend,"memory_media",memoryId),"permission reduction denies new signed URL");
  const bearer=await fetch(stale.data.signedUrl);fail(bearer.ok,"documented pre-reduction bearer survives bounded TTL");
  denied(await sign(outsider,"memory_media",memoryId),"account switch cannot reuse prior signing authority");

  const cleanupPost=crypto.randomUUID(),orphan=crypto.randomUUID(),orphanPath=`${baby}/${cleanupPost}/${orphan}.jpg`;
  const cleanupPostInsert=await editor.sb.from("memory_posts").insert({id:cleanupPost,baby_id:baby,author_id:editor.user.id,
    privacy_type:"only_me",status:"published",caption:"cleanup fixture"});if(cleanupPostInsert.error)throw cleanupPostInsert.error;
  await upload(editor,"memories",orphanPath);
  const soft=await editor.sb.rpc("soft_delete_memory_post",{p_memory_post_id:cleanupPost});if(soft.error)throw soft.error;
  fail(psql(`select count(*)=1 from media_cleanup_queue where bucket_id='memories' and storage_path='${orphanPath}'`)==="t",
    "soft-delete queues completed-unattached final object");
  await invokeWorker();await waitQueue(orphanPath);
  denied(await service.storage.from("memories").download(orphanPath),"cleanup worker removed orphan bytes");

  const deletePost=crypto.randomUUID(),deleteMedia=crypto.randomUUID(),deletePath=`${baby}/${deletePost}/${deleteMedia}.jpg`;
  const dpi=await editor.sb.from("memory_posts").insert({id:deletePost,baby_id:baby,author_id:editor.user.id,
    privacy_type:"only_me",status:"published"});if(dpi.error)throw dpi.error;
  await upload(editor,"memories",deletePath);
  const dmi=await editor.sb.from("memory_media").insert({id:deleteMedia,memory_post_id:deletePost,baby_id:baby,
    storage_path:deletePath,media_type:"image",upload_status:"ready"});if(dmi.error)throw dmi.error;
  const dmd=await editor.sb.from("memory_media").delete().eq("id",deleteMedia);if(dmd.error)throw dmd.error;
  fail(psql(`select count(*)=1 from media_cleanup_queue where storage_path='${deletePath}'`)==="t","DB delete creates durable queue intent");
  await invokeWorker();await waitQueue(deletePath);
  denied(await service.storage.from("memories").download(deletePath),"delete queue worker removes exact bytes");

  const missingPost=crypto.randomUUID(),missingMedia=crypto.randomUUID(),missingPath=`${baby}/${missingPost}/${missingMedia}.jpg`;
  const mpi=await editor.sb.from("memory_posts").insert({id:missingPost,baby_id:baby,author_id:editor.user.id,privacy_type:"only_me",status:"published"});if(mpi.error)throw mpi.error;
  await upload(editor,"memories",missingPath);
  const mmi=await editor.sb.from("memory_media").insert({id:missingMedia,memory_post_id:missingPost,baby_id:baby,storage_path:missingPath,media_type:"image",upload_status:"ready"});if(mmi.error)throw mmi.error;
  const forced=await service.storage.from("memories").remove([missingPath]);if(forced.error)throw forced.error;
  denied(await sign(editor,"memory_media",missingMedia),"DB-present byte-missing split brain fails closed");

  const retryPath=`${otherBaby}/${crypto.randomUUID()}/${crypto.randomUUID()}.jpg`;
  psql(`insert into media_cleanup_queue(bucket_id,storage_path,requested_by)
    values('memories','${retryPath}','${outsider.user.id}') on conflict do nothing`);
  const first=psql(`select lease_id from claim_media_cleanup('${outsider.user.id}',1)`);
  fail(Boolean(first),"cleanup failure lease claimed");
  psql(`update media_cleanup_queue set lease_until=now()-interval '1 second' where storage_path='${retryPath}'`);
  const second=psql(`select lease_id from claim_media_cleanup('${outsider.user.id}',1)`);
  fail(Boolean(second)&&second!==first,"expired cleanup lease retries with new identity");
  fail(psql(`select finish_media_cleanup('memories','${retryPath}','${first}')`)==="f","stale cleanup worker cannot acknowledge retry");
  psql(`delete from media_cleanup_queue where storage_path='${retryPath}'`);

  const schedule=psql("select count(*)=1 from cron.job where jobname='darin-storage-cleanup-every-15-minutes' and active");
  fail(schedule==="t","QA cleanup scheduler active and unique");
  fail(passes>=137,`QA actual Storage API equivalent matrix reached ${passes} checks`);
  console.log(`B0.4b QA Storage API: ${passes} PASS / 0 skipped`);
} finally {
  await cleanup();
}
