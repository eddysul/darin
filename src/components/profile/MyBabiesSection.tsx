import { Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { ProfileAvatar } from "./ProfileAvatar";
import { BabyLogIcon } from "../babylog/BabyLogIcon";
import { useLanguage } from "../../LanguageContext";
import { familyRoleMessageKey } from "../../types/family";
import type { MyProfileBabyItem } from "../../types/myProfileShowcase";
import { colors, fontScaleCap, radius } from "../../theme";
import { RoleBadge } from "./RoleBadge";

const TOUCH_MIN = Platform.select({ ios: 44, android: 48 }) ?? 44;
const SIDE = 20;
const GAP = 10;

type Props = {
  babies: MyProfileBabyItem[];
  loading?: boolean;
  onPressManage: () => void;
  onPressBaby: (babyId: string) => void;
};

export function MyBabiesSection({ babies, loading, onPressManage, onPressBaby }: Props) {
  const { t } = useLanguage();
  const { width } = useWindowDimensions();
  const nameMaxWidth = Math.max(72, width - SIDE * 2 - 108);

  return (
    <View style={styles.section}>
      <View style={styles.heading}>
        <Text style={styles.title} maxFontSizeMultiplier={fontScaleCap.chrome}>
          {t("memory.critical.225")}
        </Text>
        <Pressable
          style={styles.link}
          onPress={onPressManage}
          accessibilityRole="button"
          accessibilityLabel={t("memory.critical.226")}
        >
          <Text style={styles.linkText} maxFontSizeMultiplier={fontScaleCap.chrome}>
            {t("memory.critical.226")}
          </Text>
          <BabyLogIcon kind="chevron" size={15} color={colors.muted} strokeWidth={2.1} />
        </Pressable>
      </View>

      {loading ? (
        <ScrollView
          horizontal
          nestedScrollEnabled
          directionalLockEnabled
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.row}
        >
          <View style={[styles.card, styles.skeleton, { width: 148 }]} />
          <View style={[styles.card, styles.skeleton, { width: 148 }]} />
        </ScrollView>
      ) : babies.length ? (
        <ScrollView
          horizontal
          nestedScrollEnabled
          directionalLockEnabled
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.row}
        >
          {babies.map((baby) => (
            <Pressable
              key={baby.id}
              style={styles.card}
              onPress={() => onPressBaby(baby.id)}
              accessibilityRole="button"
              accessibilityLabel={baby.name}
            >
              <ProfileAvatar uri={baby.avatarUrl} size={48} fallback="baby" />
              <View style={styles.meta}>
                <Text
                  style={[styles.name, { maxWidth: nameMaxWidth }]}
                  numberOfLines={1}
                  maxFontSizeMultiplier={fontScaleCap.chrome}
                >
                  {baby.name}
                </Text>
                <Text
                  style={[styles.age, { maxWidth: nameMaxWidth }]}
                  numberOfLines={1}
                  maxFontSizeMultiplier={fontScaleCap.chrome}
                >
                  {baby.ageLabel}
                </Text>
                <View style={styles.badge}>
                  <RoleBadge role={baby.role} label={t(familyRoleMessageKey(baby.role))} />
                </View>
              </View>
              <BabyLogIcon kind="chevron" size={16} color={colors.faint} strokeWidth={2.1} />
            </Pressable>
          ))}
        </ScrollView>
      ) : (
        <Pressable
          style={styles.empty}
          onPress={onPressManage}
          accessibilityRole="button"
          accessibilityLabel={t("memory.critical.233")}
        >
          <Text style={styles.emptyTitle}>{t("memory.critical.232")}</Text>
          <Text style={styles.emptyBody}>{t("memory.critical.233")}</Text>
        </Pressable>
      )}

      <Text style={styles.note} maxFontSizeMultiplier={fontScaleCap.chrome}>
        {t("memory.critical.227")}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 10,
  },
  heading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    paddingHorizontal: SIDE,
  },
  row: {
    flexDirection: "row",
    paddingHorizontal: SIDE,
    gap: GAP,
    alignItems: "center",
  },
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
  },
  link: {
    minHeight: TOUCH_MIN,
    flexDirection: "row",
    alignItems: "center",
    gap: 1,
  },
  linkText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "600",
  },
  card: {
    minHeight: 88,
    flexGrow: 0,
    flexShrink: 0,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingVertical: 12,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  skeleton: {
    minHeight: 88,
    backgroundColor: colors.surface,
  },
  meta: {
    flexGrow: 0,
    flexShrink: 0,
    gap: 2,
  },
  name: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "800",
  },
  age: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "600",
  },
  badge: {
    alignSelf: "flex-start",
    marginTop: 4,
  },
  empty: {
    minHeight: 88,
    marginHorizontal: SIDE,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 18,
    paddingHorizontal: 16,
    gap: 4,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  emptyBody: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "600",
  },
  note: {
    color: colors.faint,
    fontSize: 11.5,
    lineHeight: 16,
    paddingHorizontal: SIDE,
  },
});
