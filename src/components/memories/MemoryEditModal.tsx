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
import type { FamilyMember } from "../../types/family";
import type { MemoryPostBundle, MemoryPrivacyType, MemoryTagDraft } from "../../types/memory";
import { MemoriesRepository } from "../../repositories/MemoriesRepository";
import { colors, radius } from "../../theme";
import { MemoryPeoplePicker } from "./MemoryPeoplePicker";
import { MemoryPrivacyPicker } from "./MemoryPrivacyPicker";

const toggle = (list: string[], id: string) => list.includes(id) ? list.filter((item) => item !== id) : [...list, id];

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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!visible) return;
    setCaption(bundle.post.caption ?? "");
    setPrivacy(bundle.post.privacyType);
    setTaggedIds(bundle.tags.filter((tag) => tag.tagType === "family_member" && tag.taggedUserId).map((tag) => tag.taggedUserId!));
    setSelectedIds(bundle.selectedUserIds);
    setManualGuests(bundle.tags.filter((tag) => tag.tagType === "manual_guest").map((tag) => tag.manualLabel).filter(Boolean).join(", "));
    setError("");
  }, [bundle, visible]);

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
    if (privacy === "tagged_family" && taggedIds.length === 0) return setError("가족을 한 명 이상 태그해주세요.");
    if (privacy === "selected_people" && selectedIds.length === 0) return setError("사진을 볼 가족을 한 명 이상 선택해주세요.");
    setSaving(true);
    setError("");
    try {
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
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 14) }]}>
          <Pressable style={styles.action} onPress={closeSafely} disabled={saving}><Text style={styles.cancel}>취소</Text></Pressable>
          <Text style={styles.title}>추억 수정</Text>
          <Pressable style={styles.action} onPress={() => void save()} disabled={saving}>
            {saving ? <ActivityIndicator color={colors.amber} /> : <Text style={styles.save}>저장</Text>}
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 28 }]} keyboardShouldPersistTaps="handled">
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
  action: { minWidth: 64, minHeight: 44, justifyContent: "center" },
  title: { flex: 1, paddingBottom: 12, textAlign: "center", color: colors.text, fontSize: 17, fontWeight: "800" },
  cancel: { color: colors.muted, fontSize: 15, fontWeight: "600" },
  save: { color: colors.amber, fontSize: 15, fontWeight: "800", textAlign: "right" },
  content: { padding: 20, gap: 14 },
  field: { gap: 8, padding: 14, borderRadius: radius.lg, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  label: { color: colors.text, fontSize: 14, fontWeight: "800" },
  caption: { minHeight: 110, borderRadius: radius.md, backgroundColor: colors.cardHi, padding: 12, color: colors.text, fontSize: 14, lineHeight: 21 },
  counter: { color: colors.faint, fontSize: 10.5, textAlign: "right" },
  error: { color: colors.dangerText, backgroundColor: colors.dangerSoft, borderRadius: radius.md, padding: 12, fontSize: 12.5 },
});
