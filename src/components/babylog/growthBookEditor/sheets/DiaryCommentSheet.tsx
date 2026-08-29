import type { Dispatch, SetStateAction } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useLanguage } from "../../../../LanguageContext";
import { colors } from "../../../../theme";
import type { BabySticker } from "../../../../types/babySticker";
import type { GrowthBookCommentSticker, GrowthBookPageEdit } from "../../../../types/growthBook";
import { BabyStickerFromModel } from "../../BabyStickerView";
import { styles } from "../styles";

export function DiaryCommentSheet({
  pageEdit,
  commentDraft,
  setCommentDraft,
  commentStickerDrafts,
  setCommentStickerDrafts,
  babyStickers,
  openStickerPicker,
  upsertPage,
  setSheet,
}: {
  pageEdit: GrowthBookPageEdit;
  commentDraft: string;
  setCommentDraft: (value: string) => void;
  commentStickerDrafts: GrowthBookCommentSticker[];
  setCommentStickerDrafts: Dispatch<SetStateAction<GrowthBookCommentSticker[]>>;
  babyStickers: BabySticker[];
  openStickerPicker: (target: "page" | "comment" | "rolling") => void;
  upsertPage: (next: GrowthBookPageEdit) => void;
  setSheet: (sheet: "photo" | "layout" | "comment" | "rolling" | "template" | null) => void;
}) {
  const { t } = useLanguage();
  return (
    <>
      <Text style={styles.sheetHint}>{t("growth.critical.040")}</Text>
      <TextInput
        style={[styles.input, styles.sheetTextArea]}
        multiline
        value={commentDraft}
        onChangeText={setCommentDraft}
        placeholder={t("growth.critical.041")}
        placeholderTextColor={colors.faint}
      />
      <View style={styles.commentStickerHeader}>
        <Text style={styles.commentStickerTitle}>{t("growth.critical.042")}</Text>
        <Pressable onPress={() => openStickerPicker("comment")} style={styles.commentStickerAdd}>
          <Text style={styles.commentStickerAddText}>{t("growth.critical.043")}</Text>
        </Pressable>
      </View>
      {commentStickerDrafts.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.commentStickerList}>
          {commentStickerDrafts.slice().sort((a, b) => a.order - b.order).map((item) => {
            const sticker = babyStickers.find((candidate) => candidate.id === item.stickerId);
            if (!sticker) return null;
            return (
              <View key={item.id} style={styles.commentStickerChip}>
                <BabyStickerFromModel sticker={sticker} size={44} />
                <Pressable
                  style={styles.commentStickerRemove}
                  onPress={() => setCommentStickerDrafts((prev) => prev.filter((candidate) => candidate.id !== item.id))}
                  hitSlop={14}
                  accessibilityRole="button"
                  accessibilityLabel={t("sticker.critical.030")}
                >
                  <Text style={styles.commentStickerRemoveText}>×</Text>
                </Pressable>
              </View>
            );
          })}
        </ScrollView>
      ) : <Text style={styles.commentStickerEmpty}>{t("growth.critical.044")}</Text>}
      <Pressable style={styles.sheetPrimary} onPress={() => { upsertPage({ ...pageEdit, pageComment: commentDraft, commentStickers: commentStickerDrafts }); setSheet(null); }}>
        <Text style={styles.sheetPrimaryText}>{t("growth.critical.045")}</Text>
      </Pressable>
    </>
  );
}
