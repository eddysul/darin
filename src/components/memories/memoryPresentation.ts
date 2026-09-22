import type { MiscIconKey } from "../babylog/BabyLogIcon";
import type { MemoryCriticalKey } from "../../i18nMemoriesCriticalMessages";
import type { MemoryCard, MemoryComment, MemoryMedia, MemoryPrivacyType } from "../../types/memory";

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

export function memoryFeedAspectRatio(media?: Pick<MemoryMedia, "width" | "height">): number {
  const width = media?.width;
  const height = media?.height;
  if (!width || !height || !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return 1;
  return Math.min(1.91, Math.max(4 / 5, width / height));
}

export function memoryCommentPreviewText(comment: MemoryComment): string {
  if (comment.commentType === "sticker") return (comment.stickerLabel || comment.body).trim();
  return comment.body.trim();
}

export function memoryFeedImageUrls(card: MemoryCard): string[] {
  const urls = (card.mediaUrls ?? []).filter(Boolean);
  if (urls.length) return urls;
  return card.coverUrl ? [card.coverUrl] : [];
}

export function memoryFeedSlides(card: MemoryCard): Array<{
  key: string;
  uri: string;
  posterUri?: string;
  media?: MemoryMedia;
}> {
  if (card.media?.length) {
    return card.media.map((media, index) => {
      const uri = card.mediaUrls?.[index] ?? "";
      const poster = card.mediaPosterUrls?.[index] || (media.mediaType === "image" ? uri || card.coverUrl : undefined);
      return {
        key: media.id,
        uri: media.mediaType === "video" ? uri : (uri || card.coverUrl || ""),
        posterUri: poster || undefined,
        media,
      };
    });
  }
  return memoryFeedImageUrls(card).map((uri, index) => ({
    key: `${card.post.id}-${index}`,
    uri,
    posterUri: uri,
  }));
}
