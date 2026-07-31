import * as FileSystem from "expo-file-system";

/** Copy a picker/camera URI into app document storage so stickers survive restarts. */
export async function persistStickerAsset(
  sourceUri: string,
  babyId: string,
  kind: "original" | "cutout" | "final",
  stickerId: string,
): Promise<string> {
  const dir = `${FileSystem.documentDirectory}stickers/${babyId}/`;
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => undefined);
  const ext = guessExt(sourceUri, kind);
  const dest = `${dir}${stickerId}-${kind}${ext}`;
  try {
    const info = await FileSystem.getInfoAsync(sourceUri);
    if (!info.exists) return sourceUri;
    await FileSystem.copyAsync({ from: sourceUri, to: dest });
    return dest;
  } catch {
    return sourceUri;
  }
}

export async function deleteStickerAssets(uris: Array<string | null | undefined>): Promise<void> {
  for (const uri of uris) {
    if (!uri || !uri.startsWith(FileSystem.documentDirectory ?? "___")) continue;
    try {
      await FileSystem.deleteAsync(uri, { idempotent: true });
    } catch {
      // ignore
    }
  }
}

function guessExt(uri: string, kind?: "original" | "cutout" | "final"): string {
  const match = uri.match(/\.(jpg|jpeg|png|webp|heic)(\?|$)/i);
  if (match) return `.${match[1].toLowerCase().replace("jpeg", "jpg")}`;
  // Cutouts are transparent PNGs when produced on-device.
  if (kind === "cutout" || kind === "final") return ".png";
  return ".jpg";
}
