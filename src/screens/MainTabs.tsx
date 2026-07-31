import { useState } from "react";
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
import { getCategory } from "../constants/babyLogCategories";
import { BabyReportScreen } from "./tabs/BabyReportScreen";
import { ConsultScreen } from "./tabs/ConsultScreen";
import { DiaryScreen } from "./tabs/DiaryScreen";
import { RecordScreen } from "./tabs/RecordScreen";
import { MemoriesScreen } from "./tabs/MemoriesScreen";
import type { LogCategoryKey } from "../types/logCategory";
import type { BabyLogCategoryId } from "../constants/babyLogCategories";
import type { MessageKey } from "../i18n";
import { colors, gradients } from "../theme";
import { isCustomCategoryKey } from "../types/logCategory";
import { canAddLog, canDeleteLog, canEditLog } from "../types/family";
import { ErrorBanner } from "../components/states/FeedbackStates";
import { formatLogMeta } from "../utils/formatLog";
import type { MainTabParamList, RootStackParamList } from "../navigation/types";

const TAB_LABEL_KEYS: Record<keyof MainTabParamList, MessageKey | null> = {
  Record: "tabs.record",
  Diary: "tabs.diary",
  Mic: "tabs.voice",
  Report: "tabs.overview",
  Consult: "tabs.consult",
  Memories: "tabs.memories",
};

const Tab = createBottomTabNavigator<MainTabParamList>();

const TAB_ICONS: Record<Exclude<keyof MainTabParamList, "Mic">, TabIconKey> = {
  Record: "record",
  Diary: "diary",
  Report: "report",
  Consult: "consult",
  Memories: "memories",
};

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
  } = useBabyLog();
  const me = familyMembers.find((member) => member.isMe);
  const allowAdd = canAddLog(myFamilyRole);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [voiceSheetCat, setVoiceSheetCat] = useState<LogCategoryKey | null>(null);
  const [voicePrefill, setVoicePrefill] = useState<RecordSheetPrefill | null>(null);
  const [editingVoiceId, setEditingVoiceId] = useState<string | null>(null);
  const [voiceEventPatch, setVoiceEventPatch] = useState<VoiceResult | null>(null);

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
        {tabs.map(({ name, center }) => {
          const active = state.routes[state.index]?.name === name;
          const labelKey = TAB_LABEL_KEYS[name];
          const label = labelKey ? t(labelKey) : "";

          if (center) {
            return (
              <Pressable
                key={name}
                style={[styles.tabItem, !allowAdd && styles.disabled]}
                disabled={!allowAdd}
                accessibilityState={{ disabled: !allowAdd }}
                onPress={() => setVoiceOpen(true)}
              >
                <View style={styles.centerBtnWrap}>
                  <LinearGradient colors={[...gradients.mic]} style={styles.centerBtn}>
                    <BabyLogIcon kind="tab" tab="mic" size={24} color="#FFFFFF" strokeWidth={2.2} />
                  </LinearGradient>
                </View>
                <Text style={[styles.tabLabel, styles.centerLabel]}>{t("tabs.voice")}</Text>
              </Pressable>
            );
          }

          const tabIcon = TAB_ICONS[name as Exclude<keyof MainTabParamList, "Mic">];

          return (
            <Pressable key={name} style={styles.tabItem} onPress={() => navigation.navigate(name)}>
              <BabyLogIcon
                kind="tab"
                tab={tabIcon}
                size={22}
                color={active ? colors.amber : colors.faint}
                strokeWidth={active ? 2.2 : 1.8}
              />
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      <BabyLogVoiceOverlay
        visible={voiceOpen}
        onClose={() => {
          setVoiceOpen(false);
          setEditingVoiceId(null);
          setVoiceEventPatch(null);
          setVoiceSheetCat(null);
          setVoicePrefill(null);
        }}
        onConfirmAll={({ rawTranscript, events }) => {
          if (!allowAdd) return;
          addLogs(events.map((event) => voiceResultToLog(event, rawTranscript, logAuthor)));
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
          if (!allowAdd) return;
          setVoiceOpen(false);
          setEditingVoiceId(null);
          setVoicePrefill(null);
          setVoiceSheetCat("memo");
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
      onOpenProfile={() => rootNavigation?.navigate("BabyProfile")}
      onOpenSettings={() => rootNavigation?.navigate("SettingsHome")}
      onOpenConsult={(initialQuestion) =>
        navigation.navigate("Consult", initialQuestion ? { initialQuestion } : undefined)
      }
    />
  );
}

function DiaryTab() {
  const navigation = useNavigation<BottomTabNavigationProp<MainTabParamList>>();
  const rootNavigation = navigation.getParent<NativeStackNavigationProp<RootStackParamList>>();
  return (
    <DiaryScreen
      onOpenProfile={() => rootNavigation?.navigate("BabyProfile")}
      onOpenSettings={() => rootNavigation?.navigate("SettingsHome")}
      onOpenConsult={(initialQuestion) =>
        navigation.navigate("Consult", initialQuestion ? { initialQuestion } : undefined)
      }
    />
  );
}

function ReportTab() {
  const navigation = useNavigation<BottomTabNavigationProp<MainTabParamList>>();
  const rootNavigation = navigation.getParent<NativeStackNavigationProp<RootStackParamList>>();
  return (
    <BabyReportScreen
      onOpenProfile={() => rootNavigation?.navigate("BabyProfile")}
      onOpenSettings={() => rootNavigation?.navigate("SettingsHome")}
      onOpenRecord={() => navigation.navigate("Record")}
      onOpenConsult={(initialQuestion) =>
        navigation.navigate("Consult", initialQuestion ? { initialQuestion } : undefined)
      }
    />
  );
}

function ConsultTab() {
  const navigation = useNavigation<BottomTabNavigationProp<MainTabParamList>>();
  const rootNavigation = navigation.getParent<NativeStackNavigationProp<RootStackParamList>>();
  return (
    <ConsultScreen
      onOpenProfile={() => rootNavigation?.navigate("BabyProfile")}
      onOpenSettings={() => rootNavigation?.navigate("SettingsHome")}
    />
  );
}

function MemoriesTab() {
  const navigation = useNavigation<BottomTabNavigationProp<MainTabParamList>>();
  const rootNavigation = navigation.getParent<NativeStackNavigationProp<RootStackParamList>>();
  return (
    <MemoriesScreen
      onOpenSettings={() => rootNavigation?.navigate("SettingsHome")}
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
        <Tab.Screen name="Consult" component={ConsultTab} />
      </Tab.Navigator>
      {storageIssue ? (
        <View style={[styles.storageBanner, { top: insets.top + 8 }]}>
          <ErrorBanner
            message={
              storageIssue.operation === "load"
                ? "저장된 데이터를 불러오지 못했어요. 다시 시도해 주세요."
                : "변경사항을 기기에 저장하지 못했어요. 앱을 닫기 전에 다시 시도해 주세요."
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
  tabItem: { flex: 1, alignItems: "center", gap: 4 },
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
  centerBtn: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: "center",
    justifyContent: "center",
  },
  tabLabel: { fontSize: 10.5, fontWeight: "600", color: colors.faint },
  tabLabelActive: { color: colors.amber },
  centerLabel: { marginTop: 2 },
  disabled: { opacity: 0.45 },
  storageBanner: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 100,
    elevation: 12,
  },
});
