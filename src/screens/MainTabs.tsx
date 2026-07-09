import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { LinearGradient } from "expo-linear-gradient";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  BabyLogVoiceOverlay,
  voiceResultToLog,
} from "../components/babylog/BabyLogVoiceOverlay";
import { RecordDetailSheet, type RecordSheetPrefill } from "../components/babylog/RecordDetailSheet";
import { useBabyLog } from "../context/BabyLogContext";
import { BabyProfileScreen } from "./BabyProfileScreen";
import { BabyReportScreen } from "./tabs/BabyReportScreen";
import { ConsultScreen } from "./tabs/ConsultScreen";
import { DiaryScreen } from "./tabs/DiaryScreen";
import { RecordScreen } from "./tabs/RecordScreen";
import type { BabyLogCategoryId } from "../constants/babyLogCategories";
import { colors, gradients } from "../theme";

export type MainTabParamList = {
  Record: undefined;
  Diary: undefined;
  Mic: undefined;
  Report: undefined;
  Consult: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

const TAB_LABELS: Record<keyof MainTabParamList, string> = {
  Record: "기록",
  Diary: "일기",
  Mic: "",
  Report: "리포트",
  Consult: "상담",
};

function MicPlaceholder() {
  return <View style={{ flex: 1, backgroundColor: colors.background }} />;
}

function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { addLog, updateLog, deleteLog, defaultFeedingMethod } = useBabyLog();
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [voiceSheetCat, setVoiceSheetCat] = useState<BabyLogCategoryId | null>(null);
  const [voicePrefill, setVoicePrefill] = useState<RecordSheetPrefill | null>(null);

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
          const label = TAB_LABELS[name];

          if (center) {
            return (
              <Pressable key={name} style={styles.tabItem} onPress={() => setVoiceOpen(true)}>
                <View style={styles.centerBtnWrap}>
                  <LinearGradient colors={[...gradients.mic]} style={styles.centerBtn}>
                    <Text style={styles.micEmoji}>🎙️</Text>
                  </LinearGradient>
                </View>
                <Text style={[styles.tabLabel, styles.centerLabel]}>음성</Text>
              </Pressable>
            );
          }

          return (
            <Pressable key={name} style={styles.tabItem} onPress={() => navigation.navigate(name)}>
              <Text style={[styles.tabIcon, active && styles.tabIconActive]}>
                {name === "Record" ? "📋" : name === "Diary" ? "📔" : name === "Report" ? "📊" : "💬"}
              </Text>
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      <BabyLogVoiceOverlay
        visible={voiceOpen}
        onClose={() => {
          setVoiceOpen(false);
        }}
        onConfirm={(result) => {
          addLog(voiceResultToLog(result));
          setVoiceOpen(false);
          navigation.navigate("Record");
        }}
        onEdit={(result) => {
          setVoiceOpen(false);
          setVoicePrefill({
            ...voiceResultToLog(result),
            chip: result.chip,
            chip2: result.chip2,
            amount: result.amount,
            duration: result.duration,
          });
          setVoiceSheetCat(result.cat);
          navigation.navigate("Record");
        }}
      />

      <RecordDetailSheet
        visible={voiceSheetCat !== null}
        catId={voiceSheetCat}
        prefill={voicePrefill}
        defaultFeedingMethod={defaultFeedingMethod}
        onClose={() => {
          setVoiceSheetCat(null);
          setVoicePrefill(null);
        }}
        onSave={(entry, editId) => {
          if (editId) updateLog(editId, entry);
          else addLog(entry);
          setVoiceSheetCat(null);
          setVoicePrefill(null);
        }}
        onDelete={(id) => {
          deleteLog(id);
          setVoiceSheetCat(null);
          setVoicePrefill(null);
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
  tabIcon: { fontSize: 20, opacity: 0.45 },
  tabIconActive: { opacity: 1 },
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
  micEmoji: { fontSize: 22 },
  tabLabel: { fontSize: 10.5, fontWeight: "600", color: colors.faint },
  tabLabelActive: { color: colors.amber },
  centerLabel: { marginTop: 2 },
});
