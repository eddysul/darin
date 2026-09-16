import { createClient } from 'npm:@supabase/supabase-js@2.110.8';
import { drainStorageCleanup, storageMaintenanceAuthorized } from '../_shared/storageCleanup.ts';

// Internal scheduled maintenance only. Never accepts object paths or user IDs.
Deno.serve(async (request) => {
  if(request.method!=='POST') return new Response(null,{status:405});
  const cronSecret=Deno.env.get('STORAGE_CLEANUP_CRON_SECRET') ?? '';
  if(!await storageMaintenanceAuthorized(request.headers.get('x-cron-secret'),cronSecret)) return new Response(null,{status:401});
  const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const url=Deno.env.get('SUPABASE_URL');
  if(!url || !serviceKey) return new Response(null,{status:503});
  const admin=createClient(url,serviceKey,{auth:{persistSession:false}});
  try {
    const queued=await admin.rpc('queue_expired_temp_media',{p_limit:100});
    if(queued.error) throw queued.error;
    const result=await drainStorageCleanup({
      claim: async()=>{
        const {data,error}=await admin.rpc('claim_media_cleanup',{p_requested_by:null,p_limit:100});
        if(error) throw error;
        return data ?? [];
      },
      remove:async(bucket,path)=>{
        const {error}=await admin.storage.from(bucket).remove([path]);
        if(error) throw error;
      },
      finish:async(intent)=>{
        const {data,error}=await admin.rpc('finish_media_cleanup',{p_bucket:intent.bucket_id,p_path:intent.storage_path,p_lease:intent.lease_id});
        if(error) throw error;
        return data===true;
      },
    });
    return Response.json({queued:queued.data,...result});
  } catch {
    return Response.json({error:'MEDIA_CLEANUP_RETRY'},{status:503});
  }
});
