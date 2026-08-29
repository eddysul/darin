import { Pressable, Text } from "react-native";
import { colors } from "../../../theme";
import { BabyLogIcon, type MiscIconKey } from "../BabyLogIcon";
import { styles } from "./styles";

export function EditorTool({ label, icon, onPress }: { label: string; icon: MiscIconKey; onPress: () => void }) {
  return (
    <Pressable style={styles.editorTool} onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
      <BabyLogIcon kind={icon} size={18} color={colors.amberText} />
      <Text style={styles.editorToolLabel}>{label}</Text>
    </Pressable>
  );
}
