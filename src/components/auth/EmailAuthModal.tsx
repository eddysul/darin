import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { User } from "@supabase/supabase-js";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../../theme";
import { EmailAuthForm } from "./EmailAuthForm";

export function EmailAuthModal({
  visible,
  onClose,
  onAuthenticated,
}: {
  visible: boolean;
  onClose: () => void;
  onAuthenticated: (payload: { user: User; email: string; name?: string }) => void | Promise<void>;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 14) }]}>
          <Pressable onPress={onClose} style={styles.headerButton}><Text style={styles.headerButtonText}>닫기</Text></Pressable>
          <Text style={styles.headerTitle}>이메일 계정 연결</Text>
          <View style={styles.headerButton} />
        </View>
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 28 }]} keyboardShouldPersistTaps="handled">
          <Text style={styles.guide}>익명 계정을 새 이메일 계정으로 연결하면 지금까지의 아기와 기록이 그대로 유지돼요.</Text>
          <EmailAuthForm onAuthenticated={onAuthenticated} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { minHeight: 58, paddingHorizontal: 16, paddingBottom: 12, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, backgroundColor: colors.card },
  headerButton: { width: 56, minHeight: 32, justifyContent: "center" },
  headerButtonText: { color: colors.muted, fontSize: 14, fontWeight: "700" },
  headerTitle: { color: colors.text, fontSize: 16, fontWeight: "900", paddingBottom: 7 },
  content: { padding: 22, gap: 18 },
  guide: { color: colors.muted, fontSize: 13, lineHeight: 20 },
});
