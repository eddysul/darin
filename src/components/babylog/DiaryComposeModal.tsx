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
import type { DiaryCoverTemplateId } from "../../constants/diaryCoverTemplates";
import type { DiaryPageTemplateId } from "../../constants/diaryPageTemplates";
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
import { DiaryCoverPhotoAdjustModal } from "./DiaryCoverPhotoAdjustModal";
import { DiaryCoverPicker } from "./DiaryCoverPicker";
import { DiaryCoverTemplate } from "./DiaryCoverTemplate";
import { DiaryPageStylePicker } from "./DiaryPageStylePicker";
import { DiaryPageTemplate } from "./DiaryPageTemplate";
import { useLanguage } from "../../LanguageContext";
import type { Locale } from "../../i18n";
import { formatLocalizedDate } from "../../utils/localeFormat";

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

const MAX_DIARY_PHOTOS = 5;

function formatTodayLabel(locale: Locale, d = new Date()): string {
  return formatLocalizedDate(d, locale, { month: "long", day: "numeric", weekday: "short" });
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
  const { locale, t } = useLanguage();
  const { logs, babyName, babyStickers, addBabySticker, deleteBabySticker, logAuthor, activeBabyId, careSetup } = useBabyLog();
  const isEdit = !!editingEntry;
  const stageLabel = editingEntry?.stageLabelSnapshot
    ?? formatDiaryStageLabel(
      careSetup.child,
      editingEntry?.dateKey ?? formatDateKey(),
      locale,
    );
  const stageDate = formatDottedDate(editingEntry?.dateKey ?? formatDateKey());

  const [notes, setNotes] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [coverStyleId, setCoverStyleId] = useState<DiaryCoverTemplateId>("cloud_sky");
  const [pageStyleId, setPageStyleId] = useState<DiaryPageTemplateId>("basic_line");
  const [coverPhotoUri, setCoverPhotoUri] = useState<string | null>(null);
  const [coverPhotoTransform, setCoverPhotoTransform] = useState({ scale: 1, translateX: 0, translateY: 0 });
  const [coverTitle, setCoverTitle] = useState("");
  const [coverPhotoAdjustOpen, setCoverPhotoAdjustOpen] = useState(false);
  const [eagerPhotos, setEagerPhotos] = useState<EagerPhoto[]>([]);
  const [photoError, setPhotoError] = useState("");
  const sessionIdRef = useRef(createUploadSessionId());
  const handedOffRef = useRef(false);
  const savingRef = useRef(false);
  const baselineRef = useRef<string | null>(null);
  const [touchNonce, setTouchNonce] = useState(0);
  const [stickerIds, setStickerIds] = useState<string[]>([]);
  const [stickerPickerOpen, setStickerPickerOpen] = useState(false);
  const [weather, setWeather] = useState<DiarySkyId | null>(DEFAULT_DIARY_SKY);
  const [mood, setMood] = useState<DiaryMoodId | null>(DEFAULT_DIARY_MOOD);
  const [milestoneTag, setMilestoneTag] = useState<string | null>(null);
  const [customMilestoneTag, setCustomMilestoneTag] = useState("");
  const [customMode, setCustomMode] = useState(false);
  const [inBook, setInBook] = useState(false);
  const [usedSuggestions, setUsedSuggestions] = useState<string[]>([]);
  const [dateLabel, setDateLabel] = useState(() => formatTodayLabel(locale));
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
  const canSubmit = canSave;

  const buildDraft = (): DiaryComposeDraft => ({
    comment: notes.trim() || (photos.length || stickerIds.length ? DIARY_PHOTO_ONLY_COMMENT : notes),
    photos,
    coverStyleId,
    pageStyleId,
    coverPhotoUri: coverPhotoUri && photos.includes(coverPhotoUri) ? coverPhotoUri : photos[0] ?? null,
    coverPhotoTransform,
    coverTitle: coverTitle.trim(),
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
      coverStyleId,
      pageStyleId,
      coverPhotoUri,
      coverPhotoTransform,
      coverTitle: coverTitle.trim(),
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
      setCoverStyleId(d.coverStyleId);
      setPageStyleId(d.pageStyleId);
      setCoverPhotoUri(d.coverPhotoUri);
      setCoverPhotoTransform(d.coverPhotoTransform);
      setCoverTitle(d.coverTitle);
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
      setCoverStyleId(initialDraft.coverStyleId ?? "cloud_sky");
      setPageStyleId(initialDraft.pageStyleId ?? "basic_line");
      setCoverPhotoUri(initialDraft.coverPhotoUri ?? initialDraft.photos[0] ?? null);
      setCoverPhotoTransform(initialDraft.coverPhotoTransform ?? { scale: 1, translateX: 0, translateY: 0 });
      setCoverTitle(initialDraft.coverTitle ?? "");
      setStickerIds(initialDraft.stickerIds ?? []);
      setWeather(initialDraft.weatherStamp);
      setMood(initialDraft.moodStamp);
      setMilestoneTag(initialDraft.milestoneTag);
      setCustomMilestoneTag(initialDraft.customMilestoneTag || "");
      setCustomMode(!!initialDraft.customMilestoneTag && !initialDraft.milestoneTag);
      setInBook(initialDraft.includedInGrowthBook);
      setUsedSuggestions(initialDraft.momentSuggestionsUsed);
      setDateLabel(formatTodayLabel(locale));
      setFrozenSnapshot(undefined);
    } else {
      setNotes("");
      setPhotos([]);
      setCoverStyleId("cloud_sky");
      setPageStyleId("basic_line");
      setCoverPhotoUri(null);
      setCoverPhotoTransform({ scale: 1, translateX: 0, translateY: 0 });
      setCoverTitle("");
      setStickerIds([]);
      setWeather(DEFAULT_DIARY_SKY);
      setMood(DEFAULT_DIARY_MOOD);
      setMilestoneTag(null);
      setCustomMilestoneTag("");
      setCustomMode(false);
      setInBook(false);
      setUsedSuggestions([]);
      setDateLabel(formatTodayLabel(locale));
      setFrozenSnapshot(undefined);
    }
    setReady(true);
    setPhotoError("");
  }, [visible, editingEntry, initialDraft]);

  useEffect(() => {
    if (photos.length === 0) {
      if (coverPhotoUri !== null) setCoverPhotoUri(null);
      return;
    }
    if (!coverPhotoUri || !photos.includes(coverPhotoUri)) {
      setCoverPhotoUri(photos[0]);
      setCoverPhotoTransform({ scale: 1, translateX: 0, translateY: 0 });
    }
  }, [photos, coverPhotoUri]);

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
    savingRef.current = false;
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
    coverStyleId,
    pageStyleId,
    coverPhotoUri,
    coverPhotoTransform,
    coverTitle,
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
      Alert.alert(t("diary.compose.photoLimitTitle"), t("diary.compose.photoLimitBody"));
      return;
    }
    if (!activeBabyId) {
      setPhotoError(t("diary.compose.activeBabyRequired"));
      return;
    }
    try {
      const permission = await ImagePicker.getMediaLibraryPermissionsAsync();
      const resolvedPermission = permission.granted
        ? permission
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!resolvedPermission.granted) {
        Alert.alert(
          t("diary.compose.photoPermissionTitle"),
          t("diary.compose.photoPermissionBody"),
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
        setTouchNonce((value) => value + 1);
      }
    } catch (error) {
      if (__DEV__) console.warn("[diary-photo-picker] open failed", error instanceof Error ? error.name : "unknown");
      Alert.alert(
        t("diary.compose.photoLoadTitle"),
        t("diary.compose.photoLoadBody"),
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
      Alert.alert(t("diary.compose.discardTitle"), t("diary.compose.discardBody"), [
        { text: t("diary.compose.keepWriting"), style: "cancel" },
        { text: t("diary.compose.close"), style: "destructive", onPress: onClose },
      ]);
      return;
    }
    onClose();
  };

  const handleDelete = () => {
    if (readOnly || !editingEntry || !onDelete) return;
    Alert.alert(t("diary.compose.deleteTitle"), t("diary.compose.deleteBody"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("diary.compose.delete"),
        style: "destructive",
        onPress: () => {
          onDelete(editingEntry.id);
          onClose();
        },
      },
    ]);
  };

  const title = readOnly
    ? t("diary.compose.viewTitle")
    : isEdit
      ? fromPush
        ? t("diary.compose.continueToday")
        : t("diary.compose.editTitle")
      : fromPush
        ? t("diary.compose.fromNotification")
        : t("diary.compose.newTitle");

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <View style={[styles.root, { paddingTop: Math.max(insets.top, 12) }]}>
        <View style={styles.header}>
          <Pressable onPress={handleClose} hitSlop={10} style={styles.headerBtn}>
            <Text style={styles.headerBtnText}>{t("diary.compose.close")}</Text>
          </Pressable>
          <Text style={styles.headerTitle}>{title}</Text>
          {readOnly ? (
            <View style={styles.headerBtn} />
          ) : (
            <Pressable
              key={`save-header-${touchNonce}`}
              onPress={handleSave}
              hitSlop={10}
              style={[styles.headerBtn, !canSubmit && styles.headerBtnDisabled]}
              disabled={!canSubmit}
              accessibilityRole="button"
              accessibilityState={{ disabled: !canSubmit }}
              accessibilityHint={
                pendingUploads > 0
                  ? t("diary.compose.uploadingSaveHint")
                  : failedUploads > 0
                    ? t("diary.compose.uploadFailedHint")
                    : undefined
              }
            >
              <Text style={[styles.saveHeaderText, !canSubmit && styles.saveHeaderTextDisabled]}>{t("diary.compose.save")}</Text>
            </Pressable>
          )}
        </View>

        {readOnly ? (
          <View style={styles.fromPushBanner}>
            <Text style={styles.fromPushText}>{t("diary.compose.readOnly")}</Text>
          </View>
        ) : fromPush ? (
          <View style={styles.fromPushBanner}>
            <BabyLogIcon kind="bell" size={14} color={colors.amberText} />
            <Text style={styles.fromPushText}>{t("diary.compose.openedFromNotification")}</Text>
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
                <Text style={styles.careTag}>{t("diary.compose.careLog")}</Text>
              </View>
              <Text style={styles.careText}>{displaySummary}</Text>
              {isEdit && frozenSnapshot ? (
                <Text style={styles.snapshotNote}>{t("diary.compose.snapshotHint")}</Text>
              ) : null}
              {!isEdit && summary.totalCount === 0 ? (
                <Text style={styles.snapshotNote}>{t("diary.compose.noRecordsHint")}</Text>
              ) : null}
            </View>

            {!readOnly && (!isEdit || fromPush) ? (
              <>
                <Text style={styles.sectionLabel}>{t("diary.compose.suggestions")}</Text>
                <Text style={styles.sectionHint}>{t("diary.compose.suggestionsHint")}</Text>
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

            <Text style={styles.fieldLabel}>{t("diary.compose.photo")}</Text>
            {readOnly ? null : (
              <>
                <View style={styles.mediaActions}>
                  <Pressable style={[styles.mediaBtn, photos.length >= MAX_DIARY_PHOTOS && styles.mediaBtnDisabled]} onPress={() => void pickPhoto()}>
                    <Text style={styles.mediaBtnText}>{t("diary.compose.addPhoto")}</Text>
                  </Pressable>
                  <Pressable style={styles.mediaBtnSecondary} onPress={() => setStickerPickerOpen(true)}>
                    <Text style={styles.mediaBtnSecondaryText}>{t("diary.compose.addSticker")}</Text>
                  </Pressable>
                </View>
                <Text style={styles.photoLimit}>
                  {pendingUploads > 0
                    ? t("diary.compose.uploadingPhotos", { count: pendingUploads })
                    : failedUploads > 0
                      ? t("diary.compose.uploadFailed")
                      : t("diary.compose.photoCount", { count: photos.length })}
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
                    {coverPhotoUri === uri ? (
                      <View pointerEvents="none" style={styles.coverPhotoBadge}>
                        <Text style={styles.coverPhotoBadgeText}>{t("diary.compose.coverBadge")}</Text>
                      </View>
                    ) : null}
                    {job?.status === "failed" ? (
                      <Pressable
                        style={styles.photoFail}
                        onPress={() => retryEagerPhoto(job.id)}
                        accessibilityRole="button"
                        accessibilityLabel={t("diary.compose.retryPhotoA11y")}
                      >
                        <Text style={styles.photoFailText}>{t("diary.compose.retry")}</Text>
                      </Pressable>
                    ) : job && job.status !== "uploaded" ? (
                      <View style={styles.photoUploading} pointerEvents="none">
                        <ActivityIndicator size="small" color={colors.onDark} />
                        <Text style={styles.photoUploadingText}>{t("diary.compose.uploading")}</Text>
                      </View>
                    ) : null}
                    {readOnly ? null : (
                      <>
                        <Pressable
                          style={styles.photoCoverSelect}
                          onPress={() => {
                            setCoverPhotoUri(uri);
                            setCoverPhotoTransform({ scale: 1, translateX: 0, translateY: 0 });
                          }}
                          accessibilityRole="button"
                          accessibilityLabel={t("diary.compose.setCoverA11y", { count: index + 1 })}
                          accessibilityState={{ selected: coverPhotoUri === uri }}
                        >
                          <Text style={styles.photoCoverSelectText}>{coverPhotoUri === uri ? t("diary.compose.coverSelected") : t("diary.compose.coverSet")}</Text>
                        </Pressable>
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
                          accessibilityLabel={t("diary.compose.deletePhotoA11y", { count: index + 1 })}
                        >
                          <View style={styles.photoRemoveGlyph}>
                            <Text style={styles.photoRemoveText}>×</Text>
                          </View>
                        </Pressable>
                      </>
                    )}
                  </View>
                  );
                })}
                {!readOnly && photos.length < MAX_DIARY_PHOTOS ? (
                  <Pressable style={styles.photoAddTile} onPress={() => void pickPhoto()}>
                    <Text style={styles.photoAddPlus}>＋</Text>
                    <Text style={styles.photoAddText}>{t("diary.compose.addPhoto")}</Text>
                  </Pressable>
                ) : null}
              </ScrollView>
            ) : (
              <Pressable style={styles.photoBox} onPress={readOnly ? undefined : () => void pickPhoto()} disabled={readOnly}>
                <View style={styles.photoHintWrap}>
                  {mood ? <DiaryMoodStamp id={mood} selected size="lg" /> : null}
                  <Text style={styles.photoHint}>{readOnly ? t("diary.compose.noPhoto") : t("diary.compose.addPhoto")}</Text>
                  {readOnly ? null : (
                    <Text style={styles.photoHintSub}>{t("diary.compose.photoOnly")}</Text>
                  )}
                </View>
              </Pressable>
            )}

            <Text style={styles.fieldLabel}>{t("diary.compose.cover")}</Text>
            <Text style={styles.sectionHint}>{t("diary.compose.coverHint")}</Text>
            <View style={styles.diaryTemplatePreviewWrap}>
              <DiaryCoverTemplate
                styleId={coverStyleId}
                photoUri={coverPhotoUri}
                photoTransform={coverPhotoTransform}
                title={coverTitle || notes}
                style={styles.diaryCoverPreview}
              />
            </View>
            {readOnly ? null : (
              <>
                <DiaryCoverPicker
                  value={coverStyleId}
                  photoUri={coverPhotoUri}
                  title={coverTitle || notes}
                  onChange={setCoverStyleId}
                />
                <TextInput
                  style={styles.coverTitleInput}
                  value={coverTitle}
                  onChangeText={setCoverTitle}
                  maxLength={60}
                  placeholder={t("diary.compose.coverTitlePlaceholder")}
                  placeholderTextColor={colors.faint}
                />
                {coverPhotoUri ? (
                  <Pressable
                    style={styles.coverAdjustButton}
                    onPress={() => setCoverPhotoAdjustOpen(true)}
                    accessibilityRole="button"
                    accessibilityLabel={t("diary.compose.coverAdjust")}
                  >
                    <Text style={styles.coverAdjustButtonText}>{t("diary.compose.coverAdjust")}</Text>
                  </Pressable>
                ) : null}
              </>
            )}

            <Text style={styles.fieldLabel}>{t("diary.compose.pageStyle")}</Text>
            <Text style={styles.sectionHint}>{t("diary.compose.pageStyleHint")}</Text>
            {readOnly ? (
              <View style={styles.diaryTemplatePreviewWrap}>
                <DiaryPageTemplate
                  styleId={pageStyleId}
                  dateLabel={dateLabel}
                  weatherStamp={weather}
                  title={coverTitle || notes}
                  body={notes}
                  style={styles.diaryPagePreview}
                />
              </View>
            ) : (
              <DiaryPageStylePicker
                value={pageStyleId}
                dateLabel={dateLabel}
                weatherStamp={weather}
                title={coverTitle || notes}
                body={notes}
                onChange={setPageStyleId}
              />
            )}

            {stickerIds.length > 0 ? (
              <>
                <Text style={styles.fieldLabel}>{t("diary.compose.todaySticker")}</Text>
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
                {readOnly ? null : <Text style={styles.sectionHint}>{t("diary.compose.removeStickerHint")}</Text>}
              </>
            ) : null}

            <Text style={styles.fieldLabel}>{t("diary.compose.comment")}</Text>
            <TextInput
              style={styles.notes}
              value={notes}
              onChangeText={setNotes}
              multiline
              editable={!readOnly}
              placeholder={t("diary.compose.commentPlaceholder", { babyName })}
              placeholderTextColor={colors.faint}
            />

            <Text style={styles.fieldLabel}>{t("diary.compose.weather")}</Text>
            {readOnly ? null : (
              <Text style={styles.sectionHint}>{t("diary.compose.toggleHint")}</Text>
            )}
            <View pointerEvents={readOnly ? "none" : "auto"}>
              <DiarySkyPicker value={weather} onChange={setWeather} />
            </View>

            <Text style={styles.fieldLabel}>{t("diary.compose.mood")}</Text>
            <View pointerEvents={readOnly ? "none" : "auto"}>
              <DiaryMoodPicker value={mood} onChange={setMood} />
            </View>

            <Text style={styles.fieldLabel}>{t("diary.compose.milestone")}</Text>
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
                  {t("diary.compose.none")}
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
                <Text style={[styles.tagChipText, customMode && styles.tagChipTextActive]}>{t("diary.compose.custom")}</Text>
              </Pressable>
            </View>
            {customMode ? (
              <TextInput
                style={styles.customMoment}
                value={customMilestoneTag}
                onChangeText={setCustomMilestoneTag}
                editable={!readOnly}
                placeholder={t("diary.compose.milestoneExample")}
                placeholderTextColor={colors.faint}
              />
            ) : null}

            <View style={styles.toggleRow}>
              <View style={styles.toggleCopy}>
                <Text style={styles.toggleTitle}>{t("diary.compose.addToBook")}</Text>
                <Text style={styles.toggleSub}>{t("diary.compose.addToBookHint")}</Text>
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
                  key={`save-btn-${touchNonce}`}
                  style={[styles.saveBtn, !canSubmit && styles.saveBtnDisabled]}
                  onPress={handleSave}
                  disabled={!canSubmit}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !canSubmit }}
                >
                  <Text style={styles.saveBtnText}>{isEdit ? t("diary.compose.saveEdit") : t("diary.compose.saveEntry")}</Text>
                </Pressable>
                {!canSave ? (
                  <Text style={styles.saveHint}>{t("diary.compose.needContent")}</Text>
                ) : pendingUploads > 0 ? (
                  <Text style={styles.saveHint}>{t("diary.compose.backgroundUploadHint")}</Text>
                ) : failedUploads > 0 ? (
                  <Text style={styles.saveHint}>{t("diary.compose.uploadFailedHint")}</Text>
                ) : null}

                {isEdit && onDelete ? (
                  <Pressable style={styles.deleteBtn} onPress={handleDelete}>
                    <Text style={styles.deleteBtnText}>{t("diary.compose.delete")}</Text>
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
      <DiaryCoverPhotoAdjustModal
        visible={!readOnly && coverPhotoAdjustOpen}
        photoUri={coverPhotoUri}
        styleId={coverStyleId}
        value={coverPhotoTransform}
        onCancel={() => setCoverPhotoAdjustOpen(false)}
        onSave={(next) => {
          setCoverPhotoTransform(next);
          setCoverPhotoAdjustOpen(false);
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
  coverPhotoBadge: { position: "absolute", left: 6, top: 6, borderRadius: 9, backgroundColor: colors.amber, paddingHorizontal: 7, paddingVertical: 3 },
  coverPhotoBadgeText: { color: colors.amberDark, fontSize: 10, fontWeight: "800" },
  photoCoverSelect: { position: "absolute", left: 5, bottom: 5, minHeight: 28, borderRadius: 9, backgroundColor: "rgba(255,255,255,0.92)", paddingHorizontal: 7, alignItems: "center", justifyContent: "center" },
  photoCoverSelectText: { color: colors.amberText, fontSize: 10, fontWeight: "800" },
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
  diaryTemplatePreviewWrap: { alignItems: "center", marginBottom: 10 },
  diaryCoverPreview: { width: 210, height: 280 },
  diaryPagePreview: { width: 210, height: 280 },
  coverTitleInput: { minHeight: 46, borderRadius: 13, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, paddingHorizontal: 13, fontSize: 14, color: colors.text, marginTop: 10 },
  coverAdjustButton: { minHeight: 44, marginTop: 8, marginBottom: 4, borderRadius: 13, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, alignItems: "center", justifyContent: "center" },
  coverAdjustButtonText: { color: colors.text, fontSize: 13, fontWeight: "800" },
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
