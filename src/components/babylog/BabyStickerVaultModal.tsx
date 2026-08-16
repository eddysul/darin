import { useEffect, useMemo, useState } from "react";
import * as ImagePicker from "expo-image-picker";
import {
  ActivityIndicator,
  Alert,
  Linking,
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
import type { BabySticker, BabyStickerDraft, StickerCutoutMode } from "../../types/babySticker";
import {
  STICKER_BORDER_OPTIONS,
  STICKER_BUBBLE_OPTIONS,
  STICKER_FRAME_OPTIONS,
  STICKER_SHADOW_OPTIONS,
  STICKER_SUGGESTED_PHRASES,
  STICKER_TEMPLATE_OPTIONS,
  defaultStickerDraft,
} from "../../types/babySticker";
import { persistStickerAsset, deleteStickerAssets } from "../../utils/babyStickerAssets";
import {
  DEFAULT_CIRCLE_CROP,
  STICKER_CUTOUT_MODE_OPTIONS,
  createStickerCutout,
  isPersonCutoutSupported,
  type CircularCutoutCrop,
} from "../../utils/babyStickerCutout";
import { createId } from "../../utils/id";
import { colors, radius } from "../../theme";
import { EmptyState } from "../states/FeedbackStates";
import { BabyStickerFromModel, BabyStickerView } from "./BabyStickerView";
import { StickerCirclePositioner } from "./StickerCirclePositioner";
import { useBabyLog } from "../../context/BabyLogContext";

type Mode = "vault" | "pickPhoto" | "position" | "cutting" | "decorate" | "save";

function isLibraryAllowed(
  status: Awaited<ReturnType<typeof ImagePicker.getMediaLibraryPermissionsAsync>>,
): boolean {
  return status.granted || status.accessPrivileges === "limited";
}

async function ensureLibraryPermission(): Promise<boolean> {
  const current = await ImagePicker.getMediaLibraryPermissionsAsync();
  const resolved = isLibraryAllowed(current)
    ? current
    : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (isLibraryAllowed(resolved)) return true;
  Alert.alert(
    "사진 접근 권한이 필요해요",
    "설정에서 사진 접근을 허용한 뒤 다시 시도해 주세요.",
    [
      { text: "취소", style: "cancel" },
      { text: "설정 열기", onPress: () => void Linking.openSettings() },
    ],
  );
  return false;
}

async function ensureCameraPermission(): Promise<boolean> {
  const current = await ImagePicker.getCameraPermissionsAsync();
  const resolved = current.granted ? current : await ImagePicker.requestCameraPermissionsAsync();
  if (resolved.granted) return true;
  Alert.alert(
    "카메라 접근 권한이 필요해요",
    "설정에서 카메라 접근을 허용한 뒤 다시 시도해 주세요.",
    [
      { text: "취소", style: "cancel" },
      { text: "설정 열기", onPress: () => void Linking.openSettings() },
    ],
  );
  return false;
}

type Props = {
  visible: boolean;
  babyId?: string;
  babyName: string;
  stickers: BabySticker[];
  createdBy?: string;
  /** When set, selecting a sticker returns it instead of only browsing. */
  pickMode?: boolean;
  /** Render as overlay inside a parent Modal (avoids iOS nested-Modal failures). */
  embedded?: boolean;
  onClose: () => void;
  onSaveSticker: (sticker: BabySticker) => void | Promise<unknown>;
  onDeleteSticker: (id: string) => void | Promise<unknown>;
  onPickSticker?: (sticker: BabySticker) => void;
  /** Open directly on the photo-pick create flow. */
  startInCreate?: boolean;
};

export function BabyStickerVaultModal({
  visible,
  babyId,
  babyName,
  stickers,
  createdBy,
  pickMode = false,
  embedded = false,
  onClose,
  onSaveSticker,
  onDeleteSticker,
  onPickSticker,
  startInCreate = false,
}: Props) {
  const insets = useSafeAreaInsets();
  const { localDataScope } = useBabyLog();
  const resolvedBabyId = babyId || localDataScope?.babyId;
  const [mode, setMode] = useState<Mode>("vault");
  const [draft, setDraft] = useState<BabyStickerDraft | null>(null);
  const [cutoutError, setCutoutError] = useState(false);
  const [pendingOriginal, setPendingOriginal] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [seedPhrase, setSeedPhrase] = useState<string | null>(null);
  const [cutoutMode, setCutoutMode] = useState<StickerCutoutMode>("circular");
  const [circleCrop, setCircleCrop] = useState<CircularCutoutCrop>(DEFAULT_CIRCLE_CROP);
  const personCutoutSupported = isPersonCutoutSupported();
  const usesInAppPositioner = cutoutMode === "circular" && Platform.OS === "ios";

  useEffect(() => {
    if (!visible) {
      setMode("vault");
      setDraft(null);
      setCutoutError(false);
      setPendingOriginal(null);
      setSaving(false);
      setSeedPhrase(null);
      setCutoutMode("circular");
      setCircleCrop(DEFAULT_CIRCLE_CROP);
      return;
    }
    if (startInCreate) {
      setDraft(null);
      setCutoutError(false);
      setPendingOriginal(null);
      setSeedPhrase(null);
      setCutoutMode("circular");
      setCircleCrop(DEFAULT_CIRCLE_CROP);
      setMode("pickPhoto");
    }
  }, [visible, startInCreate]);

  const title =
    mode === "vault"
      ? pickMode
        ? "스티커 선택"
        : "내 아기 스티커"
      : mode === "pickPhoto"
        ? "스티커 만들기"
        : mode === "position"
          ? "위치 맞추기"
          : mode === "cutting"
            ? cutoutMode === "personCutout"
              ? "인물 컷아웃"
              : "둥근 스티커"
            : mode === "decorate"
              ? "스티커 꾸미기"
              : "스티커 저장";

  const startCreate = (phrase?: string) => {
    setDraft(null);
    setCutoutError(false);
    setPendingOriginal(null);
    setSeedPhrase(phrase ?? null);
    setCutoutMode("circular");
    setCircleCrop(DEFAULT_CIRCLE_CROP);
    setMode("pickPhoto");
  };

  const applyDraftFromCutout = (originalUri: string, cutoutUri: string, modeUsed: StickerCutoutMode) => {
    setDraft((prev) => {
      const next = defaultStickerDraft(originalUri, cutoutUri, modeUsed);
      if (prev) {
        next.borderStyle = prev.borderStyle;
        next.shadowStyle = prev.shadowStyle;
        next.speechBubbleType = prev.speechBubbleType;
        next.frameType = prev.frameType;
        next.templateId = prev.templateId;
        next.stickerType = prev.stickerType;
        next.text = prev.text;
        next.label = prev.label;
      } else if (seedPhrase) {
        next.text = seedPhrase;
        next.label = seedPhrase;
      }
      return next;
    });
    setMode("decorate");
  };

  const runCutout = async (
    originalUri: string,
    preferredMode: StickerCutoutMode = cutoutMode,
    crop?: CircularCutoutCrop,
  ) => {
    setPendingOriginal(originalUri);
    setMode("cutting");
    setCutoutError(false);
    try {
      const result = await createStickerCutout(originalUri, preferredMode, crop);
      if (result.method === "circular-fallback") {
        setCutoutMode("circular");
        setMode("position");
        return;
      }
      applyDraftFromCutout(originalUri, result.uri, result.mode);
    } catch {
      setCutoutError(true);
    }
  };

  const openPositioner = (originalUri: string, resetCrop: boolean) => {
    setPendingOriginal(originalUri);
    if (resetCrop) setCircleCrop(DEFAULT_CIRCLE_CROP);
    setMode("position");
  };

  const continueAsCircular = () => {
    if (!pendingOriginal) return;
    setCutoutMode("circular");
    openPositioner(pendingOriginal, false);
  };

  const pickerExtras =
    cutoutMode === "circular" && Platform.OS !== "ios"
      ? { allowsEditing: true as const, aspect: [1, 1] as [number, number] }
      : { allowsEditing: false as const };

  const afterPickedLocal = async (localUri: string) => {
    if (usesInAppPositioner) {
      openPositioner(localUri, true);
      return;
    }
    await runCutout(localUri);
  };

  const importPickedUri = async (sourceUri: string): Promise<string | null> => {
    if (!resolvedBabyId) {
      Alert.alert("아기를 먼저 선택해 주세요", "스티커는 아기별로 보관돼요.");
      return null;
    }
    try {
      return await persistStickerAsset(sourceUri, resolvedBabyId, "original", createId());
    } catch {
      Alert.alert(
        "사진을 불러오지 못했어요",
        "시뮬레이터의 iCloud/FileProvider 사진이거나, 원본이 기기에 없을 수 있어요. 사진 앱에 저장한 로컬 사진을 골라 주세요.",
      );
      return null;
    }
  };

  const pickFromLibrary = async () => {
    try {
      if (!(await ensureLibraryPermission())) return;
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.85,
        allowsMultipleSelection: false,
        preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Current,
        ...pickerExtras,
      });
      if (result.canceled || !result.assets?.[0]?.uri) return;
      const localUri = await importPickedUri(result.assets[0].uri);
      if (!localUri) return;
      await afterPickedLocal(localUri);
    } catch (error) {
      if (__DEV__) console.warn("[sticker-photo-picker] library failed", error instanceof Error ? error.name : "unknown");
      Alert.alert(
        "사진을 불러오지 못했어요",
        "시뮬레이터에서는 iCloud 사진이 열리지 않을 수 있어요. 사진 앱에 넣은 로컬 사진을 골라 주세요.",
      );
    }
  };

  const pickFromCamera = async () => {
    try {
      if (!(await ensureCameraPermission())) return;
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        quality: 0.85,
        ...pickerExtras,
      });
      if (result.canceled || !result.assets?.[0]?.uri) return;
      const localUri = await importPickedUri(result.assets[0].uri);
      if (!localUri) return;
      await afterPickedLocal(localUri);
    } catch (error) {
      if (__DEV__) console.warn("[sticker-photo-picker] camera failed", error instanceof Error ? error.name : "unknown");
      Alert.alert("사진을 찍지 못했어요", "잠시 후 다시 시도해 주세요.");
    }
  };

  const persistAndSave = async () => {
    if (!draft) return;
    if (!resolvedBabyId) {
      Alert.alert("아기를 먼저 선택해 주세요", "스티커는 아기별로 보관돼요.");
      return;
    }
    const label = draft.label.trim() || `${babyName} 스티커`;
    setSaving(true);
    try {
      const id = createId();
      const originalImageUri = await persistStickerAsset(draft.originalImageUri, resolvedBabyId, "original", id);
      const cutoutImageUri = await persistStickerAsset(draft.cutoutImageUri, resolvedBabyId, "cutout", id);
      const finalStickerImageUri = await persistStickerAsset(cutoutImageUri, resolvedBabyId, "final", id);
      const now = new Date().toISOString();
      const sticker: BabySticker = {
        id,
        babyId: resolvedBabyId,
        originalImageUri,
        faceImageUri: cutoutImageUri,
        cutoutImageUri,
        finalStickerImageUri,
        cutoutMode: draft.cutoutMode,
        stickerType: draft.stickerType,
        templateId: draft.templateId,
        label,
        borderStyle: draft.borderStyle,
        shadowStyle: draft.shadowStyle,
        speechBubbleType: draft.speechBubbleType,
        frameType: draft.frameType,
        text: draft.text.trim(),
        createdBy,
        createdAt: now,
        updatedAt: now,
      };
      let synced = false;
      try {
        await onSaveSticker(sticker);
        synced = true;
      } catch (error) {
        if (error instanceof Error && error.message.includes("현재 선택된")) throw error;
        Alert.alert(
          "보관함에 저장했어요",
          "이 기기 보관함에는 들어갔어요. 서버 동기화는 연결되면 다시 시도해요.",
        );
      }
      setMode("vault");
      setDraft(null);
      if (pickMode && synced) onPickSticker?.(sticker);
    } catch {
      Alert.alert("스티커를 저장하지 못했어요", "사진을 다시 선택한 뒤 저장해 주세요.");
    } finally {
      setSaving(false);
    }
  };

  const goBack = () => {
    if (mode === "vault") {
      onClose();
      return;
    }
    if (mode === "save") {
      setMode("decorate");
      return;
    }
    if (mode === "cutting") {
      if (usesInAppPositioner && pendingOriginal) {
        setMode("position");
        return;
      }
      setMode("pickPhoto");
      return;
    }
    if (mode === "decorate") {
      if (draft?.cutoutMode === "circular" && pendingOriginal && Platform.OS === "ios") {
        setMode("position");
        return;
      }
      setMode("pickPhoto");
      return;
    }
    if (mode === "position") {
      if (draft) {
        setMode("decorate");
        return;
      }
      setMode("pickPhoto");
      return;
    }
    if (startInCreate) onClose();
    else setMode("vault");
  };

  if (!visible) return null;

  const body = (
      <View style={[styles.root, embedded && styles.embeddedRoot, { paddingTop: Math.max(insets.top, 12) }]}>
        <View style={styles.header}>
          <Pressable
            onPress={goBack}
            hitSlop={10}
            style={styles.headerBtnHit}
            accessibilityRole="button"
            accessibilityLabel={mode === "vault" || (mode === "pickPhoto" && startInCreate) ? "닫기" : "뒤로"}
          >
            <Text style={styles.headerBtn}>{mode === "vault" || (mode === "pickPhoto" && startInCreate) ? "닫기" : "뒤로"}</Text>
          </Pressable>
          <Text style={styles.headerTitle}>{title}</Text>
          <View style={styles.headerSpacer} />
        </View>

        {mode === "vault" ? (
          <VaultHome
            stickers={stickers}
            pickMode={pickMode}
            bottomPad={insets.bottom}
            onCreate={startCreate}
            onPick={(sticker) => onPickSticker?.(sticker)}
            onDelete={(sticker) => {
              Alert.alert("스티커 삭제", `"${sticker.label}"을(를) 삭제할까요?`, [
                { text: "취소", style: "cancel" },
                {
                  text: "삭제",
                  style: "destructive",
                  onPress: () => {
                    void deleteStickerAssets([
                      sticker.originalImageUri,
                      sticker.faceImageUri,
                      sticker.cutoutImageUri,
                      sticker.finalStickerImageUri,
                    ]);
                    onDeleteSticker(sticker.id);
                  },
                },
              ]);
            }}
            onApplyPhrase={(phrase) => startCreate(phrase)}
          />
        ) : null}

        {mode === "pickPhoto" ? (
          <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 28 }]}>
            <Text style={styles.label}>스티커 만들기 방식</Text>
            <View style={styles.modeRow}>
              {STICKER_CUTOUT_MODE_OPTIONS.filter((option) => !option.iosOnly || personCutoutSupported).map(
                (option) => {
                  const selected = cutoutMode === option.value;
                  return (
                    <Pressable
                      key={option.value}
                      style={[styles.modeCard, selected && styles.modeCardActive]}
                      onPress={() => setCutoutMode(option.value)}
                      accessibilityRole="button"
                      accessibilityLabel={option.label}
                      accessibilityHint={option.hint}
                      accessibilityState={{ selected }}
                    >
                      <Text style={[styles.modeTitle, selected && styles.modeTitleActive]}>{option.label}</Text>
                      <Text style={styles.modeHint}>{option.hint}</Text>
                    </Pressable>
                  );
                },
              )}
            </View>
            {!personCutoutSupported ? (
              <Text style={styles.hint}>
                인물 컷아웃은 iOS에서만 사용할 수 있어요. 사진을 고른 뒤 동그라미 안에 넣고 싶은 부분을 맞춰요.
              </Text>
            ) : cutoutMode === "personCutout" ? (
              <Text style={styles.hint}>배경 제거는 이 기기에서만 해요. 저장한 스티커는 계정에 보관돼요.</Text>
            ) : (
              <Text style={styles.hint}>사진을 고른 뒤 동그라미 안에 넣고 싶은 부분을 밀어 맞춰요. 저장한 스티커는 이 기기 보관함과 계정에 남겨요.</Text>
            )}
            <Pressable
              style={styles.primaryBtn}
              onPress={() => void pickFromLibrary()}
              accessibilityRole="button"
              accessibilityLabel="갤러리에서 선택"
            >
              <Text style={styles.primaryBtnText}>갤러리에서 선택</Text>
            </Pressable>
            <Pressable
              style={styles.secondaryBtn}
              onPress={() => void pickFromCamera()}
              accessibilityRole="button"
              accessibilityLabel="카메라로 촬영"
            >
              <Text style={styles.secondaryBtnText}>카메라로 촬영</Text>
            </Pressable>
          </ScrollView>
        ) : null}

        {mode === "position" && pendingOriginal ? (
          <StickerCirclePositioner
            uri={pendingOriginal}
            initialCrop={circleCrop}
            bottomPad={insets.bottom}
            onConfirm={(crop) => {
              setCircleCrop(crop);
              void runCutout(pendingOriginal, "circular", crop);
            }}
          />
        ) : null}

        {mode === "cutting" ? (
          <View style={[styles.content, styles.centerBlock, { paddingBottom: insets.bottom + 28 }]}>
            {cutoutError ? (
              <>
                <Text style={styles.errorTitle}>스티커 만들기에 실패했어요.</Text>
                <Text style={styles.hint}>다시 시도하거나 둥근 스티커 방식으로 계속할 수 있어요.</Text>
                <Pressable
                  style={styles.primaryBtn}
                  onPress={() => pendingOriginal && void runCutout(pendingOriginal, cutoutMode)}
                >
                  <Text style={styles.primaryBtnText}>다시 시도</Text>
                </Pressable>
                <Pressable style={styles.secondaryBtn} onPress={continueAsCircular}>
                  <Text style={styles.secondaryBtnText}>둥근 스티커로 계속</Text>
                </Pressable>
              </>
            ) : (
              <>
                <ActivityIndicator color={colors.amberText} size="large" />
                <Text style={[styles.hint, { marginTop: 16, textAlign: "center" }]}>
                  {cutoutMode === "personCutout"
                    ? "기기에서 인물을 찾아 배경을 지우는 중이에요..."
                    : "둥근 스티커를 만드는 중이에요..."}
                </Text>
                <Text style={styles.mockNote}>온디바이스 처리 · 사진은 서버로 전송되지 않아요</Text>
              </>
            )}
          </View>
        ) : null}

        {mode === "decorate" && draft ? (
          <DecorateStep
            draft={draft}
            bottomPad={insets.bottom}
            onChange={setDraft}
            onReposition={
              draft.cutoutMode === "circular" && pendingOriginal && Platform.OS === "ios"
                ? () => setMode("position")
                : undefined
            }
            onNext={() => setMode("save")}
          />
        ) : null}

        {mode === "save" && draft ? (
          <ScrollView
            contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 28 }]}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.previewCenter}>
              <BabyStickerView
                imageUri={draft.cutoutImageUri || draft.originalImageUri}
                cutoutMode={draft.cutoutMode}
                borderStyle={draft.borderStyle}
                shadowStyle={draft.shadowStyle}
                speechBubbleType={draft.speechBubbleType}
                frameType={draft.frameType}
                templateId={draft.templateId}
                text={draft.text}
                size={150}
              />
            </View>
            <Text style={styles.label}>스티커 이름</Text>
            <TextInput
              style={styles.input}
              value={draft.label}
              onChangeText={(label) => setDraft({ ...draft, label })}
              placeholder={`예: ${babyName} 웃는 스티커`}
              placeholderTextColor={colors.faint}
            />
            <Pressable
              style={[styles.primaryBtn, saving && styles.disabled]}
              disabled={saving}
              onPress={() => void persistAndSave()}
            >
              <Text style={styles.primaryBtnText}>{saving ? "저장 중…" : "스티커 저장"}</Text>
            </Pressable>
          </ScrollView>
        ) : null}
      </View>
  );

  if (embedded) return body;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      {body}
    </Modal>
  );
}

function VaultHome({
  stickers,
  pickMode,
  bottomPad,
  onCreate,
  onPick,
  onDelete,
  onApplyPhrase,
}: {
  stickers: BabySticker[];
  pickMode: boolean;
  bottomPad: number;
  onCreate: () => void;
  onPick: (sticker: BabySticker) => void;
  onDelete: (sticker: BabySticker) => void;
  onApplyPhrase: (phrase: string) => void;
}) {
  const sorted = useMemo(
    () => [...stickers].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [stickers],
  );

  return (
    <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 28 }]}>
      <Pressable style={styles.primaryBtn} onPress={onCreate}>
        <Text style={styles.primaryBtnText}>+ 새 스티커 만들기</Text>
      </Pressable>

      <Text style={styles.sectionTitle}>내 스티커</Text>
      {sorted.length === 0 ? (
        <EmptyState
          title="아직 만든 스티커가 없어요."
          body="아기 사진으로 귀여운 스티커를 만들어보세요."
          ctaLabel="첫 스티커 만들기"
          onPressCta={onCreate}
        />
      ) : (
        <View style={styles.grid}>
          {sorted.map((sticker) => (
            <Pressable
              key={sticker.id}
              style={styles.card}
              onPress={() => (pickMode ? onPick(sticker) : undefined)}
              onLongPress={() => onDelete(sticker)}
            >
              <View style={styles.cardStickerPreview}>
                <BabyStickerFromModel sticker={sticker} size={88} />
              </View>
              <Text style={styles.cardLabel} numberOfLines={2}>
                {sticker.label}
              </Text>
              {!pickMode ? (
                <Pressable
                  style={styles.deleteBtn}
                  onPress={() => onDelete(sticker)}
                  accessibilityRole="button"
                  accessibilityLabel={`${sticker.label} 삭제`}
                >
                  <Text style={styles.deleteLink}>삭제</Text>
                </Pressable>
              ) : (
                <Text style={styles.pickHint}>탭해서 선택</Text>
              )}
            </Pressable>
          ))}
        </View>
      )}

      {!pickMode ? (
        <>
          <Text style={[styles.sectionTitle, { marginTop: 18 }]}>추천 템플릿</Text>
          <View style={styles.phraseRow}>
            {STICKER_SUGGESTED_PHRASES.slice(0, 4).map((phrase) => (
              <Pressable key={phrase} style={styles.phraseChip} onPress={() => onApplyPhrase(phrase)}>
                <Text style={styles.phraseText}>{phrase}</Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : null}
    </ScrollView>
  );
}

function DecorateStep({
  draft,
  bottomPad,
  onChange,
  onReposition,
  onNext,
}: {
  draft: BabyStickerDraft;
  bottomPad: number;
  onChange: (next: BabyStickerDraft) => void;
  onReposition?: () => void;
  onNext: () => void;
}) {
  return (
    <ScrollView
      contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 28 }]}
      keyboardShouldPersistTaps="handled"
    >
      <Pressable
        style={styles.previewCenter}
        onPress={onReposition}
        disabled={!onReposition}
        accessibilityRole={onReposition ? "button" : undefined}
        accessibilityLabel={onReposition ? "사진 위치 조정" : undefined}
        accessibilityHint={onReposition ? "동그라미 안에 보이는 부분을 다시 맞춰요" : undefined}
      >
        <BabyStickerView
          imageUri={draft.cutoutImageUri || draft.originalImageUri}
          cutoutMode={draft.cutoutMode}
          borderStyle={draft.borderStyle}
          shadowStyle={draft.shadowStyle}
          speechBubbleType={draft.speechBubbleType}
          frameType={draft.frameType}
          templateId={draft.templateId}
          text={draft.text}
          size={150}
        />
        {onReposition ? <Text style={styles.repositionHint}>사진을 눌러 위치를 맞춰 주세요</Text> : null}
      </Pressable>

      <OptionRow
        label="상황 템플릿"
        options={STICKER_TEMPLATE_OPTIONS}
        value={draft.templateId}
        onChange={(templateId) => {
          const option = STICKER_TEMPLATE_OPTIONS.find((item) => item.value === templateId);
          onChange({
            ...draft,
            stickerType: templateId === "portrait" ? "faceCrop" : "faceTemplate",
            templateId,
            text: option?.defaultPhrase ?? draft.text,
            speechBubbleType: templateId === "portrait" ? draft.speechBubbleType : draft.speechBubbleType === "none" ? "round" : draft.speechBubbleType,
          });
        }}
      />

      <OptionRow
        label="테두리"
        options={STICKER_BORDER_OPTIONS}
        value={draft.borderStyle}
        onChange={(borderStyle) => onChange({ ...draft, borderStyle })}
      />
      <OptionRow
        label="그림자"
        options={STICKER_SHADOW_OPTIONS}
        value={draft.shadowStyle}
        onChange={(shadowStyle) => onChange({ ...draft, shadowStyle })}
      />
      <OptionRow
        label="말풍선"
        options={STICKER_BUBBLE_OPTIONS}
        value={draft.speechBubbleType}
        onChange={(speechBubbleType) => onChange({ ...draft, speechBubbleType })}
      />
      <OptionRow
        label="프레임"
        options={STICKER_FRAME_OPTIONS}
        value={draft.frameType}
        onChange={(frameType) => onChange({ ...draft, frameType })}
      />

      <Text style={styles.label}>짧은 텍스트</Text>
      <TextInput
        style={styles.input}
        value={draft.text}
        onChangeText={(text) => onChange({ ...draft, text })}
        placeholder="스티커에 넣을 한마디"
        placeholderTextColor={colors.faint}
      />
      <View style={styles.phraseRow}>
        {STICKER_SUGGESTED_PHRASES.map((phrase) => (
          <Pressable
            key={phrase}
            style={[styles.phraseChip, draft.text === phrase && styles.phraseChipActive]}
            onPress={() => onChange({ ...draft, text: phrase })}
          >
            <Text style={styles.phraseText}>{phrase}</Text>
          </Pressable>
        ))}
      </View>

      <Pressable style={styles.primaryBtn} onPress={onNext}>
        <Text style={styles.primaryBtnText}>다음 · 이름 짓고 저장</Text>
      </Pressable>
    </ScrollView>
  );
}

function OptionRow<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.optionBlock}>
      <Text style={styles.label}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.optionRow}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={option.value}
              style={[styles.optionChip, selected && styles.optionChipActive]}
              onPress={() => onChange(option.value)}
            >
              <Text style={[styles.optionChipText, selected && styles.optionChipTextActive]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  embeddedRoot: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 40,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerBtnHit: {
    minWidth: Platform.OS === "android" ? 48 : 44,
    minHeight: Platform.OS === "android" ? 48 : 44,
    justifyContent: "center",
  },
  headerBtn: { fontSize: 15, fontWeight: "600", color: colors.muted },
  headerTitle: { fontSize: 16, fontWeight: "800", color: colors.text },
  headerSpacer: { minWidth: 48 },
  content: { paddingHorizontal: 18, paddingTop: 16 },
  centerBlock: { flex: 1, justifyContent: "center" },
  hint: { fontSize: 13, color: colors.muted, lineHeight: 19, marginBottom: 14 },
  mockNote: { marginTop: 10, fontSize: 11, color: colors.faint, textAlign: "center" },
  modeRow: { gap: 10, marginBottom: 12 },
  modeCard: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  modeCardActive: { borderColor: colors.amber, backgroundColor: colors.amberSoft },
  modeTitle: { fontSize: 14, fontWeight: "800", color: colors.text, marginBottom: 4 },
  modeTitleActive: { color: colors.amberText },
  modeHint: { fontSize: 12, color: colors.muted, lineHeight: 17 },
  errorTitle: { fontSize: 16, fontWeight: "800", color: colors.text, marginBottom: 8 },
  sectionTitle: { fontSize: 16, fontWeight: "800", color: colors.text, marginBottom: 10, marginTop: 8 },
  primaryBtn: {
    minHeight: Platform.OS === "android" ? 48 : 44,
    backgroundColor: colors.amber,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  primaryBtnText: { color: colors.amberDark, fontWeight: "800", fontSize: 14.5 },
  secondaryBtn: {
    minHeight: Platform.OS === "android" ? 48 : 44,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  secondaryBtnText: { color: colors.text, fontWeight: "700", fontSize: 14 },
  disabled: { opacity: 0.55 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  card: {
    width: "47%",
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 10,
    alignItems: "center",
  },
  cardStickerPreview: { paddingBottom: 16 },
  cardLabel: {
    marginTop: 8,
    minHeight: 17,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700",
    color: colors.text,
    textAlign: "center",
  },
  deleteBtn: {
    marginTop: 8,
    minWidth: Platform.OS === "android" ? 48 : 44,
    minHeight: Platform.OS === "android" ? 48 : 44,
    alignItems: "center",
    justifyContent: "center",
  },
  deleteLink: { fontSize: 11, lineHeight: 16, fontWeight: "700", color: colors.dangerText },
  pickHint: { marginTop: 6, fontSize: 11, fontWeight: "700", color: colors.amberText },
  phraseRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  phraseChip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  phraseChipActive: { borderColor: colors.amber, backgroundColor: colors.amberSoft },
  phraseText: { fontSize: 12, fontWeight: "700", color: colors.text },
  previewCenter: { alignItems: "center", marginBottom: 18 },
  repositionHint: { marginTop: 8, fontSize: 12, fontWeight: "700", color: colors.amberText },
  label: { fontSize: 13, fontWeight: "700", color: colors.text, marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
    marginBottom: 12,
  },
  optionBlock: { marginBottom: 12 },
  optionRow: { gap: 8, paddingRight: 8 },
  optionChip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  optionChipActive: { borderColor: colors.amber, backgroundColor: colors.amberSoft },
  optionChipText: { fontSize: 12, fontWeight: "700", color: colors.muted },
  optionChipTextActive: { color: colors.amberText },
});
