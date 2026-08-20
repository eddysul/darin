import { useEffect, useMemo, useRef, useState } from "react";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import {
  Alert,
  ActivityIndicator,
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
import {
  createUploadSessionId,
  discardSession,
  enqueuePickedPhotos,
  findJobByLocalUri,
  listEagerPhotos,
  removeEagerPhoto,
  retryEagerPhoto,
  subscribeEagerSession,
  type EagerPhoto,
} from "../../utils/eagerMediaUpload";
import type { DiaryEntry } from "../../types/babyLog";
import { formatDateKey } from "../../utils/dateKey";
import { formatDiaryStageLabel, formatDottedDate } from "../../utils/childDisplay";
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
import { BabyStickerFromModel } from "./BabyStickerView";
import { BabyStickerVaultModal } from "./BabyStickerVaultModal";

type Props = {
  visible: boolean;
  fromPush?: boolean;
  readOnly?: boolean;
  editingEntry?: DiaryEntry | null;
  initialDraft?: DiaryComposeDraft | null;
  onClose: () => void;
  onSave: (draft: DiaryComposeDraft) => void;
  onDraftChange?: (draft: DiaryComposeDraft) => void;
  onDelete?: (id: string) => void;
};

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;
const MAX_DIARY_PHOTOS = 5;

function formatTodayLabel(d = new Date()): string {
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEKDAYS[d.getDay()]})`;
}

export function DiaryComposeModal({
  visible,
  fromPush,
  readOnly = false,
  editingEntry,
  initialDraft,
  onClose,
  onSave,
  onDraftChange,
  onDelete,
}: Props) {
  const insets = useSafeAreaInsets();
  const { logs, babyName, babyStickers, addBabySticker, deleteBabySticker, logAuthor, activeBabyId, careSetup } = useBabyLog();
  const isEdit = !!editingEntry;
  const stageLabel = editingEntry?.stageLabelSnapshot
    ?? formatDiaryStageLabel(
      careSetup.child,
      editingEntry?.dateKey ?? formatDateKey(),
    );
  const stageDate = formatDottedDate(editingEntry?.dateKey ?? formatDateKey());

  const [notes, setNotes] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [eagerPhotos, setEagerPhotos] = useState<EagerPhoto[]>([]);
  const [photoError, setPhotoError] = useState("");
  const sessionIdRef = useRef(createUploadSessionId());
  const handedOffRef = useRef(false);
  const savingRef = useRef(false);
  const baselineRef = useRef<string | null>(null);
  const [stickerIds, setStickerIds] = useState<string[]>([]);
  const [stickerPickerOpen, setStickerPickerOpen] = useState(false);
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

  const canSave = notes.trim().length > 0 || photos.length > 0 || stickerIds.length > 0;
  const pendingUploads = eagerPhotos.filter((photo) => photo.status !== "uploaded" && photo.status !== "failed").length;
  const failedUploads = eagerPhotos.filter((photo) => photo.status === "failed").length;
  const canSubmit = canSave && pendingUploads === 0 && failedUploads === 0;

  const buildDraft = (): DiaryComposeDraft => ({
    comment: notes.trim() || (photos.length || stickerIds.length ? DIARY_PHOTO_ONLY_COMMENT : notes),
    photos,
    stickerIds,
    weatherStamp: weather,
    moodStamp: mood,
    milestoneTag: resolvedPreset,
    customMilestoneTag: resolvedCustom,
    includedInGrowthBook: inBook,
    careLogSummarySnapshot: isEdit ? frozenSnapshot || liveSummary : liveSummary,
    momentSuggestionsUsed: usedSuggestions,
  });

  // Only the fields the user edits. The care-log snapshot is excluded because it
  // can drift on its own while the sheet is open.
  const dirtySignature = () =>
    JSON.stringify({
      comment: notes.trim(),
      photos,
      stickerIds,
      weather,
      mood,
      milestoneTag: resolvedPreset,
      customMilestoneTag: resolvedCustom,
      inBook,
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
      setStickerIds(d.stickerIds ?? []);
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
      setStickerIds(initialDraft.stickerIds ?? []);
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
      setStickerIds([]);
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
    setPhotoError("");
  }, [visible, editingEntry, initialDraft]);

  useEffect(() => {
    if (!visible || !ready) {
      baselineRef.current = null;
      return;
    }
    baselineRef.current = dirtySignature();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- snapshot the populated form once
  }, [visible, ready]);

  // Photos upload as soon as they are picked. If the compose sheet is dismissed
  // without handing them to the save path, those objects would linger in the
  // bucket's temp prefix until the 24h server sweep.
  useEffect(() => {
    if (!visible) return;
    handedOffRef.current = false;
    const sessionId = sessionIdRef.current;
    const refresh = () => setEagerPhotos(listEagerPhotos(sessionId));
    refresh();
    const unsubscribe = subscribeEagerSession(sessionId, refresh);
    return () => {
      unsubscribe();
      const handedOff = handedOffRef.current;
      sessionIdRef.current = createUploadSessionId();
      setEagerPhotos([]);
      if (handedOff) return;
      void discardSession(sessionId).catch(() => undefined);
    };
  }, [visible]);

  useEffect(() => {
    if (!visible || !ready || isEdit || readOnly || !onDraftChange) return;
    const t = setTimeout(() => onDraftChange(buildDraft()), 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- buildDraft reads latest state
  }, [
    visible,
    ready,
    isEdit,
    readOnly,
    onDraftChange,
    notes,
    photos,
    stickerIds,
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
    const remaining = MAX_DIARY_PHOTOS - photos.length;
    if (remaining <= 0) {
      Alert.alert("사진은 최대 5장까지", "사진을 더 추가하려면 먼저 한 장을 삭제해 주세요.");
      return;
    }
    if (!activeBabyId) {
      setPhotoError("사진을 올리려면 현재 아기가 필요해요.");
      return;
    }
    try {
      const permission = await ImagePicker.getMediaLibraryPermissionsAsync();
      const resolvedPermission = permission.granted
        ? permission
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!resolvedPermission.granted) {
        Alert.alert(
          "사진 접근 권한이 필요해요",
          "설정에서 사진 접근을 허용한 뒤 다시 시도해 주세요.",
        );
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 1,
        allowsMultipleSelection: true,
        selectionLimit: remaining,
        orderedSelection: true,
        preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Current,
      });
      if (!result.canceled && result.assets.length > 0) {
        setPhotoError("");
        enqueuePickedPhotos({
          babyId: activeBabyId,
          bucket: "diary-media",
          sessionId: sessionIdRef.current,
          assets: result.assets.map((asset) => ({ uri: asset.uri, width: asset.width, height: asset.height })),
        });
        setEagerPhotos(listEagerPhotos(sessionIdRef.current));
        setPhotos((current) => {
          const next = [...current];
          for (const asset of result.assets) {
            if (!next.includes(asset.uri) && next.length < MAX_DIARY_PHOTOS) next.push(asset.uri);
          }
          return next;
        });
      }
    } catch (error) {
      if (__DEV__) console.warn("[diary-photo-picker] open failed", error instanceof Error ? error.name : "unknown");
      Alert.alert(
        "사진을 불러오지 못했어요",
        "iCloud 사진이라면 사진 앱에서 원본을 먼저 열어 다운로드한 뒤 다시 선택해 주세요.",
      );
    }
  };

  const handleSave = () => {
    if (readOnly || !canSubmit || savingRef.current) return;
    savingRef.current = true;
    const draft = buildDraft();
    draft.comment = notes.trim() || DIARY_PHOTO_ONLY_COMMENT;
    handedOffRef.current = true;
    onSave(draft);
    onClose();
  };

  const handleClose = () => {
    if (!readOnly && !isEdit && onDraftChange) onDraftChange(buildDraft());
    // New entries are kept as a draft, so only edits can actually lose work.
    if (!readOnly && isEdit && baselineRef.current !== null && dirtySignature() !== baselineRef.current) {
      Alert.alert("수정한 내용을 지울까요?", "저장하지 않고 닫으면 변경한 내용이 사라져요.", [
        { text: "계속 쓰기", style: "cancel" },
        { text: "닫기", style: "destructive", onPress: onClose },
      ]);
      return;
    }
    onClose();
  };

  const handleDelete = () => {
    if (readOnly || !editingEntry || !onDelete) return;
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

  const title = readOnly
    ? "일기 보기"
    : isEdit
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
          {readOnly ? (
            <View style={styles.headerBtn} />
          ) : (
            <Pressable
              onPress={handleSave}
              hitSlop={10}
              style={[styles.headerBtn, !canSubmit && styles.headerBtnDisabled]}
              disabled={!canSubmit}
              accessibilityRole="button"
              accessibilityState={{ disabled: !canSubmit }}
              accessibilityHint={
                pendingUploads > 0
                  ? "사진 업로드가 끝나면 저장할 수 있어요"
                  : failedUploads > 0
                    ? "올리지 못한 사진을 다시 시도하거나 삭제해 주세요"
                    : undefined
              }
            >
              <Text style={[styles.saveHeaderText, !canSubmit && styles.saveHeaderTextDisabled]}>저장</Text>
            </Pressable>
          )}
        </View>

        {readOnly ? (
          <View style={styles.fromPushBanner}>
            <Text style={styles.fromPushText}>이 일기는 보기만 할 수 있어요</Text>
          </View>
        ) : fromPush ? (
          <View style={styles.fromPushBanner}>
            <BabyLogIcon kind="bell" size={14} color={colors.amberText} />
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
            {stageLabel ? <Text style={styles.dateLabel}>{stageLabel}</Text> : null}
            <Text style={styles.dateLabel}>{stageDate ? `${dateLabel} · ${stageDate}` : dateLabel}</Text>

            <View style={styles.careCard}>
              <View style={styles.careTagRow}>
                <BabyLogIcon kind="sparkles" size={12} color={colors.amberText} strokeWidth={2.2} />
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

            {!readOnly && (!isEdit || fromPush) ? (
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
            {readOnly ? null : (
              <>
                <View style={styles.mediaActions}>
                  <Pressable style={[styles.mediaBtn, photos.length >= MAX_DIARY_PHOTOS && styles.mediaBtnDisabled]} onPress={() => void pickPhoto()}>
                    <Text style={styles.mediaBtnText}>사진 추가</Text>
                  </Pressable>
                  <Pressable style={styles.mediaBtnSecondary} onPress={() => setStickerPickerOpen(true)}>
                    <Text style={styles.mediaBtnSecondaryText}>스티커 추가</Text>
                  </Pressable>
                </View>
                <Text style={styles.photoLimit}>
                  {pendingUploads > 0
                    ? `사진 ${pendingUploads}장을 올리는 중이에요. 업로드가 끝나면 저장할 수 있어요.`
                    : failedUploads > 0
                      ? "올리지 못한 사진이 있어요. 다시 시도하거나 삭제해 주세요."
                      : `선택한 사진 ${photos.length}장 · 최대 5장까지 추가할 수 있어요.`}
                </Text>
                {photoError ? <Text style={styles.photoError}>{photoError}</Text> : null}
              </>
            )}
            {photos.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoRow}>
                {photos.map((uri, index) => {
                  const job = findJobByLocalUri(uri) ?? eagerPhotos.find((photo) => photo.localUri === uri);
                  return (
                  <View key={`${uri}-${index}`} style={styles.photoThumbWrap}>
                    <Image source={{ uri }} style={styles.photoThumb} contentFit="cover" />
                    {index === 0 ? <View style={styles.coverBadge}><Text style={styles.coverBadgeText}>대표</Text></View> : null}
                    {job?.status === "failed" ? (
                      <Pressable
                        style={styles.photoFail}
                        onPress={() => retryEagerPhoto(job.id)}
                        accessibilityRole="button"
                        accessibilityLabel="사진 다시 올리기"
                      >
                        <Text style={styles.photoFailText}>다시 시도</Text>
                      </Pressable>
                    ) : job && job.status !== "uploaded" ? (
                      <View style={styles.photoUploading} pointerEvents="none">
                        <ActivityIndicator size="small" color={colors.onDark} />
                        <Text style={styles.photoUploadingText}>올리는 중</Text>
                      </View>
                    ) : null}
                    {readOnly ? null : (
                      <Pressable
                        style={styles.photoRemove}
                        onPress={() => {
                          const removed = photos[index];
                          const removedJob = removed ? findJobByLocalUri(removed) : undefined;
                          if (removedJob) removeEagerPhoto(removedJob.id);
                          setEagerPhotos(listEagerPhotos(sessionIdRef.current));
                          setPhotos((current) => current.filter((_, photoIndex) => photoIndex !== index));
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={`사진 ${index + 1} 삭제`}
                      >
                        <View style={styles.photoRemoveGlyph}>
                          <Text style={styles.photoRemoveText}>×</Text>
                        </View>
                      </Pressable>
                    )}
                  </View>
                  );
                })}
                {!readOnly && photos.length < MAX_DIARY_PHOTOS ? (
                  <Pressable style={styles.photoAddTile} onPress={() => void pickPhoto()}>
                    <Text style={styles.photoAddPlus}>＋</Text>
                    <Text style={styles.photoAddText}>사진 추가</Text>
                  </Pressable>
                ) : null}
              </ScrollView>
            ) : (
              <Pressable style={styles.photoBox} onPress={readOnly ? undefined : () => void pickPhoto()} disabled={readOnly}>
                <View style={styles.photoHintWrap}>
                  {mood ? <DiaryMoodStamp id={mood} selected size="lg" /> : null}
                  <Text style={styles.photoHint}>{readOnly ? "사진 없음" : "사진 추가하기"}</Text>
                  {readOnly ? null : (
                    <Text style={styles.photoHintSub}>사진만 있어도 저장할 수 있어요</Text>
                  )}
                </View>
              </Pressable>
            )}

            {stickerIds.length > 0 ? (
              <>
                <Text style={styles.fieldLabel}>오늘의 스티커</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stickerRow}>
                  {stickerIds.map((id) => {
                    const sticker = babyStickers.find((item) => item.id === id);
                    if (!sticker) return null;
                    return (
                      <Pressable
                        key={id}
                        onLongPress={readOnly ? undefined : () => setStickerIds((prev) => prev.filter((x) => x !== id))}
                      >
                        <BabyStickerFromModel sticker={sticker} size={72} />
                      </Pressable>
                    );
                  })}
                </ScrollView>
                {readOnly ? null : <Text style={styles.sectionHint}>길게 누르면 스티커를 빼요</Text>}
              </>
            ) : null}

            <Text style={styles.fieldLabel}>코멘트</Text>
            <TextInput
              style={styles.notes}
              value={notes}
              onChangeText={setNotes}
              multiline
              editable={!readOnly}
              placeholder={`${babyName}와 있었던 일을 적어보세요`}
              placeholderTextColor={colors.faint}
            />

            <Text style={styles.fieldLabel}>오늘의 하늘</Text>
            {readOnly ? null : (
              <Text style={styles.sectionHint}>다시 누르면 선택을 해제할 수 있어요</Text>
            )}
            <View pointerEvents={readOnly ? "none" : "auto"}>
              <DiarySkyPicker value={weather} onChange={setWeather} />
            </View>

            <Text style={styles.fieldLabel}>오늘의 마음</Text>
            <View pointerEvents={readOnly ? "none" : "auto"}>
              <DiaryMoodPicker value={mood} onChange={setMood} />
            </View>

            <Text style={styles.fieldLabel}>성장 순간 태그</Text>
            <View style={styles.optionRow} pointerEvents={readOnly ? "none" : "auto"}>
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
                editable={!readOnly}
                placeholder="예: 처음으로 손을 뻗은 날"
                placeholderTextColor={colors.faint}
              />
            ) : null}

            <View style={styles.toggleRow}>
              <View style={styles.toggleCopy}>
                <Text style={styles.toggleTitle}>성장책에 담기</Text>
                <Text style={styles.toggleSub}>저장 후 성장책에서도 볼 수 있어요</Text>
              </View>
              <Switch
                value={inBook}
                onValueChange={setInBook}
                disabled={readOnly}
                trackColor={{ false: colors.border, true: colors.amber }}
                thumbColor="#FFFFFF"
              />
            </View>

            {readOnly ? null : (
              <View>
                <Pressable
                  style={[styles.saveBtn, !canSubmit && styles.saveBtnDisabled]}
                  onPress={handleSave}
                  disabled={!canSubmit}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !canSubmit }}
                >
                  <Text style={styles.saveBtnText}>{isEdit ? "수정 저장" : "일기 저장"}</Text>
                </Pressable>
                {!canSave ? (
                  <Text style={styles.saveHint}>사진 또는 코멘트 중 하나는 필요해요</Text>
                ) : pendingUploads > 0 ? (
                  <Text style={styles.saveHint}>사진 업로드가 끝나면 저장할 수 있어요</Text>
                ) : failedUploads > 0 ? (
                  <Text style={styles.saveHint}>올리지 못한 사진을 다시 시도하거나 삭제해 주세요</Text>
                ) : null}

                {isEdit && onDelete ? (
                  <Pressable style={styles.deleteBtn} onPress={handleDelete}>
                    <Text style={styles.deleteBtnText}>일기 삭제</Text>
                  </Pressable>
                ) : null}
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </View>

      <BabyStickerVaultModal
        embedded
        visible={!readOnly && stickerPickerOpen}
        babyName={babyName}
        stickers={babyStickers}
        createdBy={logAuthor.userId}
        pickMode
        onClose={() => setStickerPickerOpen(false)}
        onSaveSticker={addBabySticker}
        onDeleteSticker={deleteBabySticker}
        onPickSticker={(sticker) => {
          setStickerIds((prev) => (prev.includes(sticker.id) ? prev : [...prev, sticker.id]));
          setStickerPickerOpen(false);
        }}
      />
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
  saveHeaderText: { fontSize: 15, fontWeight: "800", color: colors.amberText, textAlign: "right" },
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
    color: colors.amberText,
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
  photoHintWrap: { alignItems: "center", gap: 6 },
  photoHint: { color: colors.muted, fontSize: 13, fontWeight: "700" },
  photoHintSub: { color: colors.faint, fontSize: 11.5 },
  mediaActions: { flexDirection: "row", gap: 8, marginBottom: 10 },
  mediaBtn: {
    flex: 1,
    backgroundColor: colors.amber,
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: "center",
  },
  mediaBtnText: { color: colors.amberDark, fontWeight: "800", fontSize: 13 },
  mediaBtnDisabled: { opacity: 0.5 },
  mediaBtnSecondary: {
    flex: 1,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.amber,
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: "center",
  },
  mediaBtnSecondaryText: { color: colors.amberText, fontWeight: "800", fontSize: 13 },
  photoLimit: { color: colors.faint, fontSize: 11.5, lineHeight: 17, marginBottom: 8 },
  photoError: { color: colors.dangerText, fontSize: 12, fontWeight: "700", marginBottom: 8 },
  photoRow: { gap: 10, paddingRight: 4 },
  photoThumbWrap: { width: 112, height: 112, borderRadius: 16, overflow: "hidden", backgroundColor: colors.cardHi },
  photoThumb: { width: "100%", height: "100%" },
  coverBadge: { position: "absolute", left: 7, bottom: 7, borderRadius: 999, backgroundColor: "rgba(46,42,38,0.72)", paddingHorizontal: 7, paddingVertical: 3 },
  coverBadgeText: { color: colors.onDark, fontSize: 9.5, fontWeight: "800" },
  photoFail: { position: "absolute", left: 7, right: 7, bottom: 7, minHeight: 36, borderRadius: 999, backgroundColor: "rgba(46,42,38,0.82)", alignItems: "center", justifyContent: "center" },
  photoFailText: { color: colors.onDark, fontSize: 11.5, fontWeight: "800" },
  photoUploading: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, gap: 6, backgroundColor: "rgba(46,42,38,0.44)", alignItems: "center", justifyContent: "center" },
  photoUploadingText: { color: colors.onDark, fontSize: 11, fontWeight: "800" },
  photoRemove: {
    position: "absolute",
    right: 0,
    top: 0,
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  photoRemoveGlyph: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(46,42,38,0.72)",
  },
  photoRemoveText: { color: colors.onDark, fontSize: 21, lineHeight: 23, fontWeight: "500" },
  photoAddTile: { width: 96, height: 112, borderRadius: 16, borderWidth: 1, borderStyle: "dashed", borderColor: colors.amber, backgroundColor: colors.amberSoft, alignItems: "center", justifyContent: "center", gap: 4 },
  photoAddPlus: { color: colors.amberText, fontSize: 26, lineHeight: 28 },
  photoAddText: { color: colors.amberText, fontSize: 11.5, fontWeight: "800" },
  stickerRow: { gap: 10, paddingVertical: 4 },
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
