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
  if (sourceUri === dest) return dest;
  await copyUriToFile(sourceUri, dest);
  return dest;
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

async function copyUriToFile(from: string, to: string): Promise<void> {
  try {
    await FileSystem.copyAsync({ from, to });
    if (await fileHasBytes(to)) return;
  } catch {
    // FileProvider / iCloud / simulator bookmarks often fail copyAsync.
  }
  try {
    const base64 = await FileSystem.readAsStringAsync(from, {
      encoding: FileSystem.EncodingType.Base64,
    });
    if (base64) {
      await FileSystem.writeAsStringAsync(to, base64, {
        encoding: FileSystem.EncodingType.Base64,
      });
      if (await fileHasBytes(to)) return;
    }
  } catch {
    // fall through
  }
  throw new Error("사진을 앱 저장소로 복사하지 못했어요.");
}

async function fileHasBytes(uri: string): Promise<boolean> {
  const info = await FileSystem.getInfoAsync(uri);
  if (!info.exists) return false;
  if ("size" in info && typeof info.size === "number") return info.size > 0;
  return true;
}

function guessExt(uri: string, kind?: "original" | "cutout" | "final"): string {
  const match = uri.match(/\.(jpg|jpeg|png|webp|heic)(\?|$)/i);
  if (match) return `.${match[1].toLowerCase().replace("jpeg", "jpg")}`;
  if (kind === "cutout" || kind === "final") return ".png";
  return ".jpg";
}
