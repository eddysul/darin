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
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { FamilyMember } from "../../types/family";
import type { MemoryPostBundle, MemoryPrivacyType, MemoryTagDraft } from "../../types/memory";
import { MemoriesRepository } from "../../repositories/MemoriesRepository";
import { colors, radius } from "../../theme";
import { MemoryPeoplePicker } from "./MemoryPeoplePicker";
import { MemoryPrivacyPicker } from "./MemoryPrivacyPicker";
import type { BabyRow } from "../../types/database";

const MAX_MEMORY_PHOTOS = 5;

type PickedImage = {
  uri: string;
  width?: number;
  height?: number;
  fileSize?: number;
  mimeType?: string;
};

function toggle(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((item) => item !== id) : [...list, id];
}

export function MemoryUploadModal({
  visible,
  babyId,
  babyName,
  familyMembers,
  babies,
  onClose,
  onCreated,
}: {
  visible: boolean;
  babyId: string;
  babyName: string;
  familyMembers: FamilyMember[];
  babies: BabyRow[];
  onClose: () => void;
  onCreated: (bundle: MemoryPostBundle) => void;
}) {
  const insets = useSafeAreaInsets();
  const [images, setImages] = useState<PickedImage[]>([]);
  const [caption, setCaption] = useState("");
  const [privacy, setPrivacy] = useState<MemoryPrivacyType>("family_circle");
  const [taggedIds, setTaggedIds] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedBabyIds, setSelectedBabyIds] = useState<string[]>([babyId]);
  const [familyMoment, setFamilyMoment] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const dirty = Boolean(images.length || caption.trim() || taggedIds.length || selectedIds.length || privacy !== "family_circle");
  const canSubmit = images.length > 0 && !saving;

  useEffect(() => {
    if (visible) return;
    setImages([]);
    setCaption("");
    setPrivacy("family_circle");
    setTaggedIds([]);
    setSelectedIds([]);
    setSelectedBabyIds([babyId]);
    setFamilyMoment(false);
    setSaving(false);
    setError("");
  }, [babyId, visible]);

  const tags = useMemo<MemoryTagDraft[]>(() => [
    ...(!familyMoment ? selectedBabyIds.map((selectedBabyId) => ({ tagType: "baby" as const, babyId: selectedBabyId })) : []),
    ...taggedIds.map((taggedUserId) => ({ tagType: "family_member" as const, taggedUserId })),
  ], [familyMoment, selectedBabyIds, taggedIds]);

  const closeSafely = () => {
    if (saving) return;
    if (!dirty) return onClose();
    Alert.alert("작성 중인 추억을 닫을까요?", "입력한 내용은 저장되지 않아요.", [
      { text: "계속 작성", style: "cancel" },
      { text: "닫기", style: "destructive", onPress: onClose },
    ]);
  };

  const pickImage = async () => {
    setError("");
    const remaining = MAX_MEMORY_PHOTOS - images.length;
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
        quality: 0.9,
      });
      if (result.canceled) return;
      if (result.assets.some((asset) => asset.fileSize !== undefined && asset.fileSize > 25 * 1024 * 1024)) {
        setError("사진은 25MB 이하만 올릴 수 있어요.");
        return;
      }
      setImages((current) => {
        const next = [...current];
        for (const asset of result.assets) {
          if (next.some((item) => item.uri === asset.uri) || next.length >= MAX_MEMORY_PHOTOS) continue;
          next.push({ uri: asset.uri, width: asset.width, height: asset.height, fileSize: asset.fileSize, mimeType: asset.mimeType });
        }
        return next;
      });
    } catch (cause) {
      if (__DEV__) console.warn("[memory-photo-picker] open failed", cause instanceof Error ? cause.name : "unknown");
      setError("iCloud 사진이라면 사진 앱에서 원본을 먼저 열어 다운로드한 뒤 다시 선택해 주세요.");
    }
  };

  const submit = async () => {
    if (images.length === 0 || saving) return;
    if (privacy === "tagged_family" && taggedIds.length === 0) {
      setError("태그된 가족만 공개하려면 가족을 한 명 이상 태그해주세요.");
      return;
    }
    if (privacy === "selected_people" && selectedIds.length === 0) {
      setError("사진을 볼 가족을 한 명 이상 선택해주세요.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const bundle = await MemoriesRepository.createMemoryWithImages({
        babyId,
        images,
        caption,
        privacyType: privacy,
        isFamilyMoment: familyMoment,
        selectedUserIds: privacy === "selected_people" ? selectedIds : [],
        tags,
      });
      onCreated(bundle);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "추억을 올리지 못했어요. 다시 시도해주세요.");
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
          <Pressable style={styles.headerAction} onPress={closeSafely} disabled={saving}>
            <Text style={styles.cancel}>취소</Text>
          </Pressable>
          <View style={styles.titleWrap}>
            <Text style={styles.title}>오늘의 순간을 남겨요</Text>
            <Text style={styles.subtitle}>아기의 사진과 짧은 이야기를 가족과 함께 나눠보세요.</Text>
          </View>
          <Pressable style={styles.headerAction} onPress={() => void submit()} disabled={!canSubmit}>
            {saving ? <ActivityIndicator color={colors.amberText} /> : <Text style={[styles.save, !canSubmit && styles.disabledText]}>올리기</Text>}
          </Pressable>
        </View>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 120 }]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
          {images.length === 0 ? (
            <Pressable style={styles.photo} onPress={() => void pickImage()}>
              <View style={styles.photoEmpty}>
                <Text style={styles.photoPlus}>＋</Text>
                <Text style={styles.photoLabel}>사진을 선택해 주세요</Text>
              </View>
            </Pressable>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoRow}>
              {images.map((image, index) => (
                <View key={`${image.uri}-${index}`} style={styles.photoThumbWrap}>
                  <Image source={{ uri: image.uri }} style={styles.photoThumb} contentFit="cover" />
                  {index === 0 ? <View style={styles.coverBadge}><Text style={styles.coverBadgeText}>대표</Text></View> : null}
                  <Pressable style={styles.photoRemove} onPress={() => setImages((current) => current.filter((_, photoIndex) => photoIndex !== index))} accessibilityLabel={`사진 ${index + 1} 삭제`}>
                    <Text style={styles.photoRemoveText}>×</Text>
                  </Pressable>
                </View>
              ))}
              {images.length < MAX_MEMORY_PHOTOS ? <Pressable style={styles.photoAddTile} onPress={() => void pickImage()}><Text style={styles.photoPlus}>＋</Text><Text style={styles.photoAddText}>사진 추가</Text></Pressable> : null}
            </ScrollView>
          )}
          <Text style={styles.photoGuide}>선택한 사진 {images.length}장 · 최대 5장까지 추가할 수 있어요.</Text>

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
  photoEmpty: { flex: 1, alignItems: "center", justifyContent: "center" },
  photoPlus: { color: colors.amberText, fontSize: 38, fontWeight: "300" },
  photoLabel: { color: colors.muted, fontSize: 13, fontWeight: "700" },
  photoGuide: { color: colors.faint, fontSize: 11.5, lineHeight: 17 },
  photoRow: { gap: 10, paddingRight: 4 },
  photoThumbWrap: { width: 132, height: 132, borderRadius: 18, overflow: "hidden", backgroundColor: colors.cardHi },
  photoThumb: { width: "100%", height: "100%" },
  coverBadge: { position: "absolute", left: 7, bottom: 7, borderRadius: 999, backgroundColor: "rgba(46,42,38,0.72)", paddingHorizontal: 7, paddingVertical: 3 },
  coverBadgeText: { color: "#fff", fontSize: 9.5, fontWeight: "800" },
  photoRemove: { position: "absolute", right: 6, top: 6, width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(46,42,38,0.72)" },
  photoRemoveText: { color: "#fff", fontSize: 22, lineHeight: 24 },
  photoAddTile: { width: 104, height: 132, borderRadius: 18, borderWidth: 1, borderStyle: "dashed", borderColor: colors.amber, backgroundColor: colors.amberSoft, alignItems: "center", justifyContent: "center", gap: 4 },
  photoAddText: { color: colors.amberText, fontSize: 11.5, fontWeight: "800" },
  field: { gap: 8, padding: 14, borderRadius: radius.lg, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  fieldLabel: { color: colors.text, fontSize: 14, fontWeight: "800" },
  caption: { minHeight: 100, color: colors.text, fontSize: 14, lineHeight: 21, padding: 12, borderRadius: radius.md, backgroundColor: colors.cardHi },
  counter: { color: colors.faint, fontSize: 10.5, textAlign: "right" },
  babyTag: { color: colors.amberText, fontSize: 13, fontWeight: "800", marginBottom: 2 },
  babyTargetRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  babyTargetChip: { minHeight: 40, maxWidth: "100%", paddingHorizontal: 12, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  babyTargetChipActive: { borderColor: colors.amber, backgroundColor: colors.amberSoft },
  babyTargetText: { color: colors.muted, fontSize: 12.5, fontWeight: "700" },
  babyTargetTextActive: { color: colors.amberText },
  error: { color: colors.dangerText, backgroundColor: colors.dangerSoft, borderRadius: radius.md, padding: 12, fontSize: 12.5, lineHeight: 18 },
});
