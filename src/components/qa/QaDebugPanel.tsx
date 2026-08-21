import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBabyLog } from "../../context/BabyLogContext";
import {
  armQaFaultOnce,
  getQaFaultState,
  subscribeQaFaults,
} from "../../utils/qaDebug";
import { EMPTY_QA_FAULT_STATE, type QaFaultState } from "../../utils/qaFaults";
import { colors } from "../../theme";

export function QaDebugPanel({ trigger = "floating" }: { trigger?: "floating" | "menu" }) {
  return __DEV__ ? <QaDebugPanelDev trigger={trigger} /> : null;
}

function QaDebugPanelDev({ trigger }: { trigger: "floating" | "menu" }) {
  const { qaDebug } = useBabyLog();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("DEV 전용 · 운영 빌드에는 표시되지 않음");
  const [faults, setFaults] = useState<QaFaultState>(EMPTY_QA_FAULT_STATE);

  useEffect(() => {
    const unsubscribe = subscribeQaFaults(setFaults);
    void getQaFaultState().then(setFaults);
    return unsubscribe;
  }, []);

  const run = async (success: string, action: () => Promise<void>, closeAfter = false) => {
    if (busy) return;
    setBusy(true);
    try {
      await action();
      setStatus(success);
      if (closeAfter) setOpen(false);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "QA 작업에 실패했어요.");
    } finally {
      setBusy(false);
    }
  };

  if (!qaDebug) return null;

  return (
    <>
      {trigger === "floating" ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="QA Debug 열기"
          style={[styles.fab, { bottom: insets.bottom + 74 }]}
          onPress={() => setOpen(true)}
        >
          <Text style={styles.fabText}>QA</Text>
        </Pressable>
      ) : (
        <Pressable accessibilityRole="button" style={styles.menuTrigger} onPress={() => setOpen(true)}>
          <View style={styles.menuBadge}><Text style={styles.menuBadgeText}>DEV</Text></View>
          <View style={styles.menuBody}>
            <Text style={styles.menuTitle}>QA Debug 메뉴</Text>
            <Text style={styles.menuSubtitle}>장애 주입·데모 데이터·백업 복원</Text>
          </View>
          <Text style={styles.menuChevron}>›</Text>
        </Pressable>
      )}

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.overlay}>
          <View style={styles.card}>
            <View style={styles.header}>
              <View>
                <Text style={styles.eyebrow}>DEVELOPMENT ONLY</Text>
                <Text style={styles.title}>QA Debug</Text>
              </View>
              <Pressable accessibilityLabel="QA Debug 닫기" onPress={() => setOpen(false)}>
                <Text style={styles.close}>닫기</Text>
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
              <Text style={styles.section}>장애 주입 · 다음 1회</Text>
              <DebugButton
                label={`다음 AI 요청 1회 실패시키기${faults.ai ? " · 준비됨" : ""}`}
                disabled={busy}
                onPress={() =>
                  void run("다음 AI 요청이 1회 실패합니다.", () => armQaFaultOnce("ai"))
                }
              />
              <DebugButton
                label={`다음 저장 1회 실패시키기${faults.storageWrite ? " · 준비됨" : ""}`}
                disabled={busy}
                onPress={() =>
                  void run("다음 저장이 1회 실패합니다.", () => armQaFaultOnce("storageWrite"))
                }
              />
              <DebugButton
                label={`다음 불러오기 1회 실패시키기${faults.storageRead ? " · 준비됨" : ""}`}
                disabled={busy}
                onPress={() =>
                  void run(
                    "다음 앱 재시작/hydrate에서 불러오기가 1회 실패합니다.",
                    () => armQaFaultOnce("storageRead"),
                  )
                }
              />

              <Text style={styles.section}>데이터 상태</Text>
              <DebugButton
                label="현재 로컬 데이터 백업"
                disabled={busy}
                onPress={() => void run("현재 로컬 데이터를 QA backup key에 저장했습니다.", qaDebug.backupCurrentData)}
              />
              <DebugButton
                label="데모 데이터 채우기 (한눈에)"
                disabled={busy}
                onPress={() =>
                  void run("한눈에 탭 데모 데이터를 채웠습니다.", qaDebug.fillDemoData, true)
                }
              />
              <DebugButton
                label="QA용 빈 데이터로 전환"
                disabled={busy}
                danger
                onPress={() => void run("QA용 빈 데이터로 전환했습니다.", qaDebug.useEmptyData, true)}
              />
              <DebugButton
                label="샘플 데이터 복원"
                disabled={busy}
                onPress={() => void run("샘플 데이터를 복원했습니다.", qaDebug.restoreSampleData, true)}
              />
              <DebugButton
                label="백업 데이터 복원"
                disabled={busy}
                onPress={() => void run("백업 데이터를 복원했습니다.", qaDebug.restoreBackupData, true)}
              />
              <DebugButton
                label="QA 상담 테스트 기록 정리"
                disabled={busy}
                onPress={() => void run("QA로 시작하는 상담 테스트 턴을 정리했습니다.", qaDebug.removeQaChatTurns)}
              />

              <Text accessibilityLiveRegion="polite" style={styles.status}>{status}</Text>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

function DebugButton({
  label,
  disabled,
  danger = false,
  onPress,
}: {
  label: string;
  disabled: boolean;
  danger?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      style={[styles.button, danger && styles.buttonDanger, disabled && styles.disabled]}
      onPress={onPress}
    >
      <Text style={[styles.buttonText, danger && styles.buttonDangerText]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: "absolute",
    right: 10,
    zIndex: 90,
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2F2B55",
    borderWidth: 1,
    borderColor: "#8F86D8",
  },
  fabText: { color: "#FFFFFF", fontSize: 11, fontWeight: "800" },
  menuTrigger: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 15,
    borderRadius: 16,
    backgroundColor: "#F4F1FF",
    borderWidth: 1,
    borderColor: "#D7D1F6",
  },
  menuBadge: { borderRadius: 9, backgroundColor: "#746BC4", paddingHorizontal: 7, paddingVertical: 5 },
  menuBadgeText: { color: "#FFFFFF", fontSize: 9, fontWeight: "900" },
  menuBody: { flex: 1 },
  menuTitle: { color: "#3E386F", fontSize: 14, fontWeight: "800" },
  menuSubtitle: { color: "#746F95", fontSize: 11.5, marginTop: 2 },
  menuChevron: { color: "#746BC4", fontSize: 22 },
  overlay: {
    flex: 1,
    justifyContent: "center",
    backgroundColor: "rgba(24,22,20,0.62)",
    padding: 18,
  },
  card: {
    maxHeight: "84%",
    borderRadius: 20,
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  eyebrow: { color: "#746BC4", fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  title: { color: colors.text, fontSize: 20, fontWeight: "800", marginTop: 2 },
  close: { color: colors.muted, fontSize: 14, fontWeight: "700" },
  content: { padding: 16, gap: 10 },
  section: { color: colors.text, fontSize: 13, fontWeight: "800", marginTop: 5 },
  button: {
    minHeight: 46,
    justifyContent: "center",
    borderRadius: 12,
    paddingHorizontal: 14,
    backgroundColor: "#F0EEFF",
    borderWidth: 1,
    borderColor: "#CBC5F2",
  },
  buttonDanger: { backgroundColor: colors.dangerSoft, borderColor: "#EFC1BD" },
  buttonText: { color: "#3E386F", fontSize: 13, fontWeight: "700" },
  buttonDangerText: { color: colors.dangerText },
  status: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 4 },
  disabled: { opacity: 0.45 },
});
