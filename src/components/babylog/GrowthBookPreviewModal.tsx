import { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { DiaryEntry } from "../../types/babyLog";
import type { GrowthBookEdit } from "../../types/growthBook";
import { buildGrowthBookPages } from "../../utils/growthBookPages";
import { useBabyLog } from "../../context/BabyLogContext";
import { GrowthBookReader } from "./GrowthBookReader";
import { useLanguage } from "../../LanguageContext";

type Props = {
  visible: boolean;
  babyName: string;
  entries: DiaryEntry[];
  edit?: GrowthBookEdit | null;
  onClose: () => void;
  /** Render as an overlay inside a parent Modal (avoids iOS nested-Modal failures). */
  embedded?: boolean;
  onPdfCreate?: () => void;
  initialPageIndex?: number;
};

/**
 * Growth book preview: BookFrame / PageSection / PageCanvas reader.
 * Pages turn with translateX — not a single currentPage content swap.
 */
export function GrowthBookPreviewModal({
  visible,
  babyName,
  entries,
  edit,
  onClose,
  embedded = false,
  onPdfCreate,
  initialPageIndex = 0,
}: Props) {
  const { t, locale } = useLanguage();
  const insets = useSafeAreaInsets();
  const { babyStickers } = useBabyLog();
  const [currentPageIndex, setCurrentPageIndex] = useState(0);

  const pages = useMemo(
    () => buildGrowthBookPages({ babyName, entries, edit, t, locale }),
    [babyName, entries, edit, t, locale],
  );

  useEffect(() => {
    if (!visible) return;
    const last = Math.max(0, pages.length - 1);
    setCurrentPageIndex(Math.min(Math.max(0, initialPageIndex), last));
  }, [visible, initialPageIndex, pages.length]);

  if (!visible) return null;

  const body = (
    <View
      style={[
        styles.root,
        embedded && styles.embeddedRoot,
        { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 12) },
      ]}
    >
      <LinearGradient colors={["#3D342C", "#2A241F", "#1E1A16"]} style={StyleSheet.absoluteFill} />

      <View style={styles.topBar}>
        <Pressable
          onPress={onClose}
          hitSlop={10}
          style={styles.topBtn}
          accessibilityRole="button"
          accessibilityLabel={t("growth.critical.008")}
        >
          <Text style={styles.topBtnText}>{t("growth.critical.008")}</Text>
        </Pressable>
        <Text style={styles.topTitle}>{t("growth.critical.069")}</Text>
        <View style={styles.topBtn} />
      </View>

      <GrowthBookReader
        pages={pages}
        stickers={babyStickers}
        currentPageIndex={currentPageIndex}
        onPageIndexChange={setCurrentPageIndex}
        resetKey={`${visible}-${pages.map((p) => p.id).join("|")}`}
        style={styles.reader}
        onPdfCreate={onPdfCreate}
      />
    </View>
  );

  if (embedded) return body;

  return (
    <Modal visible={visible} animationType="fade" presentationStyle="fullScreen" onRequestClose={onClose}>
      {body}
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  embeddedRoot: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  topBtn: { minWidth: 48 },
  topBtnText: { color: "rgba(255,255,255,0.75)", fontWeight: "700", fontSize: 15 },
  topTitle: { color: "#FFF8F0", fontWeight: "800", fontSize: 16 },
  reader: {
    flex: 1,
    paddingTop: 8,
  },
});
