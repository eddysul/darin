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
import { useLanguage } from "../../LanguageContext";

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
  const { t } = useLanguage();
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
    Alert.alert(t("memory.critical.094"), t("memory.critical.095"), [
      { text: t("memory.critical.096"), style: "cancel" },
      { text: t("memory.critical.067"), style: "destructive", onPress: onClose },
    ]);
  };

  const pickImage = async () => {
    setError("");
    const remaining = MAX_MEMORY_PHOTOS - photos.length;
    if (remaining <= 0) {
      setError(t("memory.critical.097"));
      return;
    }
    try {
      const permission = await ImagePicker.getMediaLibraryPermissionsAsync();
      const resolvedPermission = permission.granted ? permission : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!resolvedPermission.granted) {
        setError(t("memory.critical.098"));
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
      setError(t("memory.critical.099"));
    }
  };

  const submit = () => {
    if (photos.length === 0 || postedRef.current) return;
    if (pendingUploads > 0) {
      setError(t("memory.critical.100"));
      return;
    }
    if (privacy === "tagged_family" && taggedIds.length === 0) {
      setError(t("memory.critical.101"));
      return;
    }
    if (privacy === "selected_people" && selectedIds.length === 0) {
      setError(t("memory.critical.102"));
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
            <Text style={styles.cancel}>{t("memory.critical.083")}</Text>
          </Pressable>
          <View style={styles.titleWrap}>
            <Text style={styles.title}>{t("memory.critical.080")}</Text>
            <Text style={styles.subtitle}>{t("memory.critical.081")}</Text>
          </View>
          <Pressable
            style={styles.headerAction}
            onPress={submit}
            disabled={!canSubmit}
            accessibilityRole="button"
            accessibilityState={{ disabled: !canSubmit }}
            accessibilityHint={pendingUploads > 0 ? t("memory.critical.103") : undefined}
          >
            <Text style={[styles.save, !canSubmit && styles.disabledText]}>{t("memory.critical.082")}</Text>
          </Pressable>
        </View>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 120 }]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
          {photos.length === 0 ? (
            <Pressable style={styles.photo} onPress={() => void pickImage()} accessibilityRole="button" accessibilityLabel={t("memory.critical.158")}>
              <View style={styles.photoEmpty}>
                <BabyLogIcon kind="new" size={32} color={colors.amberText} strokeWidth={2.2} />
                <Text style={styles.photoLabel}>{t("memory.critical.084")}</Text>
              </View>
            </Pressable>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoRow}>
              {photos.map((image, index) => (
                <View key={image.id} style={styles.photoThumbWrap}>
                  <Image source={{ uri: image.localUri }} style={styles.photoThumb} contentFit="cover" />
                  {index === 0 ? <View style={styles.coverBadge}><Text style={styles.coverBadgeText}>{t("memory.critical.085")}</Text></View> : null}
                  {image.status === "failed" ? (
                    <Pressable style={styles.photoFail} onPress={() => retryEagerPhoto(image.id)} accessibilityRole="button" accessibilityLabel={t("memory.critical.178")}>
                      <Text style={styles.photoFailText}>{t("memory.critical.017")}</Text>
                    </Pressable>
                  ) : image.status !== "uploaded" ? (
                    <View style={styles.photoUploading} pointerEvents="none">
                      <ActivityIndicator size="small" color="#fff" />
                      <Text style={styles.photoUploadingText}>{t("memory.critical.104")}</Text>
                    </View>
                  ) : null}
                  <Pressable
                    style={styles.photoRemove}
                    onPress={() => { removeEagerPhoto(image.id); setPhotos(listEagerPhotos(sessionIdRef.current)); }}
                    accessibilityRole="button"
                    accessibilityLabel={t("memory.critical.159", { count: index + 1 })}
                  >
                    <BabyLogIcon kind="trash" size={16} color={colors.onDark} strokeWidth={2.2} />
                  </Pressable>
                </View>
              ))}
              {photos.length < MAX_MEMORY_PHOTOS ? (
                <Pressable style={styles.photoAddTile} onPress={() => void pickImage()} accessibilityRole="button" accessibilityLabel={t("memory.critical.086")}>
                  <BabyLogIcon kind="new" size={22} color={colors.amberText} strokeWidth={2.2} />
                  <Text style={styles.photoAddText}>{t("memory.critical.086")}</Text>
                </Pressable>
              ) : null}
            </ScrollView>
          )}
          <Text style={styles.photoGuide}>
            {pendingUploads > 0
              ? t("memory.critical.087", { count: pendingUploads })
              : t("memory.critical.088", { count: photos.length })}
          </Text>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{t("memory.critical.089")}</Text>
            <TextInput
              style={styles.caption}
              value={caption}
              onChangeText={setCaption}
              placeholder={t("memory.critical.090")}
              placeholderTextColor={colors.faint}
              multiline
              maxLength={1200}
              textAlignVertical="top"
            />
            <Text style={styles.counter}>{caption.length}/1200</Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{t("memory.critical.073")}</Text>
            <MemoryPrivacyPicker value={privacy} onChange={setPrivacy} />
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{t("memory.critical.091")}</Text>
            <View style={styles.babyTargetRow}>
              {babies.map((baby) => {
                const selected = !familyMoment && selectedBabyIds.includes(baby.id);
                return <Pressable key={baby.id} style={[styles.babyTargetChip, selected && styles.babyTargetChipActive]} onPress={() => { setFamilyMoment(false); setSelectedBabyIds((current) => { const next = toggle(current, baby.id); return next.length ? next : [baby.id]; }); }}><Text style={[styles.babyTargetText, selected && styles.babyTargetTextActive]}>{baby.name}</Text></Pressable>;
              })}
              <Pressable style={[styles.babyTargetChip, familyMoment && styles.babyTargetChipActive]} onPress={() => { setFamilyMoment(true); setSelectedBabyIds([]); }}><Text style={[styles.babyTargetText, familyMoment && styles.babyTargetTextActive]}>{t("memory.critical.012")}</Text></Pressable>
            </View>
            <Text style={styles.babyTag}>{familyMoment ? t("memory.critical.092") : t("memory.critical.093", { count: selectedBabyIds.length || 1 })}</Text>
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
