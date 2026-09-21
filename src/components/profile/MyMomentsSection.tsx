import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { BabyLogIcon } from "../babylog/BabyLogIcon";
import { useLanguage } from "../../LanguageContext";
import type { MemoryMomentPreview } from "../../types/memory";
import { colors, fontScaleCap, radius } from "../../theme";

const TOUCH_MIN = Platform.select({ ios: 44, android: 48 }) ?? 44;

type Props = {
  moments: MemoryMomentPreview[];
  loading?: boolean;
  onPressSeeAll: () => void;
  onPressMoment: (memoryPostId: string) => void;
};

export function MyMomentsSection({ moments, loading, onPressSeeAll, onPressMoment }: Props) {
  const { t } = useLanguage();

  return (
    <View style={styles.section}>
      <View style={styles.heading}>
        <Text style={styles.title} maxFontSizeMultiplier={fontScaleCap.chrome}>
          {t("memory.critical.228")}
        </Text>
        <Pressable
          style={styles.link}
          onPress={onPressSeeAll}
          accessibilityRole="button"
          accessibilityLabel={t("memory.critical.229")}
        >
          <Text style={styles.linkText} maxFontSizeMultiplier={fontScaleCap.chrome}>
            {t("memory.critical.229")}
          </Text>
          <BabyLogIcon kind="chevron" size={15} color={colors.muted} strokeWidth={2.1} />
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.grid}>
          <View style={styles.skeleton} />
          <View style={styles.skeleton} />
          <View style={styles.skeleton} />
        </View>
      ) : moments.length ? (
        <View style={styles.grid}>
          {moments.slice(0, 3).map((moment) => (
            <Pressable
              key={moment.id}
              style={styles.slot}
              onPress={() => onPressMoment(moment.id)}
              accessibilityRole="button"
              accessibilityLabel={t("memory.critical.039")}
            >
              {moment.coverUrl ? (
                <Image source={{ uri: moment.coverUrl }} style={StyleSheet.absoluteFill} contentFit="cover" transition={120} />
              ) : (
                <View style={styles.placeholder}>
                  <BabyLogIcon kind="image" size={22} color={colors.muted} />
                </View>
              )}
              <View style={styles.likeShade} />
              <View style={styles.likes}>
                <BabyLogIcon kind="heart" size={11} color={colors.onDark} fill={colors.onDark} strokeWidth={2} />
                <Text style={styles.likesText}>{moment.likeCount}</Text>
              </View>
            </Pressable>
          ))}
          {moments.length === 1 ? <View style={styles.slotSpacer} /> : null}
          {moments.length < 3 ? <View style={styles.slotSpacer} /> : null}
        </View>
      ) : (
        <Pressable
          style={styles.empty}
          onPress={onPressSeeAll}
          accessibilityRole="button"
          accessibilityLabel={t("memory.critical.231")}
        >
          <Text style={styles.emptyTitle}>{t("memory.critical.230")}</Text>
          <Text style={styles.emptyBody}>{t("memory.critical.231")}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    paddingHorizontal: 20,
    gap: 10,
  },
  heading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
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
  grid: {
    flexDirection: "row",
    gap: 8,
  },
  slot: {
    flex: 1,
    aspectRatio: 0.92,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: colors.cardHi,
  },
  slotSpacer: {
    flex: 1,
  },
  skeleton: {
    flex: 1,
    aspectRatio: 0.92,
    borderRadius: 14,
    backgroundColor: colors.cardHi,
  },
  placeholder: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.cardHi,
  },
  likeShade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 36,
    backgroundColor: "rgba(20,16,14,0.18)",
  },
  likes: {
    position: "absolute",
    left: 8,
    bottom: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  likesText: {
    color: colors.onDark,
    fontSize: 11,
    fontWeight: "700",
    textShadowColor: "rgba(0,0,0,0.35)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  empty: {
    minHeight: 96,
    borderRadius: radius.xl,
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
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
});
