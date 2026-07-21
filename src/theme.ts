export const colors = {
  background: "#FEF7F2",
  backgroundSecondary: "#FFFFFF",
  card: "#FFFFFF",
  cardHi: "#FAF4EE",
  text: "#2E2A26",
  muted: "#7A746C",
  faint: "#A39E96",
  border: "#EDE5DC",
  amber: "#E8918A",
  amberSoft: "rgba(232,145,138,0.16)",
  amberDark: "#FFFFFF",
  danger: "#C0463F",
  dangerSoft: "rgba(192,70,63,0.12)",
  dangerText: "#B03A34",
  black: "#2E2A26",
  /** @deprecated use amber */
  yellow: "#E8918A",
  /** @deprecated use amberSoft */
  yellowSoft: "rgba(232,145,138,0.16)",
  primary: "#E8918A",
  primaryForeground: "#FFFFFF",
  accent: "#E8918A",
  accentGold: "#E8918A",
  inputBg: "#FFFFFF",
  sageSurface: "#FAF4EE",
  champagne: "rgba(232,145,138,0.16)",
  gold: "#E8918A",
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
  temp: "#e8654a",
  med: "#3fa66e",
  snack: "#e0a6a6",
  tummy: "#5b8dee",
  play: "#9b7fe8",
  memo: "#9096a6",
  other: "#C59AD8",
} as const;

export const gradients = {
  screen: ["#FEF7F2", "#FFF9F5", "#FEF7F2"] as const,
  hero: ["#FFFFFF", "#FAF4EE", "#FEF7F2"] as const,
  mic: ["#E8918A", "#D47870"] as const,
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
