import { useEffect, useState } from "react";
import { View } from "react-native";
import { useLanguage } from "../../../LanguageContext";
import { useBabyLog } from "../../../context/BabyLogContext";
import type { DiaryEntry } from "../../../types/babyLog";
import type { GrowthBookEdit } from "../../../types/growthBook";
import type { GrowthBookPage } from "../../../utils/growthBookPages";
import type { GrowthBookCanvasMode } from "../GrowthBookPageCanvas";
import { GrowthBookPageCanvas } from "../GrowthBookPageCanvas";
import { BookPageNavigation } from "./BookPageNavigation";
import { CoverEditor } from "./CoverEditor";
import { EditorSheet } from "./EditorSheet";
import { EditorTool } from "./EditorTool";
import { SwipeableCanvasStage } from "./SwipeableCanvasStage";
import { styles } from "./styles";
import type { BookPageNavigationProps, GrowthBookEditorPatch } from "./types";

export function CoverBookPageEditor({
  babyName,
  page,
  mode,
  edit,
  bottomPad,
  navigation,
  onPatch,
}: {
  babyName: string;
  page: GrowthBookPage;
  mode: GrowthBookCanvasMode;
  edit: GrowthBookEdit;
  entries: DiaryEntry[];
  bottomPad: number;
  navigation: BookPageNavigationProps;
  onPatch: GrowthBookEditorPatch;
}) {
  const { t } = useLanguage();
  const [sheetOpen, setSheetOpen] = useState(false);
  const { babyStickers } = useBabyLog();
  useEffect(() => {
    if (mode !== "edit") setSheetOpen(false);
  }, [mode]);
  return (
    <View style={[styles.pageWorkspace, { paddingBottom: mode === "edit" ? bottomPad : Math.max(bottomPad, 10) }]}>
      <SwipeableCanvasStage navigation={navigation}>
        <GrowthBookPageCanvas page={page} pageType="cover" mode={mode} stickers={babyStickers} style={styles.editorCanvas} />
      </SwipeableCanvasStage>
      <BookPageNavigation {...navigation} />
      {mode === "edit" ? (
        <View style={styles.editorToolbarCompact}>
          <EditorTool label={t("growth.critical.007")} icon="edit" onPress={() => setSheetOpen(true)} />
        </View>
      ) : null}
      {sheetOpen ? (
        <EditorSheet bottomPad={bottomPad} title={t("growth.critical.007")} onClose={() => setSheetOpen(false)}>
          <CoverEditor babyName={babyName} edit={edit} bottomPad={0} onPatch={onPatch} />
        </EditorSheet>
      ) : null}
    </View>
  );
}
