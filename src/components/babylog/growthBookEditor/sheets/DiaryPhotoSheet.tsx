import { Image } from "expo-image";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useLanguage } from "../../../../LanguageContext";
import type { GrowthBookPageEdit } from "../../../../types/growthBook";
import { getPhotoLayoutCount } from "../../../../utils/growthBookPhotoLayouts";
import { styles } from "../styles";

export function DiaryPhotoSheet({
  pageEdit,
  photos,
  selectedPhotoIndex,
  pickForSlot,
  setPhotos,
}: {
  pageEdit: GrowthBookPageEdit;
  photos: string[];
  selectedPhotoIndex: number;
  pickForSlot: (index: number) => void;
  setPhotos: (nextPhotos: string[]) => void;
}) {
  const { t } = useLanguage();
  return (
    <ScrollView style={styles.sheetScroll} keyboardShouldPersistTaps="handled">
      <Text style={styles.sheetHint}>{t("growth.critical.032")}</Text>
      <Text style={styles.sheetHint}>{t("growth.critical.033")}</Text>
      {Array.from({ length: Math.max(getPhotoLayoutCount(pageEdit.photoLayout), photos.length) }, (_, index) => {
        const uri = photos[index];
        return (
          <View key={index} style={[styles.photoSheetRow, selectedPhotoIndex === index && styles.photoSheetRowSelected]}>
            {uri ? <Image source={{ uri }} style={styles.photoSheetThumb} contentFit="cover" /> : <View style={styles.photoSheetEmpty}><Text>＋</Text></View>}
            <Text style={styles.photoSheetLabel}>{t("growth.critical.021")} {index + 1}</Text>
            <Pressable onPress={() => void pickForSlot(index)}><Text style={styles.sheetAction}>{uri ? t("growth.critical.034") : t("growth.critical.035")}</Text></Pressable>
            {uri ? (
              <Pressable onPress={() => setPhotos(photos.filter((_, photoIndex) => photoIndex !== index))}>
                <Text style={[styles.sheetAction, styles.sheetDanger]}>{t("growth.critical.036")}</Text>
              </Pressable>
            ) : null}
          </View>
        );
      })}
    </ScrollView>
  );
}
