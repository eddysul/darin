import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { BottomTabBarProps, BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLanguage } from "../LanguageContext";
import {
  BabyLogVoiceOverlay,
  voiceResultToLog,
  type VoiceResult,
} from "../components/babylog/BabyLogVoiceOverlay";
import { BabyLogIcon, type TabIconKey } from "../components/babylog/BabyLogIcon";
import { RecordDetailSheet, type RecordSheetPrefill } from "../components/babylog/RecordDetailSheet";
import { useBabyLog } from "../context/BabyLogContext";
import { getCategory, isPregnancyLogCategoryId } from "../constants/babyLogCategories";
import { BabyReportScreen } from "./tabs/BabyReportScreen";
import { DiaryScreen } from "./tabs/DiaryScreen";
import { RecordScreen } from "./tabs/RecordScreen";
import { MemoriesScreen } from "./tabs/MemoriesScreen";
import type { LogCategoryKey } from "../types/logCategory";
import type { BabyLogCategoryId } from "../constants/babyLogCategories";
import type { MessageKey } from "../i18n";
import { colors, fontScaleCap, gradients, type } from "../theme";
import { isCustomCategoryKey } from "../types/logCategory";
import { canAddLog, canDeleteLog, canEditLog } from "../types/family";
import { ErrorBanner } from "../components/states/FeedbackStates";
import { isPregnancyStage } from "../utils/childDisplay";
import { formatLogMeta } from "../utils/formatLog";
import type { MainTabParamList, RootStackParamList } from "../navigation/types";

const TAB_LABEL_KEYS: Record<keyof MainTabParamList, MessageKey | null> = {
  Record: "tabs.record",
  Diary: "tabs.diary",
  Mic: "tabs.voice",
  Report: "tabs.overview",
  Memories: "tabs.memories",
};

const Tab = createBottomTabNavigator<MainTabParamList>();

const TAB_ICONS: Record<Exclude<keyof MainTabParamList, "Mic">, TabIconKey> = {
  Record: "record",
  Diary: "diary",
  Report: "report",
  Memories: "memories",
};

function openConsult(
  navigation: NativeStackNavigationProp<RootStackParamList> | undefined,
  initialQuestion?: string,
) {
  navigation?.navigate("Consult", initialQuestion ? { initialQuestion } : { focusInput: true });
}

function MicPlaceholder() {
  return <View style={{ flex: 1, backgroundColor: colors.background }} />;
}

function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const {
    logs,
    addLog,
    addLogs,
    updateLog,
    deleteLog,
    customCategories,
    logAuthor,
    myFamilyRole,
    familyMembers,
    careSetup,
  } = useBabyLog();
  const me = familyMembers.find((member) => member.isMe);
  const allowAdd = canAddLog(myFamilyRole);
  const pregnancyStage = isPregnancyStage(careSetup.child);
  const allowVoice = allowAdd;
  const voiceBlockedReason = allowVoice ? null : "보기 전용 계정이라 기록을 추가할 수 없어요.";
  const [voiceNotice, setVoiceNotice] = useState<string | null>(null);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [voiceSheetCat, setVoiceSheetCat] = useState<LogCategoryKey | null>(null);
  const [voicePrefill, setVoicePrefill] = useState<RecordSheetPrefill | null>(null);
  const [editingVoiceId, setEditingVoiceId] = useState<string | null>(null);
  const [voiceEventPatch, setVoiceEventPatch] = useState<VoiceResult | null>(null);

  useEffect(() => {
    if (!voiceNotice) return;
    const timer = setTimeout(() => setVoiceNotice(null), 3200);
    return () => clearTimeout(timer);
  }, [voiceNotice]);

  useEffect(() => {
    if (allowVoice) return;
    setVoiceOpen(false);
    setVoiceSheetCat(null);
    setVoicePrefill(null);
    setEditingVoiceId(null);
    setVoiceEventPatch(null);
  }, [allowVoice]);

  const tabs: { name: keyof MainTabParamList; center?: boolean }[] = [
    { name: "Record" },
    { name: "Diary" },
    { name: "Mic", center: true },
    { name: "Report" },
    { name: "Memories" },
  ];

  return (
    <>
      <View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        {voiceNotice ? (
          <View style={styles.voiceNotice} accessibilityLiveRegion="polite">
            <Text style={styles.voiceNoticeText}>{voiceNotice}</Text>
          </View>
        ) : null}
        {tabs.map(({ name, center }) => {
          const active = state.routes[state.index]?.name === name;
          const labelKey = TAB_LABEL_KEYS[name];
          const label = labelKey ? t(labelKey) : "";

          if (center) {
            return (
              <Pressable
                key={name}
                style={styles.tabItem}
                accessibilityRole="button"
                accessibilityLabel="음성으로 기록"
                accessibilityHint={voiceBlockedReason ?? undefined}
                accessibilityState={{ disabled: !allowVoice }}
                onPress={() => {
                  if (voiceBlockedReason) {
                    setVoiceNotice(voiceBlockedReason);
                    return;
                  }
                  setVoiceOpen(true);
                }}
              >
                <View style={[styles.centerBtnWrap, !allowVoice && styles.centerBtnWrapLocked]}>
                  {allowVoice ? (
                    <LinearGradient colors={[...gradients.mic]} style={styles.centerBtn}>
                      <BabyLogIcon kind="tab" tab="mic" size={24} color={colors.amberDark} strokeWidth={2.2} />
                    </LinearGradient>
                  ) : (
                    <View style={[styles.centerBtn, styles.centerBtnLocked]}>
                      <BabyLogIcon kind="lock" size={22} color={colors.muted} strokeWidth={2.2} />
                    </View>
                  )}
                </View>
                <Text style={[styles.tabLabel, styles.centerLabel]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} maxFontSizeMultiplier={fontScaleCap.tab}>{t("tabs.voice")}</Text>
              </Pressable>
            );
          }

          const tabIcon = TAB_ICONS[name as Exclude<keyof MainTabParamList, "Mic">];

          return (
            <Pressable key={name} style={styles.tabItem} onPress={() => navigation.navigate(name)} accessibilityRole="button" accessibilityLabel={label}>
              <BabyLogIcon
                kind="tab"
                tab={tabIcon}
                size={22}
                color={active ? colors.amberText : colors.muted}
                strokeWidth={active ? 2.2 : 1.8}
              />
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} maxFontSizeMultiplier={fontScaleCap.tab}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      <BabyLogVoiceOverlay
        visible={voiceOpen}
        pregnancy={pregnancyStage}
        onClose={() => {
          setVoiceOpen(false);
          setEditingVoiceId(null);
          setVoiceEventPatch(null);
          setVoiceSheetCat(null);
          setVoicePrefill(null);
        }}
        onConfirmAll={({ rawTranscript, events }) => {
          if (!allowVoice) return;
          const stageEvents = pregnancyStage
            ? events.filter((event) => isPregnancyLogCategoryId(event.cat))
            : events;
          if (!stageEvents.length) return;
          addLogs(stageEvents.map((event) => voiceResultToLog(event, rawTranscript, logAuthor)));
          setVoiceOpen(false);
          setEditingVoiceId(null);
          navigation.navigate("Record");
        }}
        onEditEvent={(event, rawTranscript) => {
          const base = voiceResultToLog(event, rawTranscript, logAuthor);
          setEditingVoiceId(event.id);
          setVoicePrefill({
            ...base,
            notes: event.notes ?? rawTranscript,
            chip: event.chip,
            chip2: event.chip2,
            amount: event.amount,
            duration: event.duration,
            voice: true,
          });
          setVoiceSheetCat(event.cat);
        }}
        onManualEntry={() => {
          if (!allowVoice) return;
          setVoiceOpen(false);
          setEditingVoiceId(null);
          setVoicePrefill(null);
          setVoiceSheetCat(pregnancyStage ? "pregMood" : "memo");
          navigation.navigate("Record");
        }}
        eventPatch={voiceEventPatch}
        onEventPatchConsumed={() => setVoiceEventPatch(null)}
      >
        <RecordDetailSheet
          embedded
          visible={voiceSheetCat !== null}
          catKey={voiceSheetCat}
          customCategories={customCategories}
          prefill={voicePrefill}
          onClose={() => {
            setVoiceSheetCat(null);
            setVoicePrefill(null);
            setEditingVoiceId(null);
          }}
          onSave={(entry, editId) => {
            if (editId) {
              const existing = logs.find((log) => log.id === editId);
              if (!existing || !canEditLog(myFamilyRole, existing.createdBy, me)) return;
            } else if (!allowAdd) {
              return;
            }
            if (voiceOpen && editingVoiceId && !isCustomCategoryKey(entry.cat)) {
              if (pregnancyStage && !isPregnancyLogCategoryId(entry.cat)) return;
              const cat = entry.cat as BabyLogCategoryId;
              const meta = formatLogMeta(entry, customCategories);
              const label = getCategory(cat).label;
              setVoiceEventPatch({
                id: editingVoiceId,
                cat,
                time: entry.time,
                dateKey: entry.dateKey,
                chip: entry.chip,
                chip2: entry.chip2,
                amount: entry.amount,
                duration: entry.duration,
                notes: entry.notes,
                flags: entry.flags ?? voicePrefill?.flags,
                confidence: entry.confidence ?? voicePrefill?.confidence ?? 0.9,
                timeAmbiguous: false,
                extraLabel: meta === "기록됨" ? label : `${label} · ${meta}`,
              });
              setVoiceSheetCat(null);
              setVoicePrefill(null);
              setEditingVoiceId(null);
              return;
            }
            if (editId) updateLog(editId, entry);
            else addLog(entry);
            setVoiceSheetCat(null);
            setVoicePrefill(null);
            setEditingVoiceId(null);
          }}
          onDelete={(id) => {
            const existing = logs.find((log) => log.id === id);
            if (!existing || !canDeleteLog(myFamilyRole, existing.createdBy, me)) return;
            deleteLog(id);
            setVoiceSheetCat(null);
            setVoicePrefill(null);
            setEditingVoiceId(null);
          }}
        />
      </BabyLogVoiceOverlay>
    </>
  );
}

function RecordTab() {
  const navigation = useNavigation<BottomTabNavigationProp<MainTabParamList>>();
  const rootNavigation = navigation.getParent<NativeStackNavigationProp<RootStackParamList>>();
  return (
    <RecordScreen
      onOpenProfile={(opts) =>
        rootNavigation?.navigate({
          name: "BabyProfile",
          params: { mode: opts?.convertBirth ? "convertBirth" : undefined },
          merge: false,
        })
      }
      onOpenSettings={() => rootNavigation?.navigate("SettingsHome")}
      onOpenNotifications={() => rootNavigation?.navigate("NotificationCenter")}
      onOpenConsult={(initialQuestion) => openConsult(rootNavigation, initialQuestion)}
    />
  );
}

function DiaryTab() {
  const navigation = useNavigation<BottomTabNavigationProp<MainTabParamList>>();
  const rootNavigation = navigation.getParent<NativeStackNavigationProp<RootStackParamList>>();
  return (
    <DiaryScreen
      onOpenProfile={() => rootNavigation?.navigate("BabyProfile", { mode: undefined })}
      onOpenSettings={() => rootNavigation?.navigate("SettingsHome")}
      onOpenNotifications={() => rootNavigation?.navigate("NotificationCenter")}
      onOpenShared={() => rootNavigation?.navigate("FamilyShare")}
      onOpenConsult={(initialQuestion) => openConsult(rootNavigation, initialQuestion)}
    />
  );
}

function ReportTab() {
  const navigation = useNavigation<BottomTabNavigationProp<MainTabParamList>>();
  const rootNavigation = navigation.getParent<NativeStackNavigationProp<RootStackParamList>>();
  return (
    <BabyReportScreen
      onOpenProfile={() => rootNavigation?.navigate("BabyProfile", { mode: undefined })}
      onOpenSettings={() => rootNavigation?.navigate("SettingsHome")}
      onOpenNotifications={() => rootNavigation?.navigate("NotificationCenter")}
      onOpenShared={() => rootNavigation?.navigate("FamilyShare")}
      onOpenRecord={() => navigation.navigate("Record")}
      onOpenConsult={(initialQuestion) => openConsult(rootNavigation, initialQuestion)}
    />
  );
}

function MemoriesTab() {
  const navigation = useNavigation<BottomTabNavigationProp<MainTabParamList>>();
  const rootNavigation = navigation.getParent<NativeStackNavigationProp<RootStackParamList>>();
  return (
    <MemoriesScreen
      onOpenSettings={() => rootNavigation?.navigate("SettingsHome")}
      onOpenNotifications={() => rootNavigation?.navigate("NotificationCenter")}
      onOpenFamily={() => rootNavigation?.navigate("FamilyShare")}
      onOpenDetail={(memoryPostId) => rootNavigation?.navigate("MemoryDetail", { memoryPostId })}
    />
  );
}

export function MainTabs() {
  const {
    storageIssue,
    retryPersistence,
    dismissStorageIssue,
  } = useBabyLog();
  const insets = useSafeAreaInsets();

  return (
    <>
      <Tab.Navigator
        tabBar={(props) => <CustomTabBar {...props} />}
        screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.background } }}
      >
        <Tab.Screen name="Record" component={RecordTab} />
        <Tab.Screen name="Diary" component={DiaryTab} />
        <Tab.Screen name="Mic" component={MicPlaceholder} />
        <Tab.Screen name="Report" component={ReportTab} />
        <Tab.Screen name="Memories" component={MemoriesTab} />
      </Tab.Navigator>
      {storageIssue ? (
        <View style={[styles.storageBanner, { top: insets.top + 8 }]}>
          <ErrorBanner
            message={
              storageIssue.operation === "load"
                ? "저장된 데이터를 불러오지 못했어요. 다시 시도해 주세요."
                : storageIssue.severity === "critical"
                  ? "변경사항을 기기에 저장하지 못했어요. 앱을 닫기 전에 다시 시도해 주세요."
                  : "오프라인 저장을 완료하지 못했어요. 다시 불러오면 서버 기록을 확인할 수 있어요."
            }
            actionLabel="재시도"
            onAction={() => void retryPersistence()}
            onDismiss={dismissStorageIssue}
          />
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: "row",
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingTop: 9,
    paddingHorizontal: 4,
    shadowColor: "#4A3428",
    shadowOpacity: 0.07,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -3 },
    elevation: 10,
  },
  tabItem: { flex: 1, minHeight: 44, alignItems: "center", justifyContent: "flex-start", gap: 4, paddingHorizontal: 2 },
  centerBtnWrap: {
    marginTop: -28,
    borderRadius: 31,
    backgroundColor: colors.amber,
    shadowColor: colors.amber,
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  centerBtnWrapLocked: { backgroundColor: colors.border, shadowOpacity: 0, elevation: 0 },
  centerBtn: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: "center",
    justifyContent: "center",
  },
  centerBtnLocked: {
    backgroundColor: colors.cardHi,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabLabel: { fontSize: type.xs, fontWeight: "700", color: colors.muted },
  tabLabelActive: { color: colors.amberText },
  centerLabel: { marginTop: 2 },
  voiceNotice: {
    position: "absolute",
    left: 16,
    right: 16,
    top: -44,
    zIndex: 80,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  voiceNoticeText: { fontSize: type.xs, fontWeight: "700", color: colors.text, textAlign: "center" },
  storageBanner: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 100,
    elevation: 12,
  },
});
