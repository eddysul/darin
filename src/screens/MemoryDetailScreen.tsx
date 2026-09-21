import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BabyLogIcon } from "../components/babylog/BabyLogIcon";
import { ProfileAvatar } from "../components/profile/ProfileAvatar";
import { MemoryEditModal } from "../components/memories/MemoryEditModal";
import { MemoryCommentsSheet } from "../components/memories/MemoryCommentsSheet";
import { MemoryMediaViewer } from "../components/memories/MemoryMediaViewer";
import { memoryPrivacyPresentation } from "../components/memories/memoryPresentation";
import { useBabyLog } from "../context/BabyLogContext";
import { useLanguage } from "../LanguageContext";
import type { RootStackParamList } from "../navigation/types";
import { AuthRepository } from "../repositories/AuthRepository";
import { MemoriesRepository, MEMORY_DETAIL_IMAGE_WIDTH } from "../repositories/MemoriesRepository";
import { ProfileRepository } from "../repositories/ProfileRepository";
import type { MemoryPostBundle } from "../types/memory";
import type { DisplayProfile } from "../types/profileSettings";
import { getLocalUriForMedia } from "../utils/eagerMediaUpload";
import { formatLocalizedDate } from "../utils/localeFormat";
import {
  memoryAuthorIdsFromBundle,
  resolveMemoryAuthorAvatarUrl,
  resolveMemoryAuthorName,
} from "../utils/memoryAuthorDisplay";
import { colors, radius } from "../theme";
import { caughtErrorMessage } from "../utils/familyDisplay";

type Props = NativeStackScreenProps<RootStackParamList, "MemoryDetail">;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function MemoryDetailScreen({ route, navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { t, locale } = useLanguage();
  const { babyName, babies, familyMembers, myFamilyRole, logAuthor } = useBabyLog();
  const [bundle, setBundle] = useState<MemoryPostBundle | null>(null);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [likeWorking, setLikeWorking] = useState(false);
  const [error, setError] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [mediaZoomed, setMediaZoomed] = useState(false);
  const [visibleProfiles, setVisibleProfiles] = useState<DisplayProfile[]>([]);
  const [friendBabyName, setFriendBabyName] = useState("");
  const friendView = route.params.source === "friend";
  const serverFamilyMembers = useMemo(() => familyMembers.filter((member) => UUID_PATTERN.test(member.id)), [familyMembers]);

  const load = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    setError("");
    if (showSpinner) setImageUrls([]); // drop stale URLs when entering; keep current media stable during inline mutations
    try {
      const next = await MemoriesRepository.getBundleById(route.params.memoryPostId);
      if (!next) throw new Error(t("memory.critical.124"));
      if (friendView && next.post.privacyType !== "friend_circle") throw new Error(t("memory.critical.156"));
      setBundle(next);
      setIsSaved(friendView ? false : await MemoriesRepository.isSaved(next.post.id));
      const profileIds = memoryAuthorIdsFromBundle(next);
      if (friendView) {
        const [profiles, contexts] = await Promise.all([
          ProfileRepository.listMemoryAuthorDisplayProfiles(profileIds).catch(() => [] as DisplayProfile[]),
          MemoriesRepository.listMyFriendMemoryContexts(),
        ]);
        setVisibleProfiles(profiles);
        setFriendBabyName(contexts.find((item) => item.babyId === next.post.babyId)?.babyName ?? "");
      } else {
        setVisibleProfiles(
          await ProfileRepository.listMemoryAuthorDisplayProfiles(profileIds).catch(() => [] as DisplayProfile[]),
        );
      }
      setImageUrls(await Promise.all(next.media.map(async (media) => {
        const localUri = getLocalUriForMedia(media.id);
        if (media.uploadStatus !== "ready") return localUri ?? "";
        try {
          return await MemoriesRepository.createSignedUrl(media.storagePath, undefined, { width: MEMORY_DETAIL_IMAGE_WIDTH });
        } catch {
          return localUri ?? "";
        }
      })));
    } catch (cause) {
      setBundle(null);
      setError(caughtErrorMessage(t, cause, "memory.critical.016"));
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, [friendView, route.params.memoryPostId, t]);

  // Always reload + remint signed URL on focus (TTL is short; do not keep stale media links).
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  useEffect(() => { void AuthRepository.getUser().then((user) => setUserId(user?.id ?? "")); }, []);

  const authorProfileById = useMemo(
    () => new Map(visibleProfiles.map((profile) => [profile.userId, profile])),
    [visibleProfiles],
  );
  const viewerAvatarUrl = familyMembers.find((member) => member.isMe)?.avatarUrl;
  const authorName = (id: string) => resolveMemoryAuthorName({
    authorId: id,
    profile: authorProfileById.get(id),
    viewerUserId: userId || logAuthor.userId,
    viewerName: logAuthor.name,
    missingLabel: t("memory.critical.050"),
  });

  const authorAvatar = (id: string) => resolveMemoryAuthorAvatarUrl({
    authorId: id,
    profile: authorProfileById.get(id),
    viewerUserId: userId || logAuthor.userId,
    viewerAvatarUrl,
  });

  const isAuthor = bundle?.post.authorId === userId;
  // Matches RLS: author or baby admin (owner maps to admin). Editor/viewer manage UI stays hidden.
  const canEdit = Boolean(isAuthor || myFamilyRole === "owner" || myFamilyRole === "admin");
  const canDelete = Boolean(isAuthor || myFamilyRole === "owner" || myFamilyRole === "admin");
  const myReaction = bundle?.reactions.find((reaction) => reaction.authorId === userId);

  const toggleSave = async () => {
    if (!bundle || working) return;
    const previous = isSaved;
    setIsSaved(!previous);
    setWorking(true);
    setError("");
    try {
      if (previous) await MemoriesRepository.unsaveMemoryPost(bundle.post.id);
      else await MemoriesRepository.saveMemoryPost(bundle.post.id);
    } catch (cause) {
      setIsSaved(previous);
      setError(caughtErrorMessage(t, cause, "memory.critical.053"));
    } finally {
      setWorking(false);
    }
  };

  const toggleReaction = async () => {
    if (!bundle || likeWorking) return;
    setLikeWorking(true);
    setError("");
    try {
      if (myReaction) await MemoriesRepository.removeReaction(bundle.post.id);
      else await MemoriesRepository.setReaction({ memoryPostId: bundle.post.id, reactionType: "heart" });
      await load(false);
    } catch (cause) {
      setError(caughtErrorMessage(t, cause, "memory.critical.128"));
    } finally {
      setLikeWorking(false);
    }
  };

  const likeFromDoubleTap = async () => {
    if (!bundle || likeWorking || myReaction) return;
    setLikeWorking(true);
    setError("");
    try {
      await MemoriesRepository.setReaction({ memoryPostId: bundle.post.id, reactionType: "heart" });
      await load(false);
    } catch (cause) {
      setError(caughtErrorMessage(t, cause, "memory.critical.128"));
    } finally {
      setLikeWorking(false);
    }
  };

  const confirmDelete = () => {
    if (!bundle || !canDelete || working) return;
    Alert.alert(t("memory.critical.120"), t("memory.critical.121"), [
      { text: t("memory.critical.083"), style: "cancel" },
      {
        text: t("memory.critical.122"),
        style: "destructive",
        onPress: () => {
          setWorking(true);
          void MemoriesRepository.softDeleteMemoryPost(bundle.post.id)
            .then(() => navigation.goBack())
            .catch((cause) => setError(caughtErrorMessage(t, cause, "memory.critical.123")))
            .finally(() => setWorking(false));
        },
      },
    ]);
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.amberText} /><Text style={styles.muted}>{t("memory.critical.118")}</Text></View>;
  if (!bundle || error && !bundle) return (
    <View style={styles.center}>
      <Text style={styles.errorTitle}>{t("memory.critical.119")}</Text><Text style={styles.muted}>{error}</Text>
      <Pressable style={styles.outlineButton} onPress={() => void load()}><Text style={styles.outlineText}>{t("memory.critical.017")}</Text></Pressable>
    </View>
  );

  const familyTagLabels = bundle.tags.flatMap((tag) => {
    if (tag.tagType === "baby") {
      return [babies.find((baby) => baby.id === tag.babyId)?.name ?? babyName];
    }
    if (tag.tagType === "family_member" && tag.taggedUserId) return [authorName(tag.taggedUserId)];
    return [];
  });
  const guestTagLabels = bundle.tags
    .filter((tag) => tag.tagType === "manual_guest" && tag.manualLabel)
    .map((tag) => tag.manualLabel as string);
  const privacy = memoryPrivacyPresentation(bundle.post.privacyType);

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 28 }]}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        scrollEnabled={!mediaZoomed}
      >
        <MemoryMediaViewer
          media={bundle.media}
          imageUrls={imageUrls}
          onDoubleTap={() => void likeFromDoubleTap()}
          onZoomChange={setMediaZoomed}
        />
        {bundle.media.some((media) => media.uploadStatus === "failed") && canEdit ? (
          <Pressable
            style={styles.retryBanner}
            onPress={() => {
              void MemoriesRepository.retryFailedMedia(bundle.post.id).then(() => load(false));
            }}
            accessibilityRole="button"
            accessibilityLabel={t("memory.critical.148")}
          >
            <Text style={styles.retryBannerText}>{t("memory.critical.049")}</Text>
            <Text style={styles.retryBannerAction}>{t("memory.critical.017")}</Text>
          </Pressable>
        ) : null}

        <View style={[styles.postCard, { borderColor: privacy.accent }]}>
          <View style={styles.metaRow}>
            <ProfileAvatar uri={authorAvatar(bundle.post.authorId)} size={38} />
            <View style={styles.metaCopy}>
              <Text style={styles.author}>{authorName(bundle.post.authorId)}</Text>
              <Text style={styles.date}>{formatLocalizedDate(bundle.post.createdAt, locale, { month: "long", day: "numeric", hour: "numeric", minute: "2-digit" })}</Text>
            </View>
            <View style={[styles.privacyBadge, { backgroundColor: privacy.soft }]}>
              <BabyLogIcon kind={privacy.icon} size={12} color={privacy.accent} strokeWidth={2.2} />
              <Text style={[styles.privacyBadgeText, { color: privacy.accent }]}>{t(privacy.labelKey)}</Text>
            </View>
          </View>
          <View style={styles.actionRow}>
            <Pressable
              style={({ pressed }) => [styles.actionPair, pressed && styles.reactionPressed]}
              onPress={() => void toggleReaction()}
              disabled={likeWorking}
              accessibilityRole="button"
              accessibilityLabel={myReaction ? t("memory.critical.145") : t("memory.critical.144")}
              accessibilityState={{ selected: Boolean(myReaction), disabled: likeWorking }}
            >
              <BabyLogIcon kind="heart" size={20} color={myReaction ? colors.amberText : colors.muted} strokeWidth={2.2} fill={myReaction ? colors.amberText : "transparent"} />
              <Text style={[styles.actionPairText, myReaction && styles.actionPairTextActive]}>{t("memory.critical.044", { count: bundle.reactions.length })}</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.actionPair, pressed && styles.pressed]}
              onPress={() => setCommentsOpen(true)}
              accessibilityRole="button"
              accessibilityLabel={t("memory.critical.045", { count: bundle.comments.length })}
            >
              <BabyLogIcon kind="chat" size={20} color={colors.muted} />
              <Text style={styles.actionPairText}>{t("memory.critical.045", { count: bundle.comments.length })}</Text>
            </Pressable>
            <View style={styles.actionSpacer} />
            {!friendView ? <Pressable
              style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}
              onPress={() => void toggleSave()}
              disabled={working}
              accessibilityRole="button"
              accessibilityLabel={isSaved ? t("memory.critical.047") : t("memory.critical.046")}
              accessibilityState={{ selected: isSaved, disabled: working }}
            >
              <BabyLogIcon kind="bookmark" size={20} color={isSaved ? colors.amberText : colors.muted} fill={isSaved ? colors.amberText : "transparent"} />
            </Pressable> : null}
          </View>
          {bundle.post.caption ? (
            <Text style={styles.caption}>
              <Text style={styles.captionAuthor}>{authorName(bundle.post.authorId)} </Text>
              {bundle.post.caption}
            </Text>
          ) : null}
          {friendView && friendBabyName ? (
            <View style={styles.chipRow}><View style={styles.familyChip}><Text style={styles.familyChipText}>{friendBabyName}</Text></View></View>
          ) : !friendView && familyTagLabels.length ? (
            <View style={styles.chipRow}>
              {familyTagLabels.map((label) => (
                <View key={`family-${label}`} style={styles.familyChip}><Text style={styles.familyChipText}>{label}</Text></View>
              ))}
            </View>
          ) : null}
          {!friendView && guestTagLabels.length ? (
            <View style={styles.chipRow}>
              {guestTagLabels.map((label) => (
                <View key={`guest-${label}`} style={styles.guestChip}><Text style={styles.guestChipText}>{t("memory.critical.147", { label })}</Text></View>
              ))}
            </View>
          ) : null}
          {canEdit || canDelete ? (
            <View style={styles.ownerActions}>
              {canEdit ? <Pressable style={styles.smallButton} onPress={() => setEditOpen(true)}><Text style={styles.smallButtonText}>{t("memory.critical.146")}</Text></Pressable> : null}
              {canDelete ? <Pressable style={styles.smallButton} onPress={confirmDelete}><Text style={styles.deleteText}>{t("memory.critical.122")}</Text></Pressable> : null}
            </View>
          ) : null}
        </View>

        <Pressable style={styles.commentsSummary} onPress={() => setCommentsOpen(true)}>
          <BabyLogIcon kind="chat" size={18} color={colors.amberText} />
          <Text style={styles.commentsSummaryText}>{bundle.comments.length ? t("memory.critical.132", { count: bundle.comments.length }) : t("memory.critical.133")}</Text>
        </Pressable>
        {error ? <Text style={styles.inlineError}>{error}</Text> : null}
      </ScrollView>

      <MemoryEditModal visible={editOpen} bundle={bundle} familyMembers={serverFamilyMembers} onClose={() => setEditOpen(false)} onSaved={() => void load()} />

      <MemoryCommentsSheet
        visible={commentsOpen}
        memoryPostId={bundle.post.id}
        postAuthorName={authorName(bundle.post.authorId)}
        friendView={friendView}
        canModerate={canDelete}
        initialComments={bundle.comments}
        onClose={() => setCommentsOpen(false)}
        onChanged={(postId) => {
          if (postId === bundle.post.id) void load(false);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28, backgroundColor: colors.background },
  muted: { color: colors.muted, fontSize: 13, lineHeight: 20, textAlign: "center", marginTop: 9 },
  errorTitle: { color: colors.text, fontSize: 17, fontWeight: "800" },
  outlineButton: { minHeight: 44, marginTop: 16, borderRadius: radius.full, borderWidth: 1, borderColor: colors.amber, paddingHorizontal: 18, alignItems: "center", justifyContent: "center" },
  outlineText: { color: colors.amberText, fontWeight: "800" },
  content: { gap: 12 },
  retryBanner: { marginHorizontal: 16, minHeight: 44, paddingHorizontal: 14, borderRadius: radius.lg, backgroundColor: colors.dangerSoft, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  retryBannerText: { color: colors.dangerText, fontSize: 13, fontWeight: "700", flexShrink: 1 },
  retryBannerAction: { color: colors.dangerText, fontSize: 13, fontWeight: "800" },
  postCard: { marginHorizontal: 16, padding: 16, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  authorAvatar: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
  metaCopy: { flex: 1 },
  author: { color: colors.text, fontSize: 13.5, fontWeight: "800" },
  date: { color: colors.faint, fontSize: 10.5, marginTop: 2 },
  privacyBadge: { minHeight: 28, maxWidth: 140, paddingHorizontal: 9, borderRadius: radius.full, flexDirection: "row", alignItems: "center", gap: 4 },
  privacyBadgeText: { fontSize: 10.5, fontWeight: "800", textAlign: "right" },
  actionRow: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 10, marginTop: 10 },
  actionPair: { minHeight: 44, paddingRight: 2, flexDirection: "row", alignItems: "center", gap: 4 },
  actionPairText: { color: colors.muted, fontSize: 13, fontWeight: "700" },
  actionPairTextActive: { color: colors.amberText },
  actionSpacer: { flex: 1 },
  actionButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  pressed: { opacity: 0.7 },
  reactionPressed: { opacity: 0.82, transform: [{ scale: 0.92 }] },
  caption: { color: colors.text, fontSize: 15, lineHeight: 23, marginTop: 6 },
  captionAuthor: { fontWeight: "800" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 12 },
  familyChip: { minHeight: 28, paddingHorizontal: 10, borderRadius: 12, backgroundColor: colors.chip, alignItems: "center", justifyContent: "center" },
  familyChipText: { color: colors.muted, fontSize: 11.5, fontWeight: "700" },
  guestChip: { minHeight: 28, paddingHorizontal: 10, borderRadius: radius.full, backgroundColor: colors.cardHi, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  guestChipText: { color: colors.muted, fontSize: 11.5, fontWeight: "600" },
  ownerActions: { flexDirection: "row", justifyContent: "flex-end", gap: 8, marginTop: 13 },
  smallButton: { minHeight: 44, minWidth: 64, paddingHorizontal: 12, alignItems: "center", justifyContent: "center", borderRadius: radius.full, borderWidth: 1, borderColor: colors.border },
  smallButtonText: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  deleteText: { color: colors.dangerText, fontSize: 12, fontWeight: "700" },
  commentsSummary: { minHeight: 52, marginHorizontal: 16, paddingHorizontal: 16, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, flexDirection: "row", alignItems: "center", gap: 8 },
  commentsSummaryText: { color: colors.text, fontSize: 13, fontWeight: "800" },
  inlineError: { marginHorizontal: 16, color: colors.dangerText, backgroundColor: colors.dangerSoft, padding: 12, borderRadius: radius.md, fontSize: 12 },
});
