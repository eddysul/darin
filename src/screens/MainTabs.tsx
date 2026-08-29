import { useEffect, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
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
import { isPregnancyLogCategoryId } from "../constants/babyLogCategories";
import { BabyReportScreen } from "./tabs/BabyReportScreen";
import { DiaryScreen } from "./tabs/DiaryScreen";
import { RecordScreen } from "./tabs/RecordScreen";
import { MemoriesScreen } from "./tabs/MemoriesScreen";
import { FriendMemoriesScreen } from "./tabs/FriendMemoriesScreen";
import type { LogCategoryKey } from "../types/logCategory";
import type { BabyLogCategoryId } from "../constants/babyLogCategories";
import type { MessageKey } from "../i18n";
import { colors, fontScaleCap, gradients, type } from "../theme";
import { isCustomCategoryKey } from "../types/logCategory";
import { canAddLog, canDeleteLog, canEditLog } from "../types/family";
import { ErrorBanner } from "../components/states/FeedbackStates";
import { isPregnancyStage } from "../utils/childDisplay";
import { formatLogMeta } from "../utils/formatLog";
import { recordCategoryLabel } from "../utils/recordDisplay";
import type { MainTabParamList, RootStackParamList } from "../navigation/types";

const TAB_LABEL_KEYS: Record<keyof MainTabParamList, MessageKey | null> = {
  Record: "tabs.record",
  Diary: "tabs.diary",
  Report: "tabs.overview",
  Memories: "tabs.memories",
};

const Tab = createBottomTabNavigator<MainTabParamList>();
const TOUCH_MIN = Platform.select({ ios: 44, android: 48 }) ?? 44;

const TAB_ICONS: Record<keyof MainTabParamList, TabIconKey> = {
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

function CustomTabBar({ state, navigation, friendOnly = false }: BottomTabBarProps & { friendOnly?: boolean }) {
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
  const voiceBlockedReason = allowVoice ? null : t("home.voice.readOnly");
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

  const items: Array<
    | { kind: "route"; name: keyof MainTabParamList }
    | { kind: "micAction" }
  > = friendOnly ? [
    { kind: "route", name: "Memories" },
  ] : [
    { kind: "route", name: "Record" },
    { kind: "route", name: "Diary" },
    { kind: "micAction" },
    { kind: "route", name: "Report" },
    { kind: "route", name: "Memories" },
  ];

  return (
    <>
      <View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        {voiceNotice ? (
          <View style={styles.voiceNotice} accessibilityLiveRegion="polite">
            <Text style={styles.voiceNoticeText}>{voiceNotice}</Text>
          </View>
        ) : null}
        {items.map((item) => {
          if (item.kind === "micAction") {
            return (
              <Pressable
                key="mic-action"
                style={styles.tabItem}
                accessibilityRole="button"
                accessibilityLabel={t("home.a11y.voiceRecord")}
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

          const { name } = item;
          const active = state.routes[state.index]?.name === name;
          const labelKey = TAB_LABEL_KEYS[name];
          const label = labelKey ? t(labelKey) : "";
          const tabIcon = TAB_ICONS[name];

          return (
            <Pressable
              key={name}
              style={styles.tabItem}
              onPress={() => navigation.navigate(name)}
              accessibilityRole="tab"
              accessibilityLabel={label}
              accessibilityState={{ selected: active }}
            >
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
              const meta = formatLogMeta(entry, customCategories, t);
              const label = recordCategoryLabel(t, cat);
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
                extraLabel: meta === t("record.timeline.recorded") ? label : `${label} · ${meta}`,
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

function FriendMemoriesTab() {
  const navigation = useNavigation<BottomTabNavigationProp<MainTabParamList>>();
  const rootNavigation = navigation.getParent<NativeStackNavigationProp<RootStackParamList>>();
  return (
    <FriendMemoriesScreen
      onOpenNotifications={() => rootNavigation?.navigate("NotificationCenter")}
      onOpenDetail={(memoryPostId) => rootNavigation?.navigate("MemoryDetail", { memoryPostId, source: "friend" })}
    />
  );
}

export function MainTabs({ friendOnly = false }: { friendOnly?: boolean }) {
  const { t } = useLanguage();
  const {
    storageIssue,
    retryPersistence,
    dismissStorageIssue,
  } = useBabyLog();
  const insets = useSafeAreaInsets();

  return (
    <>
      <Tab.Navigator
        tabBar={(props) => friendOnly ? null : <CustomTabBar {...props} />}
        initialRouteName={friendOnly ? "Memories" : "Record"}
        screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.background } }}
      >
        {friendOnly ? (
          <Tab.Screen name="Memories" component={FriendMemoriesTab} />
        ) : (
          <>
            <Tab.Screen name="Record" component={RecordTab} />
            <Tab.Screen name="Diary" component={DiaryTab} />
            <Tab.Screen name="Report" component={ReportTab} />
            <Tab.Screen name="Memories" component={MemoriesTab} />
          </>
        )}
      </Tab.Navigator>
      {storageIssue ? (
        <View style={[styles.storageBanner, { top: insets.top + 8 }]}>
          <ErrorBanner
            message={
              storageIssue.operation === "load"
                ? t("home.storage.loadError")
                : storageIssue.severity === "critical"
                  ? t("home.storage.criticalError")
                  : t("home.storage.offlineError")
            }
            actionLabel={t("home.storage.retry")}
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
  tabItem: { flex: 1, minHeight: TOUCH_MIN, alignItems: "center", justifyContent: "flex-start", gap: 4, paddingHorizontal: 2 },
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
