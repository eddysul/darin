import { useCallback, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useIsFocused } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BabyLogIcon } from "../../components/babylog/BabyLogIcon";
import { MemoryCommentsSheet } from "../../components/memories/MemoryCommentsSheet";
import { MemoryFeedCard } from "../../components/memories/MemoryFeedCard";
import { MemoryMediaLightbox } from "../../components/memories/MemoryMediaLightbox";
import { memoryFeedSlides } from "../../components/memories/memoryPresentation";
import { MemoriesRepository, MEMORY_FEED_PAGE_SIZE } from "../../repositories/MemoriesRepository";
import { ProfileRepository } from "../../repositories/ProfileRepository";
import type { DisplayProfile } from "../../types/profileSettings";
import type { FriendMemoryContext, MemoryCard, MemoryMedia } from "../../types/memory";
import { colors, radius } from "../../theme";
import { useLanguage } from "../../LanguageContext";
import { caughtErrorMessage } from "../../utils/familyDisplay";
import {
  memoryAuthorIdsFromCards,
  mergeDisplayProfiles,
  resolveMemoryAuthorAvatarUrl,
  resolveMemoryAuthorName,
} from "../../utils/memoryAuthorDisplay";
import { MEMORY_FEED_VIEWABILITY_CONFIG, memoryFeedPostIdFromViewable } from "../../utils/memoryFeedPlayback";

type Props = {
  onOpenNotifications: () => void;
};

export function FriendMemoriesScreen({ onOpenNotifications }: Props) {
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const [contexts, setContexts] = useState<FriendMemoryContext[]>([]);
  const [cards, setCards] = useState<MemoryCard[]>([]);
  const [profiles, setProfiles] = useState<DisplayProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [workingIds, setWorkingIds] = useState<Set<string>>(() => new Set());
  const [expandedCaptions, setExpandedCaptions] = useState<Set<string>>(() => new Set());
  const [commentsPostId, setCommentsPostId] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{
    postId: string;
    media: MemoryMedia[];
    imageUrls: string[];
    posterUrls: string[];
    index: number;
  } | null>(null);
  const [activePostId, setActivePostId] = useState<string | null>(null);
  const isFocused = useIsFocused();
  const pageOffsetsRef = useRef<Map<string, number>>(new Map());
  const exhaustedBabyIdsRef = useRef<Set<string>>(new Set());
  const loadingMoreRef = useRef(false);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    setError("");
    try {
      const nextContexts = await MemoriesRepository.listMyFriendMemoryContexts();
      const lists = await Promise.all(nextContexts.map((item) => MemoriesRepository.listCardsByBabyId(item.babyId, {
        offset: 0,
        limit: MEMORY_FEED_PAGE_SIZE,
      })));
      pageOffsetsRef.current = new Map(nextContexts.map((item, index) => [item.babyId, lists[index]?.length ?? 0]));
      exhaustedBabyIdsRef.current = new Set(nextContexts
        .filter((_, index) => (lists[index]?.length ?? 0) < MEMORY_FEED_PAGE_SIZE)
        .map((item) => item.babyId));
      const nextCards = lists.flat()
        .filter((item) => item.post.privacyType === "friend_circle" && item.post.status === "published" && !item.post.deletedAt)
        .sort((a, b) => b.post.createdAt.localeCompare(a.post.createdAt));
      const nextProfiles = await ProfileRepository.listMemoryAuthorDisplayProfiles(
        memoryAuthorIdsFromCards(nextCards),
      ).catch(() => [] as DisplayProfile[]);
      setContexts(nextContexts);
      setCards(nextCards);
      setProfiles(nextProfiles);
    } catch (cause) {
      setContexts([]);
      setCards([]);
      setProfiles([]);
      setError(caughtErrorMessage(t, cause, "memory.critical.177"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

  const loadMore = useCallback(async () => {
    if (loadingMoreRef.current || loading || refreshing || error) return;
    const targets = contexts.filter((item) => !exhaustedBabyIdsRef.current.has(item.babyId));
    if (!targets.length) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const lists = await Promise.all(targets.map((item) => MemoriesRepository.listCardsByBabyId(item.babyId, {
        offset: pageOffsetsRef.current.get(item.babyId) ?? 0,
        limit: MEMORY_FEED_PAGE_SIZE,
      })));
      targets.forEach((item, index) => {
        const count = lists[index]?.length ?? 0;
        pageOffsetsRef.current.set(item.babyId, (pageOffsetsRef.current.get(item.babyId) ?? 0) + count);
        if (count < MEMORY_FEED_PAGE_SIZE) exhaustedBabyIdsRef.current.add(item.babyId);
      });
      const incoming = lists.flat()
        .filter((item) => item.post.privacyType === "friend_circle" && item.post.status === "published" && !item.post.deletedAt);
      const incomingProfiles = await ProfileRepository.listMemoryAuthorDisplayProfiles(
        memoryAuthorIdsFromCards(incoming),
      ).catch(() => [] as DisplayProfile[]);
      setCards((current) => {
        const unique = new Map(current.map((card) => [card.post.id, card]));
        incoming.forEach((card) => unique.set(card.post.id, card));
        return [...unique.values()].sort((a, b) => b.post.createdAt.localeCompare(a.post.createdAt));
      });
      setProfiles((current) => mergeDisplayProfiles(current, incomingProfiles));
    } catch (cause) {
      setError(caughtErrorMessage(t, cause, "memory.critical.177"));
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [contexts, error, loading, refreshing, t]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const contextByBabyId = useMemo(() => new Map(contexts.map((item) => [item.babyId, item])), [contexts]);
  const profileById = useMemo(() => new Map(profiles.map((item) => [item.userId, item])), [profiles]);

  const authorName = useCallback((authorId: string) => resolveMemoryAuthorName({
    authorId,
    profile: profileById.get(authorId),
    missingLabel: t("memory.critical.050"),
  }), [profileById, t]);

  const toggleLike = async (card: MemoryCard) => {
    if (workingIds.has(card.post.id)) return;
    const nextLiked = !card.isLiked;
    setWorkingIds((current) => new Set(current).add(card.post.id));
    setCards((current) => current.map((item) => item.post.id === card.post.id ? {
      ...item,
      isLiked: nextLiked,
      reactionCount: Math.max(0, item.reactionCount + (nextLiked ? 1 : -1)),
    } : item));
    try {
      if (nextLiked) await MemoriesRepository.setReaction({ memoryPostId: card.post.id, reactionType: "heart" });
      else await MemoriesRepository.removeReaction(card.post.id);
    } catch (cause) {
      setCards((current) => current.map((item) => item.post.id === card.post.id ? {
        ...item,
        isLiked: card.isLiked,
        reactionCount: card.reactionCount,
      } : item));
      setError(caughtErrorMessage(t, cause, "memory.critical.052"));
    } finally {
      setWorkingIds((current) => { const next = new Set(current); next.delete(card.post.id); return next; });
    }
  };

  const openMedia = (card: MemoryCard, index: number) => {
    const slides = memoryFeedSlides(card);
    const imageUrls = slides.map((slide) => slide.uri || slide.posterUri || "");
    const posterUrls = slides.map((slide) => slide.posterUri || "");
    if (!slides.length) return;
    const media = card.media?.length
      ? card.media
      : card.coverMedia
        ? [card.coverMedia]
        : slides.map((slide) => ({
          id: slide.key,
          memoryPostId: card.post.id,
          babyId: card.post.babyId,
          storagePath: "",
          mediaType: slide.media?.mediaType ?? "image" as const,
          uploadStatus: "ready" as const,
          createdAt: card.post.createdAt,
        }));
    setLightbox({ postId: card.post.id, media, imageUrls, posterUrls, index });
  };

  const commentsCard = commentsPostId ? cards.find((card) => card.post.id === commentsPostId) : undefined;
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: Array<{ isViewable: boolean; item: MemoryCard }> }) => {
    const next = viewableItems.find((entry) => entry.isViewable);
    setActivePostId(next ? memoryFeedPostIdFromViewable(next.item) : null);
  }).current;

  return (
    <View style={styles.root}>
      <FlatList
        data={loading || error ? [] : cards}
        keyExtractor={(item) => item.post.id}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 14, paddingBottom: insets.bottom + 28 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.amberText} />}
        onEndReached={() => void loadMore()}
        onEndReachedThreshold={0.4}
        viewabilityConfig={MEMORY_FEED_VIEWABILITY_CONFIG}
        onViewableItemsChanged={onViewableItemsChanged}
        extraData={`${activePostId}:${isFocused}:${lightbox?.postId ?? ""}`}
        keyboardShouldPersistTaps="handled"
        ListFooterComponent={loadingMore ? <ActivityIndicator style={styles.pageLoader} color={colors.amberText} /> : null}
        ListHeaderComponent={(
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={styles.title}>{t("memory.critical.153")}</Text>
              <Text style={styles.subtitle}>{t("memory.critical.171")}</Text>
            </View>
            <Pressable style={styles.iconButton} onPress={onOpenNotifications} accessibilityLabel={t("memory.critical.172")}>
              <BabyLogIcon kind="bell" size={21} color={colors.text} />
            </Pressable>
          </View>
        )}
        ListEmptyComponent={loading ? (
          <View style={styles.empty}><ActivityIndicator color={colors.amberText} /><Text style={styles.emptyCopy}>{t("memory.critical.173")}</Text></View>
        ) : error ? (
          <View style={styles.empty}><Text style={styles.emptyTitle}>{t("memory.critical.119")}</Text><Text style={styles.emptyCopy}>{error}</Text><Pressable style={styles.retry} onPress={() => void load()}><Text style={styles.retryText}>{t("memory.critical.017")}</Text></Pressable></View>
        ) : (
          <View style={styles.empty}><BabyLogIcon kind="sparkles" size={34} color={colors.muted} /><Text style={styles.emptyTitle}>{t("memory.critical.174")}</Text><Text style={styles.emptyCopy}>{t("memory.critical.175")}</Text></View>
        )}
        renderItem={({ item }) => {
          const context = contextByBabyId.get(item.post.babyId);
          const author = profileById.get(item.post.authorId);
          return (
            <MemoryFeedCard
              item={item}
              authorName={resolveMemoryAuthorName({
                authorId: item.post.authorId,
                profile: author,
                missingLabel: t("memory.critical.050"),
              })}
              authorAvatarUrl={resolveMemoryAuthorAvatarUrl({
                authorId: item.post.authorId,
                profile: author,
              })}
              expanded={expandedCaptions.has(item.post.id)}
              likeWorking={workingIds.has(item.post.id)}
              targetLabel={context?.babyName}
              showSave={false}
              commentAuthorName={authorName}
              onToggleLike={() => void toggleLike(item)}
              onOpenComments={() => setCommentsPostId(item.post.id)}
              onOpenMedia={(index) => openMedia(item, index)}
              playbackActive={isFocused && !lightbox && activePostId === item.post.id}
              onToggleCaption={() => setExpandedCaptions((current) => {
                const next = new Set(current);
                if (next.has(item.post.id)) next.delete(item.post.id);
                else next.add(item.post.id);
                return next;
              })}
            />
          );
        }}
      />

      <MemoryCommentsSheet
        visible={Boolean(commentsPostId)}
        memoryPostId={commentsPostId}
        postAuthorName={commentsCard ? authorName(commentsCard.post.authorId) : undefined}
        friendView
        initialComments={commentsCard?.latestComment ? [commentsCard.latestComment] : undefined}
        onClose={() => setCommentsPostId(null)}
        onChanged={(postId, count, latest) => {
          setCards((current) => current.map((item) => item.post.id === postId ? {
            ...item,
            commentCount: count,
            latestComment: latest,
          } : item));
        }}
      />

      <MemoryMediaLightbox
        visible={Boolean(lightbox)}
        media={lightbox?.media ?? []}
        imageUrls={lightbox?.imageUrls ?? []}
        posterUrls={lightbox?.posterUrls ?? []}
        initialIndex={lightbox?.index ?? 0}
        onClose={() => setLightbox(null)}
        onDoubleTapLike={() => {
          const card = lightbox ? cards.find((item) => item.post.id === lightbox.postId) : undefined;
          if (card && !card.isLiked) void toggleLike(card);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { paddingTop: 4 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 4, paddingHorizontal: 16 },
  headerCopy: { flex: 1 },
  title: { color: colors.text, fontSize: 27, fontWeight: "800" },
  subtitle: { color: colors.muted, fontSize: 12.5, marginTop: 3 },
  iconButton: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, alignItems: "center", justifyContent: "center" },
  empty: { paddingHorizontal: 24, paddingTop: 90, alignItems: "center" },
  emptyTitle: { color: colors.text, fontSize: 17, fontWeight: "800", marginTop: 12, textAlign: "center" },
  emptyCopy: { color: colors.muted, fontSize: 13, lineHeight: 20, marginTop: 8, textAlign: "center" },
  pageLoader: { marginVertical: 20 },
  retry: { minHeight: 44, marginTop: 18, paddingHorizontal: 18, borderRadius: 16, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  retryText: { color: colors.text, fontWeight: "800" },
});
