import { useEffect, useMemo, useState } from "react";
import { Image } from "expo-image";
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { DiaryEntry } from "../../types/babyLog";
import type { GrowthBookEdit } from "../../types/growthBook";
import { isDefaultGrowthBookCoverTitle } from "../../types/growthBook";
import {
  diaryDisplayComment,
  diaryDisplayDate,
  diaryMilestoneLabel,
  diaryPrimaryPhoto,
  sortGrowthBookEntries,
} from "../../utils/diaryModel";
import {
  estimateGrowthBookPageCount,
  growthBookPhotoCount,
  resolveGrowthBookCoverPhoto,
  resolvePageEdit,
  resolvePagePhotos,
} from "../../utils/growthBookPages";
import { createGrowthBookPdf } from "../../utils/growthBookPdf";
import { colors, radius } from "../../theme";
import { EmptyState } from "../states/FeedbackStates";
import { BabyLogIcon } from "./BabyLogIcon";
import { DiaryCoverTemplate } from "./DiaryCoverTemplate";
import { DiaryMoodStamp, DiaryStampPair } from "./DiaryStamp";
import { GrowthBookPreviewModal } from "./GrowthBookPreviewModal";
import { useBabyLog } from "../../context/BabyLogContext";
import { useLanguage } from "../../LanguageContext";

type Props = {
  visible: boolean;
  babyName: string;
  entries: DiaryEntry[];
  edit?: GrowthBookEdit | null;
  onClose: () => void;
  onDismiss?: () => void;
  onRemove: (id: string) => void;
  onOpenEditor?: () => void;
  onGoToDiary?: () => void;
};

export function GrowthBookVaultModal({
  visible,
  babyName,
  entries,
  edit,
  onClose,
  onDismiss,
  onRemove,
  onOpenEditor,
  onGoToDiary,
}: Props) {
  const { t, locale } = useLanguage();
  const insets = useSafeAreaInsets();
  const { babyStickers } = useBabyLog();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewPageIndex, setPreviewPageIndex] = useState(0);
  const sorted = useMemo(
    () => sortGrowthBookEntries(entries.filter((e) => e.includedInGrowthBook)),
    [entries],
  );
  const photoCount = useMemo(() => growthBookPhotoCount(sorted, edit), [edit, sorted]);
  const pageEstimate = estimateGrowthBookPageCount(sorted.length);
  const canRead = sorted.length > 0;
  const storedCover = edit?.coverTitle?.trim();
  const coverTitle = isDefaultGrowthBookCoverTitle(storedCover, babyName)
    ? t("growth.critical.139", { babyName })
    : storedCover!;
  const coverRange = edit?.coverDateRange?.trim() ?? "";
  const coverPhoto = resolveGrowthBookCoverPhoto(sorted, edit);
  const letterCount = edit?.letters?.length ?? 0;
  const letterIndex = sorted.length + 1;

  useEffect(() => {
    if (!visible) {
      setPreviewOpen(false);
      setPreviewPageIndex(0);
    }
  }, [visible]);

  const openPreviewAt = (index: number) => {
    if (!canRead) return;
    setPreviewPageIndex(index);
    setPreviewOpen(true);
  };

  const runPdfCreate = async () => {
    await createGrowthBookPdf({ babyName, entries: sorted, edit, stickers: babyStickers, t, locale });
  };

  const confirmRemove = (entry: DiaryEntry) => {
    Alert.alert(
      t("growth.critical.064"),
      t("growth.critical.065"),
      [
        { text: t("growth.critical.066"), style: "cancel" },
        { text: t("growth.critical.067"), style: "destructive", onPress: () => onRemove(entry.id) },
      ],
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
      onDismiss={onDismiss}
    >
      <View style={[styles.root, { paddingTop: Math.max(insets.top, 12) }]}>
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel={t("growth.critical.008")}>
            <Text style={styles.headerBtn}>{t("growth.critical.008")}</Text>
          </Pressable>
          <Text style={styles.headerTitle} numberOfLines={1}>{coverTitle}</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 28 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.hero}>
            <View style={styles.heroCover}>
              <DiaryCoverTemplate
                fill
                styleId={edit?.coverTemplateId}
                photoUri={coverPhoto}
                title={coverTitle}
                subtitle={edit?.coverSubtitle}
                caption={coverRange}
              />
            </View>
            <View style={styles.heroCopy}>
              <Text style={styles.heroTitle}>{coverTitle}</Text>
              {coverRange ? <Text style={styles.heroRange}>{coverRange}</Text> : null}
              <Text style={styles.heroStats}>{t("growth.critical.068", { entries: sorted.length, photos: photoCount, pages: pageEstimate })}</Text>
            </View>
          </View>

          <Pressable
            style={[styles.readBtn, !canRead && styles.btnDisabled]}
            disabled={!canRead}
            accessibilityRole="button"
            accessibilityLabel={t("growth.critical.069")}
            onPress={() => openPreviewAt(0)}
          >
            <BabyLogIcon kind="tab" tab="diary" size={15} color={colors.amberDark} />
            <Text style={styles.readBtnText}>{t("growth.critical.069")}</Text>
          </Pressable>

          <Pressable
            style={[styles.decorateBtn, !canRead && styles.btnDisabled]}
            disabled={!canRead}
            accessibilityRole="button"
            accessibilityLabel={t("growth.critical.070")}
            onPress={() => {
              if (!canRead) return;
              onOpenEditor?.();
            }}
          >
            <BabyLogIcon kind="edit" size={15} color={colors.amberText} />
            <Text style={styles.decorateBtnText}>{t("growth.critical.070")}</Text>
          </Pressable>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t("growth.critical.071")}</Text>
            <Text style={styles.sectionHint}>{t("growth.critical.072")}</Text>
          </View>

          {sorted.length === 0 ? (
            <EmptyState
              title={t("growth.critical.073")}
              body={t("growth.critical.074")}
              ctaLabel={t("growth.critical.075")}
              onPressCta={onGoToDiary}
            />
          ) : (
            <>
              <Pressable
                style={styles.card}
                onPress={() => openPreviewAt(0)}
                accessibilityRole="button"
                accessibilityLabel={t("growth.critical.076")}
              >
                <View style={styles.cardContent}>
                  <Text style={styles.index}>1</Text>
                  {coverPhoto ? (
                    <Image source={{ uri: coverPhoto }} style={styles.thumb} contentFit="cover" />
                  ) : (
                    <View style={styles.thumbPlaceholder}>
                      <BabyLogIcon kind="tab" tab="diary" size={20} color={colors.muted} />
                    </View>
                  )}
                  <View style={styles.body}>
                    <Text style={styles.kind}>{t("growth.critical.077")}</Text>
                    <Text style={styles.comment} numberOfLines={2}>{coverTitle}</Text>
                  </View>
                </View>
              </Pressable>

              {sorted.map((entry, index) => {
                const milestone = diaryMilestoneLabel(entry, t);
                const pageEdit = resolvePageEdit(entry.id, entry, edit);
                const pagePhotos = resolvePagePhotos(entry, pageEdit);
                const photo = pagePhotos[0] ?? diaryPrimaryPhoto(entry);
                const hasComment = Boolean(pageEdit?.pageComment?.trim());
                const entryPhotoCount = pagePhotos.length;
                const pageNumber = index + 2;
                return (
                  <Pressable
                    key={entry.id}
                    style={styles.card}
                    onPress={() => openPreviewAt(index + 1)}
                    accessibilityRole="button"
                    accessibilityLabel={t("growth.critical.140", { date: diaryDisplayDate(entry, locale) })}
                  >
                    <View style={styles.cardContent}>
                      <Text style={styles.index}>{pageNumber}</Text>
                      {photo ? (
                        <Image source={{ uri: photo }} style={styles.thumb} contentFit="cover" />
                      ) : (
                        <View style={styles.thumbPlaceholder}>
                          {entry.moodStamp ? (
                            <DiaryMoodStamp id={entry.moodStamp} selected size="sm" />
                          ) : (
                            <BabyLogIcon kind="tab" tab="diary" size={20} color={colors.muted} />
                          )}
                        </View>
                      )}
                      <View style={styles.body}>
                        <View style={styles.dateRow}>
                          <Text style={styles.date} numberOfLines={1}>{diaryDisplayDate(entry, locale)}</Text>
                          <DiaryStampPair skyId={entry.weatherStamp} moodId={entry.moodStamp} size="sm" />
                        </View>
                        <Text style={styles.comment} numberOfLines={2}>
                          {milestone ?? diaryDisplayComment(entry, t)}
                        </Text>
                        {milestone ? <Text style={styles.tag}>{milestone}</Text> : null}
                        <View style={styles.metaRow}>
                          <Text style={styles.metaChip}>{t("growth.critical.078", { count: entryPhotoCount })}</Text>
                          <Text style={styles.metaChip}>{t("growth.critical.025")} {hasComment ? t("growth.critical.079") : t("growth.critical.080")}</Text>
                        </View>
                      </View>
                    </View>
                    <View style={styles.cardActions}>
                      <Pressable
                        style={styles.removeBtn}
                        onPress={(event) => {
                          event.stopPropagation();
                          confirmRemove(entry);
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={t("growth.critical.081")}
                      >
                        <BabyLogIcon kind="trash" size={13} color={colors.dangerText} />
                        <Text style={styles.removeText}>{t("growth.critical.067")}</Text>
                      </Pressable>
                    </View>
                  </Pressable>
                );
              })}

              <Pressable
                style={styles.card}
                onPress={() => openPreviewAt(letterIndex)}
                accessibilityRole="button"
                accessibilityLabel={t("growth.critical.082")}
              >
                <View style={styles.cardContent}>
                  <Text style={styles.index}>{letterIndex + 1}</Text>
                  <View style={styles.thumbPlaceholder}>
                    <BabyLogIcon kind="chat" size={20} color={colors.muted} />
                  </View>
                  <View style={styles.body}>
                    <Text style={styles.kind}>{t("growth.critical.083")}</Text>
                    <Text style={styles.comment} numberOfLines={2}>
                      {letterCount > 0 ? t("growth.critical.084", { count: letterCount }) : t("growth.critical.085")}
                    </Text>
                  </View>
                </View>
              </Pressable>
            </>
          )}
        </ScrollView>

        <GrowthBookPreviewModal
          embedded
          visible={previewOpen}
          babyName={babyName}
          entries={sorted}
          edit={edit}
          initialPageIndex={previewPageIndex}
          onClose={() => setPreviewOpen(false)}
          onPdfCreate={() => void runPdfCreate()}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
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
  headerTitle: { flex: 1, textAlign: "center", fontSize: 16, fontWeight: "800", color: colors.text },
  headerSpacer: { minWidth: 48 },
  content: { paddingHorizontal: 18, paddingTop: 16 },
  hero: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 14,
    marginBottom: 12,
  },
  heroCover: { width: 64, height: 80, borderRadius: 10, overflow: "hidden" },
  heroCoverFallback: {
    width: 64,
    height: 80,
    borderRadius: 10,
    backgroundColor: colors.cardHi,
    alignItems: "center",
    justifyContent: "center",
  },
  heroCopy: { flex: 1, minWidth: 0 },
  heroTitle: { fontSize: 17, fontWeight: "800", color: colors.text },
  heroRange: { fontSize: 12.5, fontWeight: "600", color: colors.muted, marginTop: 4 },
  heroStats: { fontSize: 13, fontWeight: "700", color: colors.amberText, marginTop: 8 },
  readBtn: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.amber,
    borderRadius: 14,
    paddingVertical: 14,
    marginBottom: 8,
  },
  readBtnText: { fontSize: 15, fontWeight: "800", color: colors.amberDark },
  decorateBtn: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.amber,
    borderRadius: 14,
    paddingVertical: 13,
    marginBottom: 18,
  },
  decorateBtnText: { fontSize: 14, fontWeight: "800", color: colors.amberText },
  btnDisabled: { opacity: 0.45 },
  sectionHeader: { marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontWeight: "800", color: colors.text },
  sectionHint: { marginTop: 4, fontSize: 12, color: colors.muted },
  card: {
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
  },
  cardContent: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  index: {
    width: 18,
    fontSize: 12,
    fontWeight: "800",
    color: colors.muted,
    marginTop: 4,
  },
  thumb: { width: 56, height: 56, borderRadius: 12 },
  thumbPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: colors.cardHi,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { flex: 1, minWidth: 0 },
  kind: { fontSize: 11.5, fontWeight: "700", color: colors.muted },
  dateRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  date: { flex: 1, fontSize: 11.5, fontWeight: "700", color: colors.muted },
  comment: { fontSize: 13, color: colors.text, marginTop: 3, lineHeight: 19 },
  tag: { fontSize: 11.5, fontWeight: "700", color: colors.amberText, marginTop: 6 },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  metaChip: { fontSize: 10.5, fontWeight: "700", color: colors.muted, backgroundColor: colors.cardHi, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  cardActions: { flexDirection: "row", justifyContent: "flex-end", gap: 8, marginTop: 10 },
  removeBtn: {
    minHeight: 44,
    flexDirection: "row",
    gap: 4,
    borderRadius: 9,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  removeText: { fontSize: 11.5, fontWeight: "700", color: colors.dangerText },
});
