import { Pressable, Text, View } from "react-native";
import { useLanguage } from "../../../LanguageContext";
import { styles } from "./styles";

export function CommentRow({
  authorLabel,
  text,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
}: {
  authorLabel: string;
  text: string;
  canEdit: boolean;
  canDelete: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t } = useLanguage();
  return (
    <View style={styles.commentCard}>
      <Text style={styles.commentAuthor}>{authorLabel}</Text>
      <Text style={styles.commentText}>“{text}”</Text>
      <View style={styles.commentActions}>
        {canEdit ? (
          <Pressable onPress={onEdit} hitSlop={8}>
            <Text style={styles.commentAction}>{t("growth.critical.046")}</Text>
          </Pressable>
        ) : null}
        {canDelete ? (
          <Pressable onPress={onDelete} hitSlop={8}>
            <Text style={[styles.commentAction, styles.commentDanger]}>{t("growth.critical.036")}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
