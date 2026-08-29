import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { useLanguage } from "../../../LanguageContext";
import { useBabyLog } from "../../../context/BabyLogContext";
import type { FamilyMember, FamilyRole } from "../../../types/family";
import type { GrowthBookEdit } from "../../../types/growthBook";
import type { GrowthBookPage } from "../../../utils/growthBookPages";
import { DiaryPageStylePicker } from "../DiaryPageStylePicker";
import type { GrowthBookCanvasMode } from "../GrowthBookPageCanvas";
import { GrowthBookPageCanvas } from "../GrowthBookPageCanvas";
import { BookPageNavigation } from "./BookPageNavigation";
import { EditorSheet } from "./EditorSheet";
import { EditorTool } from "./EditorTool";
import { LetterEditor } from "./LetterEditor";
import { SwipeableCanvasStage } from "./SwipeableCanvasStage";
import { styles } from "./styles";
import type { BookPageNavigationProps, GrowthBookEditorPatch } from "./types";

export function FinalLetterBookPageEditor({
  babyName,
  page,
  mode,
  edit,
  me,
  myRole,
  bottomPad,
  navigation,
  onPatch,
}: {
  babyName: string;
  page: GrowthBookPage;
  mode: GrowthBookCanvasMode;
  edit: GrowthBookEdit;
  me?: FamilyMember;
  myRole: FamilyRole;
  bottomPad: number;
  navigation: BookPageNavigationProps;
  onPatch: GrowthBookEditorPatch;
}) {
  const { t } = useLanguage();
  const [sheet, setSheet] = useState<"letter" | "template" | null>(null);
  const { babyStickers } = useBabyLog();
  useEffect(() => {
    if (mode !== "edit") setSheet(null);
  }, [mode]);
  const letterTemplateId = edit.letterTemplateId ?? edit.pageTemplateId ?? "basic_line";
  return (
    <View style={[styles.pageWorkspace, { paddingBottom: mode === "edit" ? bottomPad : Math.max(bottomPad, 10) }]}>
      <SwipeableCanvasStage navigation={navigation}>
        <GrowthBookPageCanvas page={page} pageType="final_letter" mode={mode} stickers={babyStickers} style={styles.editorCanvas} />
      </SwipeableCanvasStage>
      <BookPageNavigation {...navigation} />
      {mode === "edit" ? (
        <View style={styles.editorToolbar}>
          <EditorTool label={t("growth.critical.159")} icon="bookmark" onPress={() => setSheet("template")} />
          <EditorTool label={t("growth.critical.009")} icon="chat" onPress={() => setSheet("letter")} />
        </View>
      ) : null}
      {sheet ? (
        <EditorSheet
          bottomPad={bottomPad}
          title={sheet === "template" ? t("growth.critical.163") : t("growth.critical.010")}
          onClose={() => setSheet(null)}
        >
          {sheet === "template" ? (
            <View>
              <Text style={styles.sheetHint}>{t("growth.critical.164")}</Text>
              <DiaryPageStylePicker
                value={letterTemplateId}
                dateLabel={t("growth.critical.010")}
                title={page.title}
                body={page.body}
                onChange={(id) => onPatch((prev) => ({ ...prev, letterTemplateId: id }))}
              />
            </View>
          ) : (
            <LetterEditor babyName={babyName} edit={edit} me={me} myRole={myRole} bottomPad={0} onPatch={onPatch} />
          )}
        </EditorSheet>
      ) : null}
    </View>
  );
}
