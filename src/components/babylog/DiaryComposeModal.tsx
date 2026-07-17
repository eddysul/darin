import { useEffect, useMemo, useState } from "react";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  DEFAULT_DIARY_MOOD,
  DEFAULT_DIARY_SKY,
  DIARY_GROWTH_MOMENTS,
  type DiaryComposeDraft,
  type DiaryMoodId,
  type DiarySkyId,
} from "../../constants/diaryCompose";
import { useBabyLog } from "../../context/BabyLogContext";
import type { DiaryEntry } from "../../types/babyLog";
import { formatDateKey } from "../../utils/dateKey";
import { entryToComposeDraft } from "../../utils/diaryToday";
import {
  appendMomentSuggestion,
  buildCareLogDailySummary,
  buildDiaryMomentSuggestions,
} from "../../utils/diaryMomentSuggestions";
import { DIARY_PHOTO_ONLY_COMMENT } from "../../utils/diaryModel";
import { buildTodaySummary, getLogsForDay } from "../../utils/reportAggregates";
import { colors, radius } from "../../theme";
import { BabyLogIcon } from "./BabyLogIcon";
import { DiaryMoodPicker, DiaryMoodStamp, DiarySkyPicker } from "./DiaryStamp";

type Props = {
  visible: boolean;
  fromPush?: boolean;
  editingEntry?: DiaryEntry | null;
  initialDraft?: DiaryComposeDraft | null;
  onClose: () => void;
  onSave: (draft: DiaryComposeDraft) => void;
  onDraftChange?: (draft: DiaryComposeDraft) => void;
  onDelete?: (id: string) => void;
};

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;

function formatTodayLabel(d = new Date()): string {
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEKDAYS[d.getDay()]})`;
}

export function DiaryComposeModal({
  visible,
  fromPush,
  editingEntry,
  initialDraft,
  onClose,
  onSave,
  onDraftChange,
  onDelete,
}: Props) {
  const insets = useSafeAreaInsets();
  const { logs, babyName } = useBabyLog();
  const isEdit = !!editingEntry;

  const [notes, setNotes] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [weather, setWeather] = useState<DiarySkyId | null>(DEFAULT_DIARY_SKY);
  const [mood, setMood] = useState<DiaryMoodId | null>(DEFAULT_DIARY_MOOD);
  const [milestoneTag, setMilestoneTag] = useState<string | null>(null);
  const [customMilestoneTag, setCustomMilestoneTag] = useState("");
  const [customMode, setCustomMode] = useState(false);
  const [inBook, setInBook] = useState(false);
  const [usedSuggestions, setUsedSuggestions] = useState<string[]>([]);
  const [dateLabel, setDateLabel] = useState(formatTodayLabel());
  const [frozenSnapshot, setFrozenSnapshot] = useState<string | undefined>();
  const [ready, setReady] = useState(false);

  const todayKey = formatDateKey();
  const todayLogs = useMemo(() => getLogsForDay(logs, todayKey, todayKey), [logs, todayKey]);
  const summary = useMemo(() => buildTodaySummary(logs), [logs]);
  const liveSummary = useMemo(
    () => buildCareLogDailySummary(summary, todayLogs),
    [summary, todayLogs],
  );
  const suggestions = useMemo(
    () => buildDiaryMomentSuggestions({ babyName, todayLogs, summary }),
    [babyName, todayLogs, summary],
  );

  /** Edit keeps frozen snapshot; create shows live Care Log summary */
  const displaySummary = isEdit ? frozenSnapshot || liveSummary : liveSummary;

  const resolvedCustom = customMode ? customMilestoneTag.trim() || null : null;
  const resolvedPreset = customMode ? null : milestoneTag;

  const canSave = notes.trim().length > 0 || photos.length > 0;

  const buildDraft = (): DiaryComposeDraft => ({
    comment: notes.trim() || (photos.length ? DIARY_PHOTO_ONLY_COMMENT : notes),
    photos,
    weatherStamp: weather,
    moodStamp: mood,
    milestoneTag: resolvedPreset,
    customMilestoneTag: resolvedCustom,
    includedInGrowthBook: inBook,
    careLogSummarySnapshot: isEdit ? frozenSnapshot || liveSummary : liveSummary,
    momentSuggestionsUsed: usedSuggestions,
  });

  useEffect(() => {
    if (!visible) {
      setReady(false);
      return;
    }
    if (editingEntry) {
      const d = entryToComposeDraft(editingEntry);
      setNotes(d.comment);
      setPhotos(d.photos);
      setWeather(d.weatherStamp);
      setMood(d.moodStamp);
      setMilestoneTag(d.milestoneTag);
      setCustomMilestoneTag(d.customMilestoneTag || "");
      setCustomMode(!!d.customMilestoneTag && !d.milestoneTag);
      setInBook(d.includedInGrowthBook);
      setUsedSuggestions(d.momentSuggestionsUsed);
      setDateLabel(editingEntry.date);
      setFrozenSnapshot(editingEntry.careLogSummarySnapshot || undefined);
    } else if (initialDraft) {
      setNotes(initialDraft.comment === DIARY_PHOTO_ONLY_COMMENT ? "" : initialDraft.comment);
      setPhotos(initialDraft.photos);
      setWeather(initialDraft.weatherStamp);
      setMood(initialDraft.moodStamp);
      setMilestoneTag(initialDraft.milestoneTag);
      setCustomMilestoneTag(initialDraft.customMilestoneTag || "");
      setCustomMode(!!initialDraft.customMilestoneTag && !initialDraft.milestoneTag);
      setInBook(initialDraft.includedInGrowthBook);
      setUsedSuggestions(initialDraft.momentSuggestionsUsed);
      setDateLabel(formatTodayLabel());
      setFrozenSnapshot(undefined);
    } else {
      setNotes("");
      setPhotos([]);
      setWeather(DEFAULT_DIARY_SKY);
      setMood(DEFAULT_DIARY_MOOD);
      setMilestoneTag(null);
      setCustomMilestoneTag("");
      setCustomMode(false);
      setInBook(false);
      setUsedSuggestions([]);
      setDateLabel(formatTodayLabel());
      setFrozenSnapshot(undefined);
    }
    setReady(true);
  }, [visible, editingEntry, initialDraft]);

  useEffect(() => {
    if (!visible || !ready || isEdit || !onDraftChange) return;
    const t = setTimeout(() => onDraftChange(buildDraft()), 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- buildDraft reads latest state
  }, [
    visible,
    ready,
    isEdit,
    onDraftChange,
    notes,
    photos,
    weather,
    mood,
    milestoneTag,
    customMilestoneTag,
    customMode,
    inBook,
    usedSuggestions,
    liveSummary,
  ]);

  const pickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
      allowsMultipleSelection: false,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotos([result.assets[0].uri]);
    }
  };

  const handleSave = () => {
    if (!canSave) return;
    const draft = buildDraft();
    draft.comment = notes.trim() || DIARY_PHOTO_ONLY_COMMENT;
    onSave(draft);
    onClose();
  };

  const handleClose = () => {
    if (!isEdit && onDraftChange) onDraftChange(buildDraft());
    onClose();
  };

  const handleDelete = () => {
    if (!editingEntry || !onDelete) return;
    Alert.alert("일기 삭제", "이 일기를 삭제할까요? 성장책에서도 함께 빠져요.", [
      { text: "취소", style: "cancel" },
      {
        text: "삭제",
        style: "destructive",
        onPress: () => {
          onDelete(editingEntry.id);
          onClose();
        },
      },
    ]);
  };

  const title = isEdit
    ? fromPush
      ? "오늘 일기 이어쓰기"
      : "일기 수정"
    : fromPush
      ? "알림에서 쓰기"
      : "새 일기 쓰기";

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <View style={[styles.root, { paddingTop: Math.max(insets.top, 12) }]}>
        <View style={styles.header}>
          <Pressable onPress={handleClose} hitSlop={10} style={styles.headerBtn}>
            <Text style={styles.headerBtnText}>닫기</Text>
          </Pressable>
          <Text style={styles.headerTitle}>{title}</Text>
          <Pressable
            onPress={handleSave}
            hitSlop={10}
            style={[styles.headerBtn, !canSave && styles.headerBtnDisabled]}
            disabled={!canSave}
          >
            <Text style={[styles.saveHeaderText, !canSave && styles.saveHeaderTextDisabled]}>저장</Text>
          </Pressable>
        </View>

        {fromPush ? (
          <View style={styles.fromPushBanner}>
            <BabyLogIcon kind="bell" size={14} color={colors.amber} />
            <Text style={styles.fromPushText}>알림에서 바로 열린 오늘 일기예요</Text>
          </View>
        ) : null}

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={8}
        >
          <ScrollView
            contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 28 }]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.dateLabel}>{dateLabel}</Text>

            <View style={styles.careCard}>
              <View style={styles.careTagRow}>
                <BabyLogIcon kind="sparkles" size={12} color={colors.amber} strokeWidth={2.2} />
                <Text style={styles.careTag}>오늘의 Care Log</Text>
              </View>
              <Text style={styles.careText}>{displaySummary}</Text>
              {isEdit && frozenSnapshot ? (
                <Text style={styles.snapshotNote}>저장 당시 요약 · Care Log가 바뀌어도 유지돼요</Text>
              ) : null}
              {!isEdit && summary.totalCount === 0 ? (
                <Text style={styles.snapshotNote}>기록이 없어도 일기는 남길 수 있어요</Text>
              ) : null}
            </View>

            {!isEdit || fromPush ? (
              <>
                <Text style={styles.sectionLabel}>오늘 기록 기반 제안</Text>
                <Text style={styles.sectionHint}>누르면 코멘트에 이어붙여요</Text>
                <View style={styles.suggestList}>
                  {suggestions.map((s) => (
                    <Pressable
                      key={s.id}
                      style={styles.suggestChip}
                      onPress={() => {
                        setNotes((prev) => appendMomentSuggestion(prev, s.text));
                        setUsedSuggestions((prev) =>
                          prev.includes(s.id) ? prev : [...prev, s.id],
                        );
                      }}
                    >
                      <Text style={styles.suggestChipText}>{s.text}</Text>
                    </Pressable>
                  ))}
                </View>
              </>
            ) : null}

            <Text style={styles.fieldLabel}>사진</Text>
            <Pressable style={styles.photoBox} onPress={() => void pickPhoto()}>
              {photos[0] ? (
                <>
                  <Image source={{ uri: photos[0] }} style={styles.photo} contentFit="cover" />
                  <Pressable style={styles.photoClear} onPress={() => setPhotos([])} hitSlop={8}>
                    <Text style={styles.photoClearText}>제거</Text>
                  </Pressable>
                </>
              ) : (
                <View style={styles.photoHintWrap}>
                  {mood ? <DiaryMoodStamp id={mood} selected size="lg" /> : null}
                  <Text style={styles.photoHint}>사진 추가하기</Text>
                  <Text style={styles.photoHintSub}>사진만 있어도 저장할 수 있어요</Text>
                </View>
              )}
            </Pressable>

            <Text style={styles.fieldLabel}>코멘트</Text>
            <TextInput
              style={styles.notes}
              value={notes}
              onChangeText={setNotes}
              multiline
              placeholder={`${babyName}와 있었던 일을 적어보세요`}
              placeholderTextColor={colors.faint}
            />

            <Text style={styles.fieldLabel}>오늘의 하늘</Text>
            <Text style={styles.sectionHint}>다시 누르면 선택을 해제할 수 있어요</Text>
            <DiarySkyPicker value={weather} onChange={setWeather} />

            <Text style={styles.fieldLabel}>오늘의 마음</Text>
            <DiaryMoodPicker value={mood} onChange={setMood} />

            <Text style={styles.fieldLabel}>성장 순간 태그</Text>
            <View style={styles.optionRow}>
              <Pressable
                style={[styles.tagChip, !customMode && milestoneTag === null && styles.tagChipActive]}
                onPress={() => {
                  setCustomMode(false);
                  setMilestoneTag(null);
                  setCustomMilestoneTag("");
                }}
              >
                <Text
                  style={[
                    styles.tagChipText,
                    !customMode && milestoneTag === null && styles.tagChipTextActive,
                  ]}
                >
                  없음
                </Text>
              </Pressable>
              {DIARY_GROWTH_MOMENTS.map((m) => {
                const active = !customMode && milestoneTag === m;
                return (
                  <Pressable
                    key={m}
                    style={[styles.tagChip, active && styles.tagChipActive]}
                    onPress={() => {
                      setCustomMode(false);
                      setCustomMilestoneTag("");
                      setMilestoneTag(active ? null : m);
                    }}
                  >
                    <Text style={[styles.tagChipText, active && styles.tagChipTextActive]}>🌱 {m}</Text>
                  </Pressable>
                );
              })}
              <Pressable
                style={[styles.tagChip, customMode && styles.tagChipActive]}
                onPress={() => {
                  setCustomMode(true);
                  setMilestoneTag(null);
                }}
              >
                <Text style={[styles.tagChipText, customMode && styles.tagChipTextActive]}>직접 입력</Text>
              </Pressable>
            </View>
            {customMode ? (
              <TextInput
                style={styles.customMoment}
                value={customMilestoneTag}
                onChangeText={setCustomMilestoneTag}
                placeholder="예: 처음으로 손을 뻗은 날"
                placeholderTextColor={colors.faint}
              />
            ) : null}

            <View style={styles.toggleRow}>
              <View style={styles.toggleCopy}>
                <Text style={styles.toggleTitle}>성장책에 담기</Text>
                <Text style={styles.toggleSub}>저장 후 성장책 보관함에서도 볼 수 있어요</Text>
              </View>
              <Switch
                value={inBook}
                onValueChange={setInBook}
                trackColor={{ false: colors.border, true: colors.amber }}
                thumbColor="#FFFFFF"
              />
            </View>

            <Pressable
              style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={!canSave}
            >
              <Text style={styles.saveBtnText}>{isEdit ? "수정 저장" : "일기 저장"}</Text>
            </Pressable>
            {!canSave ? (
              <Text style={styles.saveHint}>사진 또는 코멘트 중 하나는 필요해요</Text>
            ) : null}

            {isEdit && onDelete ? (
              <Pressable style={styles.deleteBtn} onPress={handleDelete}>
                <Text style={styles.deleteBtnText}>일기 삭제</Text>
              </Pressable>
            ) : null}
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerBtn: { minWidth: 48, paddingVertical: 6 },
  headerBtnDisabled: { opacity: 0.4 },
  headerBtnText: { fontSize: 15, fontWeight: "600", color: colors.muted },
  headerTitle: { fontSize: 16, fontWeight: "800", color: colors.text },
  saveHeaderText: { fontSize: 15, fontWeight: "800", color: colors.amber, textAlign: "right" },
  saveHeaderTextDisabled: { color: colors.faint },
  content: { paddingHorizontal: 18, paddingTop: 14 },
  fromPushBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginHorizontal: 18,
    marginTop: 10,
    backgroundColor: colors.amberSoft,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  fromPushText: { fontSize: 12, fontWeight: "700", color: colors.text, flex: 1 },
  dateLabel: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.text,
    marginBottom: 12,
  },
  careCard: {
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 14,
    marginBottom: 16,
  },
  careTagRow: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 8 },
  careTag: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.amber,
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  careText: { fontSize: 13.5, fontWeight: "600", color: colors.text, lineHeight: 21 },
  snapshotNote: { fontSize: 11, color: colors.faint, marginTop: 8 },
  sectionLabel: { fontSize: 13, fontWeight: "800", color: colors.text },
  sectionHint: { fontSize: 12, color: colors.faint, marginTop: 4, marginBottom: 10 },
  suggestList: { gap: 8, marginBottom: 4 },
  suggestChip: {
    backgroundColor: colors.amberSoft,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  suggestChipText: { fontSize: 13, fontWeight: "600", color: colors.text, lineHeight: 19 },
  fieldLabel: {
    fontSize: 12,
    color: colors.faint,
    fontWeight: "700",
    marginTop: 16,
    marginBottom: 8,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  photoBox: {
    height: 160,
    borderRadius: 14,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  photo: { width: "100%", height: "100%" },
  photoHintWrap: { alignItems: "center", gap: 6 },
  photoHint: { color: colors.muted, fontSize: 13, fontWeight: "700" },
  photoHintSub: { color: colors.faint, fontSize: 11.5 },
  photoClear: {
    position: "absolute",
    top: 10,
    right: 10,
    backgroundColor: "rgba(46,42,38,0.65)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  photoClearText: { color: "#fff", fontSize: 11.5, fontWeight: "700" },
  notes: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    color: colors.text,
    fontSize: 14,
    padding: 14,
    minHeight: 110,
    textAlignVertical: "top",
  },
  optionRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tagChip: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  tagChipActive: { borderColor: colors.amber, backgroundColor: colors.amberSoft },
  tagChipText: { fontSize: 12, fontWeight: "700", color: colors.muted },
  tagChipTextActive: { color: colors.text },
  customMoment: {
    marginTop: 10,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    color: colors.text,
    fontSize: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  toggleRow: {
    marginTop: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  toggleCopy: { flex: 1 },
  toggleTitle: { fontSize: 14, fontWeight: "800", color: colors.text },
  toggleSub: { fontSize: 11.5, color: colors.faint, marginTop: 3 },
  saveBtn: {
    marginTop: 18,
    backgroundColor: colors.amber,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
  },
  saveBtnDisabled: { opacity: 0.45 },
  saveBtnText: { color: colors.amberDark, fontWeight: "800", fontSize: 15 },
  saveHint: {
    textAlign: "center",
    color: colors.faint,
    fontSize: 12,
    marginTop: 8,
  },
  deleteBtn: { marginTop: 14, paddingVertical: 12, alignItems: "center" },
  deleteBtnText: { fontSize: 13, fontWeight: "700", color: colors.dangerText },
});
