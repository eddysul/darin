import type { ReactNode } from "react";
import { Platform, StyleSheet, Text, TextInput, View } from "react-native";
import { colors, fontScaleCap } from "../../theme";

const TOUCH_MIN = Platform.select({ ios: 44, android: 48 }) ?? 44;

type Props = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  helper?: string;
  status?: string;
  statusTone?: "ok" | "error";
  trailing?: ReactNode;
  maxLength?: number;
  autoCapitalize?: "none" | "sentences";
  editable?: boolean;
};

export function ProfileEditFieldRow({
  label,
  value,
  onChangeText,
  placeholder,
  helper,
  status,
  statusTone,
  trailing,
  maxLength,
  autoCapitalize = "sentences",
  editable = true,
}: Props) {
  return (
    <View style={styles.block}>
      <View style={styles.row}>
        <Text style={styles.label} maxFontSizeMultiplier={fontScaleCap.control}>{label}</Text>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.faint}
          maxLength={maxLength}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          editable={editable}
          maxFontSizeMultiplier={fontScaleCap.control}
        />
        {trailing}
      </View>
      {status ? (
        <Text
          style={[styles.status, statusTone === "error" ? styles.statusError : styles.statusOk]}
          accessibilityLiveRegion="polite"
          maxFontSizeMultiplier={fontScaleCap.control}
        >
          {status}
        </Text>
      ) : helper ? (
        <Text style={styles.helper} maxFontSizeMultiplier={fontScaleCap.control}>{helper}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    minHeight: TOUCH_MIN,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  label: {
    width: 88,
    color: colors.text,
    fontSize: 15,
    fontWeight: "600",
  },
  input: {
    flex: 1,
    minHeight: TOUCH_MIN - 8,
    color: colors.text,
    fontSize: 15,
    paddingVertical: 8,
  },
  helper: {
    marginTop: 2,
    marginLeft: 100,
    color: colors.faint,
    fontSize: 12,
    lineHeight: 16,
  },
  status: {
    marginTop: 2,
    marginLeft: 100,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
  },
  statusOk: { color: colors.accentStrong },
  statusError: { color: colors.dangerText },
});
