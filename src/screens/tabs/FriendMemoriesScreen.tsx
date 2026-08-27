import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BabyLogIcon } from "../../components/babylog/BabyLogIcon";
import { ProfileAvatar } from "../../components/profile/ProfileAvatar";
import { MemoriesRepository } from "../../repositories/MemoriesRepository";
import { ProfileRepository } from "../../repositories/ProfileRepository";
import type { DisplayProfile } from "../../types/profileSettings";
import type { FriendMemoryContext, MemoryCard } from "../../types/memory";
import { memoryPrivacyPresentation } from "../../components/memories/memoryPresentation";
import { colors, radius } from "../../theme";
import { useLanguage } from "../../LanguageContext";
import { formatLocalizedDate } from "../../utils/localeFormat";
import { caughtErrorMessage } from "../../utils/familyDisplay";

type Props = {
  onOpenNotifications: () => void;
  onOpenDetail: (memoryPostId: string) => void;
};

export function FriendMemoriesScreen({ onOpenNotifications, onOpenDetail }: Props) {
  const insets = useSafeAreaInsets();
  const { t, locale } = useLanguage();
  const [contexts, setContexts] = useState<FriendMemoryContext[]>([]);
  const [cards, setCards] = useState<MemoryCard[]>([]);
  const [profiles, setProfiles] = useState<DisplayProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [workingIds, setWorkingIds] = useState<Set<string>>(() => new Set());

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    setError("");
    try {
      const nextContexts = await MemoriesRepository.listMyFriendMemoryContexts();
      const lists = await Promise.all(nextContexts.map((item) => MemoriesRepository.listCardsByBabyId(item.babyId)));
      const nextCards = lists.flat()
        .filter((item) => item.post.privacyType === "friend_circle" && item.post.status === "published" && !item.post.deletedAt)
        .sort((a, b) => b.post.createdAt.localeCompare(a.post.createdAt));
      const nextProfiles = await ProfileRepository.listVisibleDisplayProfiles(nextCards.map((item) => item.post.authorId));
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

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const contextByBabyId = useMemo(() => new Map(contexts.map((item) => [item.babyId, item])), [contexts]);
  const profileById = useMemo(() => new Map(profiles.map((item) => [item.userId, item])), [profiles]);

  const toggleLike = async (card: MemoryCard) => {
    if (workingIds.has(card.post.id)) return;
    setWorkingIds((current) => new Set(current).add(card.post.id));
    try {
      if (card.isLiked) await MemoriesRepository.removeReaction(card.post.id);
      else await MemoriesRepository.setReaction({ memoryPostId: card.post.id, reactionType: "heart" });
      await load(true);
    } catch (cause) {
      setError(caughtErrorMessage(t, cause, "memory.critical.052"));
    } finally {
      setWorkingIds((current) => { const next = new Set(current); next.delete(card.post.id); return next; });
    }
  };

  return (
    <View style={styles.root}>
      <FlatList
        data={loading || error ? [] : cards}
        keyExtractor={(item) => item.post.id}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 14, paddingBottom: insets.bottom + 28 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.amberText} />}
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
          <View style={styles.empty}><BabyLogIcon kind="sparkles" size={34} color={colors.amberText} /><Text style={styles.emptyTitle}>{t("memory.critical.174")}</Text><Text style={styles.emptyCopy}>{t("memory.critical.175")}</Text></View>
        )}
        renderItem={({ item }) => {
          const context = contextByBabyId.get(item.post.babyId);
          const author = profileById.get(item.post.authorId);
          const privacy = memoryPrivacyPresentation(item.post.privacyType);
          return (
            <Pressable style={[styles.card, { borderColor: privacy.accent }]} onPress={() => onOpenDetail(item.post.id)} accessibilityRole="button" accessibilityLabel={t("memory.critical.176")}>
              {item.coverUrl ? <Image source={{ uri: item.coverUrl }} style={styles.photo} contentFit="cover" /> : <View style={[styles.photo, styles.photoFallback]}><BabyLogIcon kind="sparkles" size={34} color={colors.faint} /></View>}
              <View style={styles.cardBody}>
                <View style={styles.metaRow}>
                  <ProfileAvatar uri={author?.avatarUrl ?? context?.avatarUrl} size={34} />
                  <View style={styles.metaCopy}>
                    <Text style={styles.author}>{author?.displayName ?? t("memory.critical.155")}</Text>
                    <Text style={styles.date}>{formatLocalizedDate(item.post.createdAt, locale, { year: "numeric", month: "long", day: "numeric" })}</Text>
                  </View>
                  <View style={styles.badge}><Text style={styles.badgeText}>{t("memory.critical.058")}</Text></View>
                </View>
                {context?.babyName ? <Text style={styles.babyName}>{context.babyName}</Text> : null}
                {item.post.caption ? <Text style={styles.caption} numberOfLines={4}>{item.post.caption}</Text> : null}
                <View style={styles.actions}>
                  <Pressable style={styles.action} onPress={(event) => { event.stopPropagation(); void toggleLike(item); }} disabled={workingIds.has(item.post.id)} accessibilityLabel={item.isLiked ? t("memory.critical.145") : t("memory.critical.144")}>
                    <BabyLogIcon kind="heart" size={19} color={item.isLiked ? colors.amberText : colors.muted} fill={item.isLiked ? colors.amberText : "transparent"} />
                    <Text style={styles.actionText}>{item.reactionCount}</Text>
                  </Pressable>
                  <View style={styles.action}><BabyLogIcon kind="chat" size={19} color={colors.muted} /><Text style={styles.actionText}>{item.commentCount}</Text></View>
                </View>
              </View>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 16, gap: 14 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 4 },
  headerCopy: { flex: 1 },
  title: { color: colors.text, fontSize: 27, fontWeight: "800" },
  subtitle: { color: colors.muted, fontSize: 12.5, marginTop: 3 },
  iconButton: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, alignItems: "center", justifyContent: "center" },
  card: { overflow: "hidden", borderRadius: 22, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.card },
  photo: { width: "100%", aspectRatio: 4 / 3, backgroundColor: colors.cardHi },
  photoFallback: { alignItems: "center", justifyContent: "center" },
  cardBody: { padding: 14 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  metaCopy: { flex: 1 },
  author: { color: colors.text, fontSize: 13.5, fontWeight: "800" },
  date: { color: colors.faint, fontSize: 10.5, marginTop: 2 },
  badge: { paddingHorizontal: 9, paddingVertical: 6, borderRadius: radius.full, backgroundColor: colors.amberSoft },
  badgeText: { color: colors.amberText, fontSize: 10.5, fontWeight: "800" },
  babyName: { color: colors.amberText, fontSize: 12, fontWeight: "800", marginTop: 12 },
  caption: { color: colors.text, fontSize: 14.5, lineHeight: 22, marginTop: 6 },
  actions: { flexDirection: "row", gap: 18, marginTop: 12 },
  action: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 5 },
  actionText: { color: colors.muted, fontSize: 12.5, fontWeight: "700" },
  empty: { paddingHorizontal: 24, paddingTop: 90, alignItems: "center" },
  emptyTitle: { color: colors.text, fontSize: 17, fontWeight: "800", marginTop: 12, textAlign: "center" },
  emptyCopy: { color: colors.muted, fontSize: 13, lineHeight: 20, marginTop: 8, textAlign: "center" },
  retry: { minHeight: 44, marginTop: 18, paddingHorizontal: 18, borderRadius: radius.full, borderWidth: 1, borderColor: colors.amber, alignItems: "center", justifyContent: "center" },
  retryText: { color: colors.amberText, fontWeight: "800" },
});
