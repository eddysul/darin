import type { Dispatch, SetStateAction } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useLanguage } from "../../../../LanguageContext";
import { colors } from "../../../../theme";
import type { BabySticker } from "../../../../types/babySticker";
import type { FamilyMember, FamilyRole } from "../../../../types/family";
import { canDeleteGrowthBookNote, canEditOwnGrowthBookNote, memberRelationshipLabel } from "../../../../types/family";
import type { GrowthBookPageEdit } from "../../../../types/growthBook";
import { formatGrowthAuthorLabel } from "../../../../types/growthBook";
import { BabyStickerFromModel } from "../../BabyStickerView";
import { styles } from "../styles";

export function DiaryRollingSheet({
  pageEdit,
  me,
  myRole,
  canWrite,
  rollingDraft,
  setRollingDraft,
  rollingStickerDraftIds,
  setRollingStickerDraftIds,
  editingCommentId,
  setEditingCommentId,
  babyStickers,
  openStickerPicker,
  upsertPage,
  saveRollingComment,
}: {
  pageEdit: GrowthBookPageEdit;
  me?: FamilyMember;
  myRole: FamilyRole;
  canWrite: boolean;
  rollingDraft: string;
  setRollingDraft: (value: string) => void;
  rollingStickerDraftIds: string[];
  setRollingStickerDraftIds: Dispatch<SetStateAction<string[]>>;
  editingCommentId: string | null;
  setEditingCommentId: (id: string | null) => void;
  babyStickers: BabySticker[];
  openStickerPicker: (target: "page" | "comment" | "rolling") => void;
  upsertPage: (next: GrowthBookPageEdit) => void;
  saveRollingComment: () => void;
}) {
  const { t } = useLanguage();
  return (
    <ScrollView style={styles.sheetScroll} keyboardShouldPersistTaps="handled">
      {pageEdit.rollingComments.map((comment) => (
        <View key={comment.id} style={styles.rollingSheetCard}>
          <Text style={styles.commentAuthor}>{formatGrowthAuthorLabel(comment.authorRelationshipLabel, comment.authorName, t)}</Text>
          <Text style={styles.commentText}>“{comment.text}”</Text>
          {(comment.stickerIds ?? []).length > 0 ? (
            <View style={styles.rollingStickerPreviewRow}>
              {(comment.stickerIds ?? []).map((stickerId, index) => {
                const sticker = babyStickers.find((item) => item.id === stickerId);
                return sticker ? <BabyStickerFromModel key={`${stickerId}-${index}`} sticker={sticker} size={30} /> : null;
              })}
            </View>
          ) : null}
          <View style={styles.commentActions}>
            {canEditOwnGrowthBookNote(myRole, comment.authorId, me) ? (
              <Pressable onPress={() => { setEditingCommentId(comment.id); setRollingDraft(comment.text); setRollingStickerDraftIds(comment.stickerIds ?? []); }}><Text style={styles.commentAction}>{t("growth.critical.046")}</Text></Pressable>
            ) : null}
            {canDeleteGrowthBookNote(myRole, comment.authorId, me) ? (
              <Pressable onPress={() => upsertPage({ ...pageEdit, rollingComments: pageEdit.rollingComments.filter((item) => item.id !== comment.id) })}><Text style={[styles.commentAction, styles.commentDanger]}>{t("growth.critical.036")}</Text></Pressable>
            ) : null}
          </View>
        </View>
      ))}
      {canWrite && me ? (
        <>
          <Text style={styles.autoAuthor}>{t("growth.critical.047", { author: formatGrowthAuthorLabel(memberRelationshipLabel(me), me.name, t) })}</Text>
          <TextInput style={[styles.input, styles.sheetTextArea]} multiline value={rollingDraft} onChangeText={setRollingDraft} placeholder={t("growth.critical.048")} placeholderTextColor={colors.faint} />
          <View style={styles.commentStickerHeader}>
            <Text style={styles.commentStickerTitle}>{t("growth.critical.049")}</Text>
            <Pressable onPress={() => openStickerPicker("rolling")} style={styles.commentStickerAdd}>
              <Text style={styles.commentStickerAddText}>{t("growth.critical.043")}</Text>
            </Pressable>
          </View>
          {rollingStickerDraftIds.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.commentStickerList}>
              {rollingStickerDraftIds.map((stickerId, index) => {
                const sticker = babyStickers.find((item) => item.id === stickerId);
                if (!sticker) return null;
                return (
                  <View key={`${stickerId}-${index}`} style={styles.commentStickerChip}>
                    <BabyStickerFromModel sticker={sticker} size={36} />
                    <Pressable
                      style={styles.commentStickerRemove}
                      onPress={() => setRollingStickerDraftIds((prev) => prev.filter((_, itemIndex) => itemIndex !== index))}
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
          ) : <Text style={styles.commentStickerEmpty}>{t("growth.critical.050")}</Text>}
          <Pressable style={styles.sheetPrimary} onPress={saveRollingComment}><Text style={styles.sheetPrimaryText}>{editingCommentId ? t("growth.critical.051") : t("growth.critical.052")}</Text></Pressable>
        </>
      ) : <Text style={styles.sheetHint}>{t("growth.critical.053")}</Text>}
    </ScrollView>
  );
}
