import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useIsFocused } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BabyLogIcon } from "../../components/babylog/BabyLogIcon";
import { MemoryUploadModal } from "../../components/memories/MemoryUploadModal";
import { MemoryEditModal } from "../../components/memories/MemoryEditModal";
import { MemoryCommentsSheet } from "../../components/memories/MemoryCommentsSheet";
import { MemoryFeedCard } from "../../components/memories/MemoryFeedCard";
import { MemoryFeedAdCard } from "../../components/memories/MemoryFeedAdCard";
import { MemoryIdentityHeader } from "../../components/memories/MemoryIdentityHeader";
import { MemoryMediaLightbox } from "../../components/memories/MemoryMediaLightbox";
import { interleaveExampleFeedAds } from "../../components/memories/memoryFeedAds";
import { MemoryViewFilterSheet, type MemoryViewFilter } from "../../components/memories/MemoryViewFilterSheet";
import { memoryFeedSlides } from "../../components/memories/memoryPresentation";
import { useBabyLog } from "../../context/BabyLogContext";
import { MemoriesRepository, MEMORY_FEED_PAGE_SIZE } from "../../repositories/MemoriesRepository";
import { ProfileRepository } from "../../repositories/ProfileRepository";
import type { DisplayProfile } from "../../types/profileSettings";
import { createId } from "../../utils/id";
import {
  memoryAuthorIdsFromCards,
  mergeDisplayProfiles,
  resolveMemoryAuthorAvatarUrl,
  resolveMemoryAuthorName,
} from "../../utils/memoryAuthorDisplay";
import { getEagerPhoto, getLocalPosterUriForMedia, getLocalUriForMedia, subscribeEagerUploads } from "../../utils/eagerMediaUpload";
import { MEMORY_FEED_VIEWABILITY_CONFIG, memoryFeedPostIdFromViewable } from "../../utils/memoryFeedPlayback";
import type { MemoryCard, MemoryComment, MemoryMedia, MemoryPostBundle, MemoryTag, MemoryTagDraft, PublishEagerMemoryInput } from "../../types/memory";
import { colors, fontScaleCap, radius } from "../../theme";
import { NotificationBellButton } from "../../components/NotificationBellButton";
import { useLanguage } from "../../LanguageContext";
import { useAppSideMenu } from "../../context/AppSideMenuContext";
import { caughtErrorMessage } from "../../utils/familyDisplay";

import type { MemoryCriticalKey } from "../../i18nMemoriesCriticalMessages";

type Props = {
  onOpenMenu?: () => void;
  onOpenNotifications?: () => void;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMPTY_MEMORY_CARDS: MemoryCard[] = [];
type BabyTargetFilter = "all" | "family" | "friend" | string;
const AUDIENCE_FILTERS = new Set(["all", "family", "friend"]);

const EMPTY_KEYS: Record<MemoryViewFilter, { title: MemoryCriticalKey; description: MemoryCriticalKey }> = {
  all: { title: "memory.critical.020", description: "memory.critical.021" },
  family_circle: { title: "memory.critical.022", description: "memory.critical.023" },
  friend_circle: { title: "memory.critical.024", description: "memory.critical.025" },
  only_me: { title: "memory.critical.026", description: "memory.critical.027" },
  tagged: { title: "memory.critical.028", description: "memory.critical.029" },
  saved: { title: "memory.critical.030", description: "memory.critical.031" },
};

function tagsFromDrafts(postId: string, drafts: MemoryTagDraft[], createdBy: string): MemoryTag[] {
  const now = new Date().toISOString();
  return drafts.map((tag) => ({
    id: createId(),
    memoryPostId: postId,
    tagType: tag.tagType,
    babyId: tag.tagType === "baby" ? tag.babyId : undefined,
    taggedUserId: tag.tagType === "family_member" ? tag.taggedUserId : undefined,
    manualLabel: tag.tagType === "manual_guest" ? tag.manualLabel : undefined,
    status: "approved",
    createdBy,
    createdAt: now,
  }));
}

function withLocalCover(card: MemoryCard, localCover?: string, coverFromMedia?: string): MemoryCard {
  const coverUrl = card.coverUrl ?? localCover ?? coverFromMedia;
  const mediaUrls = (card.mediaUrls?.length ? card.mediaUrls : coverUrl ? [coverUrl] : []).map((url, index) => (
    index === 0 ? (coverUrl ?? url) : url
  ));
  return { ...card, coverUrl, mediaUrls };
}

export function MemoriesScreen({
  onOpenMenu,
  onOpenNotifications,
}: Props) {
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const { babyName, familyMembers, familyHydrated, myFamilyRole, logAuthor, localDataScope, storageReady, babies, activeBabyId } = useBabyLog();
  const [cards, setCards] = useState<MemoryCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [viewSheetOpen, setViewSheetOpen] = useState(false);
  const [filter, setFilter] = useState<MemoryViewFilter>("all");
  const [babyFilter, setBabyFilter] = useState<BabyTargetFilter>("all");
  const [hiddenAdIds, setHiddenAdIds] = useState<Set<string>>(() => new Set());
  const [expandedCaptions, setExpandedCaptions] = useState<Set<string>>(() => new Set());
  const [likingPostIds, setLikingPostIds] = useState<Set<string>>(() => new Set());
  const [savingPostIds, setSavingPostIds] = useState<Set<string>>(() => new Set());
  const [commentsPostId, setCommentsPostId] = useState<string | null>(null);
  const [authorProfiles, setAuthorProfiles] = useState<DisplayProfile[]>([]);
  const [editBundle, setEditBundle] = useState<MemoryPostBundle | null>(null);
  const [lightbox, setLightbox] = useState<{
    postId: string;
    media: MemoryMedia[];
    imageUrls: string[];
    posterUrls: string[];
    index: number;
  } | null>(null);
  const [activePostId, setActivePostId] = useState<string | null>(null);
  const [postCount, setPostCount] = useState(0);
  const isFocused = useIsFocused();
  const likingPostIdsRef = useRef<Set<string>>(new Set());
  const savingPostIdsRef = useRef<Set<string>>(new Set());
  const pendingPublishesRef = useRef<Map<string, PublishEagerMemoryInput>>(new Map());
  const localCoversRef = useRef<Map<string, string>>(new Map());
  const pageOffsetsRef = useRef<Map<string, number>>(new Map());
  const exhaustedBabyIdsRef = useRef<Set<string>>(new Set());
  const loadingMoreRef = useRef(false);
  const babyId = activeBabyId;
  const accountId = localDataScope?.userId ?? null;
  const feedBabyIds = useMemo(
    () => babies.length > 0 ? babies.map((baby) => baby.id) : (babyId ? [babyId] : []),
    [babies, babyId],
  );
  const feedScopeKey = storageReady && accountId && babyId && localDataScope?.babyId === babyId
    ? JSON.stringify([accountId, babyId, [...feedBabyIds].sort()])
    : null;
  const feedScopeVersionRef = useRef({ key: feedScopeKey, version: 0 });
  if (feedScopeVersionRef.current.key !== feedScopeKey) {
    feedScopeVersionRef.current = {
      key: feedScopeKey,
      version: feedScopeVersionRef.current.version + 1,
    };
  }
  const feedScopeToken = feedScopeKey
    ? `${feedScopeVersionRef.current.version}:${feedScopeKey}`
    : null;
  const feedScopeKeyRef = useRef(feedScopeToken);
  feedScopeKeyRef.current = feedScopeToken;
  const feedLoadRunRef = useRef(0);
  const [loadedFeedScopeKey, setLoadedFeedScopeKey] = useState<string | null>(null);
  const loadedFeedScopeKeyRef = useRef<string | null>(null);
  const feedReady = Boolean(feedScopeToken && loadedFeedScopeKey === feedScopeToken);
  const visibleCards = feedReady ? cards : EMPTY_MEMORY_CARDS;
  useEffect(() => {
    setUploadOpen(false);
    setCommentsPostId(null);
    setEditBundle(null);
    setLightbox(null);
  }, [feedScopeToken]);
  const canCreate = Boolean(feedScopeToken && familyHydrated && myFamilyRole !== "viewer");
  const { isOpen: menuOpen, open: openAppMenu, close: closeAppMenu } = useAppSideMenu();
  const overlayBlocking = Boolean(commentsPostId || uploadOpen || editBundle || lightbox || viewSheetOpen);
  const openSideMenu = useCallback(() => {
    if (overlayBlocking) return;
    (onOpenMenu ?? openAppMenu)();
  }, [onOpenMenu, openAppMenu, overlayBlocking]);
  const serverFamilyMembers = useMemo(
    () => familyMembers.filter((member) => UUID_PATTERN.test(member.id)),
    [familyMembers],
  );
  useEffect(() => {
    if (!AUDIENCE_FILTERS.has(babyFilter) && !babies.some((baby) => baby.id === babyFilter)) {
      setBabyFilter("all");
    }
  }, [babies, babyFilter]);
  const targetBabyIds = useCallback((card: MemoryCard) => card.tags.filter((tag) => tag.tagType === "baby" && tag.babyId).map((tag) => tag.babyId!), []);
  const targetLabel = useCallback((card: MemoryCard) => {
    if (card.post.isFamilyMoment) return t("memory.critical.012");
    const ids = targetBabyIds(card);
    if (!ids.length) return babies.length === 1 ? (babies[0]?.name ?? babyName) : t("memory.critical.012");
    return ids.map((id) => babies.find((baby) => baby.id === id)?.name).filter(Boolean).join(" · ") || babyName;
  }, [babies, babyName, t, targetBabyIds]);
  const filteredCards = useMemo(() => visibleCards.filter((card) => {
    const ids = targetBabyIds(card);
    const isFamilyMoment = card.post.isFamilyMoment || (!ids.length && babies.length > 1);
    if (babyFilter === "family" && !isFamilyMoment) return false;
    if (babyFilter === "friend" && card.post.privacyType !== "friend_circle") return false;
    if (
      !AUDIENCE_FILTERS.has(babyFilter)
      && !(!isFamilyMoment && (ids.includes(babyFilter) || (!ids.length && babies.length === 1 && card.post.babyId === babyFilter)))
    ) return false;
    if (filter === "all") return true;
    if (filter === "family_circle") return card.post.privacyType === "family_circle";
    if (filter === "friend_circle") return card.post.privacyType === "friend_circle";
    if (filter === "only_me") return card.post.privacyType === "only_me";
    if (filter === "saved") return card.isSaved;
    return card.post.privacyType === "tagged_family" || card.tags.some((tag) => tag.taggedUserId === logAuthor.userId);
  }), [babyFilter, babies.length, visibleCards, filter, logAuthor.userId, targetBabyIds]);
  const emptyCopy = useMemo(() => {
    if (filter !== "all") {
      const keys = EMPTY_KEYS[filter];
      return { title: t(keys.title), description: t(keys.description) };
    }
    if (babyFilter === "family") {
      return { title: t("memory.critical.032"), description: t("memory.critical.033") };
    }
    if (babyFilter === "friend") {
      return { title: t("memory.critical.024"), description: t("memory.critical.025") };
    }
    if (babyFilter !== "all") {
      const name = babies.find((baby) => baby.id === babyFilter)?.name ?? babyName;
      return { title: t("memory.critical.034", { name }), description: t("memory.critical.035") };
    }
    return { title: t(EMPTY_KEYS.all.title), description: t(EMPTY_KEYS.all.description) };
  }, [babies, babyFilter, babyName, filter, t]);
  const extraFilterActive = filter !== "all" || !AUDIENCE_FILTERS.has(babyFilter);
  const feedRows = useMemo(
    () => (filter === "all" ? interleaveExampleFeedAds(filteredCards, hiddenAdIds) : filteredCards.map((card) => ({ kind: "memory" as const, card }))),
    [filter, filteredCards, hiddenAdIds],
  );

  const load = useCallback(async (refresh = false) => {
    const requestRun = ++feedLoadRunRef.current;
    if (!feedScopeToken || !babyId) {
      setCards([]);
      setLoadedFeedScopeKey(null);
      setPostCount(0);
      setLoading(false);
      setRefreshing(false);
      if (storageReady) setError(t("memory.critical.051"));
      return;
    }
    const requestedScopeKey = feedScopeToken;
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError("");
    setActionError("");
    try {
      void MemoriesRepository.cleanupOrphanTempMedia();
      const [lists, nextPostCount] = await Promise.all([
        Promise.all(feedBabyIds.map((id) => MemoriesRepository.listCardsByBabyId(id, {
          offset: 0,
          limit: MEMORY_FEED_PAGE_SIZE,
        }))),
        MemoriesRepository.countByBabyId(babyId).catch(() => 0),
      ]);
      if (feedScopeKeyRef.current !== requestedScopeKey || feedLoadRunRef.current !== requestRun) return;
      setPostCount(nextPostCount);
      pageOffsetsRef.current = new Map(feedBabyIds.map((id, index) => [id, lists[index]?.length ?? 0]));
      exhaustedBabyIdsRef.current = new Set(feedBabyIds.filter((id, index) => (lists[index]?.length ?? 0) < MEMORY_FEED_PAGE_SIZE));
      const unique = new Map(lists.flat().map((card) => [card.post.id, card]));
      const nextAuthorProfiles = await ProfileRepository.listMemoryAuthorDisplayProfiles(
        memoryAuthorIdsFromCards([...unique.values()]),
      ).catch(() => [] as DisplayProfile[]);
      if (feedScopeKeyRef.current !== requestedScopeKey || feedLoadRunRef.current !== requestRun) return;
      setAuthorProfiles(nextAuthorProfiles);
      setCards((current) => {
        if (feedScopeKeyRef.current !== requestedScopeKey || feedLoadRunRef.current !== requestRun) return current;
        const optimistic = loadedFeedScopeKeyRef.current === requestedScopeKey
          ? current.filter((card) => card.isOptimistic && !unique.has(card.post.id))
          : [];
        const merged = [...optimistic, ...unique.values()].sort((a, b) => b.post.createdAt.localeCompare(a.post.createdAt));
        return merged.map((card) => {
          const localCover = localCoversRef.current.get(card.post.id);
          const coverFromMedia = card.coverMedia?.id ? getLocalUriForMedia(card.coverMedia.id) : undefined;
          return {
            ...withLocalCover(card, localCover, coverFromMedia),
            hasFailedMedia: card.hasFailedMedia || card.coverMedia?.uploadStatus === "failed",
          };
        });
      });
      loadedFeedScopeKeyRef.current = requestedScopeKey;
      setLoadedFeedScopeKey(requestedScopeKey);
    } catch (cause) {
      if (feedScopeKeyRef.current === requestedScopeKey && feedLoadRunRef.current === requestRun) {
        setError(caughtErrorMessage(t, cause, "memory.critical.016"));
      }
    } finally {
      if (feedScopeKeyRef.current === requestedScopeKey && feedLoadRunRef.current === requestRun) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [babyId, feedBabyIds, feedScopeToken, storageReady, t]);

  const loadMore = useCallback(async () => {
    if (!feedScopeToken || loadedFeedScopeKey !== feedScopeToken || loadingMoreRef.current || loading || refreshing || error) return;
    const requestedScopeKey = feedScopeToken;
    const requestRun = feedLoadRunRef.current;
    const targets = feedBabyIds.filter((id) => !exhaustedBabyIdsRef.current.has(id));
    if (!targets.length) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const lists = await Promise.all(targets.map((id) => MemoriesRepository.listCardsByBabyId(id, {
        offset: pageOffsetsRef.current.get(id) ?? 0,
        limit: MEMORY_FEED_PAGE_SIZE,
      })));
      if (feedScopeKeyRef.current !== requestedScopeKey || feedLoadRunRef.current !== requestRun) return;
      targets.forEach((id, index) => {
        const count = lists[index]?.length ?? 0;
        pageOffsetsRef.current.set(id, (pageOffsetsRef.current.get(id) ?? 0) + count);
        if (count < MEMORY_FEED_PAGE_SIZE) exhaustedBabyIdsRef.current.add(id);
      });
      const incoming = lists.flat();
      const incomingProfiles = await ProfileRepository.listMemoryAuthorDisplayProfiles(
        memoryAuthorIdsFromCards(incoming),
      ).catch(() => [] as DisplayProfile[]);
      if (feedScopeKeyRef.current !== requestedScopeKey || feedLoadRunRef.current !== requestRun) return;
      setAuthorProfiles((current) => (
        feedScopeKeyRef.current === requestedScopeKey && feedLoadRunRef.current === requestRun
          ? mergeDisplayProfiles(current, incomingProfiles)
          : current
      ));
      setCards((current) => {
        if (feedScopeKeyRef.current !== requestedScopeKey || feedLoadRunRef.current !== requestRun) return current;
        const unique = new Map(current.map((card) => [card.post.id, card]));
        for (const card of incoming) {
          const localCover = localCoversRef.current.get(card.post.id);
          const coverFromMedia = card.coverMedia?.id ? getLocalUriForMedia(card.coverMedia.id) : undefined;
          unique.set(card.post.id, {
            ...withLocalCover(card, localCover, coverFromMedia),
            hasFailedMedia: card.hasFailedMedia || card.coverMedia?.uploadStatus === "failed",
          });
        }
        return [...unique.values()].sort((a, b) => b.post.createdAt.localeCompare(a.post.createdAt));
      });
    } catch (cause) {
      if (feedScopeKeyRef.current === requestedScopeKey && feedLoadRunRef.current === requestRun) {
        setActionError(caughtErrorMessage(t, cause, "memory.critical.016"));
      }
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [error, feedBabyIds, feedScopeToken, loadedFeedScopeKey, loading, refreshing, t]);

  // Refetch on every focus so privacy/selection changes and short-lived signed URLs refresh.
  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

  useFocusEffect(useCallback(() => () => closeAppMenu(), [closeAppMenu]));

  useEffect(() => subscribeEagerUploads(() => {
    setCards((current) => current.map((card) => {
      const localCover = localCoversRef.current.get(card.post.id);
      const coverJob = card.coverMedia?.id ? getEagerPhoto(card.coverMedia.id) : undefined;
      const coverFromMedia = card.coverMedia?.id ? getLocalUriForMedia(card.coverMedia.id) : undefined;
      const failed = coverJob?.status === "failed" || (card.hasFailedMedia && coverJob?.status !== "uploaded");
      const nextCover = coverJob?.status === "uploaded" ? (card.coverUrl ?? localCover) : (card.coverUrl ?? localCover ?? coverFromMedia);
      return {
        ...withLocalCover({ ...card, coverUrl: nextCover }, localCover, coverFromMedia),
        hasFailedMedia: Boolean(failed),
      };
    }));
  }), []);

  const publishMemory = useCallback(async (payload: PublishEagerMemoryInput) => {
    const requestedScopeKey = feedScopeToken;
    if (!requestedScopeKey || feedScopeKeyRef.current !== requestedScopeKey) return;
    pendingPublishesRef.current.set(payload.id, payload);
    try {
      const bundle = await MemoriesRepository.publishEagerMemory(payload);
      pendingPublishesRef.current.delete(payload.id);
      const mediaUrls = await Promise.all(bundle.media.map(async (item) => {
        const local = getLocalUriForMedia(item.id) ?? localCoversRef.current.get(payload.id);
        if (item.mediaType === "video") return local ?? "";
        if (item.uploadStatus !== "ready") return local ?? "";
        try {
          return await MemoriesRepository.createSignedUrl(item.storagePath, undefined, { width: 800 });
        } catch {
          return local ?? "";
        }
      }));
      const mediaPosterUrls = await Promise.all(bundle.media.map(async (item) => {
        const localPoster = getLocalPosterUriForMedia(item.id);
        if (item.mediaType !== "video") return "";
        if (item.uploadStatus !== "ready") return localPoster ?? "";
        try {
          return await MemoriesRepository.createSignedUrl(item.storagePath, undefined, { width: 800, variant: "thumbnail" });
        } catch {
          return localPoster ?? "";
        }
      }));
      if (feedScopeKeyRef.current !== requestedScopeKey) return;
      setCards((current) => feedScopeKeyRef.current === requestedScopeKey ? current.map((card) => card.post.id === payload.id ? {
        post: bundle.post,
        coverMedia: bundle.media[0],
        coverUrl: (bundle.media[0]?.mediaType === "video" ? mediaPosterUrls[0] : mediaUrls[0]) || card.coverUrl,
        media: bundle.media,
        mediaUrls,
        mediaPosterUrls,
        mediaCount: bundle.media.length,
        tags: bundle.tags,
        commentCount: bundle.comments.length,
        latestComment: bundle.comments[bundle.comments.length - 1],
        reactionCount: bundle.reactions.length,
        isLiked: bundle.reactions.some((reaction) => reaction.authorId === logAuthor.userId),
        isSaved: false,
        hasFailedMedia: bundle.media.some((item) => item.uploadStatus === "failed"),
        isOptimistic: false,
        publishError: undefined,
      } : card) : current);
    } catch (cause) {
      if (feedScopeKeyRef.current !== requestedScopeKey) return;
      const message = caughtErrorMessage(t, cause, "memory.critical.048");
      setCards((current) => feedScopeKeyRef.current === requestedScopeKey
        ? current.map((card) => card.post.id === payload.id ? { ...card, publishError: message, isOptimistic: true } : card)
        : current);
    }
  }, [feedScopeToken, logAuthor.userId, t]);

  const handlePosted = useCallback((payload: PublishEagerMemoryInput & { localCoverUri?: string }) => {
    if (!feedScopeToken || feedScopeKeyRef.current !== feedScopeToken) return;
    setUploadOpen(false);
    const now = new Date().toISOString();
    if (payload.localCoverUri) localCoversRef.current.set(payload.id, payload.localCoverUri);
    const media: MemoryMedia[] = payload.photos.map((photo) => ({
      id: photo.id,
      memoryPostId: payload.id,
      babyId: payload.babyId,
      storagePath: photo.storagePath,
      mediaType: photo.mediaType ?? "image",
      uploadStatus: photo.uploadStatus,
      width: photo.width,
      height: photo.height,
      durationMs: photo.durationMs,
      thumbnailStoragePath: photo.thumbnailStoragePath,
      createdAt: now,
    }));
    const mediaUrls = payload.photos.map((photo) => photo.localUri);
    const mediaPosterUrls = payload.photos.map((photo) => photo.thumbnailLocalUri ?? "");
    const card: MemoryCard = {
      post: {
        id: payload.id,
        babyId: payload.babyId,
        authorId: logAuthor.userId,
        caption: payload.caption?.trim() || undefined,
        privacyType: payload.privacyType,
        isFamilyMoment: payload.isFamilyMoment ?? false,
        status: payload.photos.some((photo) => photo.uploadStatus === "uploading") ? "posting" : "published",
        createdAt: now,
        updatedAt: now,
      },
      coverMedia: media[0],
      coverUrl: payload.photos[0]?.thumbnailLocalUri ?? payload.localCoverUri,
      media,
      mediaUrls,
      mediaPosterUrls,
      mediaCount: payload.photos.length,
      tags: tagsFromDrafts(payload.id, payload.tags ?? [], logAuthor.userId),
      commentCount: 0,
      reactionCount: 0,
      isLiked: false,
      isSaved: false,
      isOptimistic: true,
      hasFailedMedia: payload.photos.some((photo) => photo.uploadStatus === "failed"),
    };
    setCards((current) => [card, ...current.filter((item) => item.post.id !== card.post.id)]);
    if (payload.babyId === babyId) setPostCount((current) => current + 1);
    void publishMemory(payload);
  }, [babyId, feedScopeToken, logAuthor.userId, publishMemory]);

  const retryCard = useCallback((card: MemoryCard) => {
    const pending = pendingPublishesRef.current.get(card.post.id);
    if (card.publishError && pending) {
      setCards((current) => current.map((item) => item.post.id === card.post.id ? { ...item, publishError: undefined } : item));
      void publishMemory(pending);
      return;
    }
    void MemoriesRepository.retryFailedMedia(card.post.id);
    setCards((current) => current.map((item) => item.post.id === card.post.id ? { ...item, hasFailedMedia: false } : item));
  }, [publishMemory]);

  const authorProfileById = useMemo(
    () => new Map(authorProfiles.map((profile) => [profile.userId, profile])),
    [authorProfiles],
  );
  const viewerAvatarUrl = familyMembers.find((member) => member.isMe)?.avatarUrl;
  const authorName = (authorId: string) => resolveMemoryAuthorName({
    authorId,
    profile: authorProfileById.get(authorId),
    viewerUserId: logAuthor.userId,
    viewerName: logAuthor.name,
    missingLabel: t("memory.critical.050"),
  });

  const toggleLike = useCallback(async (card: MemoryCard) => {
    if (card.publishError || likingPostIdsRef.current.has(card.post.id)) return;
    const nextLiked = !card.isLiked;
    likingPostIdsRef.current.add(card.post.id);
    setLikingPostIds((current) => new Set(current).add(card.post.id));
    setCards((current) => current.map((item) => item.post.id === card.post.id ? {
      ...item,
      isLiked: nextLiked,
      reactionCount: Math.max(0, item.reactionCount + (nextLiked ? 1 : -1)),
    } : item));
    setActionError("");
    try {
      if (nextLiked) await MemoriesRepository.setReaction({ memoryPostId: card.post.id, reactionType: "heart" });
      else await MemoriesRepository.removeReaction(card.post.id);
    } catch (cause) {
      setCards((current) => current.map((item) => item.post.id === card.post.id ? {
        ...item,
        isLiked: card.isLiked,
        reactionCount: card.reactionCount,
      } : item));
      setActionError(caughtErrorMessage(t, cause, "memory.critical.052"));
    } finally {
      setLikingPostIds((current) => {
        const next = new Set(current);
        next.delete(card.post.id);
        return next;
      });
      likingPostIdsRef.current.delete(card.post.id);
    }
  }, [t]);

  const toggleSave = useCallback(async (card: MemoryCard) => {
    if (savingPostIdsRef.current.has(card.post.id)) return;
    const nextSaved = !card.isSaved;
    savingPostIdsRef.current.add(card.post.id);
    setSavingPostIds((current) => new Set(current).add(card.post.id));
    setCards((current) => current.map((item) => item.post.id === card.post.id ? { ...item, isSaved: nextSaved } : item));
    setActionError("");
    try {
      if (nextSaved) await MemoriesRepository.saveMemoryPost(card.post.id);
      else await MemoriesRepository.unsaveMemoryPost(card.post.id);
    } catch (cause) {
      setCards((current) => current.map((item) => item.post.id === card.post.id ? { ...item, isSaved: card.isSaved } : item));
      setActionError(caughtErrorMessage(t, cause, "memory.critical.053"));
    } finally {
      setSavingPostIds((current) => {
        const next = new Set(current);
        next.delete(card.post.id);
        return next;
      });
      savingPostIdsRef.current.delete(card.post.id);
    }
  }, [t]);

  const authorAvatar = (authorId: string) => resolveMemoryAuthorAvatarUrl({
    authorId,
    profile: authorProfileById.get(authorId),
    viewerUserId: logAuthor.userId,
    viewerAvatarUrl,
  });

  const canManagePost = (card: MemoryCard) => (
    card.post.authorId === logAuthor.userId || myFamilyRole === "owner" || myFamilyRole === "admin"
  );

  const updateCardComments = useCallback((postId: string, commentCount: number, latestComment?: MemoryComment) => {
    setCards((current) => current.map((item) => item.post.id === postId ? { ...item, commentCount, latestComment } : item));
  }, []);

  const openEdit = useCallback(async (card: MemoryCard) => {
    try {
      const bundle = await MemoriesRepository.getBundleById(card.post.id);
      if (!bundle) throw new Error(t("memory.critical.124"));
      setEditBundle(bundle);
    } catch (cause) {
      setActionError(caughtErrorMessage(t, cause, "memory.critical.119"));
    }
  }, [t]);

  const confirmDelete = useCallback((card: MemoryCard) => {
    Alert.alert(t("memory.critical.120"), t("memory.critical.121"), [
      { text: t("memory.critical.083"), style: "cancel" },
      {
        text: t("memory.critical.122"),
        style: "destructive",
        onPress: () => {
          void MemoriesRepository.softDeleteMemoryPost(card.post.id)
            .then(() => {
              setCards((current) => current.filter((item) => item.post.id !== card.post.id));
              if (card.post.babyId === babyId) setPostCount((current) => Math.max(0, current - 1));
              setLightbox((current) => current?.postId === card.post.id ? null : current);
              setCommentsPostId((current) => current === card.post.id ? null : current);
            })
            .catch((cause) => setActionError(caughtErrorMessage(t, cause, "memory.critical.123")));
        },
      },
    ]);
  }, [babyId, t]);

  const openMenu = useCallback((card: MemoryCard) => {
    if (card.publishError) return;
    const edit = () => void openEdit(card);
    const del = () => confirmDelete(card);
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [t("memory.critical.083"), t("memory.critical.105"), t("memory.critical.122")],
          cancelButtonIndex: 0,
          destructiveButtonIndex: 2,
        },
        (index) => {
          if (index === 1) edit();
          if (index === 2) del();
        },
      );
      return;
    }
    Alert.alert(t("memory.critical.184"), undefined, [
      { text: t("memory.critical.105"), onPress: edit },
      { text: t("memory.critical.122"), style: "destructive", onPress: del },
      { text: t("memory.critical.083"), style: "cancel" },
    ]);
  }, [confirmDelete, openEdit, t]);

  const openMedia = useCallback((card: MemoryCard, index: number) => {
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
  }, []);

  const commentsCard = commentsPostId ? visibleCards.find((card) => card.post.id === commentsPostId) : undefined;
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: Array<{ isViewable: boolean; item: (typeof feedRows)[number] }> }) => {
    const next = viewableItems.find((entry) => entry.isViewable);
    setActivePostId(next ? memoryFeedPostIdFromViewable(next.item) : null);
  }).current;

  const listHeader = (
    <>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
        {canCreate ? (
          <Pressable
            style={styles.iconBtn}
            onPress={() => setUploadOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={t("memory.critical.003")}
          >
            <BabyLogIcon kind="new" size={22} color={colors.text} strokeWidth={2.2} />
          </Pressable>
        ) : <View style={styles.iconBtn} />}
        <View style={styles.headerSpacer} />
        <View style={styles.headerActions}>
          {onOpenNotifications ? <NotificationBellButton onPress={onOpenNotifications} /> : null}
          {onOpenMenu ? (
            <Pressable
              style={styles.menuBtn}
              onPress={openSideMenu}
              disabled={overlayBlocking}
              accessibilityRole="button"
              accessibilityLabel={t("memory.critical.207")}
              accessibilityState={{ expanded: menuOpen, disabled: overlayBlocking }}
            >
              <BabyLogIcon kind="menu" size={22} color={overlayBlocking ? colors.faint : colors.text} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {feedReady && accountId ? (
        <MemoryIdentityHeader
          key={feedScopeToken}
          scopeAccountId={accountId}
          postCount={postCount}
        />
      ) : null}

      <View style={styles.filterRow}>
        <ScrollView
          horizontal
          nestedScrollEnabled
          directionalLockEnabled
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroller}
          contentContainerStyle={styles.filterBar}
        >
          <Pressable
            style={[styles.filterChip, babyFilter === "all" && styles.filterChipActive]}
            onPress={() => setBabyFilter("all")}
            accessibilityRole="button"
            accessibilityLabel={t("memory.critical.011")}
            accessibilityState={{ selected: babyFilter === "all" }}
          >
            <Text style={[styles.filterText, babyFilter === "all" && styles.filterTextActive]}>{t("memory.critical.011")}</Text>
          </Pressable>
          <Pressable
            style={[styles.filterChip, babyFilter === "family" && styles.filterChipActive]}
            onPress={() => setBabyFilter("family")}
            accessibilityRole="button"
            accessibilityLabel={t("memory.critical.012")}
            accessibilityState={{ selected: babyFilter === "family" }}
          >
            <Text style={[styles.filterText, babyFilter === "family" && styles.filterTextActive]}>{t("memory.critical.155")}</Text>
          </Pressable>
          <Pressable
            style={[styles.filterChip, babyFilter === "friend" && styles.filterChipActive]}
            onPress={() => setBabyFilter("friend")}
            accessibilityRole="button"
            accessibilityLabel={t("memory.critical.216")}
            accessibilityState={{ selected: babyFilter === "friend" }}
          >
            <Text style={[styles.filterText, babyFilter === "friend" && styles.filterTextActive]}>{t("memory.critical.216")}</Text>
          </Pressable>
        </ScrollView>
        <Pressable
          style={[styles.filterIconBtn, extraFilterActive && styles.filterIconBtnActive]}
          onPress={() => setViewSheetOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={t("memory.critical.154")}
          accessibilityState={{ expanded: viewSheetOpen, selected: extraFilterActive }}
        >
          <BabyLogIcon
            kind="filter"
            size={20}
            color={extraFilterActive ? colors.accentStrong : colors.text}
            strokeWidth={2.1}
          />
        </Pressable>
      </View>
      {actionError ? (
        <Text style={styles.actionError} accessibilityRole="alert" accessibilityLiveRegion="polite">
          {actionError}
        </Text>
      ) : null}
    </>
  );

  return (
    <View style={styles.root}>
      <FlatList
        data={!feedReady || loading || error ? [] : feedRows}
        keyExtractor={(item) => item.kind === "ad" ? `ad:${item.ad.id}` : item.card.post.id}
        ListHeaderComponent={listHeader}
        contentContainerStyle={[styles.feed, { paddingBottom: insets.bottom + 28 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.amber} />}
        keyboardShouldPersistTaps="handled"
        onEndReached={() => void loadMore()}
        onEndReachedThreshold={0.4}
        viewabilityConfig={MEMORY_FEED_VIEWABILITY_CONFIG}
        onViewableItemsChanged={onViewableItemsChanged}
        extraData={`${activePostId}:${isFocused}:${lightbox?.postId ?? ""}:${menuOpen ? "1" : "0"}`}
        ListFooterComponent={loadingMore ? <ActivityIndicator style={styles.pageLoader} color={colors.amberText} /> : null}
        ListEmptyComponent={
          !feedReady || loading ? (
            <View style={styles.emptyState}><ActivityIndicator color={colors.amberText} /><Text style={styles.centerCopy}>{t("memory.critical.015")}</Text></View>
          ) : error ? (
            <View style={styles.emptyState}>
              <Text style={styles.errorTitle}>{t("memory.critical.016")}</Text>
              <Text style={styles.centerCopy}>{error}</Text>
              <Pressable style={styles.secondaryButton} onPress={() => void load()}><Text style={styles.secondaryText}>{t("memory.critical.017")}</Text></Pressable>
            </View>
          ) : (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}><BabyLogIcon kind="sparkles" size={34} color={colors.amberText} /></View>
              <Text style={styles.emptyTitle}>{emptyCopy.title}</Text>
              <Text style={styles.emptyCopy}>{emptyCopy.description}</Text>
              {canCreate && filter !== "tagged" ? <Pressable style={styles.primaryButton} onPress={() => setUploadOpen(true)}><Text style={styles.primaryText}>{filter === "all" ? t("memory.critical.018") : t("memory.critical.019")}</Text></Pressable> : null}
            </View>
          )
        }
        renderItem={({ item }) => {
          if (item.kind === "ad") {
            return (
              <MemoryFeedAdCard
                ad={item.ad}
                onHide={() => setHiddenAdIds((current) => new Set(current).add(item.ad.id))}
              />
            );
          }
          const card = item.card;
          return (
            <MemoryFeedCard
              item={card}
              authorName={authorName(card.post.authorId)}
              authorAvatarUrl={authorAvatar(card.post.authorId)}
              expanded={expandedCaptions.has(card.post.id)}
              likeWorking={likingPostIds.has(card.post.id)}
              saveWorking={savingPostIds.has(card.post.id)}
              targetLabel={targetLabel(card)}
              commentAuthorName={authorName}
              onToggleLike={() => void toggleLike(card)}
              onToggleSave={() => void toggleSave(card)}
              onOpenComments={() => { if (!card.publishError) setCommentsPostId(card.post.id); }}
              onOpenMedia={(index) => openMedia(card, index)}
              playbackActive={isFocused && !lightbox && !menuOpen && activePostId === card.post.id}
              onOpenMenu={canManagePost(card) ? () => openMenu(card) : undefined}
              onRetryUpload={card.hasFailedMedia || card.publishError ? () => retryCard(card) : undefined}
              onToggleCaption={() => setExpandedCaptions((current) => {
                const next = new Set(current);
                if (next.has(card.post.id)) next.delete(card.post.id);
                else next.add(card.post.id);
                return next;
              })}
            />
          );
        }}
      />

      {babyId ? (
        <MemoryUploadModal
          visible={feedReady && uploadOpen}
          babyId={babyId}
          babyName={babyName}
          familyMembers={serverFamilyMembers}
          babies={babies}
          onClose={() => setUploadOpen(false)}
          onPosted={handlePosted}
        />
      ) : null}

      <MemoryViewFilterSheet
        visible={viewSheetOpen}
        value={filter}
        onChange={setFilter}
        whoValue={babyFilter}
        onChangeWho={setBabyFilter}
        babies={babies.map((baby) => ({ id: baby.id, name: baby.name }))}
        onClose={() => setViewSheetOpen(false)}
      />

      <MemoryCommentsSheet
        visible={feedReady && Boolean(commentsCard)}
        memoryPostId={commentsCard?.post.id ?? null}
        postAuthorName={commentsCard ? authorName(commentsCard.post.authorId) : undefined}
        canModerate={commentsCard ? canManagePost(commentsCard) : false}
        initialComments={commentsCard?.latestComment ? [commentsCard.latestComment] : undefined}
        onClose={() => setCommentsPostId(null)}
        onChanged={(postId, count, latest) => updateCardComments(postId, count, latest)}
      />

      {feedReady && editBundle ? (
        <MemoryEditModal
          visible
          bundle={editBundle}
          familyMembers={serverFamilyMembers}
          onClose={() => setEditBundle(null)}
          onSaved={() => {
            setEditBundle(null);
            void load();
          }}
        />
      ) : null}

      <MemoryMediaLightbox
        visible={feedReady && Boolean(lightbox)}
        media={feedReady ? lightbox?.media ?? [] : []}
        imageUrls={feedReady ? lightbox?.imageUrls ?? [] : []}
        posterUrls={feedReady ? lightbox?.posterUrls ?? [] : []}
        initialIndex={lightbox?.index ?? 0}
        onClose={() => setLightbox(null)}
        onDoubleTapLike={() => {
          const card = lightbox ? visibleCards.find((item) => item.post.id === lightbox.postId) : undefined;
          if (card && !card.isLiked) void toggleLike(card);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingBottom: 8 },
  headerSpacer: { flex: 1 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 4 },
  iconBtn: { width: Platform.OS === "android" ? 48 : 44, height: Platform.OS === "android" ? 48 : 44, alignItems: "center", justifyContent: "center" },
  menuBtn: { width: Platform.OS === "android" ? 48 : 44, height: Platform.OS === "android" ? 48 : 44, alignItems: "center", justifyContent: "center" },
  filterRow: { flexDirection: "row", alignItems: "center", paddingRight: 8, paddingBottom: 8 },
  filterScroller: { flex: 1 },
  filterBar: { flexDirection: "row", alignItems: "center", paddingLeft: 16, paddingRight: 8, gap: 8 },
  filterChip: { minHeight: Platform.OS === "android" ? 48 : 44, paddingHorizontal: 16, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  filterIconBtn: { width: Platform.OS === "android" ? 48 : 44, height: Platform.OS === "android" ? 48 : 44, alignItems: "center", justifyContent: "center" },
  filterIconBtnActive: { borderRadius: 16, backgroundColor: colors.accentSoft },
  filterChipActive: { backgroundColor: colors.accentSoft, borderColor: colors.accentSoft },
  filterText: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  filterTextActive: { color: colors.accentStrong },
  actionError: { marginHorizontal: 16, marginBottom: 8, color: colors.dangerText, backgroundColor: colors.dangerSoft, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10, fontSize: 12.5, fontWeight: "700" },
  pageLoader: { marginVertical: 20 },
  emptyState: { paddingHorizontal: 32, paddingTop: 48, paddingBottom: 28, alignItems: "center", justifyContent: "center" },
  centerCopy: { marginTop: 9, color: colors.muted, fontSize: 13, lineHeight: 20, textAlign: "center" },
  errorTitle: { color: colors.text, fontSize: 17, fontWeight: "800" },
  emptyIcon: { width: 72, height: 72, borderRadius: 22, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", marginBottom: 18 },
  emptyTitle: { color: colors.text, fontSize: 19, fontWeight: "800" },
  emptyCopy: { color: colors.muted, fontSize: 13.5, lineHeight: 21, textAlign: "center", marginTop: 8 },
  primaryButton: { minHeight: 50, marginTop: 22, paddingHorizontal: 24, borderRadius: radius.full, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  primaryText: { color: colors.primaryForeground, fontSize: 14, fontWeight: "800" },
  secondaryButton: { minHeight: 44, marginTop: 18, paddingHorizontal: 18, borderRadius: radius.full, borderWidth: 1, borderColor: colors.amber, alignItems: "center", justifyContent: "center" },
  secondaryText: { color: colors.amberText, fontSize: 13, fontWeight: "800" },
  feed: { paddingTop: 4 },
});
