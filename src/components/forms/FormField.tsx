import type { ReactNode } from "react";
import { StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import { colors, fontScaleCap } from "../../theme";

type AccessibleInputProps = {
  accessibilityLabel: string;
  accessibilityLabelledBy: string;
};

type Props = {
  fieldId: string;
  label: string;
  children: (inputProps: AccessibleInputProps) => ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
};

/** Visual-order preserving field wrapper that centrally binds labels to inputs. */
export function FormField({ fieldId, label, children, containerStyle, labelStyle }: Props) {
  const labelId = `${fieldId}-label`;
  return (
    <View style={[styles.field, containerStyle]}>
      <Text nativeID={labelId} style={[styles.label, labelStyle]} maxFontSizeMultiplier={fontScaleCap.control}>{label}</Text>
      {children({ accessibilityLabel: label, accessibilityLabelledBy: labelId })}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  label: { color: colors.text, fontSize: 13, fontWeight: "800" },
});
