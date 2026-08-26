import type { MiscIconKey } from "../babylog/BabyLogIcon";
import type { MemoryCriticalKey } from "../../i18nMemoriesCriticalMessages";
import type { MemoryPrivacyType } from "../../types/memory";

export type MemoryPrivacyPresentation = {
  labelKey: MemoryCriticalKey;
  icon: MiscIconKey;
  accent: string;
  soft: string;
};

const PRESENTATION: Record<MemoryPrivacyType, MemoryPrivacyPresentation> = {
  family_circle: {
    labelKey: "memory.critical.056",
    icon: "family",
    accent: "#5E9E8C",
    soft: "#EAF5F1",
  },
  friend_circle: {
    labelKey: "memory.critical.058",
    icon: "handshake",
    accent: "#6795B5",
    soft: "#E9F3F9",
  },
  only_me: {
    labelKey: "memory.critical.060",
    icon: "lock",
    accent: "#8B75B8",
    soft: "#F1ECF8",
  },
  tagged_family: {
    labelKey: "memory.critical.056",
    icon: "family",
    accent: "#5E9E8C",
    soft: "#EAF5F1",
  },
  selected_people: {
    labelKey: "memory.critical.056",
    icon: "family",
    accent: "#5E9E8C",
    soft: "#EAF5F1",
  },
};

export function memoryPrivacyPresentation(privacyType: MemoryPrivacyType): MemoryPrivacyPresentation {
  return PRESENTATION[privacyType];
}

export function memoryPrivacyMessageKey(value: MemoryPrivacyType): MemoryCriticalKey {
  return PRESENTATION[value]?.labelKey ?? "memory.critical.056";
}
