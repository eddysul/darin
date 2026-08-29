import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LinearGradient } from "expo-linear-gradient";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLanguage } from "../../LanguageContext";
import { useBabyLog } from "../../context/BabyLogContext";
import { useReduceMotion } from "../../hooks/useReduceMotion";
import type { DiaryEntry } from "../../types/babyLog";
import type { FamilyMember, FamilyRole } from "../../types/family";
import type { GrowthBookEdit } from "../../types/growthBook";
import { sortGrowthBookEntries } from "../../utils/diaryModel";
import {
  buildGrowthBookPageMeta,
  buildGrowthBookPages,
} from "../../utils/growthBookPages";
import type { GrowthBookCanvasMode } from "./GrowthBookPageCanvas";
import { GrowthBookReader } from "./GrowthBookReader";
import { CoverBookPageEditor } from "./growthBookEditor/CoverBookPageEditor";
import { PageEditor } from "./growthBookEditor/DiaryPageEditor";
import { FinalLetterBookPageEditor } from "./growthBookEditor/FinalLetterBookPageEditor";
import { styles } from "./growthBookEditor/styles";
import type { BookPageNavigationProps } from "./growthBookEditor/types";
import { useGrowthBookPageTurn } from "./growthBookEditor/useGrowthBookPageTurn";

type Props = {
  visible: boolean;
  babyName: string;
  babyId: string;
  entries: DiaryEntry[];
  edit: GrowthBookEdit;
  me?: FamilyMember;
  myRole: FamilyRole;
  onChange: (next: GrowthBookEdit) => void;
  onClose: () => void;
  onDismiss?: () => void;
  initialDiaryId?: string | null;
};

export function GrowthBookEditorModal({
  visible,
  babyName,
  babyId,
  entries,
  edit,
  me,
  myRole,
  onChange,
  onClose,
  onDismiss,
  initialDiaryId,
}: Props) {
  const { t, locale } = useLanguage();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  const { babyStickers } = useBabyLog();
  const [pageMode, setPageMode] = useState<GrowthBookCanvasMode>("edit");
  const [stickerPickerOpen, setStickerPickerOpen] = useState(false);
  const wasVisible = useRef(false);
  const bookEntries = useMemo(
    () => sortGrowthBookEntries(entries.filter((e) => e.includedInGrowthBook)),
    [entries],
  );
  const bookPages = useMemo(
    () => buildGrowthBookPages({ babyName, entries: bookEntries, edit, t, locale }),
    [babyName, bookEntries, edit, t, locale],
  );
  const pageMeta = useMemo(() => buildGrowthBookPageMeta(bookPages, t), [bookPages, t]);
  const {
    activePageIndex,
    setActivePageIndex,
    pageTurnDirection,
    pageTurnProgress,
    goToPage,
    resetTurnAnimation,
  } = useGrowthBookPageTurn(bookPages.length, reduceMotion);

  useEffect(() => {
    if (visible && !wasVisible.current) {
      const targetIndex = initialDiaryId
        ? bookPages.findIndex((page) => page.diaryId === initialDiaryId)
        : 0;
      setActivePageIndex(targetIndex >= 0 ? targetIndex : 0);
    }
    if (!visible) {
      resetTurnAnimation();
      setActivePageIndex(0);
      setPageMode("edit");
      setStickerPickerOpen(false);
    }
    wasVisible.current = visible;
  }, [bookPages, initialDiaryId, resetTurnAnimation, setActivePageIndex, visible]);

  const patch = useCallback(
    (updater: (prev: GrowthBookEdit) => GrowthBookEdit) => {
      onChange({ ...updater(edit), babyId, updatedAt: new Date().toISOString() });
    },
    [babyId, edit, onChange],
  );

  const activePage = bookPages[activePageIndex] ?? bookPages[0];
  const activeEntry = activePage?.diaryId
    ? bookEntries.find((entry) => entry.id === activePage.diaryId) ?? null
    : null;

  const navigation: BookPageNavigationProps = {
    pages: pageMeta,
    activeIndex: activePageIndex,
    onSelect: goToPage,
    onPrevious: () => goToPage(activePageIndex - 1),
    onNext: () => goToPage(activePageIndex + 1),
    pageTurnProgress,
    pageTurnDirection,
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose} onDismiss={onDismiss}>
      <View style={[styles.root, { paddingTop: Math.max(insets.top, 12) }]}>
        {stickerPickerOpen ? null : (
          <View style={styles.header}>
            <Pressable
              onPress={onClose}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={t("growth.critical.001")}
              style={styles.headerBtnHit}
            >
              <Text style={styles.headerBtn}>{t("growth.critical.001")}</Text>
            </Pressable>
            <Text style={styles.headerTitle}>{t("growth.critical.002")}</Text>
            <Pressable
              onPress={() => setPageMode((current) => current === "edit" ? "preview" : "edit")}
              hitSlop={10}
              style={styles.headerModeBtn}
              accessibilityRole="button"
              accessibilityLabel={pageMode === "edit" ? t("growth.critical.003") : t("growth.critical.004")}
            >
              <Text style={styles.headerBtn}>{pageMode === "edit" ? t("growth.critical.003") : t("growth.critical.004")}</Text>
            </Pressable>
          </View>
        )}

        {pageMode === "preview" ? (
          <View style={styles.editorReaderWrap}>
            <LinearGradient
              colors={["#3D342C", "#2A241F", "#1E1A16"]}
              style={StyleSheet.absoluteFill}
            />
            <GrowthBookReader
              pages={bookPages}
              stickers={babyStickers}
              currentPageIndex={activePageIndex}
              onPageIndexChange={setActivePageIndex}
              resetKey={`${visible}-${pageMode}-${bookPages.map((page) => page.id).join("|")}`}
              style={styles.editorReader}
            />
          </View>
        ) : null}

        {pageMode === "edit" && activePage.pageType === "cover" ? (
          <CoverBookPageEditor
            babyName={babyName}
            page={activePage}
            mode={pageMode}
            edit={edit}
            entries={bookEntries}
            bottomPad={insets.bottom}
            navigation={navigation}
            onPatch={patch}
          />
        ) : null}

        {pageMode === "edit" && activePage.pageType === "diary" && activeEntry ? (
          <PageEditor
            key={activeEntry.id}
            babyId={babyId}
            babyName={babyName}
            entry={activeEntry}
            edit={edit}
            me={me}
            myRole={myRole}
            bottomPad={insets.bottom}
            mode={pageMode}
            navigation={navigation}
            onPatch={patch}
            onStickerPickerOpenChange={setStickerPickerOpen}
          />
        ) : null}

        {pageMode === "edit" && activePage.pageType === "final_letter" ? (
          <FinalLetterBookPageEditor
            babyName={babyName}
            page={activePage}
            mode={pageMode}
            edit={edit}
            me={me}
            myRole={myRole}
            bottomPad={insets.bottom}
            navigation={navigation}
            onPatch={patch}
          />
        ) : null}
      </View>
    </Modal>
  );
}
