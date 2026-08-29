import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useLanguage } from "../../../LanguageContext";
import { colors } from "../../../theme";
import type { GrowthBookEdit } from "../../../types/growthBook";
import { defaultGrowthBookCoverTitleKo, isDefaultGrowthBookCoverTitle } from "../../../types/growthBook";
import { DiaryCoverPicker } from "../DiaryCoverPicker";
import { DiaryCoverTemplate } from "../DiaryCoverTemplate";
import { pickImageUri } from "./pickImage";
import { styles } from "./styles";
import type { GrowthBookEditorPatch } from "./types";

export function CoverEditor({
  babyName,
  edit,
  bottomPad,
  onPatch,
}: {
  babyName: string;
  edit: GrowthBookEdit;
  bottomPad: number;
  onPatch: GrowthBookEditorPatch;
}) {
  const { t } = useLanguage();
  const titleIsDefault = isDefaultGrowthBookCoverTitle(edit.coverTitle, babyName);
  const title = titleIsDefault
    ? t("growth.critical.139", { babyName })
    : edit.coverTitle.trim();

  return (
    <ScrollView
      contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 28 }]}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.label}>{t("growth.critical.155")}</Text>
      <Text style={styles.sheetHint}>{t("growth.critical.156")}</Text>
      <View style={styles.coverTemplatePreview}>
        <DiaryCoverTemplate
          fill
          styleId={edit.coverTemplateId}
          photoUri={edit.coverPhotoUri}
          title={title}
          subtitle={edit.coverSubtitle}
          caption={edit.coverDateRange}
        />
      </View>
      <DiaryCoverPicker
        value={edit.coverTemplateId ?? "cloud_sky"}
        photoUri={edit.coverPhotoUri}
        title={title}
        onChange={(id) => onPatch((prev) => ({ ...prev, coverTemplateId: id }))}
      />

      <Text style={[styles.label, { marginTop: 14 }]}>{t("growth.critical.011")}</Text>
      <TextInput
        style={styles.input}
        value={title}
        onChangeText={(text) => onPatch((prev) => ({
          ...prev,
          coverTitle: text.trim() ? text : defaultGrowthBookCoverTitleKo(babyName),
        }))}
        placeholder={t("growth.critical.139", { babyName })}
        placeholderTextColor={colors.faint}
      />

      <Text style={[styles.label, { marginTop: 14 }]}>{t("growth.critical.012")}</Text>
      <TextInput
        style={styles.input}
        value={edit.coverSubtitle ?? ""}
        onChangeText={(text) => onPatch((prev) => ({ ...prev, coverSubtitle: text }))}
        placeholder={t("growth.critical.013")}
        placeholderTextColor={colors.faint}
      />

      <Text style={[styles.label, { marginTop: 14 }]}>{t("growth.critical.014")}</Text>
      <TextInput
        style={styles.input}
        value={edit.coverDateRange ?? ""}
        onChangeText={(text) => onPatch((prev) => ({ ...prev, coverDateRange: text }))}
        placeholder={t("growth.critical.015")}
        placeholderTextColor={colors.faint}
      />

      <Text style={[styles.label, { marginTop: 18 }]}>{t("growth.critical.016")}</Text>
      <Pressable
        style={styles.primaryBtn}
        onPress={async () => {
          const uri = await pickImageUri();
          if (uri) onPatch((prev) => ({ ...prev, coverPhotoUri: uri }));
        }}
      >
        <Text style={styles.primaryBtnText}>{t("growth.critical.018")}</Text>
      </Pressable>
    </ScrollView>
  );
}
