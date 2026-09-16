import type { SupabaseClient } from "@supabase/supabase-js";
import { captureSessionScope } from "../lib/supabase";
import type { Database } from "../types/database";

export type PrivateMediaKind =
  | "memory_media"
  | "diary_media"
  | "growth_book_media"
  | "baby_sticker"
  | "profile_avatar"
  | "baby_avatar";

type SignedMediaResponse = { signedUrl?: string; expiresIn?: number; error?: string };

/** Server-owned resolver and TTL. Client resource IDs are selectors, not authority. */
export async function createPrivateMediaSignedUrl(
  kind: PrivateMediaKind,
  resourceId: string,
  options?: { width?: number },
): Promise<string> {
  const scope = await captureSessionScope();
  await scope.assertCurrent();
  const width = options?.width === undefined
    ? undefined
    : Math.max(1, Math.min(2000, Math.round(options.width)));
  const { data, error } = await scope.client.functions.invoke<SignedMediaResponse>("media-signed-url", {
    body: { kind, resourceId, ...(width ? { width } : {}) },
  });
  await scope.assertCurrent();
  if (error || !data?.signedUrl) throw error ?? new Error(data?.error ?? "Private media URL unavailable.");
  return data.signedUrl;
}

export async function retireUnattachedStorageUpload(
  client: SupabaseClient<Database>,
  bucket: string,
  path: string,
): Promise<void> {
  await client.rpc("retire_unattached_storage_upload", { p_bucket: bucket, p_path: path });
}
