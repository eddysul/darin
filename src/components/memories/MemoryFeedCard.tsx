import { memo, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { Image } from "expo-image";
import { ResizeMode } from "expo-av";
import { BabyLogIcon } from "../babylog/BabyLogIcon";
import { ProfileAvatar } from "../profile/ProfileAvatar";
import { useLanguage } from "../../LanguageContext";
import type { MemoryCard } from "../../types/memory";
import { formatLocalizedDate } from "../../utils/localeFormat";
import { colors } from "../../theme";
import {
  memoryCommentPreviewText,
  memoryFeedAspectRatio,
  memoryFeedSlides,
  memoryPrivacyPresentation,
} from "./memoryPresentation";
import { MemoryVideoPlayer } from "./MemoryVideoPlayer";

const TOUCH_MIN = Platform.select({ ios: 44, android: 48 }) ?? 44;
const CAPTION_EXPAND_AT = 80;

type Props = {
  item: MemoryCard;
  authorName: string;
  authorAvatarUrl?: string;
  expanded: boolean;
  likeWorking: boolean;
  saveWorking?: boolean;
  targetLabel?: string;
  subtitle?: string;
  showSave?: boolean;
  commentAuthorName: (authorId: string) => string;
  onToggleCaption: () => void;
  onToggleLike: () => void;
  onToggleSave?: () => void;
  onOpenComments: () => void;
  onOpenMedia: (index: number) => void;
  onOpenMenu?: () => void;
  onRetryUpload?: () => void;
  playbackActive?: boolean;
};

export const MemoryFeedCard = memo(function MemoryFeedCard({
  item,
  authorName,
  authorAvatarUrl,
  expanded,
  likeWorking,
  saveWorking,
  targetLabel,
  subtitle,
  showSave = true,
  commentAuthorName,
  onToggleCaption,
  onToggleLike,
  onToggleSave,
  onOpenComments,
  onOpenMedia,
  onOpenMenu,
  onRetryUpload,
  playbackActive = false,
}: Props) {
  const { t, locale } = useLanguage();
  const { width: windowWidth } = useWindowDimensions();
  const [page, setPage] = useState(0);
  const privacy = memoryPrivacyPresentation(item.post.privacyType);
  const caption = item.post.caption?.trim() ?? "";
  const slides = memoryFeedSlides(item);
  const aspectRatio = memoryFeedAspectRatio(item.media?.[0] ?? item.coverMedia);
  const mediaHeight = windowWidth / aspectRatio;
  const failMessage = item.publishError
    ? t("memory.critical.048")
    : item.media?.some((media) => media.mediaType === "video" && media.uploadStatus === "failed")
      ? t("memory.critical.194")
      : t("memory.critical.049");
  const canExpandCaption = caption.length > CAPTION_EXPAND_AT;
  const latest = item.latestComment;
  const latestPreview = latest ? memoryCommentPreviewText(latest) : "";
  const createdAt = new Date(item.post.createdAt);
  const photoLabel = slides[0]
    ? `${caption || t("memory.critical.036")}${item.mediaCount > 1 ? `, ${t("memory.critical.037", { count: item.mediaCount })}` : ""}`
    : `${caption || t("memory.critical.036")}, ${t("memory.critical.038")}`;

  return (
    <View style={styles.post}>
      <View style={styles.header}>
        <ProfileAvatar uri={authorAvatarUrl} size={32} />
        <View style={styles.headerCopy}>
          <Text style={styles.author} numberOfLines={1}>{authorName}</Text>
          {subtitle || targetLabel ? (
            <Text style={styles.headerMeta} numberOfLines={1}>
              {subtitle || targetLabel}
            </Text>
          ) : null}
        </View>
        {onOpenMenu ? (
          <Pressable
            style={styles.iconHit}
            onPress={onOpenMenu}
            accessibilityRole="button"
            accessibilityLabel={t("memory.critical.184")}
          >
            <BabyLogIcon kind="more" size={20} color={colors.text} />
          </Pressable>
        ) : null}
      </View>

      <View style={[styles.media, { width: windowWidth, height: mediaHeight }]}>
        {slides.length ? (
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(event) => {
              setPage(Math.round(event.nativeEvent.contentOffset.x / Math.max(windowWidth, 1)));
            }}
          >
            {slides.map((slide, index) => {
              const isVideo = slide.media?.mediaType === "video";
              return (
                <View key={slide.key} style={{ width: windowWidth, height: mediaHeight }}>
                  {isVideo ? (
                    <MemoryVideoPlayer
                      media={slide.media}
                      sourceUri={slide.uri}
                      posterUri={slide.posterUri}
                      active={playbackActive && page === index}
                      resizeMode={ResizeMode.COVER}
                      onRequestFullscreen={() => onOpenMedia(index)}
                    />
                  ) : (
                    <Pressable
                      style={StyleSheet.absoluteFill}
                      onPress={() => onOpenMedia(index)}
                      accessibilityRole="imagebutton"
                      accessibilityLabel={photoLabel}
                      accessibilityHint={t("memory.critical.185")}
                    >
                      {slide.uri || slide.posterUri ? (
                        <Image source={{ uri: slide.uri || slide.posterUri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={120} />
                      ) : (
                        <View style={styles.mediaEmpty}>
                          <BabyLogIcon kind="folder" size={32} color={colors.faint} />
                        </View>
                      )}
                    </Pressable>
                  )}
                </View>
              );
            })}
          </ScrollView>
        ) : (
          <View style={styles.mediaEmpty}>
            <BabyLogIcon kind="folder" size={32} color={colors.faint} />
          </View>
        )}
        {slides.length > 1 ? (
          <View style={styles.indexBadge} pointerEvents="none" accessibilityElementsHidden>
            <Text style={styles.indexBadgeText}>{`${page + 1}/${slides.length}`}</Text>
          </View>
        ) : null}
        {item.hasFailedMedia || item.publishError ? (
          <View style={styles.failBanner} accessibilityRole="alert" accessibilityLiveRegion="assertive" accessibilityLabel={failMessage}>
            <Text style={styles.failText}>{failMessage}</Text>
            {onRetryUpload ? (
              <Pressable style={styles.retry} onPress={onRetryUpload} accessibilityRole="button" accessibilityLabel={t("memory.critical.017")}>
                <Text style={styles.retryText}>{t("memory.critical.017")}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>

      {slides.length > 1 ? (
        <View style={styles.dots} pointerEvents="none" accessibilityElementsHidden>
          {slides.map((slide, index) => (
            <View key={`dot-${slide.key}`} style={[styles.dot, index === page && styles.dotActive]} />
          ))}
        </View>
      ) : null}

      <View style={styles.actions}>
        <Pressable
          style={({ pressed }) => [styles.iconHit, pressed && styles.pressed]}
          onPress={onToggleLike}
          disabled={likeWorking}
          accessibilityRole="button"
          accessibilityLabel={item.isLiked ? t("memory.critical.043", { count: item.reactionCount }) : t("memory.critical.042", { count: item.reactionCount })}
          accessibilityState={{ selected: item.isLiked, disabled: likeWorking }}
        >
          <BabyLogIcon
            kind="heart"
            size={24}
            color={item.isLiked ? colors.brandCoral : colors.text}
            strokeWidth={2.1}
            fill={item.isLiked ? colors.brandCoral : "transparent"}
          />
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.iconHit, pressed && styles.pressed]}
          onPress={onOpenComments}
          accessibilityRole="button"
          accessibilityLabel={t("memory.critical.045", { count: item.commentCount })}
        >
          <BabyLogIcon kind="chat" size={24} color={colors.text} />
        </Pressable>
        <View style={styles.actionSpacer} />
        {showSave && onToggleSave ? (
          <Pressable
            style={({ pressed }) => [styles.iconHit, pressed && styles.pressed]}
            onPress={onToggleSave}
            disabled={saveWorking}
            accessibilityRole="button"
            accessibilityLabel={item.isSaved ? t("memory.critical.047") : t("memory.critical.046")}
            accessibilityState={{ selected: item.isSaved, disabled: saveWorking }}
          >
            <BabyLogIcon
              kind="bookmark"
              size={24}
              color={colors.text}
              fill={item.isSaved ? colors.text : "transparent"}
            />
          </Pressable>
        ) : null}
      </View>

      {item.reactionCount > 0 ? (
        <Text style={styles.likes}>{t("memory.critical.044", { count: item.reactionCount })}</Text>
      ) : null}

      {caption ? (
        <Text style={styles.caption} numberOfLines={expanded ? undefined : 3}>
          <Text style={styles.captionAuthor}>{authorName}  </Text>
          {caption}
        </Text>
      ) : null}
      {canExpandCaption ? (
        <Pressable style={styles.moreButton} onPress={onToggleCaption} hitSlop={8} accessibilityRole="button">
          <Text style={styles.moreText}>{expanded ? t("memory.critical.040") : t("memory.critical.041")}</Text>
        </Pressable>
      ) : null}

      {latest && latestPreview ? (
        <Pressable onPress={onOpenComments} accessibilityRole="button" accessibilityLabel={t("memory.critical.181")}>
          <Text style={styles.commentPreview} numberOfLines={1}>
            <Text style={styles.captionAuthor}>{commentAuthorName(latest.authorId)}  </Text>
            {latestPreview}
          </Text>
        </Pressable>
      ) : null}
      <Pressable
        style={styles.viewAll}
        onPress={onOpenComments}
        accessibilityRole="button"
        accessibilityLabel={item.commentCount > 0 ? t("memory.critical.183", { count: item.commentCount }) : t("memory.critical.189")}
      >
        <Text style={styles.viewAllText}>
          {item.commentCount > 0 ? t("memory.critical.183", { count: item.commentCount }) : t("memory.critical.189")}
        </Text>
      </Pressable>
      <Text style={styles.date}>
        {formatLocalizedDate(createdAt, locale, { month: "long", day: "numeric" })}
      </Text>
      <View style={[styles.privacyHint, { backgroundColor: privacy.soft }]}>
        <BabyLogIcon kind={privacy.icon} size={11} color={privacy.accent} strokeWidth={2.2} />
        <Text style={[styles.privacyHintText, { color: privacy.accent }]}>{t(privacy.labelKey)}</Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  post: { backgroundColor: colors.background, paddingBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  header: { minHeight: TOUCH_MIN, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 10 },
  headerCopy: { flex: 1, minWidth: 0 },
  author: { color: colors.text, fontSize: 13.5, fontWeight: "800" },
  headerMeta: { color: colors.muted, fontSize: 11.5, marginTop: 1, fontWeight: "600" },
  iconHit: { width: TOUCH_MIN, height: TOUCH_MIN, alignItems: "center", justifyContent: "center" },
  media: { backgroundColor: colors.cardHi, overflow: "hidden" },
  mediaEmpty: { flex: 1, alignItems: "center", justifyContent: "center" },
  indexBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    minHeight: 24,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  indexBadgeText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  failBanner: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 12,
    minHeight: 44,
    paddingLeft: 12,
    paddingRight: 6,
    borderRadius: 14,
    backgroundColor: "rgba(46,42,38,0.82)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  failText: { color: "#fff", fontSize: 12, fontWeight: "700", flexShrink: 1 },
  retry: { minHeight: 44, minWidth: 72, paddingHorizontal: 10, alignItems: "center", justifyContent: "center" },
  retryText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  dots: { flexDirection: "row", justifyContent: "center", gap: 5, minHeight: 8, marginTop: 8 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.border },
  dotActive: { backgroundColor: colors.text, width: 14 },
  actions: { flexDirection: "row", alignItems: "center", paddingHorizontal: 6, marginTop: 2 },
  actionSpacer: { flex: 1 },
  likes: { color: colors.text, fontSize: 13.5, fontWeight: "800", paddingHorizontal: 14, marginTop: 2 },
  caption: { color: colors.text, fontSize: 14, lineHeight: 20, paddingHorizontal: 14, marginTop: 6 },
  captionAuthor: { fontWeight: "800" },
  moreButton: { alignSelf: "flex-start", minHeight: TOUCH_MIN, justifyContent: "center", paddingHorizontal: 14 },
  moreText: { color: colors.faint, fontSize: 13, fontWeight: "700" },
  commentPreview: { color: colors.text, fontSize: 13.5, lineHeight: 19, paddingHorizontal: 14, marginTop: 6 },
  viewAll: { alignSelf: "flex-start", minHeight: TOUCH_MIN, justifyContent: "center", paddingHorizontal: 14 },
  viewAllText: { color: colors.faint, fontSize: 13, fontWeight: "700" },
  date: { color: colors.faint, fontSize: 11, fontWeight: "600", paddingHorizontal: 14, marginTop: 2, textTransform: "uppercase" },
  privacyHint: {
    alignSelf: "flex-start",
    marginTop: 8,
    marginHorizontal: 14,
    minHeight: 22,
    paddingHorizontal: 8,
    borderRadius: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  privacyHintText: { fontSize: 10.5, fontWeight: "800" },
  pressed: { opacity: 0.7 },
});
