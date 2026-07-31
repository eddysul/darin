import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Image } from "expo-image";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BabyLogIcon } from "../components/babylog/BabyLogIcon";
import { MemoryEditModal } from "../components/memories/MemoryEditModal";
import { memoryPrivacyLabel } from "../components/memories/MemoryPrivacyPicker";
import { useBabyLog } from "../context/BabyLogContext";
import type { RootStackParamList } from "../navigation/types";
import { AuthRepository } from "../repositories/AuthRepository";
import { MemoriesRepository } from "../repositories/MemoriesRepository";
import type { MemoryPostBundle } from "../types/memory";
import { colors, radius } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "MemoryDetail">;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function MemoryDetailScreen({ route, navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { babyName, familyMembers, myFamilyRole, logAuthor } = useBabyLog();
  const [bundle, setBundle] = useState<MemoryPostBundle | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [userId, setUserId] = useState("");
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const serverFamilyMembers = useMemo(() => familyMembers.filter((member) => UUID_PATTERN.test(member.id)), [familyMembers]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const next = await MemoriesRepository.getBundleById(route.params.memoryPostId);
      if (!next) throw new Error("삭제되었거나 볼 수 없는 추억이에요.");
      setBundle(next);
      const cover = next.media[0];
      setImageUrl(cover ? await MemoriesRepository.createSignedUrl(cover.storagePath) : "");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "추억을 불러오지 못했어요.");
    } finally {
      setLoading(false);
    }
  }, [route.params.memoryPostId]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));
  useEffect(() => { void AuthRepository.getUser().then((user) => setUserId(user?.id ?? "")); }, []);

  const authorName = (id: string) => {
    if (id === logAuthor.userId || id === userId) return logAuthor.name;
    return familyMembers.find((member) => member.id === id)?.name ?? "가족";
  };

  const isAuthor = bundle?.post.authorId === userId;
  const canEdit = Boolean(isAuthor || myFamilyRole === "owner" || myFamilyRole === "admin" || myFamilyRole === "editor" || myFamilyRole === "caregiver");
  const canDelete = Boolean(isAuthor || myFamilyRole === "owner" || myFamilyRole === "admin");
  const myReaction = bundle?.reactions.find((reaction) => reaction.authorId === userId);

  const submitComment = async () => {
    if (!bundle || !comment.trim() || working) return;
    setWorking(true);
    setError("");
    try {
      await MemoriesRepository.addComment({ memoryPostId: bundle.post.id, body: comment });
      setComment("");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "댓글을 남기지 못했어요.");
    } finally {
      setWorking(false);
    }
  };

  const toggleReaction = async () => {
    if (!bundle || working) return;
    setWorking(true);
    setError("");
    try {
      if (myReaction) await MemoriesRepository.removeReaction(bundle.post.id);
      else await MemoriesRepository.setReaction({ memoryPostId: bundle.post.id, reactionType: "heart" });
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "반응을 저장하지 못했어요.");
    } finally {
      setWorking(false);
    }
  };

  const confirmDelete = () => {
    if (!bundle || !canDelete || working) return;
    Alert.alert("이 추억을 삭제할까요?", "가족 앨범 목록에서 사라져요.", [
      { text: "취소", style: "cancel" },
      {
        text: "삭제",
        style: "destructive",
        onPress: () => {
          setWorking(true);
          void MemoriesRepository.softDeleteMemoryPost(bundle.post.id)
            .then(() => navigation.goBack())
            .catch((cause) => setError(cause instanceof Error ? cause.message : "삭제하지 못했어요."))
            .finally(() => setWorking(false));
        },
      },
    ]);
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.amber} /><Text style={styles.muted}>추억을 불러오는 중…</Text></View>;
  if (!bundle || error && !bundle) return (
    <View style={styles.center}>
      <Text style={styles.errorTitle}>추억을 열지 못했어요.</Text><Text style={styles.muted}>{error}</Text>
      <Pressable style={styles.outlineButton} onPress={() => void load()}><Text style={styles.outlineText}>다시 시도</Text></Pressable>
    </View>
  );

  const tagLabels = bundle.tags.map((tag) => {
    if (tag.tagType === "baby") return babyName;
    if (tag.tagType === "family_member" && tag.taggedUserId) return authorName(tag.taggedUserId);
    return tag.manualLabel;
  }).filter(Boolean);

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={92}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 26 }]} keyboardShouldPersistTaps="handled">
        <View style={styles.imageWrap}>
          {imageUrl ? <Image source={{ uri: imageUrl }} style={StyleSheet.absoluteFill} contentFit="contain" transition={150} /> : <BabyLogIcon kind="folder" size={40} color={colors.faint} />}
        </View>

        <View style={styles.postCard}>
          <View style={styles.metaRow}>
            <View style={styles.authorAvatar}><BabyLogIcon kind="profile" size={17} color={colors.amber} /></View>
            <View style={styles.metaCopy}>
              <Text style={styles.author}>{authorName(bundle.post.authorId)}</Text>
              <Text style={styles.date}>{new Date(bundle.post.createdAt).toLocaleString("ko-KR", { month: "long", day: "numeric", hour: "numeric", minute: "2-digit" })}</Text>
            </View>
            <Text style={styles.privacy}>{memoryPrivacyLabel(bundle.post.privacyType)}</Text>
          </View>
          {bundle.post.caption ? <Text style={styles.caption}>{bundle.post.caption}</Text> : null}
          {tagLabels.length ? <Text style={styles.tags}>{tagLabels.map((label) => `#${label}`).join("  ")}</Text> : null}
          {canEdit || canDelete ? (
            <View style={styles.ownerActions}>
              {canEdit ? <Pressable style={styles.smallButton} onPress={() => setEditOpen(true)}><Text style={styles.smallButtonText}>수정</Text></Pressable> : null}
              {canDelete ? <Pressable style={styles.smallButton} onPress={confirmDelete}><Text style={styles.deleteText}>삭제</Text></Pressable> : null}
            </View>
          ) : null}
        </View>

        <Pressable style={[styles.reaction, myReaction && styles.reactionActive]} onPress={() => void toggleReaction()} disabled={working}>
          <Text style={styles.reactionHeart}>{myReaction ? "♥" : "♡"}</Text>
          <Text style={[styles.reactionText, myReaction && styles.reactionTextActive]}>좋아요 {bundle.reactions.length}</Text>
        </Pressable>

        <View style={styles.commentsCard}>
          <Text style={styles.sectionTitle}>댓글 {bundle.comments.length}</Text>
          {bundle.comments.length === 0 ? <Text style={styles.emptyComments}>아직 댓글이 없어요.</Text> : bundle.comments.map((item) => {
            const mayDelete = item.authorId === userId || canDelete;
            return (
              <View key={item.id} style={styles.commentRow}>
                <View style={styles.commentCopy}><Text style={styles.commentAuthor}>{authorName(item.authorId)}</Text><Text style={styles.commentBody}>{item.body}</Text></View>
                {mayDelete ? <Pressable style={styles.commentDelete} onPress={() => {
                  if (working) return;
                  setWorking(true);
                  void MemoriesRepository.deleteComment(item.id).then(load).catch((cause) => setError(cause instanceof Error ? cause.message : "댓글을 삭제하지 못했어요.")).finally(() => setWorking(false));
                }}><Text style={styles.commentDeleteText}>삭제</Text></Pressable> : null}
              </View>
            );
          })}
          <View style={styles.composer}>
            <TextInput style={styles.commentInput} value={comment} onChangeText={setComment} placeholder="가족에게 댓글 남기기" placeholderTextColor={colors.faint} maxLength={500} multiline />
            <Pressable style={[styles.send, (!comment.trim() || working) && styles.disabled]} onPress={() => void submitComment()} disabled={!comment.trim() || working}><Text style={styles.sendText}>등록</Text></Pressable>
          </View>
        </View>
        {error ? <Text style={styles.inlineError}>{error}</Text> : null}
      </ScrollView>

      <MemoryEditModal visible={editOpen} bundle={bundle} familyMembers={serverFamilyMembers} onClose={() => setEditOpen(false)} onSaved={() => void load()} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28, backgroundColor: colors.background },
  muted: { color: colors.muted, fontSize: 13, lineHeight: 20, textAlign: "center", marginTop: 9 },
  errorTitle: { color: colors.text, fontSize: 17, fontWeight: "800" },
  outlineButton: { minHeight: 44, marginTop: 16, borderRadius: radius.full, borderWidth: 1, borderColor: colors.amber, paddingHorizontal: 18, alignItems: "center", justifyContent: "center" },
  outlineText: { color: colors.amber, fontWeight: "800" },
  content: { gap: 12 },
  imageWrap: { width: "100%", aspectRatio: 1, backgroundColor: colors.cardHi, alignItems: "center", justifyContent: "center" },
  postCard: { marginHorizontal: 16, padding: 16, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  authorAvatar: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: colors.amberSoft },
  metaCopy: { flex: 1 },
  author: { color: colors.text, fontSize: 13.5, fontWeight: "800" },
  date: { color: colors.faint, fontSize: 10.5, marginTop: 2 },
  privacy: { color: colors.amber, fontSize: 10.5, fontWeight: "700", backgroundColor: colors.amberSoft, paddingHorizontal: 8, paddingVertical: 5, borderRadius: radius.full, overflow: "hidden" },
  caption: { color: colors.text, fontSize: 15, lineHeight: 23, marginTop: 15 },
  tags: { color: colors.amber, fontSize: 12, fontWeight: "700", marginTop: 12 },
  ownerActions: { flexDirection: "row", justifyContent: "flex-end", gap: 8, marginTop: 13 },
  smallButton: { minHeight: 44, minWidth: 56, alignItems: "center", justifyContent: "center", borderRadius: radius.full, borderWidth: 1, borderColor: colors.border },
  smallButtonText: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  deleteText: { color: colors.dangerText, fontSize: 12, fontWeight: "700" },
  reaction: { marginHorizontal: 16, minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  reactionActive: { borderColor: colors.amber, backgroundColor: colors.amberSoft },
  reactionHeart: { color: colors.amber, fontSize: 21 },
  reactionText: { color: colors.muted, fontSize: 13, fontWeight: "700" },
  reactionTextActive: { color: colors.amber },
  commentsCard: { marginHorizontal: 16, padding: 16, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  sectionTitle: { color: colors.text, fontSize: 15, fontWeight: "800", marginBottom: 8 },
  emptyComments: { color: colors.faint, fontSize: 12.5, paddingVertical: 12 },
  commentRow: { minHeight: 52, flexDirection: "row", alignItems: "flex-start", gap: 8, paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  commentCopy: { flex: 1 },
  commentAuthor: { color: colors.text, fontSize: 11.5, fontWeight: "800" },
  commentBody: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 2 },
  commentDelete: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
  commentDeleteText: { color: colors.faint, fontSize: 10.5 },
  composer: { flexDirection: "row", alignItems: "flex-end", gap: 8, marginTop: 14 },
  commentInput: { flex: 1, minHeight: 44, maxHeight: 100, borderRadius: 14, backgroundColor: colors.cardHi, color: colors.text, paddingHorizontal: 12, paddingVertical: 11, fontSize: 13 },
  send: { minWidth: 54, minHeight: 44, borderRadius: 14, backgroundColor: colors.amber, alignItems: "center", justifyContent: "center" },
  sendText: { color: "#FFFFFF", fontSize: 12, fontWeight: "800" },
  disabled: { opacity: 0.45 },
  inlineError: { marginHorizontal: 16, color: colors.dangerText, backgroundColor: colors.dangerSoft, padding: 12, borderRadius: radius.md, fontSize: 12 },
});
