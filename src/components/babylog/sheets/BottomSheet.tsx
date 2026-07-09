import type { ReactNode } from "react";
import { Modal, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { sheetStyles } from "./sheetStyles";

type Props = {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  sheetStyle?: StyleProp<ViewStyle>;
  maxHeight?: "compact" | "default";
};

export function BottomSheet({
  visible,
  onClose,
  children,
  sheetStyle,
  maxHeight = "default",
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={sheetStyles.backdrop} onPress={onClose}>
        <Pressable
          style={[
            sheetStyles.sheet,
            maxHeight === "compact" && sheetStyles.sheetCompact,
            sheetStyle,
          ]}
          onPress={() => {}}
        >
          <View style={styles.handleWrap}>
            <View style={sheetStyles.handle} />
          </View>
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  handleWrap: { alignItems: "center" },
});
