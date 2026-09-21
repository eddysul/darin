import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { ProfileAvatar } from "./ProfileAvatar";
import { BabyLogIcon } from "../babylog/BabyLogIcon";
import { useLanguage } from "../../LanguageContext";
import { colors, fontScaleCap, radius } from "../../theme";

const TOUCH_MIN = Platform.select({ ios: 44, android: 48 }) ?? 44;

type Props = {
  name: string;
  handle?: string;
  bio: string;
  avatarUrl?: string;
  saving?: boolean;
  onChangePhoto: () => void;
  onEditProfile: () => void;
};

export function ProfileSummarySection({
  name,
  handle,
  bio,
  avatarUrl,
  saving,
  onChangePhoto,
  onEditProfile,
}: Props) {
  const { t } = useLanguage();
  const photoLabel = avatarUrl ? t("chrome.critical.032") : t("chrome.critical.031");

  return (
    <View style={styles.row}>
      <View style={styles.avatarWrap}>
        <ProfileAvatar uri={avatarUrl} size={92} />
        <Pressable
          style={styles.avatarHit}
          onPress={onChangePhoto}
          disabled={saving}
          accessibilityRole="button"
          accessibilityLabel={photoLabel}
        />
        <Pressable
          style={styles.camera}
          onPress={onChangePhoto}
          disabled={saving}
          accessibilityRole="button"
          accessibilityLabel={photoLabel}
          hitSlop={8}
        >
          <BabyLogIcon kind="camera" size={13} color={colors.muted} strokeWidth={2.2} />
        </Pressable>
      </View>

      <View style={styles.copy}>
        <Text style={styles.name} numberOfLines={1} maxFontSizeMultiplier={fontScaleCap.chrome}>
          {name}
        </Text>
        {handle ? (
          <Text style={styles.handle} numberOfLines={1} maxFontSizeMultiplier={fontScaleCap.chrome}>
            {handle}
          </Text>
        ) : null}
        <Text style={styles.bio} numberOfLines={2} maxFontSizeMultiplier={fontScaleCap.chrome}>
          {bio}
        </Text>
        <Pressable
          style={styles.edit}
          onPress={onEditProfile}
          hitSlop={5}
          accessibilityRole="button"
          accessibilityLabel={t("memory.critical.223")}
        >
          <BabyLogIcon kind="edit" size={13} color={colors.text} strokeWidth={2.1} />
          <Text style={styles.editText} maxFontSizeMultiplier={fontScaleCap.control}>
            {t("memory.critical.223")}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingHorizontal: 20,
  },
  avatarWrap: {
    width: 92,
    height: 92,
  },
  avatarHit: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 46,
  },
  camera: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.chip,
    borderWidth: 2,
    borderColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  name: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  handle: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "600",
  },
  bio: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  edit: {
    alignSelf: "flex-start",
    minHeight: TOUCH_MIN,
    marginTop: 8,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: colors.chip,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  editText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: TOUCH_MIN > 44 ? 18 : 16,
  },
});
