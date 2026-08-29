import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useLanguage } from "../../../LanguageContext";
import { styles } from "./styles";

export function EditorSheet({
  bottomPad,
  title,
  onClose,
  closeHitSlop,
  children,
}: {
  bottomPad: number;
  title: string;
  onClose: () => void;
  closeHitSlop?: number;
  children: ReactNode;
}) {
  const { t } = useLanguage();
  return (
    <View style={styles.sheetOverlay}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={[styles.editorSheet, { paddingBottom: bottomPad + 14 }]}>
        <View style={styles.sheetHandle} />
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>{title}</Text>
          <Pressable onPress={onClose} hitSlop={closeHitSlop}><Text style={styles.sheetClose}>{t("growth.critical.008")}</Text></Pressable>
        </View>
        {children}
      </View>
    </View>
  );
}
