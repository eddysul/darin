import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { ProfileAvatar } from "../profile/ProfileAvatar";
import { useLanguage } from "../../LanguageContext";
import type { InviteRowStatus, InviteSearchHit } from "../../types/inviteSearch";
import { colors } from "../../theme";

const TOUCH_MIN = Platform.select({ ios: 44, android: 48 }) ?? 44;
const AVATAR = 50;

type Props = {
  hit: InviteSearchHit;
  status: InviteRowStatus;
  sending?: boolean;
  onInvite: () => void;
  onOpenIncoming: () => void;
};

export function InviteSearchRow({ hit, status, sending, onInvite, onOpenIncoming }: Props) {
  const { t } = useLanguage();
  const darinLabel = hit.darinId.startsWith("@") ? hit.darinId : `@${hit.darinId}`;
  const action = actionFor(status, hit.displayName, t);

  return (
    <View style={styles.row}>
      <ProfileAvatar uri={hit.avatarUrl} size={AVATAR} fallback="profile" />
      <View style={styles.copy}>
        <Text style={styles.name} numberOfLines={1}>{hit.displayName}</Text>
        <Text style={styles.id} numberOfLines={1}>{darinLabel}</Text>
      </View>
      {action ? (
        <Pressable
          testID={status === "invite" ? "invite-row-invite" : undefined}
          style={[
            styles.action,
            status === "invite" ? styles.actionPrimary : styles.actionNeutral,
            (status === "outgoing" || sending) && styles.actionDisabled,
          ]}
          onPress={() => {
            if (status === "invite") onInvite();
            if (status === "incoming") onOpenIncoming();
          }}
          disabled={status === "outgoing" || status === "family" || status === "friend" || status === "self" || sending}
          accessibilityRole="button"
          accessibilityState={{ disabled: status !== "invite" && status !== "incoming", busy: sending }}
          accessibilityLabel={action.label}
        >
          {sending ? <ActivityIndicator color={colors.primaryForeground} /> : (
            <Text style={[styles.actionText, status === "invite" ? styles.actionTextPrimary : styles.actionTextNeutral]}>
              {action.title}
            </Text>
          )}
        </Pressable>
      ) : null}
    </View>
  );
}

function actionFor(status: InviteRowStatus, name: string, t: ReturnType<typeof useLanguage>["t"]) {
  if (status === "hidden") return null;
  if (status === "self") return { title: t("family.critical.111"), label: t("family.critical.111") };
  if (status === "family") return { title: t("family.critical.008"), label: t("family.critical.131", { name }) };
  if (status === "friend") return { title: t("family.critical.029"), label: t("family.critical.132", { name }) };
  if (status === "outgoing") return { title: t("family.critical.109"), label: t("family.critical.130", { name }) };
  if (status === "incoming") return { title: t("family.critical.110"), label: t("family.critical.110") };
  return { title: t("family.critical.108"), label: t("family.critical.129", { name }) };
}

const styles = StyleSheet.create({
  row: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.card,
  },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  name: { color: colors.text, fontSize: 16.5, fontWeight: "700" },
  id: { color: colors.muted, fontSize: 14 },
  action: {
    minWidth: 84,
    minHeight: TOUCH_MIN,
    paddingHorizontal: 14,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  actionPrimary: { backgroundColor: colors.primaryCoral },
  actionNeutral: { backgroundColor: colors.chip },
  actionDisabled: { opacity: 1 },
  actionText: { fontSize: 13, fontWeight: "800" },
  actionTextPrimary: { color: colors.primaryForeground },
  actionTextNeutral: { color: colors.muted },
});
