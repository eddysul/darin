import { CheckCircle, CreditCard } from "lucide-react-native";
import { useRef, useState } from "react";
import { Animated, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { PressSlide } from "./PressSlide";
import { useApp } from "../context/AppContext";
import { useLanguage } from "../LanguageContext";
import type { WeeklyPayment } from "../types/payment";
import { colors, radius } from "../theme";

type Props = {
  open: boolean;
  payment: WeeklyPayment | null;
  onClose: () => void;
};

export function PaymentModal({ open, payment, onClose }: Props) {
  const { makePayment } = useApp();
  const { locale, t } = useLanguage();
  const ko = locale === "ko";
  const [paid, setPaid] = useState(false);
  const checkAnim = useRef(new Animated.Value(0)).current;

  const handlePay = () => {
    if (!payment) return;
    makePayment(payment.id);
    setPaid(true);
    checkAnim.setValue(0);
    Animated.spring(checkAnim, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 10 }).start();
    setTimeout(() => {
      setPaid(false);
      onClose();
    }, 1500);
  };

  if (!payment) return null;

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          {paid ? (
            <View style={styles.success}>
              <Animated.View style={{ transform: [{ scale: checkAnim }] }}>
                <CheckCircle size={44} color={colors.sage} />
              </Animated.View>
              <Text style={styles.successTitle}>{t("payment.success")} ✓</Text>
              <Text style={styles.successAmount}>{payment.amount}</Text>
            </View>
          ) : (
            <>
              <View style={styles.header}>
                <CreditCard size={18} color={colors.gold} />
                <Text style={styles.title}>{t("payment.title")}</Text>
              </View>

              <View style={styles.summaryCard}>
                <Row label={ko ? "케어기버" : "Caregiver"} value={payment.caregiverName} />
                <Row label={t("payment.week")} value={ko ? payment.weekLabelKo : payment.weekLabel} />
                <Row label={t("payment.due")} value={ko ? payment.dueDateKo : payment.dueDate} />
                <View style={styles.divider} />
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>{ko ? "총 금액" : "Total"}</Text>
                  <Text style={styles.totalAmount}>{payment.amount}</Text>
                </View>
              </View>

              <View style={styles.actions}>
                <PressSlide style={styles.cancelBtn} onPress={onClose}>
                  <Text style={styles.cancelText}>{ko ? "취소" : "Cancel"}</Text>
                </PressSlide>
                <PressSlide style={styles.payBtn} onPress={handlePay}>
                  <CreditCard size={14} color="#fff" />
                  <Text style={styles.payText}>{t("payment.confirm")} · {payment.amount}</Text>
                </PressSlide>
              </View>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: 24,
    paddingBottom: 40,
    borderWidth: 1,
    borderColor: colors.border,
  },
  header: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 20 },
  title: { fontSize: 18, fontWeight: "700", color: colors.text },

  summaryCard: {
    backgroundColor: colors.inputBg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 20,
  },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  rowLabel: { fontSize: 13, color: colors.muted },
  rowValue: { fontSize: 13, fontWeight: "600", color: colors.text },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 10 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  totalLabel: { fontSize: 15, fontWeight: "700", color: colors.text },
  totalAmount: { fontSize: 20, fontWeight: "800", color: colors.gold },

  actions: { flexDirection: "row", gap: 10 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: radius.md,
    backgroundColor: colors.champagne,
    alignItems: "center",
  },
  cancelText: { fontSize: 14, fontWeight: "600", color: colors.muted },
  payBtn: {
    flex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: radius.md,
    backgroundColor: colors.navy,
  },
  payText: { fontSize: 14, fontWeight: "700", color: "#fff" },

  success: { alignItems: "center", paddingVertical: 32 },
  successTitle: { fontSize: 18, fontWeight: "700", color: colors.text, marginTop: 14 },
  successAmount: { fontSize: 24, fontWeight: "800", color: colors.gold, marginTop: 6 },
});
