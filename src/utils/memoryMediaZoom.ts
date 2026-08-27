export const MEMORY_MEDIA_MIN_ZOOM = 1;
export const MEMORY_MEDIA_MAX_ZOOM = 4;

export function clampMemoryMediaZoom(value: number): number {
  if (!Number.isFinite(value)) return MEMORY_MEDIA_MIN_ZOOM;
  return Math.min(MEMORY_MEDIA_MAX_ZOOM, Math.max(MEMORY_MEDIA_MIN_ZOOM, value));
}

export function clampMemoryMediaTranslation(value: number, zoom: number, viewport: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(viewport) || viewport <= 0) return 0;
  const maxOffset = Math.max(0, viewport * (clampMemoryMediaZoom(zoom) - 1) / 2);
  return Math.min(maxOffset, Math.max(-maxOffset, value));
}

export function memoryMediaPinchTranslation(input: {
  focal: number;
  startTranslation: number;
  startZoom: number;
  nextZoom: number;
  viewport: number;
}): number {
  const startZoom = clampMemoryMediaZoom(input.startZoom);
  const nextZoom = clampMemoryMediaZoom(input.nextZoom);
  const ratio = nextZoom / startZoom;
  const next = input.startTranslation + (1 - ratio) * (input.focal - input.startTranslation);
  return clampMemoryMediaTranslation(next, nextZoom, input.viewport);
}
