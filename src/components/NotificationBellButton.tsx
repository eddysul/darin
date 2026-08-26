import { useCallback, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { BabyLogIcon } from "./babylog/BabyLogIcon";
import { colors } from "../theme";
import { useLanguage } from "../LanguageContext";
import { hasUnreadNotificationQaSeed } from "../data/notificationQaSeed";
import { NotificationRepository } from "../repositories/NotificationRepository";

type Props = {
  onPress: () => void;
  hasUnread?: boolean;
};

/** A shared entry point for the in-app notification center. */
export function NotificationBellButton({ onPress, hasUnread }: Props) {
  const { t } = useLanguage();
  const [serverUnread, setServerUnread] = useState(false);
  useFocusEffect(useCallback(() => {
    let active = true;
    void NotificationRepository.listInAppEvents()
      .then((items) => {
        if (!active) return;
        if (items.length) setServerUnread(items.some((item) => !item.read_at));
        else setServerUnread(hasUnreadNotificationQaSeed());
      })
      .catch(() => { if (active) setServerUnread(false); });
    return () => { active = false; };
  }, []));
  const showUnread = hasUnread ?? serverUnread;
  return (
    <Pressable
      style={styles.button}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t("chrome.critical.034")}
      accessibilityHint={t("chrome.critical.024")}
    >
      <BabyLogIcon kind="bell" size={19} color={colors.muted} strokeWidth={1.7} />
      {showUnread ? <View style={styles.dot} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  dot: {
    position: "absolute",
    top: 9,
    right: 10,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.amber,
    borderWidth: 1.5,
    borderColor: colors.card,
  },
});
