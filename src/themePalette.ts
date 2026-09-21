/** Pure color constants shared by app UI and Node-based QA utilities. */

/** App chrome — white-first. Category pastels stay in `categoryColors`. */
export const APP_BACKGROUND = "#FFFFFF";
export const APP_BACKGROUND_SOFT = "#FFFDF9";
export const SURFACE = "#FFFFFF";
export const NEUTRAL_BORDER = "#EEEAE4";
export const TEXT_PRIMARY = "#1F1F1F";
export const TEXT_SECONDARY = "#7A756F";
export const TEXT_TERTIARY = "#A6A19B";
export const CHARCOAL = TEXT_PRIMARY;
export const CHARCOAL_PRESSED = "#111111";

/** Voice tab signature. Not used as the app-wide brown fill. */
export const VOICE_AMBER = "#E6B24A";
export const VOICE_AMBER_STRONG = "#B77A1F";
export const VOICE_AMBER_SOFT = "#F7EED6";

export const CHIP = "#F4F2EF";

/** Compatibility aliases — surfaces are white; brand fill is charcoal. */
export const OATMEAL_CARD = SURFACE;
export const SOFT_BEIGE = NEUTRAL_BORDER;
export const TEDDY_BROWN = CHARCOAL;
export const DEEP_BROWN = CHARCOAL_PRESSED;
export const SOFT_ACCENT = VOICE_AMBER_SOFT;

export const BRAND_SAGE = CHARCOAL;
export const SAGE_STRONG = CHARCOAL_PRESSED;
export const SAGE_SOFT = VOICE_AMBER_SOFT;
export const BRAND_CORAL = CHARCOAL;
export const CORAL_STRONG = CHARCOAL_PRESSED;
export const CORAL_SOFT = VOICE_AMBER_SOFT;

export const CARD = SURFACE;
export const SOFT = CHIP;
export const BORDER = NEUTRAL_BORDER;
export const INPUT_SURFACE = APP_BACKGROUND_SOFT;

export const ICON_NEUTRAL = TEXT_SECONDARY;

export const ROLE_ADMIN_BG = CHIP;
export const ROLE_ADMIN_TEXT = TEXT_SECONDARY;

export const MIC_INACTIVE_BG = CHIP;
export const MIC_INACTIVE_ICON = TEXT_SECONDARY;

export const TRIAL_SAGE = VOICE_AMBER_SOFT;
export const ACCENT_STRONG = CHARCOAL;
export const ACCENT_SOFT = VOICE_AMBER_SOFT;

export const roleColors = {
  admin: { background: ROLE_ADMIN_BG, text: ROLE_ADMIN_TEXT },
  editor: { background: SOFT, text: TEXT_SECONDARY },
  viewer: { background: SOFT, text: TEXT_SECONDARY },
  friend: { background: SOFT, text: TEXT_SECONDARY },
} as const;

/** Icon / badge accents only — never full-card fills. */
export const categoryColors = {
  diaper: "#c98a54",
  sleep: "#7c83fd",
  breast: "#e8607a",
  formula: "#f0a93c",
  storedMilk: "#e8607a",
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

/** Soft icon-chip washes for overview summary cards. */
export const overviewIconWash = {
  feed: "#FFF6E8",
  sleep: "#EEF0FE",
  diaper: "#E8F7F2",
  activity: "#EEF4FF",
} as const;
