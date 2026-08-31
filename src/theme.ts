import { DynamicColorIOS, Platform, PlatformColor, type ColorValue } from "react-native";
import { BRAND_CORAL, categoryColors } from "./themePalette";

export { categoryColors } from "./themePalette";

const BRAND_CORAL_SOFT = "rgba(232,145,138,0.16)";
const PRIMARY_CORAL = "#B65B55";
const PRIMARY_CORAL_PRESSED = "#A94E49";
const PRIMARY_CORAL_DISABLED = "#D6AAA6";

/**
 * Native adaptive colors let the existing static StyleSheets react to the
 * system appearance without rebuilding every screen at runtime. iOS keeps
 * Darin's warm cream/brown character; Android follows the platform surface
 * and text roles while the coral brand colors remain stable.
 */
function adaptiveColor(
  light: string,
  dark: string,
  androidRole?: string,
): string {
  let value: ColorValue = light;
  if (Platform.OS === "ios") value = DynamicColorIOS({ light, dark });
  // Semantic Android roles adapt natively. Stable brand colors deliberately
  // keep their light value so they do not unexpectedly invert.
  if (Platform.OS === "android" && androidRole) value = PlatformColor(androidRole);
  return value as unknown as string;
}

export const lightThemeColors = {
  background: "#FEF7F2",
  card: "#FFFFFF",
  text: "#2E2A26",
  muted: "#6B655E",
  border: "#EDE5DC",
} as const;

export const darkThemeColors = {
  /** Warm near-black instead of pure black preserves Darin's cream tone. */
  background: "#181513",
  card: "#24201D",
  text: "#F7EEE7",
  muted: "#C7BCB3",
  border: "#443B35",
} as const;

export const colors = {
  background: adaptiveColor(lightThemeColors.background, darkThemeColors.background, "?attr/colorBackground"),
  backgroundSecondary: adaptiveColor("#FFFFFF", "#201C19", "?attr/colorBackgroundFloating"),
  card: adaptiveColor(lightThemeColors.card, darkThemeColors.card, "?attr/colorBackgroundFloating"),
  cardHi: adaptiveColor("#FAF4EE", "#2B2521", "?attr/colorBackgroundFloating"),
  text: adaptiveColor(lightThemeColors.text, darkThemeColors.text, "?attr/textColorPrimary"),
  /** Secondary text. >=4.5:1 on every light surface incl. cardHi. */
  muted: adaptiveColor(lightThemeColors.muted, darkThemeColors.muted, "?attr/textColorSecondary"),
  /** Tertiary text and placeholders. >=4.5:1 on every light surface incl. cardHi. */
  faint: adaptiveColor("#736D65", "#B3A69D", "?attr/textColorSecondary"),
  border: adaptiveColor(lightThemeColors.border, darkThemeColors.border, "?attr/colorControlNormal"),
  /** Darin's soft brand accent. Keep this for decorative and selected-state accents. */
  brandCoral: BRAND_CORAL,
  brandCoralSoft: BRAND_CORAL_SOFT,
  /** Readable content on solid brandCoral fills used by selected controls. */
  brandCoralForeground: "#2E2A26",
  /** Fill / border accent. Do not use as text on cream or white. */
  amber: BRAND_CORAL,
  amberSoft: adaptiveColor(BRAND_CORAL_SOFT, "rgba(232,145,138,0.22)"),
  /** Text/icon on light surfaces. ~5.4:1 on #FFFFFF. */
  amberText: adaptiveColor("#B03A34", "#F2A8A1", "?attr/textColorPrimary"),
  /** Content on coral fills (primary buttons, selected chips, FAB). */
  amberDark: "#FFFFFF",
  /** Content on dark fills and scrims (photo overlays, Apple button). */
  onDark: "#FFFFFF",
  /** Accent text on dark surfaces (toasts). ~9:1 on the toast scrim. */
  accentOnDark: "#F7B3AB",
  danger: adaptiveColor("#C0463F", "#F28B82"),
  dangerSoft: adaptiveColor("rgba(192,70,63,0.12)", "rgba(242,139,130,0.18)"),
  dangerText: adaptiveColor("#B03A34", "#FFAAA2", "?attr/textColorPrimary"),
  black: adaptiveColor("#2E2A26", "#F7EEE7", "?attr/textColorPrimary"),
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
  inputBg: adaptiveColor("#FFFFFF", "#2A2521", "?attr/colorBackgroundFloating"),
  sageSurface: adaptiveColor("#FAF4EE", "#2B2521", "?attr/colorBackgroundFloating"),
  champagne: BRAND_CORAL_SOFT,
  /** Alias of amber. Prefer amber in new code. */
  gold: BRAND_CORAL,
  deepSage: adaptiveColor("#FEF7F2", "#181513", "?attr/colorBackground"),
  sage: adaptiveColor("#FEF7F2", "#181513", "?attr/colorBackground"),
  navy: adaptiveColor("#2E2A26", "#F7EEE7", "?attr/textColorPrimary"),
};

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
  screen: [
    adaptiveColor("#FEF7F2", "#181513", "?attr/colorBackground"),
    adaptiveColor("#FFF9F5", "#211C19", "?attr/colorBackground"),
    adaptiveColor("#FEF7F2", "#181513", "?attr/colorBackground"),
  ] as const,
  hero: [
    adaptiveColor("#FFFFFF", "#29231F", "?attr/colorBackgroundFloating"),
    adaptiveColor("#FAF4EE", "#211C19", "?attr/colorBackground"),
    adaptiveColor("#FEF7F2", "#181513", "?attr/colorBackground"),
  ] as const,
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
