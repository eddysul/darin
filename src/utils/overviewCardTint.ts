const CARD_TINT_WHITE = 0.88;
const FALLBACK_TINT = "#f4f2ef";

function normalizeHex(hex: string): string | null {
  const raw = hex.trim().replace(/^#/, "");
  const six = raw.length === 3
    ? raw.split("").map((part) => `${part}${part}`).join("")
    : raw.slice(0, 6);
  return /^[0-9a-fA-F]{6}$/.test(six) ? `#${six.toLowerCase()}` : null;
}

/** Mix a record-page category color toward white so extra cards match 수유·수면 pastels. */
export function mixHexWithWhite(hex: string, amount = CARD_TINT_WHITE): string {
  const normalized = normalizeHex(hex);
  if (!normalized) return FALLBACK_TINT;
  const value = normalized.slice(1);
  const mix = (channel: number) => Math.round(channel + (255 - channel) * amount);
  const red = mix(Number.parseInt(value.slice(0, 2), 16));
  const green = mix(Number.parseInt(value.slice(2, 4), 16));
  const blue = mix(Number.parseInt(value.slice(4, 6), 16));
  return `#${[red, green, blue].map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}
