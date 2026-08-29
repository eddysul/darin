import { Pressable, ScrollView, Text } from "react-native";
import { useLanguage } from "../../../../LanguageContext";
import type { GrowthBookPageEdit } from "../../../../types/growthBook";
import {
  PHOTO_LAYOUT_OPTIONS,
  PRIMARY_RATIO_LAYOUTS,
  SECONDARY_RATIO_LAYOUTS,
} from "../../../../utils/growthBookPhotoLayouts";
import { PHOTO_LAYOUT_MESSAGE_KEYS } from "../photoLayoutMessages";
import { PhotoLayoutThumbnail } from "../PhotoLayoutThumbnail";
import { RatioOptionRow } from "../RatioOptionRow";
import { styles } from "../styles";

export function DiaryLayoutSheet({
  pageEdit,
  upsertPage,
  setPhotoSwapSourceIndex,
}: {
  pageEdit: GrowthBookPageEdit;
  upsertPage: (next: GrowthBookPageEdit) => void;
  setPhotoSwapSourceIndex: (index: number | null) => void;
}) {
  const { t } = useLanguage();
  return (
    <ScrollView style={styles.sheetScroll} contentContainerStyle={styles.sheetOptionGrid}>
      {PHOTO_LAYOUT_OPTIONS.map((option) => (
        <Pressable
          key={option.value}
          onPress={() => {
            upsertPage({ ...pageEdit, photoLayout: option.value, photoLayoutTuning: undefined });
            setPhotoSwapSourceIndex(null);
          }}
          style={[styles.sheetOption, pageEdit.photoLayout === option.value && styles.sheetOptionSelected]}
        >
          <PhotoLayoutThumbnail
            layout={option.value}
            selected={pageEdit.photoLayout === option.value}
            tuning={pageEdit.photoLayout === option.value ? pageEdit.photoLayoutTuning : undefined}
          />
          <Text style={[styles.sheetOptionText, pageEdit.photoLayout === option.value && styles.sheetOptionTextSelected]}>{t(PHOTO_LAYOUT_MESSAGE_KEYS[option.value])}</Text>
        </Pressable>
      ))}
      {PRIMARY_RATIO_LAYOUTS.has(pageEdit.photoLayout) ? (
        <RatioOptionRow
          title={pageEdit.photoLayout.includes("top_large") ? t("growth.critical.037") : t("growth.critical.038")}
          values={[0.55, 0.6, 0.65, 0.7]}
          value={pageEdit.photoLayoutTuning?.primaryRatio}
          onChange={(primaryRatio) => upsertPage({
            ...pageEdit,
            photoLayoutTuning: {
              ...pageEdit.photoLayoutTuning,
              primaryRatio: primaryRatio as 0.55 | 0.6 | 0.65 | 0.7 | undefined,
            },
          })}
        />
      ) : null}
      {SECONDARY_RATIO_LAYOUTS.has(pageEdit.photoLayout) ? (
        <RatioOptionRow
          title={t("growth.critical.039")}
          values={[0.55, 0.6, 0.65]}
          value={pageEdit.photoLayoutTuning?.secondaryTopRatio}
          onChange={(secondaryTopRatio) => upsertPage({
            ...pageEdit,
            photoLayoutTuning: {
              ...pageEdit.photoLayoutTuning,
              secondaryTopRatio: secondaryTopRatio as 0.55 | 0.6 | 0.65 | undefined,
            },
          })}
        />
      ) : null}
    </ScrollView>
  );
}
