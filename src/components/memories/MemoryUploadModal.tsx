import { useEffect, useMemo, useRef, useState } from "react";
import {
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
  View,
} from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { FamilyMember } from "../../types/family";
import type { MemoryPrivacyType, MemoryTagDraft, PreparedMemoryPhoto, PublishEagerMemoryInput } from "../../types/memory";
import {
  createUploadSessionId,
  discardSession,
  enqueuePickedPhotos,
  listEagerPhotos,
  removeEagerPhoto,
  retryEagerPhoto,
  subscribeEagerSession,
  type EagerPhoto,
} from "../../utils/eagerMediaUpload";
import { createId } from "../../utils/id";
import { colors, radius } from "../../theme";
import { BabyLogIcon } from "../babylog/BabyLogIcon";
import { MemoryPeoplePicker } from "./MemoryPeoplePicker";
import { MemoryPrivacyPicker } from "./MemoryPrivacyPicker";
import type { BabyRow } from "../../types/database";

const MAX_MEMORY_PHOTOS = 5;
const TOUCH_MIN = Platform.select({ ios: 44, android: 48 }) ?? 44;

function toggle(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((item) => item !== id) : [...list, id];
}

function toPreparedPhoto(photo: EagerPhoto): PreparedMemoryPhoto {
  return {
    id: photo.id,
    localUri: photo.localUri,
    storagePath: photo.storagePath,
    width: photo.width,
    height: photo.height,
    uploadStatus: photo.status === "uploaded" ? "ready" : photo.status === "failed" ? "failed" : "uploading",
  };
}

export function MemoryUploadModal({
  visible,
  babyId,
  babyName: _babyName,
  familyMembers,
  babies,
  onClose,
  onPosted,
}: {
  visible: boolean;
  babyId: string;
  babyName: string;
  familyMembers: FamilyMember[];
  babies: BabyRow[];
  onClose: () => void;
  onPosted: (input: PublishEagerMemoryInput & { localCoverUri?: string }) => void;
}) {
  const insets = useSafeAreaInsets();
  const sessionIdRef = useRef(createUploadSessionId());
  const postIdRef = useRef(createId());
  const postedRef = useRef(false);
  const [photos, setPhotos] = useState<EagerPhoto[]>([]);
  const [caption, setCaption] = useState("");
  const [privacy, setPrivacy] = useState<MemoryPrivacyType>("family_circle");
  const [taggedIds, setTaggedIds] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedBabyIds, setSelectedBabyIds] = useState<string[]>([babyId]);
  const [familyMoment, setFamilyMoment] = useState(false);
  const [error, setError] = useState("");

  const dirty = Boolean(photos.length || caption.trim() || taggedIds.length || selectedIds.length || privacy !== "family_circle");
  // "failed" photos can still be posted and retried from the feed, but a photo
  // that is still compressing or uploading has no storage path to attach yet.
  const pendingUploads = photos.filter((photo) => photo.status !== "uploaded" && photo.status !== "failed").length;
  const canSubmit = photos.length > 0 && pendingUploads === 0;

  useEffect(() => {
    if (!visible) return;
    postedRef.current = false;
    sessionIdRef.current = createUploadSessionId();
    postIdRef.current = createId();
    setPhotos([]);
    setCaption("");
    setPrivacy("family_circle");
    setTaggedIds([]);
    setSelectedIds([]);
    setSelectedBabyIds([babyId]);
    setFamilyMoment(false);
    setError("");
    return subscribeEagerSession(sessionIdRef.current, () => {
      setPhotos(listEagerPhotos(sessionIdRef.current));
    });
  }, [babyId, visible]);

  useEffect(() => {
    if (visible) return;
    if (postedRef.current) return;
    const sessionId = sessionIdRef.current;
    void discardSession(sessionId).catch(() => undefined);
  }, [visible]);

  const tags = useMemo<MemoryTagDraft[]>(() => [
    ...(!familyMoment ? selectedBabyIds.map((selectedBabyId) => ({ tagType: "baby" as const, babyId: selectedBabyId })) : []),
    ...taggedIds.map((taggedUserId) => ({ tagType: "family_member" as const, taggedUserId })),
  ], [familyMoment, selectedBabyIds, taggedIds]);

  const closeSafely = () => {
    if (!dirty) return onClose();
    Alert.alert("작성 중인 추억을 닫을까요?", "입력한 내용은 저장되지 않아요.", [
      { text: "계속 작성", style: "cancel" },
      { text: "닫기", style: "destructive", onPress: onClose },
    ]);
  };

  const pickImage = async () => {
    setError("");
    const remaining = MAX_MEMORY_PHOTOS - photos.length;
    if (remaining <= 0) {
      setError("사진을 더 추가하려면 먼저 한 장을 삭제해 주세요.");
      return;
    }
    try {
      const permission = await ImagePicker.getMediaLibraryPermissionsAsync();
      const resolvedPermission = permission.granted ? permission : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!resolvedPermission.granted) {
        setError("사진을 선택하려면 설정에서 사진 보관함 접근을 허용해 주세요.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsMultipleSelection: true,
        selectionLimit: remaining,
        orderedSelection: true,
        preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Current,
        quality: 1,
      });
      if (result.canceled) return;
      enqueuePickedPhotos({
        babyId,
        bucket: "memories",
        sessionId: sessionIdRef.current,
        assets: result.assets.map((asset) => ({ uri: asset.uri, width: asset.width, height: asset.height })),
      });
      setPhotos(listEagerPhotos(sessionIdRef.current));
    } catch (cause) {
      if (__DEV__) console.warn("[memory-photo-picker] open failed", cause instanceof Error ? cause.name : "unknown");
      setError("iCloud 사진이라면 사진 앱에서 원본을 먼저 열어 다운로드한 뒤 다시 선택해 주세요.");
    }
  };

  const submit = () => {
    if (photos.length === 0 || postedRef.current) return;
    if (pendingUploads > 0) {
      setError("사진을 올리는 중이에요. 잠시 후 다시 시도해 주세요.");
      return;
    }
    if (privacy === "tagged_family" && taggedIds.length === 0) {
      setError("태그된 가족만 공개하려면 가족을 한 명 이상 태그해주세요.");
      return;
    }
    if (privacy === "selected_people" && selectedIds.length === 0) {
      setError("사진을 볼 가족을 한 명 이상 선택해주세요.");
      return;
    }
    postedRef.current = true;
    onPosted({
      id: postIdRef.current,
      babyId,
      caption,
      privacyType: privacy,
      isFamilyMoment: familyMoment,
      selectedUserIds: privacy === "selected_people" ? selectedIds : [],
      tags,
      photos: photos.map(toPreparedPhoto),
      localCoverUri: photos[0]?.localUri,
    });
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={closeSafely}>
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 12 : 0}
      >
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 14) }]}>
          <Pressable style={styles.headerAction} onPress={closeSafely}>
            <Text style={styles.cancel}>취소</Text>
          </Pressable>
          <View style={styles.titleWrap}>
            <Text style={styles.title}>오늘의 순간을 남겨요</Text>
            <Text style={styles.subtitle}>아기의 사진과 짧은 이야기를 가족과 함께 나눠보세요.</Text>
          </View>
          <Pressable
            style={styles.headerAction}
            onPress={submit}
            disabled={!canSubmit}
            accessibilityRole="button"
            accessibilityState={{ disabled: !canSubmit }}
            accessibilityHint={pendingUploads > 0 ? "사진 업로드가 끝나면 올릴 수 있어요" : undefined}
          >
            <Text style={[styles.save, !canSubmit && styles.disabledText]}>올리기</Text>
          </Pressable>
        </View>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 120 }]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
          {photos.length === 0 ? (
            <Pressable style={styles.photo} onPress={() => void pickImage()} accessibilityRole="button" accessibilityLabel="사진 선택">
              <View style={styles.photoEmpty}>
                <BabyLogIcon kind="new" size={32} color={colors.amberText} strokeWidth={2.2} />
                <Text style={styles.photoLabel}>사진을 선택해 주세요</Text>
              </View>
            </Pressable>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoRow}>
              {photos.map((image, index) => (
                <View key={image.id} style={styles.photoThumbWrap}>
                  <Image source={{ uri: image.localUri }} style={styles.photoThumb} contentFit="cover" />
                  {index === 0 ? <View style={styles.coverBadge}><Text style={styles.coverBadgeText}>대표</Text></View> : null}
                  {image.status === "failed" ? (
                    <Pressable style={styles.photoFail} onPress={() => retryEagerPhoto(image.id)} accessibilityRole="button" accessibilityLabel="사진 다시 올리기">
                      <Text style={styles.photoFailText}>다시 시도</Text>
                    </Pressable>
                  ) : image.status !== "uploaded" ? (
                    <View style={styles.photoUploading} pointerEvents="none">
                      <ActivityIndicator size="small" color="#fff" />
                      <Text style={styles.photoUploadingText}>올리는 중</Text>
                    </View>
                  ) : null}
                  <Pressable
                    style={styles.photoRemove}
                    onPress={() => { removeEagerPhoto(image.id); setPhotos(listEagerPhotos(sessionIdRef.current)); }}
                    accessibilityRole="button"
                    accessibilityLabel={`사진 ${index + 1} 삭제`}
                  >
                    <BabyLogIcon kind="trash" size={16} color={colors.onDark} strokeWidth={2.2} />
                  </Pressable>
                </View>
              ))}
              {photos.length < MAX_MEMORY_PHOTOS ? (
                <Pressable style={styles.photoAddTile} onPress={() => void pickImage()} accessibilityRole="button" accessibilityLabel="사진 추가">
                  <BabyLogIcon kind="new" size={22} color={colors.amberText} strokeWidth={2.2} />
                  <Text style={styles.photoAddText}>사진 추가</Text>
                </Pressable>
              ) : null}
            </ScrollView>
          )}
          <Text style={styles.photoGuide}>
            {pendingUploads > 0
              ? `사진 ${pendingUploads}장을 올리는 중이에요. 업로드가 끝나면 올릴 수 있어요.`
              : `선택한 사진 ${photos.length}장 · 지금은 사진만, 최대 5장까지 추가할 수 있어요.`}
          </Text>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>짧은 이야기</Text>
            <TextInput
              style={styles.caption}
              value={caption}
              onChangeText={setCaption}
              placeholder="오늘 어떤 순간이었나요?"
              placeholderTextColor={colors.faint}
              multiline
              maxLength={1200}
              textAlignVertical="top"
            />
            <Text style={styles.counter}>{caption.length}/1200</Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>공개 범위</Text>
            <MemoryPrivacyPicker value={privacy} onChange={setPrivacy} />
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>이 순간에 함께한 아기</Text>
            <View style={styles.babyTargetRow}>
              {babies.map((baby) => {
                const selected = !familyMoment && selectedBabyIds.includes(baby.id);
                return <Pressable key={baby.id} style={[styles.babyTargetChip, selected && styles.babyTargetChipActive]} onPress={() => { setFamilyMoment(false); setSelectedBabyIds((current) => { const next = toggle(current, baby.id); return next.length ? next : [baby.id]; }); }}><Text style={[styles.babyTargetText, selected && styles.babyTargetTextActive]}>{baby.name}</Text></Pressable>;
              })}
              <Pressable style={[styles.babyTargetChip, familyMoment && styles.babyTargetChipActive]} onPress={() => { setFamilyMoment(true); setSelectedBabyIds([]); }}><Text style={[styles.babyTargetText, familyMoment && styles.babyTargetTextActive]}>가족 순간</Text></Pressable>
            </View>
            <Text style={styles.babyTag}>{familyMoment ? "가족 모두의 순간으로 표시돼요." : `${selectedBabyIds.length || 1}명의 아기와 연결돼요.`}</Text>
            <MemoryPeoplePicker
              members={familyMembers}
              taggedIds={taggedIds}
              selectedIds={selectedIds}
              showSelectedPeople={privacy === "selected_people"}
              onToggleTagged={(id) => setTaggedIds((current) => toggle(current, id))}
              onToggleSelected={(id) => setSelectedIds((current) => toggle(current, id))}
            />
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { minHeight: 74, paddingHorizontal: 14, paddingBottom: 10, flexDirection: "row", alignItems: "flex-end", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, backgroundColor: colors.card },
  headerAction: { minWidth: 64, minHeight: 44, justifyContent: "center" },
  titleWrap: { flex: 1, alignItems: "center", justifyContent: "flex-end", paddingBottom: 8 },
  title: { textAlign: "center", color: colors.text, fontSize: 17, fontWeight: "800" },
  subtitle: { color: colors.muted, fontSize: 10.5, textAlign: "center", marginTop: 2 },
  cancel: { color: colors.muted, fontSize: 15, fontWeight: "600" },
  save: { color: colors.amberText, fontSize: 15, fontWeight: "800", textAlign: "right" },
  disabledText: { opacity: 0.4 },
  content: { padding: 20, gap: 14 },
  photo: { width: "100%", aspectRatio: 1.25, borderRadius: radius.xl, overflow: "hidden", borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  photoEmpty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  photoLabel: { color: colors.muted, fontSize: 13, fontWeight: "700" },
  photoGuide: { color: colors.faint, fontSize: 11.5, lineHeight: 17 },
  photoRow: { gap: 10, paddingRight: 4 },
  photoThumbWrap: { width: 132, height: 132, borderRadius: 18, overflow: "hidden", backgroundColor: colors.cardHi },
  photoThumb: { width: "100%", height: "100%" },
  coverBadge: { position: "absolute", left: 7, bottom: 7, borderRadius: 999, backgroundColor: "rgba(46,42,38,0.72)", paddingHorizontal: 7, paddingVertical: 3 },
  coverBadgeText: { color: "#fff", fontSize: 9.5, fontWeight: "800" },
  photoFail: { position: "absolute", left: 7, right: 7, bottom: 7, minHeight: 44, borderRadius: 999, backgroundColor: "rgba(46,42,38,0.82)", alignItems: "center", justifyContent: "center" },
  photoFailText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  photoUploading: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, gap: 6, backgroundColor: "rgba(46,42,38,0.44)", alignItems: "center", justifyContent: "center" },
  photoUploadingText: { color: "#fff", fontSize: 11, fontWeight: "800" },
  photoRemove: { position: "absolute", right: 4, top: 4, width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(46,42,38,0.72)" },
  photoAddTile: { width: 104, height: 132, borderRadius: 18, borderWidth: 1, borderStyle: "dashed", borderColor: colors.amber, backgroundColor: colors.amberSoft, alignItems: "center", justifyContent: "center", gap: 4 },
  photoAddText: { color: colors.amberText, fontSize: 11.5, fontWeight: "800" },
  field: { gap: 8, padding: 14, borderRadius: radius.lg, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  fieldLabel: { color: colors.text, fontSize: 14, fontWeight: "800" },
  caption: { minHeight: 100, color: colors.text, fontSize: 14, lineHeight: 21, padding: 12, borderRadius: radius.md, backgroundColor: colors.cardHi },
  counter: { color: colors.faint, fontSize: 10.5, textAlign: "right" },
  babyTag: { color: colors.amberText, fontSize: 13, fontWeight: "800", marginBottom: 2 },
  babyTargetRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  babyTargetChip: { minHeight: TOUCH_MIN, maxWidth: "100%", paddingHorizontal: 12, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  babyTargetChipActive: { borderColor: colors.amber, backgroundColor: colors.amberSoft },
  babyTargetText: { color: colors.muted, fontSize: 12.5, fontWeight: "700" },
  babyTargetTextActive: { color: colors.amberText },
  error: { color: colors.dangerText, backgroundColor: colors.dangerSoft, borderRadius: radius.md, padding: 12, fontSize: 12.5, lineHeight: 18 },
});
