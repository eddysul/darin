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

function manualTagDrafts(value: string): MemoryTagDraft[] {
  return [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))]
    .map((manualLabel) => ({ tagType: "manual_guest" as const, manualLabel }));
}

export function MemoryUploadModal({
  visible,
  babyId,
  babyName,
  familyMembers,
  onClose,
  onCreated,
}: {
  visible: boolean;
  babyId: string;
  babyName: string;
  familyMembers: FamilyMember[];
  onClose: () => void;
  onCreated: (bundle: MemoryPostBundle) => void;
}) {
  const insets = useSafeAreaInsets();
  const [image, setImage] = useState<PickedImage | null>(null);
  const [caption, setCaption] = useState("");
  const [privacy, setPrivacy] = useState<MemoryPrivacyType>("family_circle");
  const [taggedIds, setTaggedIds] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [manualGuests, setManualGuests] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const dirty = Boolean(image || caption.trim() || taggedIds.length || selectedIds.length || manualGuests.trim() || privacy !== "family_circle");
  const canSubmit = Boolean(image && !saving);

  useEffect(() => {
    if (visible) return;
    setImage(null);
    setCaption("");
    setPrivacy("family_circle");
    setTaggedIds([]);
    setSelectedIds([]);
    setManualGuests("");
    setSaving(false);
    setError("");
  }, [visible]);

  const tags = useMemo<MemoryTagDraft[]>(() => [
    { tagType: "baby", babyId },
    ...taggedIds.map((taggedUserId) => ({ tagType: "family_member" as const, taggedUserId })),
    ...manualTagDrafts(manualGuests),
  ], [babyId, manualGuests, taggedIds]);

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
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError("사진을 선택하려면 사진 보관함 접근 권한이 필요해요.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: false,
      quality: 0.9,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (asset.fileSize !== undefined && asset.fileSize > 25 * 1024 * 1024) {
      setError("사진은 25MB 이하만 올릴 수 있어요.");
      return;
    }
    setImage({
      uri: asset.uri,
      width: asset.width,
      height: asset.height,
      fileSize: asset.fileSize,
      mimeType: asset.mimeType,
    });
  };

  const submit = async () => {
    if (!image || saving) return;
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
      const bundle = await MemoriesRepository.createMemoryWithImage({
        babyId,
        imageUri: image.uri,
        imageSizeBytes: image.fileSize,
        mimeType: image.mimeType,
        width: image.width,
        height: image.height,
        caption,
        privacyType: privacy,
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
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 14) }]}>
          <Pressable style={styles.headerAction} onPress={closeSafely} disabled={saving}>
            <Text style={styles.cancel}>취소</Text>
          </Pressable>
          <Text style={styles.title}>새 추억</Text>
          <Pressable style={styles.headerAction} onPress={() => void submit()} disabled={!canSubmit}>
            {saving ? <ActivityIndicator color={colors.amber} /> : <Text style={[styles.save, !canSubmit && styles.disabledText]}>올리기</Text>}
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 28 }]} keyboardShouldPersistTaps="handled">
          <Pressable style={styles.photo} onPress={() => void pickImage()}>
            {image ? <Image source={{ uri: image.uri }} style={StyleSheet.absoluteFill} contentFit="cover" /> : (
              <View style={styles.photoEmpty}>
                <Text style={styles.photoPlus}>＋</Text>
                <Text style={styles.photoLabel}>사진 선택</Text>
              </View>
            )}
          </Pressable>
          {image ? <Pressable onPress={() => void pickImage()}><Text style={styles.changePhoto}>사진 바꾸기</Text></Pressable> : null}

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>짧은 이야기</Text>
            <TextInput
              style={styles.caption}
              value={caption}
              onChangeText={setCaption}
              placeholder={`${babyName}의 오늘을 남겨보세요.`}
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
            <Text style={styles.babyTag}>아기 태그 · {babyName}</Text>
            <MemoryPeoplePicker
              members={familyMembers}
              taggedIds={taggedIds}
              selectedIds={selectedIds}
              showSelectedPeople={privacy === "selected_people"}
              manualGuests={manualGuests}
              onToggleTagged={(id) => setTaggedIds((current) => toggle(current, id))}
              onToggleSelected={(id) => setSelectedIds((current) => toggle(current, id))}
              onChangeManualGuests={setManualGuests}
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
  headerAction: { minWidth: 64, minHeight: 44, justifyContent: "center" },
  title: { flex: 1, textAlign: "center", color: colors.text, fontSize: 17, fontWeight: "800", paddingBottom: 12 },
  cancel: { color: colors.muted, fontSize: 15, fontWeight: "600" },
  save: { color: colors.amber, fontSize: 15, fontWeight: "800", textAlign: "right" },
  disabledText: { opacity: 0.4 },
  content: { padding: 20, gap: 14 },
  photo: { width: "100%", aspectRatio: 1.25, borderRadius: radius.xl, overflow: "hidden", borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  photoEmpty: { flex: 1, alignItems: "center", justifyContent: "center" },
  photoPlus: { color: colors.amber, fontSize: 38, fontWeight: "300" },
  photoLabel: { color: colors.muted, fontSize: 13, fontWeight: "700" },
  changePhoto: { minHeight: 36, textAlign: "center", color: colors.amber, fontWeight: "700" },
  field: { gap: 8, padding: 14, borderRadius: radius.lg, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  fieldLabel: { color: colors.text, fontSize: 14, fontWeight: "800" },
  caption: { minHeight: 100, color: colors.text, fontSize: 14, lineHeight: 21, padding: 12, borderRadius: radius.md, backgroundColor: colors.cardHi },
  counter: { color: colors.faint, fontSize: 10.5, textAlign: "right" },
  babyTag: { color: colors.amber, fontSize: 13, fontWeight: "800", marginBottom: 2 },
  error: { color: colors.dangerText, backgroundColor: colors.dangerSoft, borderRadius: radius.md, padding: 12, fontSize: 12.5, lineHeight: 18 },
});
