import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BabyLogIcon } from "../../components/babylog/BabyLogIcon";
import { MemoryUploadModal } from "../../components/memories/MemoryUploadModal";
import { MemoryFeedAdCard } from "../../components/memories/MemoryFeedAdCard";
import { interleaveExampleFeedAds } from "../../components/memories/memoryFeedAds";
import { MemoryViewFilterSheet, memoryViewFilterLabel, type MemoryViewFilter } from "../../components/memories/MemoryViewFilterSheet";
import { memoryPrivacyPresentation } from "../../components/memories/memoryPresentation";
import { useBabyLog } from "../../context/BabyLogContext";
import { MemoriesRepository } from "../../repositories/MemoriesRepository";
import { createId } from "../../utils/id";
import { getEagerPhoto, getLocalUriForMedia, subscribeEagerUploads } from "../../utils/eagerMediaUpload";
import type { MemoryCard, MemoryTag, MemoryTagDraft, PublishEagerMemoryInput } from "../../types/memory";
import { colors, fontScaleCap, radius } from "../../theme";
import { NotificationBellButton } from "../../components/NotificationBellButton";

const TOUCH_MIN = Platform.select({ ios: 44, android: 48 }) ?? 44;

type Props = {
  onOpenSettings?: () => void;
  onOpenNotifications?: () => void;
  onOpenFamily?: () => void;
  onOpenDetail: (memoryPostId: string) => void;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type BabyTargetFilter = "all" | "family" | string;

const EMPTY_COPY: Record<MemoryViewFilter, { title: string; description: string }> = {
  all: { title: "첫 번째 순간을 남겨보세요", description: "사진 한 장과 짧은 이야기로 오늘을 가족과 나눠보세요." },
  family_circle: { title: "가족에게 공개된 순간이 아직 없어요", description: "함께 보고 싶은 오늘의 순간을 남겨보세요." },
  friend_circle: { title: "친구에게 보여줄 순간이 아직 없어요", description: "초대된 친구와 나누고 싶은 순간을 남겨보세요." },
  only_me: { title: "나만 간직한 순간이 아직 없어요", description: "조용히 보관하고 싶은 사진과 이야기를 남겨보세요." },
  tagged: { title: "태그된 순간이 아직 없어요", description: "가족이 태그한 순간이 생기면 여기에 모여요." },
  saved: { title: "저장한 순간이 아직 없어요", description: "다시 보고 싶은 순간의 저장 아이콘을 눌러보세요." },
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

type FeedCardProps = {
  item: MemoryCard;
  authorName: string;
  expanded: boolean;
  onToggleCaption: () => void;
  onOpen: () => void;
  onToggleLike: () => void;
  onToggleSave: () => void;
  onRetryUpload?: () => void;
  likeWorking: boolean;
  saveWorking: boolean;
  targetLabel: string;
};

const MemoryFeedCard = memo(function MemoryFeedCard({
  item,
  authorName,
  expanded,
  onToggleCaption,
  onOpen,
  onToggleLike,
  onToggleSave,
  onRetryUpload,
  likeWorking,
  saveWorking,
  targetLabel,
}: FeedCardProps) {
  const privacy = memoryPrivacyPresentation(item.post.privacyType);
  const createdAt = new Date(item.post.createdAt);
  const caption = item.post.caption?.trim() ?? "";
  const failMessage = item.publishError ? "추억을 올리지 못했어요" : "사진 업로드 실패";

  return (
    <View style={styles.card}>
      <View style={styles.thumbnail}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onOpen}
          accessibilityRole="imagebutton"
          accessibilityLabel={
            item.coverUrl
              ? `${caption || "설명 없는 추억"} 사진${item.mediaCount > 1 ? `, 사진 ${item.mediaCount}장` : ""}`
              : `${caption || "설명 없는 추억"}, 사진 없음`
          }
          accessibilityHint="추억 상세를 열어요"
        >
          {item.coverUrl ? (
            <Image source={{ uri: item.coverUrl }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
          ) : null}
        </Pressable>
        {item.coverUrl ? null : (
          <View style={styles.thumbnailEmpty} pointerEvents="none">
            <BabyLogIcon kind="folder" size={32} color={colors.faint} />
          </View>
        )}
        <View style={[styles.privacyBadge, { backgroundColor: privacy.soft }]} pointerEvents="none">
          <BabyLogIcon kind={privacy.icon} size={11} color={privacy.accent} strokeWidth={2.2} />
          <Text style={[styles.privacyText, { color: privacy.accent }]}>{privacy.label}</Text>
        </View>
        {item.mediaCount > 1 ? <View style={styles.mediaCountBadge} pointerEvents="none"><Text style={styles.mediaCountText}>+{item.mediaCount - 1}</Text></View> : null}
        {item.hasFailedMedia || item.publishError ? (
          <View
            style={styles.uploadFailBanner}
            accessibilityRole="alert"
            accessibilityLiveRegion="assertive"
            accessibilityLabel={failMessage}
          >
            <Text style={styles.uploadFailText}>{failMessage}</Text>
            {onRetryUpload ? (
              <Pressable
                style={styles.uploadRetryButton}
                onPress={onRetryUpload}
                accessibilityRole="button"
                accessibilityLabel="다시 시도"
              >
                <Text style={styles.uploadRetryText}>다시 시도</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>
      <View style={styles.cardBody}>
        <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel="추억 상세 보기">
          <View style={styles.metaRow}>
            <View style={[styles.authorAvatar, { backgroundColor: privacy.soft }]}>
              <BabyLogIcon kind="profile" size={15} color={privacy.accent} />
            </View>
            <View style={styles.metaCopy}>
              <View style={styles.authorLine}><Text style={styles.author}>{authorName}</Text><View style={styles.targetBadge}><Text style={styles.targetBadgeText}>{targetLabel}</Text></View></View>
              <Text style={styles.meta}>
                {createdAt.toLocaleDateString("ko-KR", { month: "long", day: "numeric" })} · {createdAt.toLocaleTimeString("ko-KR", { hour: "numeric", minute: "2-digit" })}
              </Text>
            </View>
          </View>
          {caption ? (
            <Text style={styles.caption} numberOfLines={expanded ? undefined : 3}>{caption}</Text>
          ) : null}
        </Pressable>
        {caption.length > 72 ? (
          <Pressable style={styles.moreButton} onPress={onToggleCaption} hitSlop={8}>
            <Text style={styles.moreText}>{expanded ? "접기" : "더 보기"}</Text>
          </Pressable>
        ) : null}
        <View style={styles.reactionRow}>
          <Pressable
            style={({ pressed }) => [styles.reactionButton, pressed && styles.pressed]}
            onPress={onToggleLike}
            disabled={likeWorking}
            accessibilityRole="button"
            accessibilityLabel={item.isLiked ? `좋아요 취소, ${item.reactionCount}개` : `좋아요, ${item.reactionCount}개`}
            accessibilityState={{ selected: item.isLiked, disabled: likeWorking }}
          >
            <BabyLogIcon
              kind="heart"
              size={19}
              color={item.isLiked ? colors.amberText : colors.muted}
              strokeWidth={2.2}
              fill={item.isLiked ? colors.amberText : "transparent"}
            />
            <Text style={[styles.reactionText, item.isLiked && styles.reactionTextActive]}>좋아요 {item.reactionCount}</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.reactionButton, pressed && styles.pressed]}
            onPress={onOpen}
            accessibilityRole="button"
            accessibilityLabel={`댓글 ${item.commentCount}개`}
          >
            <BabyLogIcon kind="chat" size={19} color={colors.muted} />
            <Text style={styles.reactionText}>댓글 {item.commentCount}</Text>
          </Pressable>
          <View style={styles.reactionSpacer} />
          <Pressable
            style={({ pressed }) => [styles.saveButton, pressed && styles.pressed]}
            onPress={onToggleSave}
            disabled={saveWorking}
            accessibilityRole="button"
            accessibilityLabel={item.isSaved ? "저장 취소" : "나중에 다시 보기"}
            accessibilityState={{ selected: item.isSaved, disabled: saveWorking }}
          >
            <BabyLogIcon
              kind="bookmark"
              size={20}
              color={item.isSaved ? colors.amberText : colors.muted}
              fill={item.isSaved ? colors.amberText : "transparent"}
            />
          </Pressable>
        </View>
      </View>
    </View>
  );
});

export function MemoriesScreen({ onOpenSettings, onOpenNotifications, onOpenFamily, onOpenDetail }: Props) {
  const insets = useSafeAreaInsets();
  const { babyName, careSetup, familyMembers, myFamilyRole, logAuthor, storageReady, babies, activeBabyId } = useBabyLog();
  const [cards, setCards] = useState<MemoryCard[]>([]);
  const [loading, setLoading] = useState(true);
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
  const likingPostIdsRef = useRef<Set<string>>(new Set());
  const savingPostIdsRef = useRef<Set<string>>(new Set());
  const pendingPublishesRef = useRef<Map<string, PublishEagerMemoryInput>>(new Map());
  const localCoversRef = useRef<Map<string, string>>(new Map());
  const babyId = activeBabyId;
  const canCreate = myFamilyRole !== "viewer";
  const serverFamilyMembers = useMemo(
    () => familyMembers.filter((member) => UUID_PATTERN.test(member.id)),
    [familyMembers],
  );
  const activeFamilyMembers = useMemo(
    () => familyMembers.filter((member) => member.status === "active" && !member.isMe),
    [familyMembers],
  );
  const togetherDays = useMemo(() => {
    if (!careSetup.child.birthDate) return null;
    const startedAt = new Date(`${careSetup.child.birthDate}T00:00:00`).getTime();
    if (!Number.isFinite(startedAt) || startedAt > Date.now()) return null;
    return Math.max(1, Math.floor((Date.now() - startedAt) / 86_400_000) + 1);
  }, [careSetup.child.birthDate]);
  useEffect(() => {
    if (babyFilter !== "all" && babyFilter !== "family" && !babies.some((baby) => baby.id === babyFilter)) {
      setBabyFilter("all");
    }
  }, [babies, babyFilter]);
  const targetBabyIds = useCallback((card: MemoryCard) => card.tags.filter((tag) => tag.tagType === "baby" && tag.babyId).map((tag) => tag.babyId!), []);
  const targetLabel = useCallback((card: MemoryCard) => {
    if (card.post.isFamilyMoment) return "가족 순간";
    const ids = targetBabyIds(card);
    if (!ids.length) return babies.length === 1 ? (babies[0]?.name ?? babyName) : "가족 순간";
    return ids.map((id) => babies.find((baby) => baby.id === id)?.name).filter(Boolean).join(" · ") || babyName;
  }, [babies, babyName, targetBabyIds]);
  const filteredCards = useMemo(() => cards.filter((card) => {
    const ids = targetBabyIds(card);
    const isFamilyMoment = card.post.isFamilyMoment || (!ids.length && babies.length > 1);
    if (babyFilter === "family" && !isFamilyMoment) return false;
    if (
      babyFilter !== "all"
      && babyFilter !== "family"
      && !(!isFamilyMoment && (ids.includes(babyFilter) || (!ids.length && babies.length === 1 && card.post.babyId === babyFilter)))
    ) return false;
    if (filter === "all") return true;
    if (filter === "family_circle") return card.post.privacyType === "family_circle";
    if (filter === "friend_circle") return card.post.privacyType === "friend_circle";
    if (filter === "only_me") return card.post.privacyType === "only_me";
    if (filter === "saved") return card.isSaved;
    return card.post.privacyType === "tagged_family" || card.tags.some((tag) => tag.taggedUserId === logAuthor.userId);
  }), [babyFilter, babies.length, cards, filter, logAuthor.userId, targetBabyIds]);
  const emptyCopy = useMemo(() => {
    if (filter !== "all") return EMPTY_COPY[filter];
    if (babyFilter === "family") {
      return { title: "가족 순간이 아직 없어요", description: "온 가족이 함께한 순간을 남겨보세요." };
    }
    if (babyFilter !== "all") {
      const name = babies.find((baby) => baby.id === babyFilter)?.name ?? babyName;
      return { title: `${name}의 순간이 아직 없어요`, description: "사진 한 장과 짧은 이야기로 오늘을 남겨보세요." };
    }
    return EMPTY_COPY.all;
  }, [babies, babyFilter, babyName, filter]);
  const selectedBabyName = babies.find((baby) => baby.id === babyFilter)?.name;
  const viewChipLabel = selectedBabyName
    ? (filter === "all" ? selectedBabyName : `${selectedBabyName} · ${memoryViewFilterLabel(filter)}`)
    : filter === "all"
      ? "보기"
      : memoryViewFilterLabel(filter);
  const feedRows = useMemo(
    () => (filter === "all" ? interleaveExampleFeedAds(filteredCards, hiddenAdIds) : filteredCards.map((card) => ({ kind: "memory" as const, card }))),
    [filter, filteredCards, hiddenAdIds],
  );

  const load = useCallback(async (refresh = false) => {
    if (!storageReady) return;
    if (!babyId) {
      setCards([]);
      setLoading(false);
      setRefreshing(false);
      setError("현재 아기 정보를 서버에서 찾지 못했어요. 다시 로그인한 뒤 시도해주세요.");
      return;
    }
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError("");
    setActionError("");
    try {
      void MemoriesRepository.cleanupOrphanTempMedia();
      const lists = await Promise.all(babies.map((baby) => MemoriesRepository.listCardsByBabyId(baby.id)));
      const unique = new Map(lists.flat().map((card) => [card.post.id, card]));
      setCards((current) => {
        const optimistic = current.filter((card) => card.isOptimistic && !unique.has(card.post.id));
        const merged = [...optimistic, ...unique.values()].sort((a, b) => b.post.createdAt.localeCompare(a.post.createdAt));
        return merged.map((card) => {
          const localCover = localCoversRef.current.get(card.post.id);
          const coverFromMedia = card.coverMedia?.id ? getLocalUriForMedia(card.coverMedia.id) : undefined;
          return {
            ...card,
            coverUrl: card.coverUrl ?? localCover ?? coverFromMedia,
            hasFailedMedia: card.hasFailedMedia || card.coverMedia?.uploadStatus === "failed",
          };
        });
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "추억을 불러오지 못했어요.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [babies, babyId, storageReady]);

  // Refetch on every focus so privacy/selection changes and short-lived signed URLs refresh.
  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

  useEffect(() => subscribeEagerUploads(() => {
    setCards((current) => current.map((card) => {
      const localCover = localCoversRef.current.get(card.post.id);
      const coverJob = card.coverMedia?.id ? getEagerPhoto(card.coverMedia.id) : undefined;
      const coverFromMedia = card.coverMedia?.id ? getLocalUriForMedia(card.coverMedia.id) : undefined;
      const failed = coverJob?.status === "failed" || (card.hasFailedMedia && coverJob?.status !== "uploaded");
      return {
        ...card,
        coverUrl: coverJob?.status === "uploaded" ? (card.coverUrl ?? localCover) : (card.coverUrl ?? localCover ?? coverFromMedia),
        hasFailedMedia: Boolean(failed),
      };
    }));
  }), []);

  const publishMemory = useCallback(async (payload: PublishEagerMemoryInput) => {
    pendingPublishesRef.current.set(payload.id, payload);
    try {
      const bundle = await MemoriesRepository.publishEagerMemory(payload);
      pendingPublishesRef.current.delete(payload.id);
      const coverMedia = bundle.media[0];
      const coverUrl = coverMedia?.uploadStatus === "ready"
        ? await MemoriesRepository.createSignedUrl(coverMedia.storagePath, undefined, { width: 800 }).catch(() => localCoversRef.current.get(payload.id))
        : localCoversRef.current.get(payload.id);
      setCards((current) => current.map((card) => card.post.id === payload.id ? {
        post: bundle.post,
        coverMedia,
        coverUrl: coverUrl ?? card.coverUrl,
        mediaCount: bundle.media.length,
        tags: bundle.tags,
        commentCount: bundle.comments.length,
        reactionCount: bundle.reactions.length,
        isLiked: bundle.reactions.some((reaction) => reaction.authorId === logAuthor.userId),
        isSaved: false,
        hasFailedMedia: bundle.media.some((item) => item.uploadStatus === "failed"),
        isOptimistic: false,
        publishError: undefined,
      } : card));
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "추억을 올리지 못했어요.";
      setCards((current) => current.map((card) => card.post.id === payload.id ? { ...card, publishError: message, isOptimistic: true } : card));
    }
  }, [logAuthor.userId]);

  const handlePosted = useCallback((payload: PublishEagerMemoryInput & { localCoverUri?: string }) => {
    setUploadOpen(false);
    const now = new Date().toISOString();
    if (payload.localCoverUri) localCoversRef.current.set(payload.id, payload.localCoverUri);
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
      coverUrl: payload.localCoverUri,
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
    void publishMemory(payload);
  }, [logAuthor.userId, publishMemory]);

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

  const authorName = (authorId: string) => {
    if (authorId === logAuthor.userId) return logAuthor.name;
    return familyMembers.find((member) => member.id === authorId)?.name ?? "탈퇴한 사용자";
  };

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
      setActionError(cause instanceof Error ? cause.message : "좋아요를 저장하지 못했어요.");
    } finally {
      setLikingPostIds((current) => {
        const next = new Set(current);
        next.delete(card.post.id);
        return next;
      });
      likingPostIdsRef.current.delete(card.post.id);
    }
  }, []);

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
      setActionError(cause instanceof Error ? cause.message : "저장 상태를 바꾸지 못했어요.");
    } finally {
      setSavingPostIds((current) => {
        const next = new Set(current);
        next.delete(card.post.id);
        return next;
      });
      savingPostIdsRef.current.delete(card.post.id);
    }
  }, []);

  const listHeader = (
    <>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <View style={styles.headerCopy}>
          <Text style={styles.title} maxFontSizeMultiplier={fontScaleCap.chrome}>우리 순간</Text>
          <Text style={styles.subtitle} maxFontSizeMultiplier={fontScaleCap.chrome}>가족과 함께 보는 우리 아기의 순간</Text>
        </View>
        <View style={styles.headerActions}>
          {onOpenNotifications ? <NotificationBellButton onPress={onOpenNotifications} /> : null}
          {canCreate ? (
            <Pressable style={styles.iconButton} onPress={() => setUploadOpen(true)} accessibilityRole="button" accessibilityLabel="추억 올리기">
              <BabyLogIcon kind="new" size={20} color={colors.amberText} strokeWidth={2.2} />
            </Pressable>
          ) : null}
          {onOpenSettings ? (
            <Pressable style={styles.iconButton} onPress={onOpenSettings} accessibilityRole="button" accessibilityLabel="설정 열기">
              <BabyLogIcon kind="settings" size={19} color={colors.muted} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <View style={[styles.familySection, activeFamilyMembers.length > 0 && styles.familySectionCompact]}>
        <Pressable
          style={styles.familyMain}
          onPress={onOpenFamily}
          accessibilityRole="button"
          accessibilityLabel={activeFamilyMembers.length === 0 ? "가족 초대하기" : "가족 구성원 관리"}
        >
          <View style={styles.paperPlane}><BabyLogIcon kind="send" size={16} color={colors.amberText} strokeWidth={2.2} /></View>
          <View style={styles.familyCopy}>
            <Text style={styles.familyTitle}>{babyName}네 가족</Text>
            <Text style={styles.familySummary}>
              {activeFamilyMembers.length === 0
                ? "아직 초대된 가족이 없어요"
                : `가족 ${activeFamilyMembers.length + 1}명${togetherDays ? ` · 함께 ${togetherDays}일` : ""}`}
            </Text>
            {activeFamilyMembers.length === 0 ? (
              <Text style={styles.familyHint}>여기를 눌러 요청을 보내 보세요.</Text>
            ) : null}
          </View>
          <BabyLogIcon kind="chevron" size={16} color={colors.faint} />
        </Pressable>
      </View>

      <View style={styles.filterBar}>
        <Pressable
          style={[styles.filterChip, babyFilter === "all" && styles.filterChipActive]}
          onPress={() => setBabyFilter("all")}
          accessibilityRole="button"
          accessibilityLabel="전체"
          accessibilityState={{ selected: babyFilter === "all" }}
        >
          <Text style={[styles.filterText, babyFilter === "all" && styles.filterTextActive]}>전체</Text>
        </Pressable>
        <Pressable
          style={[styles.filterChip, babyFilter === "family" && styles.filterChipActive]}
          onPress={() => setBabyFilter("family")}
          accessibilityRole="button"
          accessibilityLabel="가족 순간"
          accessibilityState={{ selected: babyFilter === "family" }}
        >
          <Text style={[styles.filterText, babyFilter === "family" && styles.filterTextActive]}>가족</Text>
        </Pressable>
        <Pressable
          style={[
            styles.viewChip,
            (filter !== "all" || (babyFilter !== "all" && babyFilter !== "family")) && styles.filterChipActive,
          ]}
          onPress={() => setViewSheetOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={filter === "all" && (babyFilter === "all" || babyFilter === "family")
            ? "보기 선택"
            : `보기 ${viewChipLabel}`}
          accessibilityState={{ expanded: viewSheetOpen, selected: filter !== "all" || (babyFilter !== "all" && babyFilter !== "family") }}
        >
          <Text
            style={[
              styles.filterText,
              (filter !== "all" || (babyFilter !== "all" && babyFilter !== "family")) && styles.filterTextActive,
            ]}
            numberOfLines={1}
          >
            {viewChipLabel}
          </Text>
          <BabyLogIcon
            kind="chevron"
            size={14}
            color={filter !== "all" || (babyFilter !== "all" && babyFilter !== "family") ? colors.amberDark : colors.muted}
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
        data={loading || error ? [] : feedRows}
        keyExtractor={(item) => item.kind === "ad" ? `ad:${item.ad.id}` : item.card.post.id}
        ListHeaderComponent={listHeader}
        contentContainerStyle={[styles.feed, { paddingBottom: insets.bottom + 28 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.amber} />}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          loading ? (
            <View style={styles.emptyState}><ActivityIndicator color={colors.amberText} /><Text style={styles.centerCopy}>가족 추억을 불러오는 중…</Text></View>
          ) : error ? (
            <View style={styles.emptyState}>
              <Text style={styles.errorTitle}>추억을 불러오지 못했어요.</Text>
              <Text style={styles.centerCopy}>{error}</Text>
              <Pressable style={styles.secondaryButton} onPress={() => void load()}><Text style={styles.secondaryText}>다시 시도</Text></Pressable>
            </View>
          ) : (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}><BabyLogIcon kind="sparkles" size={34} color={colors.amberText} /></View>
              <Text style={styles.emptyTitle}>{emptyCopy.title}</Text>
              <Text style={styles.emptyCopy}>{emptyCopy.description}</Text>
              {canCreate && filter !== "tagged" ? <Pressable style={styles.primaryButton} onPress={() => setUploadOpen(true)}><Text style={styles.primaryText}>{filter === "all" ? "첫 순간 올리기" : "순간 올리기"}</Text></Pressable> : null}
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
              expanded={expandedCaptions.has(card.post.id)}
              onOpen={() => { if (!card.publishError) onOpenDetail(card.post.id); }}
              onToggleLike={() => void toggleLike(card)}
              onToggleSave={() => void toggleSave(card)}
              onRetryUpload={card.hasFailedMedia || card.publishError ? () => retryCard(card) : undefined}
              likeWorking={likingPostIds.has(card.post.id)}
              saveWorking={savingPostIds.has(card.post.id)}
              targetLabel={targetLabel(card)}
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
          visible={uploadOpen}
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
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingBottom: 15, gap: 12 },
  headerCopy: { flex: 1 },
  title: { color: colors.text, fontSize: 27, fontWeight: "800", letterSpacing: -0.5 },
  subtitle: { color: colors.muted, fontSize: 12.5, marginTop: 2 },
  headerActions: { flexDirection: "row", gap: 8 },
  iconButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  familySection: { marginHorizontal: 16, marginBottom: 10, padding: 13, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  familySectionCompact: { paddingVertical: 10, paddingHorizontal: 12 },
  familyMain: { flex: 1, minWidth: 0, minHeight: Platform.OS === "android" ? 48 : 44, flexDirection: "row", alignItems: "center", gap: 10 },
  paperPlane: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.amberSoft, alignItems: "center", justifyContent: "center" },
  familyCopy: { flex: 1, minWidth: 0 },
  familyTitle: { color: colors.text, fontSize: 14, fontWeight: "800" },
  familySummary: { color: colors.muted, fontSize: 11.5, marginTop: 2 },
  familyHint: { color: colors.muted, fontSize: 12.5, marginTop: 6 },
  filterBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 8, gap: 8 },
  filterChip: { minHeight: Platform.OS === "android" ? 48 : 44, paddingHorizontal: 16, borderRadius: 18, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  viewChip: { minHeight: Platform.OS === "android" ? 48 : 44, maxWidth: 148, marginLeft: "auto", paddingHorizontal: 12, borderRadius: 18, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, flexDirection: "row", alignItems: "center", gap: 4 },
  filterChipActive: { backgroundColor: colors.amber, borderColor: colors.amber },
  filterText: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  filterTextActive: { color: colors.amberDark },
  actionError: { marginHorizontal: 16, marginBottom: 8, color: colors.dangerText, backgroundColor: colors.dangerSoft, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10, fontSize: 12.5, fontWeight: "700" },
  emptyState: { paddingHorizontal: 32, paddingTop: 48, paddingBottom: 28, alignItems: "center", justifyContent: "center" },
  center: { flex: 1, paddingHorizontal: 32, alignItems: "center", justifyContent: "center" },
  centerCopy: { marginTop: 9, color: colors.muted, fontSize: 13, lineHeight: 20, textAlign: "center" },
  errorTitle: { color: colors.text, fontSize: 17, fontWeight: "800" },
  emptyIcon: { width: 72, height: 72, borderRadius: 28, backgroundColor: colors.amberSoft, alignItems: "center", justifyContent: "center", marginBottom: 18 },
  emptyTitle: { color: colors.text, fontSize: 19, fontWeight: "800" },
  emptyCopy: { color: colors.muted, fontSize: 13.5, lineHeight: 21, textAlign: "center", marginTop: 8 },
  primaryButton: { minHeight: 50, marginTop: 22, paddingHorizontal: 24, borderRadius: radius.full, backgroundColor: colors.amber, alignItems: "center", justifyContent: "center" },
  primaryText: { color: colors.amberDark, fontSize: 14, fontWeight: "800" },
  secondaryButton: { minHeight: 44, marginTop: 18, paddingHorizontal: 18, borderRadius: radius.full, borderWidth: 1, borderColor: colors.amber, alignItems: "center", justifyContent: "center" },
  secondaryText: { color: colors.amberText, fontSize: 13, fontWeight: "800" },
  feed: { paddingTop: 4, gap: 14 },
  card: { width: "auto", minWidth: 0, marginHorizontal: 16, borderRadius: 22, overflow: "hidden", backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  thumbnail: { width: "100%", aspectRatio: 4 / 3, backgroundColor: colors.cardHi },
  thumbnailEmpty: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  privacyBadge: { position: "absolute", left: 12, top: 12, minHeight: 28, paddingHorizontal: 9, borderRadius: radius.full, flexDirection: "row", alignItems: "center", gap: 4 },
  privacyText: { fontSize: 10.5, fontWeight: "800" },
  mediaCountBadge: { position: "absolute", right: 12, top: 12, minWidth: 30, height: 28, paddingHorizontal: 8, borderRadius: 14, backgroundColor: "rgba(46,42,38,0.72)", alignItems: "center", justifyContent: "center" },
  mediaCountText: { color: "#fff", fontSize: 11, fontWeight: "800" },
  uploadFailBanner: { position: "absolute", left: 12, right: 12, bottom: 12, minHeight: 44, paddingLeft: 12, paddingRight: 6, borderRadius: 14, backgroundColor: "rgba(46,42,38,0.82)", flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  uploadFailText: { color: "#fff", fontSize: 12, fontWeight: "700", flexShrink: 1 },
  uploadRetryButton: { minHeight: 44, minWidth: 72, paddingHorizontal: 10, alignItems: "center", justifyContent: "center" },
  uploadRetryText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  cardBody: { paddingHorizontal: 14, paddingVertical: 13 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  authorAvatar: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  metaCopy: { flex: 1 },
  authorLine: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6 },
  author: { color: colors.text, fontSize: 13, fontWeight: "800" },
  targetBadge: { maxWidth: 180, paddingHorizontal: 7, paddingVertical: 2, borderRadius: radius.full, backgroundColor: colors.amberSoft },
  targetBadgeText: { color: colors.amberText, fontSize: 9.5, fontWeight: "800" },
  meta: { color: colors.faint, fontSize: 10.5, marginTop: 2 },
  caption: { color: colors.text, fontSize: 14, lineHeight: 21, marginTop: 11 },
  moreButton: { alignSelf: "flex-start", minHeight: TOUCH_MIN, justifyContent: "center", marginTop: 2 },
  moreText: { color: colors.amberText, fontSize: 12, fontWeight: "800" },
  reactionRow: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 10, marginTop: 4 },
  reactionButton: { minHeight: 44, paddingRight: 2, flexDirection: "row", alignItems: "center", gap: 4 },
  reactionSpacer: { flex: 1 },
  saveButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  reactionText: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  reactionTextActive: { color: colors.amberText },
  pressed: { opacity: 0.7 },
});
