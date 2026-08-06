import type { MemoryPrivacyType } from "../../types/memory";

export type MemoryPrivacyPresentation = {
  label: string;
  icon: string;
  accent: string;
  soft: string;
};

const PRESENTATION: Record<MemoryPrivacyType, MemoryPrivacyPresentation> = {
  family_circle: {
    label: "가족 공개",
    icon: "⌂",
    accent: "#5E9E8C",
    soft: "#EAF5F1",
  },
  friend_circle: {
    label: "친구 공개",
    icon: "◇",
    accent: "#6795B5",
    soft: "#E9F3F9",
  },
  only_me: {
    label: "나만 보기",
    icon: "♙",
    accent: "#8B75B8",
    soft: "#F1ECF8",
  },
  tagged_family: {
    label: "태그된 가족",
    icon: "#",
    accent: "#D98A52",
    soft: "#FFF0E5",
  },
  selected_people: {
    label: "선택 공개",
    icon: "✓",
    accent: "#6F91B8",
    soft: "#EAF1F8",
  },
};

export function memoryPrivacyPresentation(privacyType: MemoryPrivacyType): MemoryPrivacyPresentation {
  return PRESENTATION[privacyType];
}
