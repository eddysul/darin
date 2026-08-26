export function devLog(...values: unknown[]): void {
  if (typeof __DEV__ !== "undefined" && __DEV__) console.log(...values);
}

export function devWarn(...values: unknown[]): void {
  if (typeof __DEV__ !== "undefined" && __DEV__) console.warn(...values);
}
