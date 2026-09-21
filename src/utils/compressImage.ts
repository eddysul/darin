import * as FileSystem from "expo-file-system";
import * as ImageManipulator from "expo-image-manipulator";

/** Long-edge cap for Storage uploads. Original camera files are not uploaded. */
export const UPLOAD_MAX_LONG_EDGE = 1800;
export const UPLOAD_JPEG_QUALITY = 0.8;

export type CompressedImage = {
  uri: string;
  width: number;
  height: number;
  mimeType: "image/jpeg";
};

export async function compressImageForUpload(
  uri: string,
  width?: number,
  height?: number,
): Promise<CompressedImage> {
  const actions: ImageManipulator.Action[] = [];
  const longEdge = Math.max(width ?? 0, height ?? 0);
  if (longEdge > UPLOAD_MAX_LONG_EDGE) {
    if ((width ?? 0) >= (height ?? 0)) actions.push({ resize: { width: UPLOAD_MAX_LONG_EDGE } });
    else actions.push({ resize: { height: UPLOAD_MAX_LONG_EDGE } });
  }

  try {
    return await manipulateToJpeg(uri, actions);
  } catch {
    const copied = await copyPickerUriToCache(uri);
    try {
      return await manipulateToJpeg(copied, actions);
    } catch {
      throw new Error("선택한 사진을 읽지 못했어요.");
    }
  }
}

async function manipulateToJpeg(
  uri: string,
  actions: ImageManipulator.Action[],
): Promise<CompressedImage> {
  const result = await ImageManipulator.manipulateAsync(uri, actions, {
    compress: UPLOAD_JPEG_QUALITY,
    format: ImageManipulator.SaveFormat.JPEG,
  });
  if (!result.uri) throw new Error("선택한 사진을 읽지 못했어요.");
  return {
    uri: result.uri,
    width: result.width,
    height: result.height,
    mimeType: "image/jpeg",
  };
}

/** PHPicker/FileProvider URIs often fail ImageIO until copied into app storage. */
async function copyPickerUriToCache(uri: string): Promise<string> {
  const dir = FileSystem.cacheDirectory;
  if (!dir) throw new Error("선택한 사진을 읽지 못했어요.");
  const dest = `${dir}upload-${Date.now()}-${Math.random().toString(16).slice(2)}.jpg`;
  try {
    await FileSystem.copyAsync({ from: uri, to: dest });
    if (await fileHasBytes(dest)) return dest;
  } catch {
    // Simulator iCloud / FileProvider bookmarks often fail copyAsync.
  }
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  if (!base64) throw new Error("선택한 사진을 읽지 못했어요.");
  await FileSystem.writeAsStringAsync(dest, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  if (!await fileHasBytes(dest)) throw new Error("선택한 사진을 읽지 못했어요.");
  return dest;
}

async function fileHasBytes(path: string): Promise<boolean> {
  const info = await FileSystem.getInfoAsync(path);
  if (!info.exists) return false;
  if ("size" in info && typeof info.size === "number") return info.size > 0;
  return true;
}
