import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BabyLogIcon } from "../babylog/BabyLogIcon";
import { BabyStickerFromModel } from "../babylog/BabyStickerView";
import { BabyStickerVaultModal } from "../babylog/BabyStickerVaultModal";
import { ProfileAvatar } from "../profile/ProfileAvatar";
import { useBabyLog } from "../../context/BabyLogContext";
import { useLanguage } from "../../LanguageContext";
import { AuthRepository } from "../../repositories/AuthRepository";
import { MemoriesRepository } from "../../repositories/MemoriesRepository";
import { ProfileRepository } from "../../repositories/ProfileRepository";
import type { BabySticker } from "../../types/babySticker";
import type { MemoryComment } from "../../types/memory";
import type { DisplayProfile } from "../../types/profileSettings";
import { formatRelativeTime } from "../../utils/localeFormat";
import { createId } from "../../utils/id";
import { caughtErrorMessage } from "../../utils/familyDisplay";
import {
  collectMemoryAuthorUserIds,
  resolveMemoryAuthorAvatarUrl,
  resolveMemoryAuthorName,
} from "../../utils/memoryAuthorDisplay";
import { colors, radius } from "../../theme";
import { memoryCommentPreviewText } from "./memoryPresentation";

const TOUCH_MIN = Platform.select({ ios: 44, android: 48 }) ?? 44;
const QUICK_EMOJIS = ["❤️", "🙌", "🔥", "👏", "😢", "😍", "😮", "😂"] as const;
const SHEET_HEIGHT_RATIO = 0.65;

type Props = {
  visible: boolean;
  memoryPostId: string | null;
  postAuthorName?: string;
  friendView?: boolean;
  canModerate?: boolean;
  initialComments?: MemoryComment[];
  onClose: () => void;
  onChanged?: (memoryPostId: string, commentCount: number, latestComment?: MemoryComment) => void;
};

export function MemoryCommentsSheet({
  visible,
  memoryPostId,
  postAuthorName,
  friendView = false,
  canModerate = false,
  initialComments,
  onClose,
  onChanged,
}: Props) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const { t, locale } = useLanguage();
  const {
    babyName,
    familyMembers,
    logAuthor,
    babyStickers,
    addBabySticker,
    deleteBabySticker,
  } = useBabyLog();
  const listRef = useRef<ScrollView>(null);
  const stickToEndRef = useRef(false);
  const onChangedRef = useRef(onChanged);
  onChangedRef.current = onChanged;
  const activePostIdRef = useRef(memoryPostId);
  activePostIdRef.current = memoryPostId;
  const [userId, setUserId] = useState(logAuthor.userId);
  const [comments, setComments] = useState<MemoryComment[]>(initialComments ?? []);
  const [visibleProfiles, setVisibleProfiles] = useState<DisplayProfile[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [stickerVaultOpen, setStickerVaultOpen] = useState(false);
  const [commentStatus, setCommentStatus] = useState<"submitting" | "saved" | null>(null);
  const me = familyMembers.find((member) => member.isMe);
  const sheetHeight = Math.round(windowHeight * SHEET_HEIGHT_RATIO);

  const load = useCallback(async () => {
    if (!memoryPostId) return;
    const postId = memoryPostId;
    setLoading(true);
    setError("");
    try {
      const next = await MemoriesRepository.listComments(postId);
      if (activePostIdRef.current !== postId) return;
      setComments(next);
      onChangedRef.current?.(postId, next.length, next[next.length - 1]);
      const authorIds = collectMemoryAuthorUserIds(next.map((item) => item.authorId));
      if (authorIds.length) {
        const profiles = await ProfileRepository.listMemoryAuthorDisplayProfiles(authorIds).catch(() => []);
        setVisibleProfiles(profiles);
      } else {
        setVisibleProfiles([]);
      }
    } catch (cause) {
      if (activePostIdRef.current !== postId) return;
      setError(caughtErrorMessage(t, cause, "memory.critical.016"));
    } finally {
      if (activePostIdRef.current === postId) setLoading(false);
    }
  }, [memoryPostId, t]);

  useEffect(() => {
    void AuthRepository.getUser().then((user) => setUserId(user?.id ?? logAuthor.userId));
  }, [logAuthor.userId]);

  useEffect(() => {
    if (!visible || !memoryPostId) return;
    setComments(initialComments ?? []);
    setDraft("");
    setError("");
    setStickerVaultOpen(false);
    void load();
    // Seed from the opening snapshot, then refresh from the existing comments API.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, memoryPostId, visible]);

  useEffect(() => {
    if (commentStatus !== "saved") return;
    AccessibilityInfo.announceForAccessibility(t("memory.critical.180"));
    const timer = setTimeout(() => setCommentStatus(null), 1_800);
    return () => clearTimeout(timer);
  }, [commentStatus, t]);

  const authorProfileById = useMemo(
    () => new Map(visibleProfiles.map((profile) => [profile.userId, profile])),
    [visibleProfiles],
  );
  const authorName = useCallback((id: string) => resolveMemoryAuthorName({
    authorId: id,
    profile: authorProfileById.get(id),
    viewerUserId: userId || logAuthor.userId,
    viewerName: logAuthor.name,
    missingLabel: t("memory.critical.050"),
  }), [authorProfileById, logAuthor.name, logAuthor.userId, t, userId]);

  const authorAvatar = useCallback((id: string) => resolveMemoryAuthorAvatarUrl({
    authorId: id,
    profile: authorProfileById.get(id),
    viewerUserId: userId || logAuthor.userId,
    viewerAvatarUrl: me?.avatarUrl,
  }), [authorProfileById, logAuthor.userId, me?.avatarUrl, userId]);

  const applyComments = (updater: (current: MemoryComment[]) => MemoryComment[]) => {
    if (!memoryPostId) return;
    const postId = memoryPostId;
    setComments((current) => {
      const next = updater(current);
      queueMicrotask(() => onChangedRef.current?.(postId, next.length, next[next.length - 1]));
      return next;
    });
  };

  const submitComment = async () => {
    if (!memoryPostId || !draft.trim() || working) return;
    setWorking(true);
    setCommentStatus("submitting");
    setError("");
    try {
      const created = await MemoriesRepository.addComment({ memoryPostId, body: draft });
      setDraft("");
      stickToEndRef.current = true;
      applyComments((current) => [...current, created]);
      setCommentStatus("saved");
    } catch (cause) {
      setCommentStatus(null);
      setError(caughtErrorMessage(t, cause, "memory.critical.126"));
    } finally {
      setWorking(false);
    }
  };

  const submitStickerComment = async (sticker: BabySticker) => {
    if (!memoryPostId || working) return;
    const tempId = `optimistic-${createId()}`;
    const optimistic: MemoryComment = {
      id: tempId,
      memoryPostId,
      authorId: userId,
      body: sticker.label,
      commentType: "sticker",
      stickerId: sticker.id,
      stickerLabel: sticker.label,
      stickerImageUrl: sticker.finalStickerImageUri,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setStickerVaultOpen(false);
    stickToEndRef.current = true;
    applyComments((current) => [...current, optimistic]);
    setWorking(true);
    setCommentStatus("submitting");
    setError("");
    try {
      const created = await MemoriesRepository.addStickerComment({
        memoryPostId,
        stickerId: sticker.id,
        stickerLabel: sticker.label,
      });
      applyComments((current) => [...current.filter((item) => item.id !== tempId), created]);
      setCommentStatus("saved");
    } catch (cause) {
      setCommentStatus(null);
      applyComments((current) => current.filter((item) => item.id !== tempId));
      setError(caughtErrorMessage(t, cause, "memory.critical.127"));
    } finally {
      setWorking(false);
    }
  };

  const confirmDelete = (item: MemoryComment) => {
    if (working) return;
    Alert.alert(t("memory.critical.129"), t("memory.critical.130"), [
      { text: t("memory.critical.083"), style: "cancel" },
      {
        text: t("memory.critical.122"),
        style: "destructive",
        onPress: () => {
          setWorking(true);
          void MemoriesRepository.deleteComment(item.id)
            .then(() => applyComments((current) => current.filter((comment) => comment.id !== item.id)))
            .catch((cause) => setError(caughtErrorMessage(t, cause, "memory.critical.131")))
            .finally(() => setWorking(false));
        },
      },
    ]);
  };

  const placeholder = postAuthorName
    ? t("memory.critical.182", { name: postAuthorName })
    : t("memory.critical.142");

  const body = (
    <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel={t("memory.critical.135")} />
      <View style={[styles.sheet, { height: sheetHeight, paddingBottom: Math.max(insets.bottom, 10) }]}>
        <View style={styles.handle} />
        <View style={styles.header}>
          <View style={styles.headerSide} />
          <Text style={styles.title}>{t("memory.critical.181")}</Text>
          <View style={styles.headerSide} />
        </View>

        {loading && comments.length === 0 ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.amberText} />
          </View>
        ) : (
          <ScrollView
            ref={listRef}
            style={styles.list}
            contentContainerStyle={comments.length === 0 ? styles.emptyList : styles.listContent}
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={() => {
              if (!stickToEndRef.current) return;
              stickToEndRef.current = false;
              listRef.current?.scrollToEnd({ animated: true });
            }}
          >
            {comments.length === 0 ? (
              <Text style={styles.empty}>{t("memory.critical.136")}</Text>
            ) : comments.map((item) => {
              const mayDelete = item.authorId === userId || canModerate;
              const sticker = item.commentType === "sticker"
                ? babyStickers.find((candidate) => candidate.id === item.stickerId)
                : undefined;
              return (
                <View key={item.id} style={styles.row}>
                  <ProfileAvatar uri={authorAvatar(item.authorId)} size={32} />
                  <View style={styles.rowCopy}>
                    <Text style={styles.rowBody}>
                      <Text style={styles.rowAuthor}>{authorName(item.authorId)} </Text>
                      {item.commentType === "sticker" ? "" : (item.body ?? "")}
                    </Text>
                    {item.commentType === "sticker" ? (
                      <View style={styles.stickerComment}>
                        {sticker ? (
                          <BabyStickerFromModel sticker={sticker} size={64} />
                        ) : item.stickerImageUrl ? (
                          <Image source={{ uri: item.stickerImageUrl }} style={styles.stickerImage} contentFit="contain" />
                        ) : (
                          <Text style={styles.stickerLabel}>{memoryCommentPreviewText(item)}</Text>
                        )}
                      </View>
                    ) : null}
                    <View style={styles.rowMeta}>
                      <Text style={styles.rowTime}>{formatRelativeTime(item.createdAt, locale)}</Text>
                      {mayDelete ? (
                        <Pressable
                          onPress={() => confirmDelete(item)}
                          accessibilityRole="button"
                          accessibilityLabel={t("memory.critical.170")}
                          hitSlop={8}
                        >
                          <Text style={styles.deleteText}>{t("memory.critical.122")}</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {commentStatus ? (
          <Text style={styles.status} accessibilityLiveRegion="polite">
            {t(commentStatus === "submitting" ? "memory.critical.179" : "memory.critical.180")}
          </Text>
        ) : null}

        <View style={styles.emojiRow}>
          {QUICK_EMOJIS.map((emoji) => (
            <Pressable
              key={emoji}
              style={styles.emojiButton}
              onPress={() => setDraft((current) => `${current}${emoji}`)}
              accessibilityRole="button"
              accessibilityLabel={t("memory.critical.188", { emoji })}
            >
              <Text style={styles.emoji}>{emoji}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.composer}>
          <ProfileAvatar uri={me?.avatarUrl} size={32} />
          <View style={styles.inputWrap}>
            <TextInput
              style={styles.input}
              value={draft}
              onChangeText={setDraft}
              placeholder={placeholder}
              placeholderTextColor={colors.faint}
              maxLength={500}
              multiline
              accessibilityLabel={t("memory.critical.181")}
            />
            {draft.trim() ? (
              <Pressable
                style={({ pressed }) => [styles.send, working && styles.disabled, pressed && !working && styles.pressed]}
                onPress={() => void submitComment()}
                disabled={working}
                accessibilityRole="button"
                accessibilityLabel={t("memory.critical.143")}
                accessibilityState={{ disabled: working, busy: working }}
              >
                {working ? <ActivityIndicator color={colors.amberText} size="small" /> : <Text style={styles.sendText}>{t("memory.critical.143")}</Text>}
              </Pressable>
            ) : !friendView ? (
              <Pressable
                style={styles.stickerButton}
                onPress={() => setStickerVaultOpen(true)}
                accessibilityRole="button"
                accessibilityLabel={t("memory.critical.186")}
              >
                <BabyLogIcon kind="image" size={20} color={colors.muted} />
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>

      {!friendView ? (
        <BabyStickerVaultModal
          visible={stickerVaultOpen}
          embedded
          pickMode
          babyName={babyName}
          stickers={babyStickers}
          createdBy={userId}
          onClose={() => setStickerVaultOpen(false)}
          onSaveSticker={addBabySticker}
          onDeleteSticker={deleteBabySticker}
          onPickSticker={(sticker) => void submitStickerComment(sticker)}
        />
      ) : null}
    </KeyboardAvoidingView>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      {body}
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(46,42,38,0.38)" },
  sheet: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    backgroundColor: colors.card,
    overflow: "hidden",
  },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: "center", marginTop: 8, marginBottom: 4 },
  header: { minHeight: 44, flexDirection: "row", alignItems: "center", paddingHorizontal: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  headerSide: { width: 44 },
  title: { flex: 1, color: colors.text, fontSize: 16, fontWeight: "800", textAlign: "center" },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 8 },
  emptyList: { flexGrow: 1, paddingHorizontal: 24, justifyContent: "center" },
  empty: { color: colors.faint, fontSize: 13, lineHeight: 20, textAlign: "center" },
  row: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 10 },
  rowCopy: { flex: 1, minWidth: 0 },
  rowBody: { color: colors.text, fontSize: 13.5, lineHeight: 19 },
  rowAuthor: { fontWeight: "800" },
  rowMeta: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 4 },
  rowTime: { color: colors.faint, fontSize: 11, fontWeight: "600" },
  deleteText: { color: colors.faint, fontSize: 11, fontWeight: "700" },
  stickerComment: { alignSelf: "flex-start", marginTop: 6 },
  stickerImage: { width: 64, height: 64 },
  stickerLabel: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  error: { marginHorizontal: 16, marginBottom: 8, color: colors.dangerText, backgroundColor: colors.dangerSoft, borderRadius: radius.md, padding: 9, fontSize: 12 },
  status: { marginHorizontal: 16, marginBottom: 8, color: colors.amberText, backgroundColor: colors.amberSoft, borderRadius: radius.md, padding: 9, fontSize: 12, fontWeight: "700" },
  emojiRow: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 10, paddingTop: 6, paddingBottom: 4 },
  emojiButton: { flex: 1, minHeight: TOUCH_MIN, alignItems: "center", justifyContent: "center" },
  emoji: { fontSize: 22 },
  composer: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingTop: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  inputWrap: {
    flex: 1,
    minHeight: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 14,
    paddingRight: 6,
  },
  input: { flex: 1, maxHeight: 88, color: colors.text, fontSize: 14, paddingVertical: Platform.OS === "ios" ? 8 : 6 },
  send: { minHeight: TOUCH_MIN, paddingHorizontal: 10, alignItems: "center", justifyContent: "center" },
  sendText: { color: colors.amberText, fontSize: 14, fontWeight: "800" },
  stickerButton: { width: TOUCH_MIN, height: TOUCH_MIN, alignItems: "center", justifyContent: "center" },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.45 },
});
