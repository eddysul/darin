import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
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
import { getCategory, formatLogMeta } from "../constants/babyLogCategories";
import { BabyProfileScreen } from "./BabyProfileScreen";
import { BabyReportScreen } from "./tabs/BabyReportScreen";
import { ConsultScreen } from "./tabs/ConsultScreen";
import { DiaryScreen } from "./tabs/DiaryScreen";
import { RecordScreen } from "./tabs/RecordScreen";
import type { LogCategoryKey } from "../types/logCategory";
import type { BabyLogCategoryId } from "../constants/babyLogCategories";
import type { MessageKey } from "../i18n";
import { colors, gradients } from "../theme";
import { isCustomCategoryKey } from "../types/logCategory";
import { canAddLog, canDeleteLog, canEditLog } from "../types/family";

const TAB_LABEL_KEYS: Record<keyof MainTabParamList, MessageKey | null> = {
  Record: "tabs.record",
  Diary: "tabs.diary",
  Mic: "tabs.voice",
  Report: "tabs.overview",
  Consult: "tabs.consult",
};

export type MainTabParamList = {
  Record: undefined;
  Diary: {
    openCompose?: boolean;
    date?: string;
    source?: string;
  } | undefined;
  Mic: undefined;
  Report: undefined;
  Consult: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

const TAB_ICONS: Record<Exclude<keyof MainTabParamList, "Mic">, TabIconKey> = {
  Record: "record",
  Diary: "diary",
  Report: "report",
  Consult: "consult",
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
    { name: "Consult" },
  ];

  return (
    <>
      <View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        {tabs.map(({ name, center }, index) => {
          const active = state.index === index;
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
          // Keep voice overlay open so other cards aren't lost
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
      />

      <RecordDetailSheet
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
    </>
  );
}

function RecordTab() {
  const { setProfileOpen } = useBabyLog();
  return <RecordScreen onOpenProfile={() => setProfileOpen(true)} />;
}

function DiaryTab() {
  const { setProfileOpen } = useBabyLog();
  return <DiaryScreen onOpenProfile={() => setProfileOpen(true)} />;
}

function ReportTab() {
  const { setProfileOpen } = useBabyLog();
  return <BabyReportScreen onOpenProfile={() => setProfileOpen(true)} />;
}

function ConsultTab() {
  const { setProfileOpen } = useBabyLog();
  return <ConsultScreen onOpenProfile={() => setProfileOpen(true)} />;
}

export function MainTabs() {
  const { profileOpen, setProfileOpen } = useBabyLog();

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
        <Tab.Screen name="Consult" component={ConsultTab} />
      </Tab.Navigator>
      <BabyProfileScreen visible={profileOpen} onClose={() => setProfileOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: "row",
    backgroundColor: colors.backgroundSecondary,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 6,
    paddingHorizontal: 4,
  },
  tabItem: { flex: 1, alignItems: "center", gap: 3 },
  centerBtnWrap: { marginTop: -22 },
  centerBtn: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.amber,
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  tabLabel: { fontSize: 10.5, fontWeight: "600", color: colors.faint },
  tabLabelActive: { color: colors.amber },
  centerLabel: { marginTop: 2 },
  disabled: { opacity: 0.45 },
});
