export type CleanupIntent = { bucket_id: string; storage_path: string; lease_id: string };
export type CleanupAdapter = {
  claim: () => Promise<CleanupIntent[]>;
  remove: (bucket: string, path: string) => Promise<void>;
  finish: (intent: CleanupIntent) => Promise<boolean>;
};

export async function storageMaintenanceAuthorized(header: string | null, expectedSecret: string): Promise<boolean> {
  if (!expectedSecret || !header) return false;
  const encode = new TextEncoder();
  const [a,b] = await Promise.all([header,expectedSecret].map(value => crypto.subtle.digest('SHA-256',encode.encode(value))));
  const left=new Uint8Array(a), right=new Uint8Array(b);
  let difference=0;
  for(let i=0;i<left.length;i++) difference |= left[i] ^ right[i];
  return difference===0;
}

/** Storage deletion is idempotent because DB tombstones prohibit key reuse.
 * Failed/ambiguous API calls keep the durable lease; retry after lease expiry.
 * Never acknowledge before Storage API removal succeeds. */
export async function drainStorageCleanup(adapter: CleanupAdapter): Promise<{ completed: number; pending: number }> {
  const intents = await adapter.claim();
  let completed = 0;
  for (const intent of intents) {
    if (!['memories','diary-media','growth-book-media','baby-stickers','profile-media'].includes(intent.bucket_id)
      || !/^[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*\/[A-Za-z0-9_-]+\.(?:jpg|jpeg|png|heic|heif|webp)$/.test(intent.storage_path)
      || !/^[0-9a-f-]{36}$/i.test(intent.lease_id)) continue;
    try {
      await adapter.remove(intent.bucket_id, intent.storage_path);
      if (await adapter.finish(intent)) completed += 1;
    } catch {
      // No raw Storage error/path/user data in logs. A scheduler retries leases.
    }
  }
  return { completed, pending: intents.length - completed };
}
