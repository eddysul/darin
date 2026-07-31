import { useEffect, useMemo, useState } from "react";
import { Image } from "expo-image";
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { DiaryEntry } from "../../types/babyLog";
import type { GrowthBookEdit } from "../../types/growthBook";
import {
  diaryDisplayComment,
  diaryMilestoneLabel,
  diaryPhotoCount,
  diaryPrimaryPhoto,
  sortGrowthBookEntries,
} from "../../utils/diaryModel";
import { estimateGrowthBookPageCount } from "../../utils/growthBookPages";
import { createGrowthBookPdf } from "../../utils/growthBookPdf";
import { colors, radius } from "../../theme";
import { EmptyState } from "../states/FeedbackStates";
import { BabyLogIcon } from "./BabyLogIcon";
import { DiaryMoodStamp, DiaryStampPair } from "./DiaryStamp";
import { GrowthBookPreviewModal } from "./GrowthBookPreviewModal";
import { useBabyLog } from "../../context/BabyLogContext";

type Props = {
  visible: boolean;
  babyName: string;
  entries: DiaryEntry[];
  edit?: GrowthBookEdit | null;
  onClose: () => void;
  onDismiss?: () => void;
  onRemove: (id: string) => void;
  onOpenPage?: (entry: DiaryEntry) => void;
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
  onOpenPage,
  onOpenEditor,
  onGoToDiary,
}: Props) {
  const insets = useSafeAreaInsets();
  const { babyStickers } = useBabyLog();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const sorted = useMemo(
    () => sortGrowthBookEntries(entries.filter((e) => e.includedInGrowthBook)),
    [entries],
  );
  const photoCount = useMemo(() => diaryPhotoCount(sorted), [sorted]);
  const pageEstimate = estimateGrowthBookPageCount(sorted.length);
  const canPreview = sorted.length > 0;

  useEffect(() => {
    if (!visible) setPreviewOpen(false);
  }, [visible]);

  const runPdfCreate = async () => {
    setPdfBusy(true);
    try {
      await createGrowthBookPdf({ babyName, entries: sorted, edit, stickers: babyStickers });
    } finally {
      setPdfBusy(false);
    }
  };

  const confirmRemove = (entry: DiaryEntry) => {
    Alert.alert(
      "성장책에서 제거할까요?",
      "성장책에서만 제거돼요. 원본 일기는 그대로 남아 있어요.",
      [
        { text: "취소", style: "cancel" },
        { text: "제거", style: "destructive", onPress: () => onRemove(entry.id) },
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
          <Pressable onPress={onClose} hitSlop={10}>
            <Text style={styles.headerBtn}>닫기</Text>
          </Pressable>
          <Text style={styles.headerTitle}>성장책 보관함</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 28 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.hero}>
            <Text style={styles.heroTitle}>📖 {babyName}의 성장책</Text>
            <Text style={styles.heroStats}>
              담은 기록 {sorted.length}개 · 사진 {photoCount}장 · 예상 {pageEstimate}쪽
            </Text>
            <Text style={styles.heroHint}>
              가족이 함께 꾸민 편집본을 미리보고 PDF로 완성해 보세요.
            </Text>
          </View>

          <Pressable
            style={[styles.editBtn, !canPreview && styles.btnDisabled]}
            disabled={!canPreview}
            accessibilityRole="button"
            onPress={() => {
              if (!canPreview) return;
              onOpenEditor?.();
            }}
          >
            <Text style={styles.editBtnText}>성장책 편집하기</Text>
            <BabyLogIcon kind="edit" size={15} color={colors.amberDark} />
          </Pressable>

          <View style={styles.secondaryActions}>
            <Pressable
              style={[styles.previewBtn, !canPreview && styles.btnDisabled]}
              disabled={!canPreview}
              accessibilityRole="button"
              onPress={() => {
                if (!canPreview) return;
                setPreviewOpen(true);
              }}
            >
              <Text style={styles.previewBtnText}>미리보기</Text>
            </Pressable>

            <Pressable
              style={[styles.pdfBtn, (!canPreview || pdfBusy) && styles.btnDisabled]}
              disabled={!canPreview || pdfBusy}
              onPress={() => void runPdfCreate()}
            >
              <Text style={styles.pdfBtnText}>{pdfBusy ? "만드는 중…" : "PDF 만들기"}</Text>
            </Pressable>
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>담긴 순간 {sorted.length}개</Text>
            <Text style={styles.sectionHint}>성장책에 들어갈 순서예요.</Text>
          </View>

          {sorted.length === 0 ? (
            <EmptyState
              title="아직 성장책에 담긴 일기가 없어요."
              body="일기에서 기억하고 싶은 순간을 골라 성장책에 담아보세요."
              ctaLabel="일기 보러가기"
              onPressCta={onGoToDiary}
            />
          ) : (
            sorted.map((entry, index) => {
              const photo = diaryPrimaryPhoto(entry);
              const milestone = diaryMilestoneLabel(entry);
              const pageEdit = edit?.pages?.[entry.id];
              const hasComment = Boolean(pageEdit?.pageComment?.trim());
              const entryPhotoCount = diaryPhotoCount([entry]);
              return (
                <Pressable key={entry.id} style={styles.card} onPress={() => onOpenPage?.(entry)}>
                  <View style={styles.cardContent}>
                    <Text style={styles.index}>{index + 1}</Text>
                    {photo ? (
                      <Image source={{ uri: photo }} style={styles.thumb} contentFit="cover" />
                    ) : (
                      <View style={styles.thumbPlaceholder}>
                        {entry.moodStamp ? (
                          <DiaryMoodStamp id={entry.moodStamp} selected size="sm" />
                        ) : (
                          <Text style={styles.thumbFallback}>📔</Text>
                        )}
                      </View>
                    )}
                    <View style={styles.body}>
                      <View style={styles.dateRow}>
                        <Text style={styles.date} numberOfLines={1}>{entry.date}</Text>
                        <DiaryStampPair skyId={entry.weatherStamp} moodId={entry.moodStamp} size="sm" />
                      </View>
                      <Text style={styles.comment} numberOfLines={2}>
                        {milestone ?? diaryDisplayComment(entry)}
                      </Text>
                      {milestone ? <Text style={styles.tag}>🌱 {milestone}</Text> : null}
                      <View style={styles.metaRow}>
                        <Text style={styles.metaChip}>사진 {entryPhotoCount}장</Text>
                        <Text style={styles.metaChip}>코멘트 {hasComment ? "있음" : "없음"}</Text>
                      </View>
                    </View>
                  </View>
                  <View style={styles.cardActions}>
                    <Pressable
                      style={styles.pageEditBtn}
                      onPress={(event) => {
                        event.stopPropagation();
                        onOpenPage?.(entry);
                      }}
                    >
                      <BabyLogIcon kind="edit" size={13} color={colors.text} />
                      <Text style={styles.pageEditText}>페이지 편집</Text>
                    </Pressable>
                    <Pressable
                      style={styles.removeBtn}
                      onPress={(event) => {
                        event.stopPropagation();
                        confirmRemove(entry);
                      }}
                      accessibilityLabel="성장책에서 제거"
                    >
                      <BabyLogIcon kind="trash" size={13} color={colors.dangerText} />
                      <Text style={styles.removeText}>제거</Text>
                    </Pressable>
                  </View>
                </Pressable>
              );
            })
          )}
        </ScrollView>

        <GrowthBookPreviewModal
          embedded
          visible={previewOpen}
          babyName={babyName}
          entries={sorted}
          edit={edit}
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
  headerTitle: { fontSize: 16, fontWeight: "800", color: colors.text },
  headerSpacer: { minWidth: 48 },
  content: { paddingHorizontal: 18, paddingTop: 16 },
  hero: {
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 16,
    marginBottom: 12,
  },
  heroTitle: { fontSize: 17, fontWeight: "800", color: colors.text },
  heroStats: { fontSize: 13.5, fontWeight: "700", color: colors.amber, marginTop: 8 },
  heroHint: { fontSize: 12, color: colors.faint, marginTop: 6, lineHeight: 18 },
  editBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.amber,
    borderRadius: 14,
    paddingVertical: 15,
    marginBottom: 8,
  },
  editBtnText: { fontSize: 15, fontWeight: "800", color: colors.amberDark },
  secondaryActions: { flexDirection: "row", gap: 10, marginBottom: 18 },
  previewBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.amber,
    borderRadius: 14,
    paddingVertical: 13,
  },
  previewBtnText: { fontSize: 14, fontWeight: "800", color: colors.amber },
  pdfBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.cardHi,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingVertical: 13,
  },
  pdfBtnText: { fontSize: 13.5, fontWeight: "700", color: colors.text },
  btnDisabled: { opacity: 0.45 },
  sectionHeader: { marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontWeight: "800", color: colors.text },
  sectionHint: { marginTop: 4, fontSize: 12, color: colors.faint },
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
    color: colors.faint,
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
  thumbFallback: { fontSize: 20 },
  body: { flex: 1, minWidth: 0 },
  dateRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  date: { flex: 1, fontSize: 11.5, fontWeight: "700", color: colors.faint },
  comment: { fontSize: 13, color: colors.text, marginTop: 3, lineHeight: 19 },
  tag: { fontSize: 11.5, fontWeight: "700", color: colors.amber, marginTop: 6 },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  metaChip: { fontSize: 10.5, fontWeight: "700", color: colors.muted, backgroundColor: colors.cardHi, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  cardActions: { flexDirection: "row", justifyContent: "flex-end", gap: 8, marginTop: 10 },
  pageEditBtn: { flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderColor: colors.border, borderRadius: 9, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: colors.card },
  pageEditText: { fontSize: 11.5, fontWeight: "700", color: colors.text },
  removeBtn: {
    flexDirection: "row",
    gap: 4,
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 7,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  removeText: { fontSize: 11.5, fontWeight: "700", color: colors.dangerText },
});
