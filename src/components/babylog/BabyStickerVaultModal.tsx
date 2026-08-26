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
import type { BabySticker, BabyStickerDraft, StickerBorderStyle, StickerCutoutMode, StickerShadowStyle, StickerSpeechBubbleType, StickerTemplateId } from "../../types/babySticker";
import {
  STICKER_BORDER_OPTIONS,
  STICKER_BUBBLE_OPTIONS,
  STICKER_SHADOW_OPTIONS,
  STICKER_TEMPLATE_OPTIONS,
  defaultStickerDraft,
} from "../../types/babySticker";
import { persistStickerAsset, deleteStickerAssets } from "../../utils/babyStickerAssets";
import {
  DEFAULT_CIRCLE_CROP,
  STICKER_CUTOUT_MODE_OPTIONS,
  createStickerCutout,
  stickerCutoutErrorKey,
  isPersonCutoutSupported,
  type CircularCutoutCrop,
} from "../../utils/babyStickerCutout";
import { createId } from "../../utils/id";
import { colors, radius } from "../../theme";
import { EmptyState } from "../states/FeedbackStates";
import { BabyLogIcon } from "./BabyLogIcon";
import { BabyStickerFromModel, BabyStickerView } from "./BabyStickerView";
import { StickerCirclePositioner } from "./StickerCirclePositioner";
import { useBabyLog } from "../../context/BabyLogContext";
import { useLanguage } from "../../LanguageContext";
import { createT } from "../../i18n";
import type { StickerCriticalKey } from "../../i18nStickerCriticalMessages";

type Translate = ReturnType<typeof createT>;

const TEMPLATE_COPY: Record<StickerTemplateId, StickerCriticalKey> = {
  portrait: "sticker.critical.077",
  hello: "sticker.critical.078",
  huh: "sticker.critical.079",
  wow: "sticker.critical.080",
  yummy: "sticker.critical.081",
  sleepy: "sticker.critical.082",
  cry: "sticker.critical.083",
  daze: "sticker.critical.084",
  heart: "sticker.critical.085",
  giggle: "sticker.critical.086",
  like: "sticker.critical.087",
  pout: "sticker.critical.088",
  squeal: "sticker.critical.089",
  why: "sticker.critical.090",
  oops: "sticker.critical.091",
  bite: "sticker.critical.092",
  cute: "sticker.critical.093",
};

const SUGGESTED_PHRASE_KEYS: StickerCriticalKey[] = [
  "sticker.critical.078",
  "sticker.critical.079",
  "sticker.critical.080",
  "sticker.critical.081",
  "sticker.critical.082",
  "sticker.critical.083",
  "sticker.critical.084",
  "sticker.critical.085",
  "sticker.critical.086",
  "sticker.critical.087",
  "sticker.critical.088",
  "sticker.critical.089",
  "sticker.critical.090",
  "sticker.critical.091",
  "sticker.critical.092",
  "sticker.critical.093",
];

function borderCopy(value: StickerBorderStyle): StickerCriticalKey {
  return value === "whiteThick" ? "sticker.critical.073" : "sticker.critical.072";
}

function shadowCopy(value: StickerShadowStyle): StickerCriticalKey {
  return value === "soft" ? "sticker.critical.074" : "sticker.critical.072";
}

function bubbleCopy(value: StickerSpeechBubbleType): StickerCriticalKey {
  return value === "round" ? "sticker.critical.076" : "sticker.critical.075";
}

type Mode = "vault" | "pickPhoto" | "position" | "cutting" | "decorate";

function isLibraryAllowed(
  status: Awaited<ReturnType<typeof ImagePicker.getMediaLibraryPermissionsAsync>>,
): boolean {
  return status.granted || status.accessPrivileges === "limited";
}

async function ensureLibraryPermission(t: Translate): Promise<boolean> {
  const current = await ImagePicker.getMediaLibraryPermissionsAsync();
  const resolved = isLibraryAllowed(current)
    ? current
    : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (isLibraryAllowed(resolved)) return true;
  Alert.alert(
    t("sticker.critical.025"),
    t("sticker.critical.026"),
    [
      { text: t("sticker.critical.010"), style: "cancel" },
      { text: t("sticker.critical.029"), onPress: () => void Linking.openSettings() },
    ],
  );
  return false;
}

async function ensureCameraPermission(t: Translate): Promise<boolean> {
  const current = await ImagePicker.getCameraPermissionsAsync();
  const resolved = current.granted ? current : await ImagePicker.requestCameraPermissionsAsync();
  if (resolved.granted) return true;
  Alert.alert(
    t("sticker.critical.027"),
    t("sticker.critical.028"),
    [
      { text: t("sticker.critical.010"), style: "cancel" },
      { text: t("sticker.critical.029"), onPress: () => void Linking.openSettings() },
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
  const { t } = useLanguage();
  const { localDataScope } = useBabyLog();
  const resolvedBabyId = babyId || localDataScope?.babyId;
  const [mode, setMode] = useState<Mode>("vault");
  const [draft, setDraft] = useState<BabyStickerDraft | null>(null);
  const [cutoutError, setCutoutError] = useState(false);
  const [cutoutErrorReason, setCutoutErrorReason] = useState<StickerCriticalKey | null>(null);
  const [pendingOriginal, setPendingOriginal] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [seedPhrase, setSeedPhrase] = useState<string | null>(null);
  const [cutoutMode, setCutoutMode] = useState<StickerCutoutMode>("roundedRect");
  const [circleCrop, setCircleCrop] = useState<CircularCutoutCrop>(DEFAULT_CIRCLE_CROP);
  const personCutoutSupported = isPersonCutoutSupported();
  const usesInAppPositioner = cutoutMode === "roundedRect" && Platform.OS === "ios";

  useEffect(() => {
    if (!visible) {
      setMode("vault");
      setDraft(null);
      setCutoutError(false);
      setCutoutErrorReason(null);
      setPendingOriginal(null);
      setSaving(false);
      setSeedPhrase(null);
      setCutoutMode("roundedRect");
      setCircleCrop(DEFAULT_CIRCLE_CROP);
      return;
    }
    if (startInCreate) {
      setDraft(null);
      setCutoutError(false);
      setCutoutErrorReason(null);
      setPendingOriginal(null);
      setSeedPhrase(null);
      setCutoutMode("roundedRect");
      setCircleCrop(DEFAULT_CIRCLE_CROP);
      setMode("pickPhoto");
    }
  }, [visible, startInCreate]);

  const title =
    mode === "vault"
      ? pickMode
        ? t("sticker.critical.002")
        : t("sticker.critical.001")
      : mode === "pickPhoto"
        ? t("sticker.critical.003")
        : mode === "position"
          ? t("sticker.critical.004")
          : mode === "cutting"
            ? cutoutMode === "personCutout"
              ? t("sticker.critical.005")
              : t("sticker.critical.006")
              : t("sticker.critical.007");

  const startCreate = (phrase?: string) => {
    setDraft(null);
    setCutoutError(false);
    setCutoutErrorReason(null);
    setPendingOriginal(null);
    setSeedPhrase(phrase ?? null);
    setCutoutMode("roundedRect");
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
        next.speechBubbleType = "round";
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
    setCutoutErrorReason(null);
    try {
      const result = await createStickerCutout(originalUri, preferredMode, crop);
      applyDraftFromCutout(originalUri, result.uri, result.mode);
    } catch (error) {
      if (__DEV__) console.warn("[sticker-cutout]", error);
      setCutoutErrorReason(stickerCutoutErrorKey(error));
      setCutoutError(true);
    }
  };

  const openPositioner = (originalUri: string, resetCrop: boolean) => {
    setPendingOriginal(originalUri);
    if (resetCrop) setCircleCrop(DEFAULT_CIRCLE_CROP);
    setMode("position");
  };

  const continueAsRoundedRect = () => {
    if (!pendingOriginal) return;
    setCutoutMode("roundedRect");
    openPositioner(pendingOriginal, false);
  };

  const pickerExtras =
    cutoutMode === "roundedRect" && Platform.OS !== "ios"
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
      Alert.alert(t("sticker.critical.013"), t("sticker.critical.014"));
      return null;
    }
    try {
      return await persistStickerAsset(sourceUri, resolvedBabyId, "original", createId());
    } catch {
      Alert.alert(
        t("sticker.critical.015"),
        t("sticker.critical.016"),
      );
      return null;
    }
  };

  const pickFromLibrary = async () => {
    try {
      if (!(await ensureLibraryPermission(t))) return;
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
        t("sticker.critical.015"),
        t("sticker.critical.017"),
      );
    }
  };

  const pickFromCamera = async () => {
    try {
      if (!(await ensureCameraPermission(t))) return;
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
      Alert.alert(t("sticker.critical.018"), t("sticker.critical.019"));
    }
  };

  const persistAndSave = async () => {
    if (!draft) return;
    if (!resolvedBabyId) {
      Alert.alert(t("sticker.critical.013"), t("sticker.critical.014"));
      return;
    }
    const label = draft.label.trim() || t("sticker.critical.020", { babyName });
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
          t("sticker.critical.021"),
          t("sticker.critical.022"),
        );
      }
      setMode("vault");
      setDraft(null);
      if (pickMode && synced) onPickSticker?.(sticker);
    } catch {
      Alert.alert(t("sticker.critical.023"), t("sticker.critical.024"));
    } finally {
      setSaving(false);
    }
  };

  const goBack = () => {
    if (mode === "vault") {
      onClose();
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
      if (draft?.cutoutMode === "roundedRect" && pendingOriginal) {
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

  const cancelCreate = () => {
    void deleteStickerAssets([
      pendingOriginal,
      draft?.originalImageUri,
      draft?.faceImageUri,
      draft?.cutoutImageUri,
    ]);
    setDraft(null);
    setPendingOriginal(null);
    setSeedPhrase(null);
    setCircleCrop(DEFAULT_CIRCLE_CROP);
    if (startInCreate) onClose();
    else setMode("vault");
  };

  if (!visible) return null;

  const body = (
      <View style={[styles.root, embedded && styles.embeddedRoot, { paddingTop: embedded ? 8 : Math.max(insets.top, 12) }]}>
        <View style={styles.header}>
          <Pressable
            onPress={goBack}
            hitSlop={10}
            style={styles.headerBtnHit}
            accessibilityRole="button"
            accessibilityLabel={mode === "vault" || (mode === "pickPhoto" && startInCreate) ? t("sticker.critical.008") : t("sticker.critical.009")}
          >
            <Text style={styles.headerBtn}>{mode === "vault" || (mode === "pickPhoto" && startInCreate) ? t("sticker.critical.008") : t("sticker.critical.009")}</Text>
          </Pressable>
          <Text style={styles.headerTitle}>{title}</Text>
          {mode === "position" || mode === "decorate" ? (
            <Pressable
              onPress={cancelCreate}
              disabled={saving}
              hitSlop={10}
              style={[styles.headerBtnHit, styles.headerCancelHit, saving && styles.headerBtnDisabled]}
              accessibilityRole="button"
              accessibilityLabel={t("sticker.critical.011")}
              accessibilityHint={t("sticker.critical.012")}
              accessibilityState={{ disabled: saving }}
            >
              <Text style={[styles.headerBtn, styles.headerCancelText]}>{t("sticker.critical.010")}</Text>
            </Pressable>
          ) : (
            <View style={styles.headerSpacer} />
          )}
        </View>

        {mode === "vault" ? (
          <VaultHome
            stickers={stickers}
            pickMode={pickMode}
            bottomPad={insets.bottom}
            onCreate={startCreate}
            onPick={(sticker) => onPickSticker?.(sticker)}
            onDelete={(sticker) => {
              Alert.alert(t("sticker.critical.030"), t("sticker.critical.031", { label: sticker.label }), [
                { text: t("sticker.critical.010"), style: "cancel" },
                {
                  text: t("sticker.critical.032"),
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
            <Text style={styles.label}>{t("sticker.critical.033")}</Text>
            <View style={styles.modeRow}>
              {STICKER_CUTOUT_MODE_OPTIONS.map((option) => {
                  const locked = Boolean(option.iosOnly && Platform.OS !== "ios");
                  const selected = cutoutMode === option.value;
                  const label = option.value === "personCutout" ? t("sticker.critical.005") : t("sticker.critical.102");
                  const hint = option.value === "personCutout" ? t("sticker.critical.104") : t("sticker.critical.103");
                  return (
                    <Pressable
                      key={option.value}
                      style={[styles.modeCard, selected && styles.modeCardActive, locked && styles.modeCardLocked]}
                      onPress={() => {
                        if (locked) return;
                        setCutoutMode(option.value);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={label}
                      accessibilityHint={locked ? t("sticker.critical.034") : hint}
                      accessibilityState={{ selected, disabled: locked }}
                    >
                      <Text style={[styles.modeTitle, selected && styles.modeTitleActive]}>{label}</Text>
                      <Text style={styles.modeHint}>
                        {locked ? t("sticker.critical.035") : hint}
                      </Text>
                    </Pressable>
                  );
                })}
            </View>
            {cutoutMode === "personCutout" ? (
              <Text style={styles.hint}>
                {personCutoutSupported
                  ? t("sticker.critical.036")
                  : t("sticker.critical.037")}
              </Text>
            ) : (
              <Text style={styles.hint}>{t("sticker.critical.038")}</Text>
            )}
            <Pressable
              style={styles.primaryBtn}
              onPress={() => void pickFromLibrary()}
              accessibilityRole="button"
              accessibilityLabel={t("sticker.critical.039")}
            >
              <Text style={styles.primaryBtnText}>{t("sticker.critical.039")}</Text>
            </Pressable>
            <Pressable
              style={styles.secondaryBtn}
              onPress={() => void pickFromCamera()}
              accessibilityRole="button"
              accessibilityLabel={t("sticker.critical.040")}
            >
              <Text style={styles.secondaryBtnText}>{t("sticker.critical.040")}</Text>
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
              void runCutout(pendingOriginal, "roundedRect", crop);
            }}
          />
        ) : null}

        {mode === "cutting" ? (
          <View style={[styles.content, styles.centerBlock, { paddingBottom: insets.bottom + 28 }]}>
            {cutoutError ? (
              <>
                <Text style={styles.errorTitle}>{t("sticker.critical.041")}</Text>
                <Text style={styles.hint}>
                  {t(cutoutErrorReason ?? "sticker.critical.042")}
                </Text>
                <Pressable
                  style={styles.primaryBtn}
                  onPress={() => pendingOriginal && void runCutout(pendingOriginal, cutoutMode)}
                >
                  <Text style={styles.primaryBtnText}>{t("sticker.critical.043")}</Text>
                </Pressable>
                <Pressable style={styles.secondaryBtn} onPress={continueAsRoundedRect}>
                  <Text style={styles.secondaryBtnText}>{t("sticker.critical.044")}</Text>
                </Pressable>
              </>
            ) : (
              <>
                <ActivityIndicator color={colors.amberText} size="large" />
                <Text style={[styles.hint, { marginTop: 16, textAlign: "center" }]}>
                  {cutoutMode === "personCutout"
                    ? t("sticker.critical.045")
                    : t("sticker.critical.046")}
                </Text>
                <Text style={styles.mockNote}>{t("sticker.critical.047")}</Text>
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
              draft.cutoutMode === "roundedRect" && pendingOriginal && Platform.OS === "ios"
                ? () => setMode("position")
                : undefined
            }
            babyName={babyName}
            saving={saving}
            onSave={() => void persistAndSave()}
          />
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
  const { t } = useLanguage();
  const [preview, setPreview] = useState<BabySticker | null>(null);
  const sorted = useMemo(
    () => [...stickers].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [stickers],
  );

  return (
    <View style={{ flex: 1 }}>
    <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 28 }]}>
      {sorted.length === 0 ? (
        <EmptyState
          title={t("sticker.critical.048")}
          body={pickMode ? t("sticker.critical.049") : t("sticker.critical.050")}
          ctaLabel={t("sticker.critical.051")}
          onPressCta={onCreate}
        />
      ) : (
        <>
      <Pressable
        style={styles.primaryBtn}
        onPress={onCreate}
        accessibilityRole="button"
        accessibilityLabel={t("sticker.critical.052")}
      >
        <BabyLogIcon kind="new" size={18} color={colors.amberDark} strokeWidth={2.2} />
        <Text style={styles.primaryBtnText}>{t("sticker.critical.052")}</Text>
      </Pressable>
      <Text style={styles.sectionTitle}>{t("sticker.critical.053")}</Text>
        <View style={styles.grid}>
          {sorted.map((sticker) => (
            <Pressable
              key={sticker.id}
              style={styles.card}
              onPress={() => (pickMode ? onPick(sticker) : setPreview(sticker))}
              onLongPress={() => onDelete(sticker)}
              accessibilityRole="button"
              accessibilityLabel={pickMode ? t("sticker.critical.054", { label: sticker.label }) : t("sticker.critical.055", { label: sticker.label })}
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
                  accessibilityLabel={t("sticker.critical.056", { label: sticker.label })}
                >
                  <Text style={styles.deleteLink}>{t("sticker.critical.032")}</Text>
                </Pressable>
              ) : (
                <Text style={styles.pickHint}>{t("sticker.critical.057")}</Text>
              )}
            </Pressable>
          ))}
        </View>
        </>
      )}

      {!pickMode ? (
        <>
          <Text style={[styles.sectionTitle, { marginTop: 18 }]}>{t("sticker.critical.058")}</Text>
          <View style={styles.phraseRow}>
            {SUGGESTED_PHRASE_KEYS.slice(0, 4).map((key) => (
              <Pressable key={key} style={styles.phraseChip} onPress={() => onApplyPhrase(t(key))}>
                <Text style={styles.phraseText}>{t(key)}</Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : null}
    </ScrollView>
      {preview ? (
        <View style={styles.previewOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setPreview(null)} />
          <View style={styles.previewSheet}>
            <Text style={styles.sectionTitle}>{preview.label}</Text>
            <View style={styles.previewCenter}>
              <BabyStickerFromModel sticker={preview} size={168} />
            </View>
            <Pressable style={styles.primaryBtn} onPress={() => setPreview(null)}>
              <Text style={styles.primaryBtnText}>{t("sticker.critical.008")}</Text>
            </Pressable>
            <Pressable
              style={styles.secondaryBtn}
              onPress={() => {
                const target = preview;
                setPreview(null);
                onDelete(target);
              }}
            >
              <Text style={[styles.secondaryBtnText, styles.deleteLink]}>{t("sticker.critical.032")}</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

function DecorateStep({
  draft,
  bottomPad,
  onChange,
  onReposition,
  babyName,
  saving,
  onSave,
}: {
  draft: BabyStickerDraft;
  bottomPad: number;
  onChange: (next: BabyStickerDraft) => void;
  onReposition?: () => void;
  babyName: string;
  saving: boolean;
  onSave: () => void;
}) {
  const { t } = useLanguage();
  return (
    <ScrollView
      contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 28 }]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.decoratePreview}>
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
        {onReposition ? (
          <Pressable
            style={styles.repositionBtn}
            onPress={onReposition}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={t("sticker.critical.059")}
            accessibilityHint={t("sticker.critical.060")}
          >
            <BabyLogIcon kind="edit" size={13} color={colors.muted} />
            <Text style={styles.repositionBtnText}>{t("sticker.critical.059")}</Text>
          </Pressable>
        ) : null}
      </View>

      <Text style={styles.hint}>{t("sticker.critical.061")}</Text>
      <OptionRow
        label={t("sticker.critical.062")}
        options={STICKER_TEMPLATE_OPTIONS.map((item) => ({ value: item.value, label: t(TEMPLATE_COPY[item.value]) }))}
        value={draft.templateId}
        onChange={(templateId) => {
          const option = STICKER_TEMPLATE_OPTIONS.find((item) => item.value === templateId);
          onChange({
            ...draft,
            stickerType: templateId === "portrait" ? "faceCrop" : "faceTemplate",
            templateId,
            text: templateId === "portrait" ? "" : t(TEMPLATE_COPY[templateId]),
            speechBubbleType: option?.speechBubbleType ?? "none",
          });
        }}
      />

      <OptionRow
        label={t("sticker.critical.063")}
        options={STICKER_BORDER_OPTIONS.map((item) => ({ value: item.value, label: t(borderCopy(item.value)) }))}
        value={draft.borderStyle}
        onChange={(borderStyle) => onChange({ ...draft, borderStyle })}
      />
      <OptionRow
        label={t("sticker.critical.064")}
        options={STICKER_SHADOW_OPTIONS.map((item) => ({ value: item.value, label: t(shadowCopy(item.value)) }))}
        value={draft.shadowStyle}
        onChange={(shadowStyle) => onChange({ ...draft, shadowStyle })}
      />
      <OptionRow
        label={t("sticker.critical.065")}
        options={STICKER_BUBBLE_OPTIONS.map((item) => ({ value: item.value, label: t(bubbleCopy(item.value)) }))}
        value={draft.speechBubbleType}
        onChange={(speechBubbleType) => onChange({ ...draft, speechBubbleType })}
      />

      <Text style={styles.label}>{t("sticker.critical.066")}</Text>
      <TextInput
        style={styles.input}
        value={draft.text}
        onChangeText={(text) => onChange({ ...draft, text })}
        placeholder={t("sticker.critical.067")}
        placeholderTextColor={colors.faint}
      />
      <View style={styles.phraseRow}>
        {SUGGESTED_PHRASE_KEYS.map((key) => {
          const phrase = t(key);
          return (
          <Pressable
            key={key}
            style={[styles.phraseChip, draft.text === phrase && styles.phraseChipActive]}
            onPress={() => onChange({ ...draft, text: phrase, speechBubbleType: "round" })}
          >
            <Text style={styles.phraseText}>{phrase}</Text>
          </Pressable>
          );
        })}
      </View>

      <Text style={styles.label}>{t("sticker.critical.068")}</Text>
      <TextInput
        style={styles.input}
        value={draft.label}
        onChangeText={(label) => onChange({ ...draft, label })}
        placeholder={t("sticker.critical.069", { babyName })}
        placeholderTextColor={colors.faint}
      />

      <Pressable style={[styles.primaryBtn, saving && styles.disabled]} disabled={saving} onPress={onSave}>
        <Text style={styles.primaryBtnText}>{saving ? t("sticker.critical.070") : t("sticker.critical.071")}</Text>
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
  headerCancelHit: { alignItems: "flex-end" },
  headerCancelText: { color: colors.amberText, fontWeight: "700" },
  headerBtnDisabled: { opacity: 0.45 },
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
  modeCardLocked: { opacity: 0.55 },
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
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
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
    paddingHorizontal: 12,
    paddingTop: 16,
    paddingBottom: 12,
    alignItems: "center",
  },
  cardStickerPreview: { minHeight: 118, paddingTop: 8, paddingBottom: 22, alignItems: "center", justifyContent: "center" },
  previewOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
    justifyContent: "flex-end",
    backgroundColor: "rgba(46,42,38,0.38)",
  },
  previewSheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 22,
  },
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
  previewCenter: { alignItems: "center", marginBottom: 18, paddingTop: 12, paddingBottom: 16 },
  decoratePreview: { alignItems: "center", marginBottom: 18, paddingTop: 38, paddingRight: 8 },
  repositionBtn: {
    minHeight: 36,
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 4,
  },
  repositionBtnText: { fontSize: 12, fontWeight: "600", color: colors.muted },
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
