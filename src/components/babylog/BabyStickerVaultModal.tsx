import { useEffect, useMemo, useState } from "react";
import * as ImagePicker from "expo-image-picker";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { BabySticker, BabyStickerDraft } from "../../types/babySticker";
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
import { removeBackground } from "../../utils/babyStickerCutout";
import { createId } from "../../utils/id";
import { colors, radius } from "../../theme";
import { EmptyState } from "../states/FeedbackStates";
import { BabyStickerFromModel, BabyStickerView } from "./BabyStickerView";

type Mode = "vault" | "pickPhoto" | "cutting" | "decorate" | "save";

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
  onSaveSticker: (sticker: BabySticker) => void;
  onDeleteSticker: (id: string) => void;
  onPickSticker?: (sticker: BabySticker) => void;
};

export function BabyStickerVaultModal({
  visible,
  babyId = "baby-1",
  babyName,
  stickers,
  createdBy,
  pickMode = false,
  embedded = false,
  onClose,
  onSaveSticker,
  onDeleteSticker,
  onPickSticker,
}: Props) {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<Mode>("vault");
  const [draft, setDraft] = useState<BabyStickerDraft | null>(null);
  const [cutoutError, setCutoutError] = useState(false);
  const [pendingOriginal, setPendingOriginal] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [seedPhrase, setSeedPhrase] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
      setMode("vault");
      setDraft(null);
      setCutoutError(false);
      setPendingOriginal(null);
      setSaving(false);
      setSeedPhrase(null);
    }
  }, [visible]);

  const title =
    mode === "vault"
      ? pickMode
        ? "스티커 선택"
        : "내 아기 스티커"
      : mode === "pickPhoto"
        ? "사진 선택"
        : mode === "cutting"
          ? "배경 제거"
          : mode === "decorate"
            ? "스티커 꾸미기"
            : "스티커 저장";

  const startCreate = (phrase?: string) => {
    setDraft(null);
    setCutoutError(false);
    setPendingOriginal(null);
    setSeedPhrase(phrase ?? null);
    setMode("pickPhoto");
  };

  const runCutout = async (originalUri: string) => {
    setPendingOriginal(originalUri);
    setMode("cutting");
    setCutoutError(false);
    try {
      const result = await removeBackground(originalUri);
      const next = defaultStickerDraft(originalUri, result.uri);
      if (seedPhrase) {
        next.text = seedPhrase;
        next.label = seedPhrase;
      }
      setDraft(next);
      setMode("decorate");
    } catch {
      setCutoutError(true);
    }
  };

  const pickFromLibrary = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.85,
      allowsMultipleSelection: false,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;
    await runCutout(result.assets[0].uri);
  };

  const pickFromCamera = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("카메라 권한", "카메라 권한이 필요해요.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.85,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;
    await runCutout(result.assets[0].uri);
  };

  const persistAndSave = async () => {
    if (!draft) return;
    const label = draft.label.trim() || `${babyName} 스티커`;
    setSaving(true);
    try {
      const id = createId();
      const originalImageUri = await persistStickerAsset(draft.originalImageUri, babyId, "original", id);
      const cutoutImageUri = await persistStickerAsset(draft.cutoutImageUri, babyId, "cutout", id);
      // Decorations are metadata-rendered; final asset stores the cutout base for PDF/reuse.
      const finalStickerImageUri = await persistStickerAsset(cutoutImageUri, babyId, "final", id);
      const now = new Date().toISOString();
      const sticker: BabySticker = {
        id,
        babyId,
        originalImageUri,
        faceImageUri: cutoutImageUri,
        cutoutImageUri,
        finalStickerImageUri,
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
      onSaveSticker(sticker);
      setMode("vault");
      setDraft(null);
      if (pickMode) onPickSticker?.(sticker);
    } finally {
      setSaving(false);
    }
  };

  if (!visible) return null;

  const body = (
      <View style={[styles.root, embedded && styles.embeddedRoot, { paddingTop: Math.max(insets.top, 12) }]}>
        <View style={styles.header}>
          <Pressable
            onPress={() => {
              if (mode === "vault") onClose();
              else setMode("vault");
            }}
            hitSlop={10}
          >
            <Text style={styles.headerBtn}>{mode === "vault" ? "닫기" : "뒤로"}</Text>
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
            <Text style={styles.hint}>아기 얼굴이 잘 보이는 사진을 골라 주세요. 얼굴은 둥근 crop으로 안전하게 표시됩니다.</Text>
            <Pressable style={styles.primaryBtn} onPress={() => void pickFromLibrary()}>
              <Text style={styles.primaryBtnText}>갤러리에서 선택</Text>
            </Pressable>
            <Pressable style={styles.secondaryBtn} onPress={() => void pickFromCamera()}>
              <Text style={styles.secondaryBtnText}>카메라로 촬영</Text>
            </Pressable>
          </ScrollView>
        ) : null}

        {mode === "cutting" ? (
          <View style={[styles.content, styles.centerBlock, { paddingBottom: insets.bottom + 28 }]}>
            {cutoutError ? (
              <>
                <Text style={styles.errorTitle}>배경 제거에 실패했어요.</Text>
                <Text style={styles.hint}>다시 시도하거나 원본 사진의 얼굴을 둥글게 crop하는 fallback으로 계속할 수 있어요.</Text>
                <Pressable
                  style={styles.primaryBtn}
                  onPress={() => pendingOriginal && void runCutout(pendingOriginal)}
                >
                  <Text style={styles.primaryBtnText}>다시 시도</Text>
                </Pressable>
                <Pressable
                  style={styles.secondaryBtn}
                  onPress={() => {
                    if (!pendingOriginal) return;
                    const next = defaultStickerDraft(pendingOriginal, pendingOriginal);
                    if (seedPhrase) {
                      next.text = seedPhrase;
                      next.label = seedPhrase;
                    }
                    setDraft(next);
                    setMode("decorate");
                  }}
                >
                  <Text style={styles.secondaryBtnText}>둥근 얼굴 crop으로 계속</Text>
                </Pressable>
              </>
            ) : (
              <>
                <ActivityIndicator color={colors.amber} size="large" />
                <Text style={[styles.hint, { marginTop: 16, textAlign: "center" }]}>
                  배경을 지우는 중이에요...
                </Text>
                <Text style={styles.mockNote}>개발용 mock 누끼 · 이후 서버 프록시로 교체 가능</Text>
              </>
            )}
          </View>
        ) : null}

        {mode === "decorate" && draft ? (
          <DecorateStep
            draft={draft}
            bottomPad={insets.bottom}
            onChange={setDraft}
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
              <BabyStickerFromModel sticker={sticker} size={88} />
              <Text style={styles.cardLabel} numberOfLines={2}>
                {sticker.label}
              </Text>
              {!pickMode ? (
                <Pressable onPress={() => onDelete(sticker)} hitSlop={8}>
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
  onNext,
}: {
  draft: BabyStickerDraft;
  bottomPad: number;
  onChange: (next: BabyStickerDraft) => void;
  onNext: () => void;
}) {
  return (
    <ScrollView
      contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 28 }]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.previewCenter}>
        <BabyStickerView
          imageUri={draft.cutoutImageUri || draft.originalImageUri}
          borderStyle={draft.borderStyle}
          shadowStyle={draft.shadowStyle}
          speechBubbleType={draft.speechBubbleType}
          frameType={draft.frameType}
          templateId={draft.templateId}
          text={draft.text}
          size={150}
        />
      </View>

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
  headerBtn: { fontSize: 15, fontWeight: "600", color: colors.muted, minWidth: 48 },
  headerTitle: { fontSize: 16, fontWeight: "800", color: colors.text },
  headerSpacer: { minWidth: 48 },
  content: { paddingHorizontal: 18, paddingTop: 16 },
  centerBlock: { flex: 1, justifyContent: "center" },
  hint: { fontSize: 13, color: colors.muted, lineHeight: 19, marginBottom: 14 },
  mockNote: { marginTop: 10, fontSize: 11, color: colors.faint, textAlign: "center" },
  errorTitle: { fontSize: 16, fontWeight: "800", color: colors.text, marginBottom: 8 },
  sectionTitle: { fontSize: 16, fontWeight: "800", color: colors.text, marginBottom: 10, marginTop: 8 },
  primaryBtn: {
    backgroundColor: colors.amber,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 10,
  },
  primaryBtnText: { color: colors.amberDark, fontWeight: "800", fontSize: 14.5 },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: "center",
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
  cardLabel: { marginTop: 8, fontSize: 12, fontWeight: "700", color: colors.text, textAlign: "center" },
  deleteLink: { marginTop: 6, fontSize: 11, fontWeight: "700", color: colors.dangerText },
  pickHint: { marginTop: 6, fontSize: 11, fontWeight: "700", color: colors.amber },
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
  optionChipTextActive: { color: colors.amber },
});
