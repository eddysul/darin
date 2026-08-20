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

  const result = await ImageManipulator.manipulateAsync(uri, actions, {
    compress: UPLOAD_JPEG_QUALITY,
    format: ImageManipulator.SaveFormat.JPEG,
  });

  return {
    uri: result.uri,
    width: result.width,
    height: result.height,
    mimeType: "image/jpeg",
  };
}
