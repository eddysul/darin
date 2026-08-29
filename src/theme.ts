const BRAND_CORAL = "#E8918A";
const BRAND_CORAL_SOFT = "rgba(232,145,138,0.16)";
const PRIMARY_CORAL = "#B65B55";
const PRIMARY_CORAL_PRESSED = "#A94E49";
const PRIMARY_CORAL_DISABLED = "#D6AAA6";

export const colors = {
  background: "#FEF7F2",
  backgroundSecondary: "#FFFFFF",
  card: "#FFFFFF",
  cardHi: "#FAF4EE",
  text: "#2E2A26",
  /** Secondary text. >=4.5:1 on every light surface incl. cardHi. */
  muted: "#6B655E",
  /** Tertiary text and placeholders. >=4.5:1 on every light surface incl. cardHi. */
  faint: "#736D65",
  border: "#EDE5DC",
  /** Darin's soft brand accent. Keep this for decorative and selected-state accents. */
  brandCoral: BRAND_CORAL,
  brandCoralSoft: BRAND_CORAL_SOFT,
  /** Readable content on solid brandCoral fills used by selected controls. */
  brandCoralForeground: "#2E2A26",
  /** Fill / border accent. Do not use as text on cream or white. */
  amber: BRAND_CORAL,
  amberSoft: BRAND_CORAL_SOFT,
  /** Text/icon on light surfaces. ~5.4:1 on #FFFFFF. */
  amberText: "#B03A34",
  /** Content on coral fills (primary buttons, selected chips, FAB). */
  amberDark: "#FFFFFF",
  /** Content on dark fills and scrims (photo overlays, Apple button). */
  onDark: "#FFFFFF",
  /** Accent text on dark surfaces (toasts). ~9:1 on the toast scrim. */
  accentOnDark: "#F7B3AB",
  danger: "#C0463F",
  dangerSoft: "rgba(192,70,63,0.12)",
  dangerText: "#B03A34",
  black: "#2E2A26",
  /** Alias of brandCoral. Prefer brandCoral in new code. */
  yellow: BRAND_CORAL,
  /** Alias of amberSoft. Prefer amberSoft in new code. */
  yellowSoft: BRAND_CORAL_SOFT,
  /** High-emphasis filled actions only. 4.55:1 with primaryForeground. */
  primaryCoral: PRIMARY_CORAL,
  primaryCoralPressed: PRIMARY_CORAL_PRESSED,
  primaryCoralDisabled: PRIMARY_CORAL_DISABLED,
  /** Semantic aliases used by filled-action components. */
  primary: PRIMARY_CORAL,
  primaryPressed: PRIMARY_CORAL_PRESSED,
  primaryDisabled: PRIMARY_CORAL_DISABLED,
  /** Content on primary/primaryPressed fills. */
  primaryForeground: "#FFFFFF",
  /** Alias of amber. Prefer amber in new code. */
  accent: BRAND_CORAL,
  /** Alias of amber. Prefer amber in new code. */
  accentGold: BRAND_CORAL,
  inputBg: "#FFFFFF",
  sageSurface: "#FAF4EE",
  champagne: BRAND_CORAL_SOFT,
  /** Alias of amber. Prefer amber in new code. */
  gold: BRAND_CORAL,
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
  /** Dense control labels and single-line inputs still grow without consuming the full viewport. */
  control: 1.6,
} as const;

export const gradients = {
  screen: ["#FEF7F2", "#FFF9F5", "#FEF7F2"] as const,
  hero: ["#FFFFFF", "#FAF4EE", "#FEF7F2"] as const,
  mic: [BRAND_CORAL, "#D47870"] as const,
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
