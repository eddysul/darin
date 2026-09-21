import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildTempMediaPath, isTempMediaPath, isOwnedMediaPath, isCanonicalMediaPath } from '../src/utils/tempMediaPath.ts';
import { drainStorageCleanup, storageMaintenanceAuthorized } from '../supabase/functions/_shared/storageCleanup.ts';
import { sessionClientOptions } from '../src/lib/sessionClientOptions.ts';
import { createClient } from '@supabase/supabase-js';
const baby='10000000-0000-4000-8000-000000000001';
const user='20000000-0000-4000-8000-000000000001';
const media='30000000-0000-4000-8000-000000000001';
const path=buildTempMediaPath(baby,user,media);
assert.ok(isTempMediaPath(baby,path));
assert.ok(!isTempMediaPath(user,path));
assert.ok(isOwnedMediaPath(baby,user,`${baby}/${user}/${media}.jpg`));
assert.ok(isCanonicalMediaPath(`${baby}/${user}/${media}.mp4`));
assert.ok(isCanonicalMediaPath(`${baby}/${user}/${media}.mov`));
assert.ok(isCanonicalMediaPath(`${baby}/temp/${user}/${media}-poster.jpg`));
assert.ok(!isCanonicalMediaPath(`${baby}/${user}/${media}.mkv`));
for(const bad of ['../x.jpg',`${baby}/${user}/%2e%2e.jpg`,`${baby}/${user}/x%2fy.jpg`,`${baby}/${user}/x\\y.jpg`,`${baby}/${user}//x.jpg`,`${baby}/${user}/a/b.jpg`,`${baby}/${user}/한글.jpg`]) {
  assert.ok(!isOwnedMediaPath(baby,user,bad));
}
assert.throws(()=>buildTempMediaPath('..',user,media));
assert.ok(!isCanonicalMediaPath(`${baby}/${user}/x.svg`));
const intent={bucket_id:'memories',storage_path:path,lease_id:user};
let removed=0,finished=0;
const positive=await drainStorageCleanup({claim:async()=>[intent],remove:async()=>{removed++;},finish:async()=>{finished++;return true;}});
assert.deepEqual(positive,{completed:1,pending:0});assert.equal(removed,1);assert.equal(finished,1);
const failed=await drainStorageCleanup({claim:async()=>[intent],remove:async()=>{throw new Error('simulated network failure');},finish:async()=>{throw new Error('must not acknowledge');}});
assert.deepEqual(failed,{completed:0,pending:1});
const crash=await drainStorageCleanup({claim:async()=>[intent],remove:async()=>{},finish:async()=>{throw new Error('lost acknowledgement');}});
assert.deepEqual(crash,{completed:0,pending:1});
const stale=await drainStorageCleanup({claim:async()=>[intent],remove:async()=>{},finish:async()=>false});
assert.deepEqual(stale,{completed:0,pending:1});
const invalid=await drainStorageCleanup({claim:async()=>[{...intent,bucket_id:'other'},{...intent,storage_path:'../private'}],remove:async()=>{throw new Error('must not remove');},finish:async()=>true});
assert.deepEqual(invalid,{completed:0,pending:2});
assert.equal(await storageMaintenanceAuthorized(null,'local-test-value'),false);
assert.equal(await storageMaintenanceAuthorized('wrong','local-test-value'),false);
assert.equal(await storageMaintenanceAuthorized('local-test-value','local-test-value'),true);
const memory=readFileSync('src/repositories/MemoriesRepository.ts','utf8');
assert.ok(!memory.includes('signedUrlCache'));
assert.ok(memory.includes('requireCompletedEagerPhoto'));
assert.ok(memory.includes('createPrivateMediaSignedUrl("memory_media"'));
for (const file of [
  'src/repositories/MemoriesRepository.ts', 'src/repositories/DiaryRepository.ts',
  'src/repositories/GrowthBookRepository.ts', 'src/repositories/BabyStickerRepository.ts',
  'src/repositories/ProfileRepository.ts', 'src/repositories/BabyProfileRepository.ts',
]) {
  const source=readFileSync(file,'utf8');
  assert.ok(source.includes('captureSessionScope'), `${file} must pin upload identity`);
  assert.ok(source.includes('scope.assertCurrent()'), `${file} must reject account switches`);
}
const boundary=readFileSync('supabase/migrations/202609150008_b04b_storage_boundary.sql','utf8');
assert.match(boundary,/b04b_storage_select[\s\S]*using \(false\)/);
assert.match(boundary,/resolve_private_media_for_signing/);
assert.match(boundary,/current_baby_write_permission\(b\.baby_id\)/);
const signer=readFileSync('supabase/functions/media-signed-url/index.ts','utf8');
assert.ok(!signer.includes('body.storagePath'));
assert.match(signer,/row\.expires_in/);
assert.match(signer,/thumbnail_storage_path/);
assert.match(signer,/body\.variant/);
assert.ok(!signer.includes('getPublicUrl'));
const videoMigration=readFileSync('supabase/migrations/202609170001_memory_video_media.sql','utf8');
const videoCompatibility=readFileSync('supabase/migrations/202609210001_memory_video_baby_scope_compat.sql','utf8');
assert.match(videoMigration,/duration_ms <= 90000/);
assert.match(videoMigration,/file_size_limit=104857600/);
assert.doesNotMatch(videoMigration,/create table public\.notification_events/);
assert.doesNotMatch(videoMigration,/alter table public\.notification/);
assert.doesNotMatch(videoMigration,/returns table\(bucket_id text,storage_path text,expires_in integer,thumbnail_storage_path text\)/);
assert.match(videoCompatibility,/thumbnail_storage_path text/);
assert.match(videoCompatibility,/has_baby_access\(b\.id,'care\.read'\)/);
assert.match(videoCompatibility,/has_baby_access\(b\.id,'moments\.read'\)/);
assert.match(memory,/variant: "thumbnail"/);
assert.ok(!memory.includes('getPublicUrl'));
const stickerStore=readFileSync('src/utils/babyStickersStore.ts','utf8');
assert.ok(!stickerStore.includes('readScopedWithLegacyMigration'));
assert.match(stickerStore,/removeItem\(STORAGE_KEY\)/);
const account=readFileSync('supabase/functions/delete-account/index.ts','utf8');
assert.match(account,/prepare_account_deletion/);
assert.match(account,/mediaCleanupPending: true/);
assert.ok(!account.includes('adminClient.storage.from'));
assert.ok(!account.includes('soloBabyIds'));
let currentToken='synthetic-account-A';
const options=sessionClientOptions(currentToken);
const sent:string[]=[];
const client=createClient('http://127.0.0.1:1','synthetic-public-key',{
  ...options,global:{...options.global,fetch:async(_url,init)=>{
    sent.push(new Headers(init?.headers).get('authorization') ?? '');
    return new Response(JSON.stringify({Key:'memories/fixture',Id:'synthetic'}),{status:200,headers:{'Content-Type':'application/json'}});
  }},
});
currentToken='synthetic-account-B';
await client.storage.from('memories').upload(path,new Uint8Array([1]),{contentType:'image/jpeg'});
await client.storage.from('memories').remove([path]);
assert.deepEqual(sent,['Bearer synthetic-account-A','Bearer synthetic-account-A']);
assert.notEqual(sent[0],`Bearer ${currentToken}`);
assert.equal(options.auth.persistSession,false);
console.log('B0.4b storage path, cleanup failure/retry/auth and client boundary smoke PASS');
