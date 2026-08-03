import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
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
import { memoryPrivacyLabel } from "../../components/memories/MemoryPrivacyPicker";
import { useBabyLog } from "../../context/BabyLogContext";
import { MemoriesRepository } from "../../repositories/MemoriesRepository";
import type { MemoryCard } from "../../types/memory";
import { memberRelationshipLabel } from "../../types/family";
import { getSupabaseSync } from "../../utils/supabaseSyncStore";
import { colors, radius } from "../../theme";

type Props = {
  onOpenSettings: () => void;
  onOpenDetail: (memoryPostId: string) => void;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type MemoryFilter = "all" | "family_circle" | "only_me" | "tagged";

const FILTERS: Array<{ key: MemoryFilter; label: string }> = [
  { key: "all", label: "전체" },
  { key: "family_circle", label: "가족 공개" },
  { key: "only_me", label: "나만 보기" },
  { key: "tagged", label: "태그됨" },
];

export function MemoriesScreen({ onOpenSettings, onOpenDetail }: Props) {
  const insets = useSafeAreaInsets();
  const { babyName, familyMembers, myFamilyRole, logAuthor, storageReady } = useBabyLog();
  const [cards, setCards] = useState<MemoryCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [filter, setFilter] = useState<MemoryFilter>("all");
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
  const filteredCards = useMemo(() => cards.filter((card) => {
    if (filter === "all") return true;
    if (filter === "family_circle") return card.post.privacyType === "family_circle";
    if (filter === "only_me") return card.post.privacyType === "only_me";
    return card.tags.some((tag) =>
      tag.tagType === "baby" ||
      tag.taggedUserId === logAuthor.userId ||
      tag.taggedUserId === card.post.authorId,
    );
  }), [cards, filter, logAuthor.userId]);

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
    return familyMembers.find((member) => member.id === authorId)?.name ?? "가족";
  };

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
          <Pressable style={styles.iconButton} onPress={onOpenSettings} accessibilityRole="button" accessibilityLabel="설정 열기">
            <BabyLogIcon kind="settings" size={19} color={colors.muted} />
          </Pressable>
        </View>
      </View>

      <View style={styles.familySection}>
        <View style={styles.paperPlane}><Text style={styles.paperPlaneText}>✈</Text></View>
        <View style={styles.familyCopy}>
          <Text style={styles.familyTitle}>베베로그</Text>
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
        {activeFamilyMembers.length === 0 ? (
          <Pressable style={styles.inviteButton} onPress={onOpenSettings}>
            <Text style={styles.inviteText}>가족 초대하기</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.filterRow}>
        {FILTERS.map((item) => {
          const active = filter === item.key;
          return (
            <Pressable key={item.key} style={[styles.filterChip, active && styles.filterChipActive]} onPress={() => setFilter(item.key)}>
              <Text style={[styles.filterText, active && styles.filterTextActive]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>

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
          <Text style={styles.emptyTitle}>첫 번째 순간을 남겨보세요</Text>
          <Text style={styles.emptyCopy}>오늘의 사진 한 장과 짧은 이야기를{`\n`}가족과 함께 나눌 수 있어요.</Text>
          {canCreate ? <Pressable style={styles.primaryButton} onPress={() => setUploadOpen(true)}><Text style={styles.primaryText}>첫 순간 올리기</Text></Pressable> : null}
        </View>
      ) : (
        <FlatList
          data={filteredCards}
          keyExtractor={(item) => item.post.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={[styles.grid, { paddingBottom: insets.bottom + 28 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.amber} />}
          renderItem={({ item }) => (
            <Pressable style={styles.card} onPress={() => onOpenDetail(item.post.id)}>
              <View style={styles.thumbnail}>
                {item.coverUrl ? <Image source={{ uri: item.coverUrl }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} /> : <BabyLogIcon kind="folder" size={28} color={colors.faint} />}
                <View style={styles.privacyBadge}><Text style={styles.privacyText}>{memoryPrivacyLabel(item.post.privacyType)}</Text></View>
              </View>
              <View style={styles.cardBody}>
                <Text style={styles.meta}>{authorName(item.post.authorId)} · {new Date(item.post.createdAt).toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" })}</Text>
                <Text style={styles.counts}>♡ {item.reactionCount}  댓글 {item.commentCount}</Text>
              </View>
            </Pressable>
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
  familyTitle: { color: colors.text, fontSize: 13, fontWeight: "800", marginBottom: 6 },
  familyHint: { color: colors.muted, fontSize: 12.5 },
  familyChips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  familyChip: { minHeight: 30, maxWidth: 92, paddingHorizontal: 8, borderRadius: radius.full, backgroundColor: colors.cardHi, borderWidth: 1, borderColor: colors.border, flexDirection: "row", alignItems: "center", gap: 4 },
  familyEmoji: { color: colors.amber, fontSize: 11 },
  familyChipText: { color: colors.muted, fontSize: 11.5, fontWeight: "700", flexShrink: 1 },
  inviteButton: { minHeight: 36, paddingHorizontal: 10, borderRadius: radius.full, backgroundColor: colors.amberSoft, alignItems: "center", justifyContent: "center" },
  inviteText: { color: colors.amber, fontSize: 11.5, fontWeight: "800" },
  filterRow: { flexDirection: "row", paddingHorizontal: 16, gap: 8, marginBottom: 8 },
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
  grid: { paddingHorizontal: 16, paddingTop: 4 },
  row: { gap: 12, marginBottom: 12 },
  // Fixed half-width so a lone card does not stretch full row.
  card: { width: "48%", minWidth: 0, borderRadius: 20, overflow: "hidden", backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  thumbnail: { aspectRatio: 0.8, alignItems: "center", justifyContent: "center", backgroundColor: colors.cardHi },
  privacyBadge: { position: "absolute", left: 8, bottom: 8, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, backgroundColor: "rgba(46,42,38,0.55)" },
  privacyText: { color: "#FFFFFF", fontSize: 9.5, fontWeight: "600" },
  cardBody: { padding: 10 },
  meta: { color: colors.faint, fontSize: 9.5, marginTop: 5 },
  counts: { color: colors.muted, fontSize: 10.5, marginTop: 6 },
});
