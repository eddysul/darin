import { requireNativeModule, Platform } from "expo-modules-core";

export type CircularCutoutCrop = {
  /** Crop center X in 0...1 image space. 0.5 is the middle. */
  offsetX: number;
  /** Crop center Y in 0...1 image space. 0.5 is the middle. */
  offsetY: number;
  /** 1 = cover the shorter side. Larger values zoom in. */
  zoom: number;
};

type PersonCutoutNativeModule = {
  isAvailable(): boolean;
  createPersonCutout(imageUri: string, featherRadius: number): Promise<string>;
  createCircularCutout(imageUri: string): Promise<string>;
  createCircularCutoutFramed?(
    imageUri: string,
    offsetX: number,
    offsetY: number,
    zoom: number,
  ): Promise<string>;
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

/** Circular transparent PNG crop (on-device). Optional crop frames a region before clipping. */
export async function createCircularCutout(
  imageUri: string,
  crop?: CircularCutoutCrop,
): Promise<string> {
  const mod = getNative();
  if (!mod) {
    throw new Error("Circular cutout native module unavailable");
  }
  if (crop && typeof mod.createCircularCutoutFramed === "function") {
    const offsetX = Math.min(1, Math.max(0, crop.offsetX));
    const offsetY = Math.min(1, Math.max(0, crop.offsetY));
    const zoom = Math.min(8, Math.max(1, crop.zoom));
    try {
      return await mod.createCircularCutoutFramed(imageUri, offsetX, offsetY, zoom);
    } catch {
      // Older native binary without framed cutout.
    }
  }
  return mod.createCircularCutout(imageUri);
}
