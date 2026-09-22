export function pickerWheelIndex(offsetY: number, itemHeight: number, itemCount: number): number {
  if (!Number.isFinite(offsetY) || !Number.isFinite(itemHeight) || itemHeight <= 0 || itemCount <= 0) return 0;
  return Math.max(0, Math.min(itemCount - 1, Math.round(offsetY / itemHeight)));
}

export function pickerWheelOffset(index: number, itemHeight: number): number {
  if (!Number.isFinite(index) || !Number.isFinite(itemHeight) || itemHeight <= 0) return 0;
  return Math.max(0, Math.round(index) * itemHeight);
}
