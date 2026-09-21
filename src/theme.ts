import { DynamicColorIOS, Platform, PlatformColor, type ColorValue } from "react-native";
import {
  ACCENT_SOFT,
  ACCENT_STRONG,
  APP_BACKGROUND,
  APP_BACKGROUND_SOFT,
  BORDER,
  BRAND_CORAL,
  CARD,
  CHARCOAL_PRESSED,
  CHIP,
  ICON_NEUTRAL,
  INPUT_SURFACE,
  SURFACE,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  TEXT_TERTIARY,
  VOICE_AMBER,
  VOICE_AMBER_SOFT,
  VOICE_AMBER_STRONG,
} from "./themePalette";

export { categoryColors, overviewIconWash, roleColors } from "./themePalette";

const PRIMARY_CORAL = TEXT_PRIMARY;
const PRIMARY_CORAL_PRESSED = CHARCOAL_PRESSED;
const PRIMARY_CORAL_DISABLED = "#D8D4CF";

/**
 * Native adaptive colors let existing StyleSheets follow system appearance.
 * Light is white-first; dark uses neutral near-black rather than warm brown.
 */
function adaptiveColor(
  light: string,
  dark: string,
  androidRole?: string,
): string {
  let value: ColorValue = light;
  if (Platform.OS === "ios") value = DynamicColorIOS({ light, dark });
  if (Platform.OS === "android" && androidRole) value = PlatformColor(androidRole);
  return value as unknown as string;
}

export const lightThemeColors = {
  background: APP_BACKGROUND,
  card: SURFACE,
  text: TEXT_PRIMARY,
  muted: TEXT_SECONDARY,
  border: BORDER,
} as const;

export const darkThemeColors = {
  background: "#121212",
  card: "#1C1C1C",
  text: "#F5F5F5",
  muted: "#A8A39E",
  border: "#2E2E2E",
} as const;

export const colors = {
  background: adaptiveColor(lightThemeColors.background, darkThemeColors.background, "?attr/colorBackground"),
  backgroundSecondary: adaptiveColor(APP_BACKGROUND_SOFT, "#161616", "?attr/colorBackgroundFloating"),
  card: adaptiveColor(lightThemeColors.card, darkThemeColors.card, "?attr/colorBackgroundFloating"),
  /** Quiet grouped surface. Prefer white cards with a border over tinted fills. */
  surface: adaptiveColor(APP_BACKGROUND_SOFT, "#1A1A1A", "?attr/colorBackgroundFloating"),
  cardHi: adaptiveColor(APP_BACKGROUND_SOFT, "#1A1A1A", "?attr/colorBackgroundFloating"),
  chip: adaptiveColor(CHIP, "#262626", "?attr/colorBackgroundFloating"),
  text: adaptiveColor(lightThemeColors.text, darkThemeColors.text, "?attr/textColorPrimary"),
  muted: adaptiveColor(lightThemeColors.muted, darkThemeColors.muted, "?attr/textColorSecondary"),
  faint: adaptiveColor(TEXT_TERTIARY, "#9C9792", "?attr/textColorSecondary"),
  iconNeutral: adaptiveColor(ICON_NEUTRAL, "#C2BDB8", "?attr/textColorSecondary"),
  border: adaptiveColor(lightThemeColors.border, darkThemeColors.border, "?attr/colorControlNormal"),
  brandCoral: BRAND_CORAL,
  brandCoralSoft: ACCENT_SOFT,
  /** Text on light amber washes (selected chips). */
  brandCoralForeground: VOICE_AMBER_STRONG,
  accentSoft: adaptiveColor(ACCENT_SOFT, "rgba(230,178,74,0.22)"),
  accentStrong: adaptiveColor(ACCENT_STRONG, VOICE_AMBER_SOFT),
  amber: VOICE_AMBER,
  amberSoft: adaptiveColor(VOICE_AMBER_SOFT, "rgba(230,178,74,0.22)"),
  amberText: adaptiveColor(VOICE_AMBER_STRONG, VOICE_AMBER_SOFT, "?attr/textColorPrimary"),
  /** Content on solid amber fills (voice mic). */
  amberDark: "#FFFFFF",
  onDark: "#FFFFFF",
  accentOnDark: VOICE_AMBER,
  voiceAmber: VOICE_AMBER,
  voiceAmberStrong: VOICE_AMBER_STRONG,
  danger: adaptiveColor("#C0463F", "#F28B82"),
  dangerSoft: adaptiveColor("rgba(192,70,63,0.12)", "rgba(242,139,130,0.18)"),
  dangerText: adaptiveColor("#B03A34", "#FFAAA2", "?attr/textColorPrimary"),
  black: adaptiveColor(TEXT_PRIMARY, "#F5F5F5", "?attr/textColorPrimary"),
  yellow: VOICE_AMBER,
  yellowSoft: VOICE_AMBER_SOFT,
  primaryCoral: PRIMARY_CORAL,
  primaryCoralPressed: PRIMARY_CORAL_PRESSED,
  primaryCoralDisabled: PRIMARY_CORAL_DISABLED,
  primary: PRIMARY_CORAL,
  primaryPressed: PRIMARY_CORAL_PRESSED,
  primaryDisabled: PRIMARY_CORAL_DISABLED,
  primaryForeground: "#FFFFFF",
  accent: VOICE_AMBER,
  accentGold: VOICE_AMBER,
  inputBg: adaptiveColor(INPUT_SURFACE, "#222222", "?attr/colorBackgroundFloating"),
  sageSurface: adaptiveColor(APP_BACKGROUND_SOFT, "#1A1A1A", "?attr/colorBackgroundFloating"),
  champagne: ACCENT_SOFT,
  gold: VOICE_AMBER,
  deepSage: adaptiveColor(lightThemeColors.background, darkThemeColors.background, "?attr/colorBackground"),
  sage: adaptiveColor(lightThemeColors.background, darkThemeColors.background, "?attr/colorBackground"),
  navy: adaptiveColor(TEXT_PRIMARY, "#F5F5F5", "?attr/textColorPrimary"),
  trialSage: ACCENT_SOFT,
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
  control: 1.6,
} as const;

export const gradients = {
  screen: [
    adaptiveColor(lightThemeColors.background, darkThemeColors.background, "?attr/colorBackground"),
    adaptiveColor(SURFACE, "#161616", "?attr/colorBackground"),
    adaptiveColor(lightThemeColors.background, darkThemeColors.background, "?attr/colorBackground"),
  ] as const,
  hero: [
    adaptiveColor(SURFACE, "#1C1C1C", "?attr/colorBackgroundFloating"),
    adaptiveColor(CARD, "#161616", "?attr/colorBackground"),
    adaptiveColor(lightThemeColors.background, darkThemeColors.background, "?attr/colorBackground"),
  ] as const,
  mic: [VOICE_AMBER, VOICE_AMBER_STRONG] as const,
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
