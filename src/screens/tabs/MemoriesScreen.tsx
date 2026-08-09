import { memo, useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import { Bookmark } from "lucide-react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BabyLogIcon } from "../../components/babylog/BabyLogIcon";
import { MemoryUploadModal } from "../../components/memories/MemoryUploadModal";
import { memoryPrivacyPresentation } from "../../components/memories/memoryPresentation";
import { useBabyLog } from "../../context/BabyLogContext";
import { MemoriesRepository } from "../../repositories/MemoriesRepository";
import type { MemoryCard } from "../../types/memory";
import { memberRelationshipLabel } from "../../types/family";
import { getSupabaseSync } from "../../utils/supabaseSyncStore";
import { colors, radius } from "../../theme";

type Props = {
  onOpenSettings?: () => void;
  onOpenFamily?: () => void;
  onOpenDetail: (memoryPostId: string) => void;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type MemoryFilter = "all" | "family_circle" | "friend_circle" | "only_me" | "tagged" | "saved";

const FILTERS: Array<{ key: MemoryFilter; label: string }> = [
  { key: "all", label: "전체" },
  { key: "family_circle", label: "가족 공개" },
  { key: "friend_circle", label: "친구 공개" },
  { key: "only_me", label: "나만 보기" },
  { key: "tagged", label: "태그됨" },
  { key: "saved", label: "저장됨" },
];

const EMPTY_COPY: Record<MemoryFilter, { title: string; description: string }> = {
  all: { title: "첫 번째 순간을 남겨보세요", description: "사진 한 장과 짧은 이야기로 오늘을 가족과 나눠보세요." },
  family_circle: { title: "가족에게 공개된 순간이 아직 없어요", description: "함께 보고 싶은 오늘의 순간을 남겨보세요." },
  friend_circle: { title: "친구에게 보여줄 순간이 아직 없어요", description: "초대된 친구와 나누고 싶은 순간을 남겨보세요." },
  only_me: { title: "나만 간직한 순간이 아직 없어요", description: "조용히 보관하고 싶은 사진과 이야기를 남겨보세요." },
  tagged: { title: "태그된 순간이 아직 없어요", description: "가족이 태그한 순간이 생기면 여기에 모여요." },
  saved: { title: "저장한 순간이 아직 없어요", description: "다시 보고 싶은 순간의 저장 아이콘을 눌러보세요." },
};

type FeedCardProps = {
  item: MemoryCard;
  authorName: string;
  expanded: boolean;
  onToggleCaption: () => void;
  onOpen: () => void;
  onToggleSave: () => void;
  saveWorking: boolean;
};

const MemoryFeedCard = memo(function MemoryFeedCard({
  item,
  authorName,
  expanded,
  onToggleCaption,
  onOpen,
  onToggleSave,
  saveWorking,
}: FeedCardProps) {
  const privacy = memoryPrivacyPresentation(item.post.privacyType);
  const createdAt = new Date(item.post.createdAt);
  const caption = item.post.caption?.trim() ?? "";

  return (
    <View style={[styles.card, { borderColor: privacy.accent }]}>
      <Pressable style={styles.thumbnail} onPress={onOpen} accessibilityRole="button" accessibilityLabel="추억 상세 보기">
        {item.coverUrl ? (
          <Image source={{ uri: item.coverUrl }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
        ) : (
          <BabyLogIcon kind="folder" size={32} color={colors.faint} />
        )}
        <View style={[styles.privacyBadge, { backgroundColor: privacy.soft }]}>
          <Text style={[styles.privacyIcon, { color: privacy.accent }]}>{privacy.icon}</Text>
          <Text style={[styles.privacyText, { color: privacy.accent }]}>{privacy.label}</Text>
        </View>
      </Pressable>
      <View style={styles.cardBody}>
        <Pressable onPress={onOpen} accessibilityRole="button">
          <View style={styles.metaRow}>
            <View style={[styles.authorAvatar, { backgroundColor: privacy.soft }]}>
              <BabyLogIcon kind="profile" size={15} color={privacy.accent} />
            </View>
            <View style={styles.metaCopy}>
              <Text style={styles.author}>{authorName}</Text>
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
          <Pressable style={styles.reactionButton} onPress={onOpen} accessibilityLabel={`좋아요 ${item.reactionCount}개`}>
            <Text style={styles.heart}>♡</Text><Text style={styles.reactionText}>{item.reactionCount}</Text>
          </Pressable>
          <Pressable style={styles.reactionButton} onPress={onOpen} accessibilityLabel={`댓글 ${item.commentCount}개`}>
            <BabyLogIcon kind="chat" size={19} color={colors.muted} /><Text style={styles.reactionText}>{item.commentCount}</Text>
          </Pressable>
          <View style={styles.reactionSpacer} />
          <Pressable
            style={styles.saveButton}
            onPress={onToggleSave}
            disabled={saveWorking}
            accessibilityRole="button"
            accessibilityLabel={item.isSaved ? "저장 취소" : "추억 저장"}
            accessibilityState={{ selected: item.isSaved, disabled: saveWorking }}
          >
            <Bookmark size={20} color={item.isSaved ? colors.amber : colors.muted} fill={item.isSaved ? colors.amber : "transparent"} />
          </Pressable>
        </View>
      </View>
    </View>
  );
});

export function MemoriesScreen({ onOpenSettings, onOpenFamily, onOpenDetail }: Props) {
  const insets = useSafeAreaInsets();
  const { babyName, careSetup, familyMembers, myFamilyRole, logAuthor, storageReady } = useBabyLog();
  const [cards, setCards] = useState<MemoryCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [filter, setFilter] = useState<MemoryFilter>("all");
  const [expandedCaptions, setExpandedCaptions] = useState<Set<string>>(() => new Set());
  const [savingPostIds, setSavingPostIds] = useState<Set<string>>(() => new Set());
  const savingPostIdsRef = useRef<Set<string>>(new Set());
  const babyId = getSupabaseSync().babyId;
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
  const filteredCards = useMemo(() => cards.filter((card) => {
    if (filter === "all") return true;
    if (filter === "family_circle") return card.post.privacyType === "family_circle";
    if (filter === "friend_circle") return card.post.privacyType === "friend_circle";
    if (filter === "only_me") return card.post.privacyType === "only_me";
    if (filter === "saved") return card.isSaved;
    return card.post.privacyType === "tagged_family" || card.tags.some((tag) => tag.taggedUserId === logAuthor.userId);
  }), [cards, filter, logAuthor.userId]);
  const emptyCopy = EMPTY_COPY[filter];

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
    try {
      setCards(await MemoriesRepository.listCardsByBabyId(babyId));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "추억을 불러오지 못했어요.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [babyId, storageReady]);

  // Refetch on every focus so privacy/selection changes and short-lived signed URLs refresh.
  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

  const authorName = (authorId: string) => {
    if (authorId === logAuthor.userId) return logAuthor.name;
    return familyMembers.find((member) => member.id === authorId)?.name ?? "탈퇴한 사용자";
  };

  const toggleSave = useCallback(async (card: MemoryCard) => {
    if (savingPostIdsRef.current.has(card.post.id)) return;
    const nextSaved = !card.isSaved;
    savingPostIdsRef.current.add(card.post.id);
    setSavingPostIds((current) => new Set(current).add(card.post.id));
    setCards((current) => current.map((item) => item.post.id === card.post.id ? { ...item, isSaved: nextSaved } : item));
    setError("");
    try {
      if (nextSaved) await MemoriesRepository.saveMemoryPost(card.post.id);
      else await MemoriesRepository.unsaveMemoryPost(card.post.id);
    } catch (cause) {
      setCards((current) => current.map((item) => item.post.id === card.post.id ? { ...item, isSaved: card.isSaved } : item));
      setError(cause instanceof Error ? cause.message : "저장 상태를 바꾸지 못했어요.");
    } finally {
      setSavingPostIds((current) => {
        const next = new Set(current);
        next.delete(card.post.id);
        return next;
      });
      savingPostIdsRef.current.delete(card.post.id);
    }
  }, []);

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>우리 순간</Text>
          <Text style={styles.subtitle}>가족과 함께 보는 우리 아기의 순간</Text>
        </View>
        <View style={styles.headerActions}>
          {canCreate ? (
            <Pressable style={styles.iconButton} onPress={() => setUploadOpen(true)} accessibilityRole="button" accessibilityLabel="사진 추가">
              <BabyLogIcon kind="new" size={20} color={colors.amber} strokeWidth={2.2} />
            </Pressable>
          ) : null}
          {onOpenSettings ? (
            <Pressable style={styles.iconButton} onPress={onOpenSettings} accessibilityRole="button" accessibilityLabel="설정 열기">
              <BabyLogIcon kind="settings" size={19} color={colors.muted} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <Pressable style={styles.familySection} onPress={onOpenFamily} accessibilityRole="button" accessibilityLabel="가족 구성원 관리">
        <View style={styles.paperPlane}><Text style={styles.paperPlaneText}>✈</Text></View>
        <View style={styles.familyCopy}>
          <Text style={styles.familyTitle}>{babyName}네 가족</Text>
          <Text style={styles.familySummary}>가족 {activeFamilyMembers.length + 1}명 · {togetherDays ? `함께 ${togetherDays}일` : "함께 기록 중"}</Text>
          {activeFamilyMembers.length === 0 ? (
            <Text style={styles.familyHint}>아직 초대된 가족이 없어요.</Text>
          ) : (
            <View style={styles.familyChips}>
              {activeFamilyMembers.slice(0, 5).map((member) => (
                <View key={member.id} style={styles.familyChip}>
                  <Text style={styles.familyEmoji}>{member.emoji ?? "♡"}</Text>
                  <Text style={styles.familyChipText} numberOfLines={1}>{memberRelationshipLabel(member)}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
        <Pressable style={styles.inviteButton} onPress={onOpenFamily}>
          <Text style={styles.inviteText}>가족 초대</Text>
        </Pressable>
      </Pressable>

      <ScrollView
        horizontal
        style={styles.filterScroller}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
          {FILTERS.map((item) => {
            const active = filter === item.key;
            return (
              <Pressable key={item.key} style={[styles.filterChip, active && styles.filterChipActive]} onPress={() => setFilter(item.key)}>
                <Text style={[styles.filterText, active && styles.filterTextActive]}>{item.label}</Text>
              </Pressable>
            );
          })}
      </ScrollView>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.amber} /><Text style={styles.centerCopy}>가족 추억을 불러오는 중…</Text></View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorTitle}>추억을 불러오지 못했어요.</Text>
          <Text style={styles.centerCopy}>{error}</Text>
          <Pressable style={styles.secondaryButton} onPress={() => void load()}><Text style={styles.secondaryText}>다시 시도</Text></Pressable>
        </View>
      ) : filteredCards.length === 0 ? (
        <View style={styles.center}>
          <View style={styles.emptyIcon}><BabyLogIcon kind="sparkles" size={34} color={colors.amber} /></View>
          <Text style={styles.emptyTitle}>{emptyCopy.title}</Text>
          <Text style={styles.emptyCopy}>{emptyCopy.description}</Text>
          {canCreate && filter !== "tagged" ? <Pressable style={styles.primaryButton} onPress={() => setUploadOpen(true)}><Text style={styles.primaryText}>{filter === "all" ? "첫 순간 올리기" : "순간 올리기"}</Text></Pressable> : null}
        </View>
      ) : (
        <FlatList
          data={filteredCards}
          keyExtractor={(item) => item.post.id}
          contentContainerStyle={[styles.feed, { paddingBottom: insets.bottom + 28 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.amber} />}
          renderItem={({ item }) => (
            <MemoryFeedCard
              item={item}
              authorName={authorName(item.post.authorId)}
              expanded={expandedCaptions.has(item.post.id)}
              onOpen={() => onOpenDetail(item.post.id)}
              onToggleSave={() => void toggleSave(item)}
              saveWorking={savingPostIds.has(item.post.id)}
              onToggleCaption={() => setExpandedCaptions((current) => {
                const next = new Set(current);
                if (next.has(item.post.id)) next.delete(item.post.id);
                else next.add(item.post.id);
                return next;
              })}
            />
          )}
        />
      )}

      {babyId ? (
        <MemoryUploadModal
          visible={uploadOpen}
          babyId={babyId}
          babyName={babyName}
          familyMembers={serverFamilyMembers}
          onClose={() => setUploadOpen(false)}
          onCreated={() => void load(true)}
        />
      ) : null}
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
  familySection: { marginHorizontal: 16, marginBottom: 10, padding: 13, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, flexDirection: "row", alignItems: "center", gap: 10 },
  paperPlane: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.amberSoft, alignItems: "center", justifyContent: "center" },
  paperPlaneText: { color: colors.amber, fontSize: 18, fontWeight: "800" },
  familyCopy: { flex: 1 },
  familyTitle: { color: colors.text, fontSize: 14, fontWeight: "800" },
  familySummary: { color: colors.muted, fontSize: 11.5, marginTop: 2, marginBottom: 7 },
  familyHint: { color: colors.muted, fontSize: 12.5 },
  familyChips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  familyChip: { minHeight: 30, maxWidth: 92, paddingHorizontal: 8, borderRadius: radius.full, backgroundColor: colors.cardHi, borderWidth: 1, borderColor: colors.border, flexDirection: "row", alignItems: "center", gap: 4 },
  familyEmoji: { color: colors.amber, fontSize: 11 },
  familyChipText: { color: colors.muted, fontSize: 11.5, fontWeight: "700", flexShrink: 1 },
  inviteButton: { minHeight: 36, paddingHorizontal: 10, borderRadius: radius.full, backgroundColor: colors.amberSoft, alignItems: "center", justifyContent: "center" },
  inviteText: { color: colors.amber, fontSize: 11.5, fontWeight: "800" },
  filterScroller: { flexGrow: 0, flexShrink: 0 },
  filterRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, gap: 8, paddingBottom: 8 },
  filterChip: { minHeight: 36, paddingHorizontal: 12, borderRadius: radius.full, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  filterChipActive: { backgroundColor: colors.amber, borderColor: colors.amber },
  filterText: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  filterTextActive: { color: "#FFFFFF" },
  center: { flex: 1, paddingHorizontal: 32, alignItems: "center", justifyContent: "center" },
  centerCopy: { marginTop: 9, color: colors.muted, fontSize: 13, lineHeight: 20, textAlign: "center" },
  errorTitle: { color: colors.text, fontSize: 17, fontWeight: "800" },
  emptyIcon: { width: 72, height: 72, borderRadius: 28, backgroundColor: colors.amberSoft, alignItems: "center", justifyContent: "center", marginBottom: 18 },
  emptyTitle: { color: colors.text, fontSize: 19, fontWeight: "800" },
  emptyCopy: { color: colors.muted, fontSize: 13.5, lineHeight: 21, textAlign: "center", marginTop: 8 },
  primaryButton: { minHeight: 50, marginTop: 22, paddingHorizontal: 24, borderRadius: radius.full, backgroundColor: colors.amber, alignItems: "center", justifyContent: "center" },
  primaryText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  secondaryButton: { minHeight: 44, marginTop: 18, paddingHorizontal: 18, borderRadius: radius.full, borderWidth: 1, borderColor: colors.amber, alignItems: "center", justifyContent: "center" },
  secondaryText: { color: colors.amber, fontSize: 13, fontWeight: "800" },
  feed: { paddingHorizontal: 16, paddingTop: 4, gap: 14 },
  card: { width: "100%", minWidth: 0, borderRadius: 22, overflow: "hidden", backgroundColor: colors.card, borderWidth: 1.25 },
  thumbnail: { width: "100%", aspectRatio: 4 / 3, alignItems: "center", justifyContent: "center", backgroundColor: colors.cardHi },
  privacyBadge: { position: "absolute", left: 12, top: 12, minHeight: 28, paddingHorizontal: 9, borderRadius: radius.full, flexDirection: "row", alignItems: "center", gap: 4 },
  privacyIcon: { fontSize: 11, fontWeight: "900" },
  privacyText: { fontSize: 10.5, fontWeight: "800" },
  cardBody: { paddingHorizontal: 14, paddingVertical: 13 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  authorAvatar: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  metaCopy: { flex: 1 },
  author: { color: colors.text, fontSize: 13, fontWeight: "800" },
  meta: { color: colors.faint, fontSize: 10.5, marginTop: 2 },
  caption: { color: colors.text, fontSize: 14, lineHeight: 21, marginTop: 11 },
  moreButton: { alignSelf: "flex-start", minHeight: 32, justifyContent: "center", marginTop: 2 },
  moreText: { color: colors.amber, fontSize: 12, fontWeight: "800" },
  reactionRow: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  reactionButton: { minWidth: 54, minHeight: 44, paddingHorizontal: 5, flexDirection: "row", alignItems: "center", gap: 5 },
  reactionSpacer: { flex: 1 },
  saveButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  heart: { color: colors.muted, fontSize: 25, lineHeight: 27 },
  reactionText: { color: colors.muted, fontSize: 12, fontWeight: "700" },
});
