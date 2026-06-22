import { CheckCircle2, Clock } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useLanguage } from "../LanguageContext";
import type { CareScheduleEvent, ScheduleParticipantRole } from "../types/schedule";
import { formatScheduleDayLabel, parseDateISO } from "../utils/scheduleCalendar";
import { colors, radius } from "../theme";

type Props = {
  event: CareScheduleEvent;
  currentUserRole: ScheduleParticipantRole;
  onAccept?: () => void;
  onCounter?: () => void;
  onDecline?: () => void;
  compact?: boolean;
};

function typeLabel(type: CareScheduleEvent["type"], t: ReturnType<typeof useLanguage>["t"]) {
  switch (type) {
    case "care_shift":
      return t("schedule.typeCareShift");
    case "pickup_dropoff":
      return t("schedule.typePickup");
    case "trial_session":
      return t("schedule.typeTrial");
    case "clinic_visit":
      return t("schedule.typeClinic");
    default:
      return t("schedule.typeCustom");
  }
}

function statusLabel(
  event: CareScheduleEvent,
  role: ScheduleParticipantRole,
  t: ReturnType<typeof useLanguage>["t"],
) {
  if (event.status === "accepted") return t("schedule.statusAccepted");
  if (event.status === "declined") return t("schedule.statusDeclined");
  if (event.status === "countered") return t("schedule.statusCountered");
  if (event.status === "proposed") {
    const waitingForMe =
      (role === "parent" && event.proposedBy === "caregiver") ||
      (role === "caregiver" && event.proposedBy === "parent");
    if (waitingForMe) return t("schedule.statusNeedsAction");
    return role === "parent" ? t("schedule.waitingCaregiver") : t("schedule.waitingParent");
  }
  return event.status;
}

export function ScheduleProposalCard({
  event,
  currentUserRole,
  onAccept,
  onCounter,
  onDecline,
  compact = false,
}: Props) {
  const { locale, t } = useLanguage();
  const ko = locale === "ko";
  const dateLabel = formatScheduleDayLabel(parseDateISO(event.date), ko);
  const proposedByName =
    event.proposedBy === "parent"
      ? ko
        ? "지수"
        : "Jisoo"
      : event.caregiverName.split(" ")[0];

  const needsAction =
    event.status === "proposed" &&
    ((currentUserRole === "parent" && event.proposedBy === "caregiver") ||
      (currentUserRole === "caregiver" && event.proposedBy === "parent"));

  const cardStyle = [
    styles.card,
    event.status === "proposed" && styles.cardProposed,
    event.status === "accepted" && styles.cardAccepted,
    event.status === "declined" && styles.cardDeclined,
    event.status === "countered" && styles.cardCountered,
  ];

  return (
    <View style={cardStyle}>
      <View style={styles.headerRow}>
        <View style={styles.typeBadge}>
          <Text style={styles.typeBadgeText}>{typeLabel(event.type, t)}</Text>
        </View>
        {event.status === "accepted" && <CheckCircle2 size={14} color={colors.text} />}
      </View>

      <Text style={styles.title}>{event.title}</Text>

      <View style={styles.timeRow}>
        <Clock size={12} color={colors.muted} />
        <Text style={styles.timeText}>
          {dateLabel} · {event.displayTime}
        </Text>
      </View>

      <Text style={styles.meta}>
        {t("schedule.proposedBy")} {proposedByName}
      </Text>

      <View style={styles.statusPill}>
        <Text style={styles.statusText}>{statusLabel(event, currentUserRole, t)}</Text>
      </View>

      {event.note && !compact && <Text style={styles.note}>{event.note}</Text>}

      {event.status === "accepted" && (
        <Text style={styles.acceptedHint}>{t("schedule.acceptedHint")}</Text>
      )}

      {needsAction && onAccept && onCounter && onDecline && (
        <View style={styles.actions}>
          <Pressable style={styles.acceptBtn} onPress={onAccept}>
            <Text style={styles.acceptBtnText}>{t("schedule.accept")}</Text>
          </Pressable>
          <Pressable style={styles.counterBtn} onPress={onCounter}>
            <Text style={styles.counterBtnText}>{t("schedule.counter")}</Text>
          </Pressable>
          <Pressable style={styles.declineBtn} onPress={onDecline}>
            <Text style={styles.declineBtnText}>{t("schedule.decline")}</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 14,
    gap: 6,
  },
  cardProposed: { backgroundColor: colors.yellowSoft, borderColor: colors.yellow },
  cardAccepted: { backgroundColor: colors.card },
  cardDeclined: { backgroundColor: colors.backgroundSecondary, opacity: 0.85 },
  cardCountered: { backgroundColor: colors.background, borderColor: colors.yellow, borderStyle: "dashed" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  typeBadge: {
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  typeBadgeText: { fontSize: 10, fontWeight: "700", color: colors.text },
  title: { fontSize: 14, fontWeight: "700", color: colors.text },
  timeRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  timeText: { fontSize: 12, color: colors.muted, fontWeight: "500" },
  meta: { fontSize: 11, color: colors.muted },
  statusPill: {
    alignSelf: "flex-start",
    backgroundColor: colors.background,
    borderRadius: radius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statusText: { fontSize: 10, fontWeight: "600", color: colors.text },
  note: { fontSize: 12, lineHeight: 18, color: colors.muted, marginTop: 4 },
  acceptedHint: { fontSize: 11, fontWeight: "600", color: colors.text, marginTop: 4 },
  actions: { flexDirection: "row", gap: 6, marginTop: 8 },
  acceptBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 8,
    alignItems: "center",
  },
  acceptBtnText: { fontSize: 11, fontWeight: "700", color: colors.primaryForeground },
  counterBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.yellow,
    backgroundColor: colors.yellowSoft,
    borderRadius: radius.md,
    paddingVertical: 8,
    alignItems: "center",
  },
  counterBtnText: { fontSize: 11, fontWeight: "700", color: colors.text },
  declineBtn: {
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 8,
    alignItems: "center",
  },
  declineBtnText: { fontSize: 11, fontWeight: "600", color: colors.muted },
});
