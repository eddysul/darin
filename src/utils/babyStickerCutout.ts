/**
 * Background removal for baby stickers.
 * Swap `removeBackground` implementation to call a server proxy later —
 * never put API keys in the client for production builds.
 */

export type CutoutMethod = "mock" | "api";

export type CutoutResult = {
  uri: string;
  method: CutoutMethod;
};

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Mock 누끼: returns the same image URI after a short delay.
 * Structure is ready for a real proxy endpoint later.
 */
export async function removeBackground(imageUri: string): Promise<CutoutResult> {
  // Future:
  // const res = await fetch(`${EXPO_PUBLIC_API}/stickers/cutout`, { method: "POST", ... });
  // return { uri: uploadedCutoutUrl, method: "api" };
  await wait(900);
  if (!imageUri) throw new Error("이미지 URI가 없어요.");
  return { uri: imageUri, method: "mock" };
}
