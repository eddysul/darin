import { useEffect, useMemo, useState } from "react";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import type { FamilyMember } from "../../types/family";
import type { MemoryPostBundle, MemoryPrivacyType, MemoryTagDraft } from "../../types/memory";
import { MemoriesRepository } from "../../repositories/MemoriesRepository";
import { colors, radius } from "../../theme";
import { MemoryPeoplePicker } from "./MemoryPeoplePicker";
import { MemoryPrivacyPicker } from "./MemoryPrivacyPicker";

const toggle = (list: string[], id: string) => list.includes(id) ? list.filter((item) => item !== id) : [...list, id];
const MAX_MEMORY_PHOTOS = 5;

type PickedImage = { uri: string; width?: number; height?: number; fileSize?: number; mimeType?: string };

export function MemoryEditModal({
  visible,
  bundle,
  familyMembers,
  onClose,
  onSaved,
}: {
  visible: boolean;
  bundle: MemoryPostBundle;
  familyMembers: FamilyMember[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [caption, setCaption] = useState("");
  const [privacy, setPrivacy] = useState<MemoryPrivacyType>("family_circle");
  const [taggedIds, setTaggedIds] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [manualGuests, setManualGuests] = useState("");
  const [existingPhotos, setExistingPhotos] = useState<Array<{ mediaId: string; uri: string }>>([]);
  const [newImages, setNewImages] = useState<PickedImage[]>([]);
  const [mediaReady, setMediaReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!visible) return;
    setCaption(bundle.post.caption ?? "");
    setPrivacy(bundle.post.privacyType);
    setTaggedIds(bundle.tags.filter((tag) => tag.tagType === "family_member" && tag.taggedUserId).map((tag) => tag.taggedUserId!));
    setSelectedIds(bundle.selectedUserIds);
    setManualGuests(bundle.tags.filter((tag) => tag.tagType === "manual_guest").map((tag) => tag.manualLabel).filter(Boolean).join(", "));
    setExistingPhotos([]);
    setNewImages([]);
    setMediaReady(false);
    setError("");
    void Promise.all(bundle.media.map(async (media) => ({ mediaId: media.id, uri: await MemoriesRepository.createSignedUrl(media.storagePath) })))
      .then((photos) => { setExistingPhotos(photos); setMediaReady(true); })
      .catch(() => setError("기존 사진을 불러오지 못했어요. 화면을 닫고 다시 시도해 주세요."));
  }, [bundle, visible]);

  const pickImages = async () => {
    setError("");
    const remaining = MAX_MEMORY_PHOTOS - existingPhotos.length - newImages.length;
    if (remaining <= 0) return setError("사진을 더 추가하려면 먼저 한 장을 삭제해 주세요.");
    try {
      const permission = await ImagePicker.getMediaLibraryPermissionsAsync();
      const resolvedPermission = permission.granted ? permission : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!resolvedPermission.granted) return setError("사진을 선택하려면 설정에서 사진 보관함 접근을 허용해 주세요.");
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsMultipleSelection: true,
        selectionLimit: remaining,
        orderedSelection: true,
        preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Current,
        quality: 0.9,
      });
      if (result.canceled) return;
      if (result.assets.some((asset) => asset.fileSize !== undefined && asset.fileSize > 25 * 1024 * 1024)) return setError("사진은 25MB 이하만 올릴 수 있어요.");
      setNewImages((current) => [
        ...current,
        ...result.assets.slice(0, remaining).filter((asset) => !current.some((item) => item.uri === asset.uri)).map((asset) => ({ uri: asset.uri, width: asset.width, height: asset.height, fileSize: asset.fileSize, mimeType: asset.mimeType })),
      ].slice(0, remaining + current.length));
    } catch (cause) {
      if (__DEV__) console.warn("[memory-edit-photo-picker] open failed", cause instanceof Error ? cause.name : "unknown");
      setError("iCloud 사진이라면 사진 앱에서 원본을 먼저 열어 다운로드한 뒤 다시 선택해 주세요.");
    }
  };

  const tags = useMemo<MemoryTagDraft[]>(() => [
    { tagType: "baby", babyId: bundle.post.babyId },
    ...taggedIds.map((taggedUserId) => ({ tagType: "family_member" as const, taggedUserId })),
    ...[...new Set(manualGuests.split(",").map((item) => item.trim()).filter(Boolean))]
      .map((manualLabel) => ({ tagType: "manual_guest" as const, manualLabel })),
  ], [bundle.post.babyId, manualGuests, taggedIds]);

  const closeSafely = () => {
    if (saving) return;
    Alert.alert("수정을 닫을까요?", "저장하지 않은 변경은 사라져요.", [
      { text: "계속 수정", style: "cancel" },
      { text: "닫기", style: "destructive", onPress: onClose },
    ]);
  };

  const save = async () => {
    if (saving) return;
    if (!mediaReady) return setError("사진을 불러온 뒤 다시 시도해 주세요.");
    if (existingPhotos.length + newImages.length === 0) return setError("사진을 한 장 이상 추가해 주세요.");
    if (privacy === "tagged_family" && taggedIds.length === 0) return setError("가족을 한 명 이상 태그해주세요.");
    if (privacy === "selected_people" && selectedIds.length === 0) return setError("사진을 볼 가족을 한 명 이상 선택해주세요.");
    setSaving(true);
    setError("");
    try {
      await MemoriesRepository.updateMemoryMedia({
        memoryPostId: bundle.post.id,
        babyId: bundle.post.babyId,
        retainedMediaIds: existingPhotos.map((photo) => photo.mediaId),
        newImages,
      });
      await MemoriesRepository.updateMemoryPost({
        memoryPostId: bundle.post.id,
        caption,
        privacyType: privacy,
        selectedUserIds: privacy === "selected_people" ? selectedIds : [],
        tags,
      });
      onSaved();
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "수정 내용을 저장하지 못했어요.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={closeSafely}>
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 12 : 0}
      >
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 14) }]}>
          <Pressable style={styles.action} onPress={closeSafely} disabled={saving}><Text style={styles.cancel}>취소</Text></Pressable>
          <Text style={styles.title}>추억 수정</Text>
          <Pressable style={styles.action} onPress={() => void save()} disabled={saving}>
            {saving ? <ActivityIndicator color={colors.amber} /> : <Text style={styles.save}>저장</Text>}
          </Pressable>
        </View>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 120 }]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
          <View style={styles.field}>
            <Text style={styles.label}>사진</Text>
            <Text style={styles.photoGuide}>최대 5장까지 추가할 수 있어요. 첫 번째 사진이 대표 이미지로 표시돼요.</Text>
            {!mediaReady ? <ActivityIndicator color={colors.amber} /> : <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoRow}>
              {existingPhotos.map((photo, index) => (
                <View key={photo.mediaId} style={styles.photoThumbWrap}>
                  <Image source={{ uri: photo.uri }} style={styles.photoThumb} contentFit="cover" />
                  {index === 0 ? <View style={styles.coverBadge}><Text style={styles.coverBadgeText}>대표</Text></View> : null}
                  <Pressable style={styles.photoRemove} onPress={() => setExistingPhotos((current) => current.filter((item) => item.mediaId !== photo.mediaId))} accessibilityLabel={`기존 사진 ${index + 1} 삭제`}><Text style={styles.photoRemoveText}>×</Text></Pressable>
                </View>
              ))}
              {newImages.map((image, index) => {
                const position = existingPhotos.length + index;
                return <View key={`${image.uri}-${index}`} style={styles.photoThumbWrap}>
                  <Image source={{ uri: image.uri }} style={styles.photoThumb} contentFit="cover" />
                  {position === 0 ? <View style={styles.coverBadge}><Text style={styles.coverBadgeText}>대표</Text></View> : null}
                  <Pressable style={styles.photoRemove} onPress={() => setNewImages((current) => current.filter((_, photoIndex) => photoIndex !== index))} accessibilityLabel={`새 사진 ${index + 1} 삭제`}><Text style={styles.photoRemoveText}>×</Text></Pressable>
                </View>;
              })}
              {existingPhotos.length + newImages.length < MAX_MEMORY_PHOTOS ? <Pressable style={styles.photoAddTile} onPress={() => void pickImages()}><Text style={styles.photoPlus}>＋</Text><Text style={styles.photoAddText}>사진 추가</Text></Pressable> : null}
            </ScrollView>}
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>짧은 이야기</Text>
            <TextInput style={styles.caption} value={caption} onChangeText={setCaption} multiline maxLength={1200} textAlignVertical="top" />
            <Text style={styles.counter}>{caption.length}/1200</Text>
          </View>
          <View style={styles.field}><Text style={styles.label}>공개 범위</Text><MemoryPrivacyPicker value={privacy} onChange={setPrivacy} /></View>
          <View style={styles.field}>
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
  header: { minHeight: 58, paddingHorizontal: 14, paddingBottom: 10, flexDirection: "row", alignItems: "flex-end", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, backgroundColor: colors.card },
  action: { minWidth: 64, minHeight: 44, justifyContent: "center" },
  title: { flex: 1, paddingBottom: 12, textAlign: "center", color: colors.text, fontSize: 17, fontWeight: "800" },
  cancel: { color: colors.muted, fontSize: 15, fontWeight: "600" },
  save: { color: colors.amber, fontSize: 15, fontWeight: "800", textAlign: "right" },
  content: { padding: 20, gap: 14 },
  field: { gap: 8, padding: 14, borderRadius: radius.lg, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  label: { color: colors.text, fontSize: 14, fontWeight: "800" },
  photoGuide: { color: colors.faint, fontSize: 11.5, lineHeight: 17 },
  photoRow: { gap: 10, paddingRight: 4 },
  photoThumbWrap: { width: 112, height: 112, borderRadius: 16, overflow: "hidden", backgroundColor: colors.cardHi },
  photoThumb: { width: "100%", height: "100%" },
  coverBadge: { position: "absolute", left: 7, bottom: 7, borderRadius: 999, backgroundColor: "rgba(46,42,38,0.72)", paddingHorizontal: 7, paddingVertical: 3 },
  coverBadgeText: { color: "#fff", fontSize: 9.5, fontWeight: "800" },
  photoRemove: { position: "absolute", right: 6, top: 6, width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(46,42,38,0.72)" },
  photoRemoveText: { color: "#fff", fontSize: 21, lineHeight: 23 },
  photoAddTile: { width: 96, height: 112, borderRadius: 16, borderWidth: 1, borderStyle: "dashed", borderColor: colors.amber, backgroundColor: colors.amberSoft, alignItems: "center", justifyContent: "center", gap: 4 },
  photoPlus: { color: colors.amber, fontSize: 26, lineHeight: 28 },
  photoAddText: { color: colors.amber, fontSize: 11.5, fontWeight: "800" },
  caption: { minHeight: 110, borderRadius: radius.md, backgroundColor: colors.cardHi, padding: 12, color: colors.text, fontSize: 14, lineHeight: 21 },
  counter: { color: colors.faint, fontSize: 10.5, textAlign: "right" },
  error: { color: colors.dangerText, backgroundColor: colors.dangerSoft, borderRadius: radius.md, padding: 12, fontSize: 12.5 },
});
