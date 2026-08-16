const AMBER = "#E8918A";
const AMBER_SOFT = "rgba(232,145,138,0.16)";

export const colors = {
  background: "#FEF7F2",
  backgroundSecondary: "#FFFFFF",
  card: "#FFFFFF",
  cardHi: "#FAF4EE",
  text: "#2E2A26",
  muted: "#7A746C",
  faint: "#A39E96",
  border: "#EDE5DC",
  /** Fill / border accent. Do not use as text on cream or white. */
  amber: AMBER,
  amberSoft: AMBER_SOFT,
  /** Text/icon on light surfaces. ~5.4:1 on #FFFFFF. */
  amberText: "#B03A34",
  /** Text on coral fills. */
  amberDark: "#FFFFFF",
  danger: "#C0463F",
  dangerSoft: "rgba(192,70,63,0.12)",
  dangerText: "#B03A34",
  black: "#2E2A26",
  /** Alias of amber. Prefer amber in new code. */
  yellow: AMBER,
  /** Alias of amberSoft. Prefer amberSoft in new code. */
  yellowSoft: AMBER_SOFT,
  /** Alias of amber. Prefer amber in new code. */
  primary: AMBER,
  primaryForeground: "#FFFFFF",
  /** Alias of amber. Prefer amber in new code. */
  accent: AMBER,
  /** Alias of amber. Prefer amber in new code. */
  accentGold: AMBER,
  inputBg: "#FFFFFF",
  sageSurface: "#FAF4EE",
  champagne: AMBER_SOFT,
  /** Alias of amber. Prefer amber in new code. */
  gold: AMBER,
  deepSage: "#FEF7F2",
  sage: "#FEF7F2",
  navy: "#2E2A26",
};

export const categoryColors = {
  diaper: "#c98a54",
  sleep: "#7c83fd",
  breast: "#e8607a",
  formula: "#f0a93c",
  storedMilk: "#E8918A",
  food: "#4ec9b0",
  water: "#55AEE6",
  milk: "#89A9D9",
  pump: "#ec7fb8",
  bath: "#4fa8e0",
  doctor: "#6fcf7a",
  vaccination: "#6E9FD8",
  temp: "#e8654a",
  med: "#3fa66e",
  snack: "#e0a6a6",
  tummy: "#5b8dee",
  play: "#9b7fe8",
  memo: "#9096a6",
  other: "#C59AD8",
} as const;

export const type = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 20,
  xl: 24,
} as const;

/** Cap Dynamic Type on chrome so headers/tabs do not overflow. Body copy can still scale. */
export const fontScaleCap = {
  tab: 1.2,
  chrome: 1.3,
} as const;

export const gradients = {
  screen: ["#FEF7F2", "#FFF9F5", "#FEF7F2"] as const,
  hero: ["#FFFFFF", "#FAF4EE", "#FEF7F2"] as const,
  mic: [AMBER, "#D47870"] as const,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const radius = {
  md: 12,
  lg: 16,
  xl: 22,
  full: 999,
};
