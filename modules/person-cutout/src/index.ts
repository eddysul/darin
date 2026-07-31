import { requireNativeModule, Platform } from "expo-modules-core";

type PersonCutoutNativeModule = {
  isAvailable(): boolean;
  createPersonCutout(imageUri: string, featherRadius: number): Promise<string>;
  createCircularCutout(imageUri: string): Promise<string>;
};

let native: PersonCutoutNativeModule | null = null;

function getNative(): PersonCutoutNativeModule | null {
  if (Platform.OS !== "ios") return null;
  if (native) return native;
  try {
    native = requireNativeModule<PersonCutoutNativeModule>("PersonCutout");
    return native;
  } catch {
    return null;
  }
}

/** True when on-device Vision person segmentation is available (iOS 15+). */
export function isPersonCutoutAvailable(): boolean {
  const mod = getNative();
  if (!mod) return false;
  try {
    return mod.isAvailable();
  } catch {
    return false;
  }
}

/**
 * On-device person segmentation → transparent PNG URI.
 * Photos never leave the device.
 */
export async function createPersonCutout(
  imageUri: string,
  featherRadius = 2.5,
): Promise<string> {
  const mod = getNative();
  if (!mod?.isAvailable()) {
    throw new Error("Person cutout is not available on this device");
  }
  return mod.createPersonCutout(imageUri, featherRadius);
}

/** Circular transparent PNG crop (on-device). */
export async function createCircularCutout(imageUri: string): Promise<string> {
  const mod = getNative();
  if (!mod) {
    throw new Error("Circular cutout native module unavailable");
  }
  return mod.createCircularCutout(imageUri);
}
