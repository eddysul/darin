import { useMemo, useState } from "react";
import { Image } from "expo-image";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { DiaryEntry } from "../../types/babyLog";
import {
  diaryDisplayComment,
  diaryMilestoneLabel,
  diaryPhotoCount,
  diaryPrimaryPhoto,
  sortGrowthBookEntries,
} from "../../utils/diaryModel";
import { estimateGrowthBookPageCount } from "../../utils/growthBookPages";
import { colors, radius } from "../../theme";
import { EmptyState } from "../states/FeedbackStates";
import { BabyLogIcon } from "./BabyLogIcon";
import { DiaryMoodStamp, DiaryStampPair } from "./DiaryStamp";
import { GrowthBookPreviewModal } from "./GrowthBookPreviewModal";

type Props = {
  visible: boolean;
  babyName: string;
  entries: DiaryEntry[];
  onClose: () => void;
  onRemove: (id: string) => void;
  onOpenEntry?: (entry: DiaryEntry) => void;
};

export function GrowthBookVaultModal({
  visible,
  babyName,
  entries,
  onClose,
  onRemove,
  onOpenEntry,
}: Props) {
  const insets = useSafeAreaInsets();
  const [previewOpen, setPreviewOpen] = useState(false);
  const sorted = useMemo(
    () => sortGrowthBookEntries(entries.filter((e) => e.includedInGrowthBook)),
    [entries],
  );
  const photoCount = useMemo(() => diaryPhotoCount(sorted), [sorted]);
  const pageEstimate = estimateGrowthBookPageCount(sorted.length);

  return (
    <>
      <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
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
          >
            <View style={styles.hero}>
              <Text style={styles.heroTitle}>📖 {babyName}의 성장책</Text>
              <Text style={styles.heroStats}>
                담은 기록 {sorted.length}개 · 사진 {photoCount}장 · 예상 {pageEstimate}쪽
              </Text>
              <Text style={styles.heroHint}>시간순으로 모아두었어요. 미리보기로 책처럼 넘겨보세요.</Text>
            </View>

            <Pressable
              style={[styles.previewBtn, sorted.length === 0 && styles.previewBtnDisabled]}
              disabled={sorted.length === 0}
              onPress={() => setPreviewOpen(true)}
            >
              <Text style={styles.previewBtnText}>성장책 미리보기</Text>
              <BabyLogIcon kind="chevron" size={14} color={colors.amber} />
            </Pressable>

            <Pressable style={styles.pdfBtn} disabled>
              <Text style={styles.pdfBtnText}>PDF 만들기</Text>
              <View style={styles.comingSoon}>
                <Text style={styles.comingSoonText}>Coming soon</Text>
              </View>
            </Pressable>

            {sorted.length === 0 ? (
              <EmptyState
                title="아직 성장책에 담은 순간이 없어요."
                body="소중한 일기에서 📖 담기를 눌러보세요."
              />
            ) : (
              sorted.map((entry, index) => {
                const photo = diaryPrimaryPhoto(entry);
                const milestone = diaryMilestoneLabel(entry);
                return (
                  <Pressable key={entry.id} style={styles.card} onPress={() => onOpenEntry?.(entry)}>
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
                        <Text style={styles.date} numberOfLines={1}>
                          {entry.date}
                        </Text>
                        <DiaryStampPair skyId={entry.weatherStamp} moodId={entry.moodStamp} size="sm" />
                      </View>
                      <Text style={styles.comment} numberOfLines={2}>
                        {milestone ? milestone : diaryDisplayComment(entry)}
                      </Text>
                      {milestone ? <Text style={styles.tag}>🌱 {milestone}</Text> : null}
                    </View>
                    <Pressable
                      style={styles.removeBtn}
                      onPress={() => onRemove(entry.id)}
                      hitSlop={8}
                      accessibilityLabel="성장책에서 빼기"
                    >
                      <BabyLogIcon kind="trash" size={15} color={colors.muted} />
                    </Pressable>
                  </Pressable>
                );
              })
            )}
          </ScrollView>
        </View>
      </Modal>

      <GrowthBookPreviewModal
        visible={previewOpen}
        babyName={babyName}
        entries={sorted}
        onClose={() => setPreviewOpen(false)}
      />
    </>
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
  previewBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: colors.amber,
    borderRadius: 14,
    paddingVertical: 14,
    marginBottom: 8,
  },
  previewBtnDisabled: { opacity: 0.45 },
  previewBtnText: { fontSize: 14.5, fontWeight: "800", color: colors.amberDark },
  pdfBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.cardHi,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingVertical: 12,
    marginBottom: 16,
    opacity: 0.75,
  },
  pdfBtnText: { fontSize: 13, fontWeight: "700", color: colors.muted },
  comingSoon: {
    backgroundColor: colors.amberSoft,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  comingSoonText: { fontSize: 10.5, fontWeight: "800", color: colors.amber },
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
  },
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
  removeBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.cardHi,
  },
});
