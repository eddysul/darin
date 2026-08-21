import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { QUICK_RECORD_ACTIONS, type OneTouchAction } from "../../constants/quickRecordActions";
import { useApp } from "../../context/AppContext";
import { useAppSettings } from "../../context/AppSettingsContext";
import { useBabyLog } from "../../context/BabyLogContext";
import { colors, type } from "../../theme";
import { AddCustomCategorySheet } from "../babylog/AddCustomCategorySheet";
import { DraggableCategoryList } from "./DraggableCategoryList";
import { NavigationHeader } from "../navigation/NavigationHeader";
import { DataExportRepository } from "../../repositories/DataExportRepository";
import { ContactRequestRepository } from "../../repositories/ContactRequestRepository";
import { AuthRepository } from "../../repositories/AuthRepository";
import { authProviderFlags } from "../../config/authProviders";
import type { ContactRequestCategory } from "../../types/database";
import { createId } from "../../utils/id";
import { isPregnancyStage } from "../../utils/childDisplay";
import { getMarketingConsent, saveMarketingConsent } from "../../utils/termsStore";
import { customCategoriesForStage } from "../../types/logCategory";
import type { AppSettings } from "../../types/appSettings";
import { useLanguage } from "../../LanguageContext";
import type { MessageKey } from "../../i18n";

function applyCategoryOrder(current: AppSettings, order: OneTouchAction[]): AppSettings {
  const visible = current.categories.visible;
  const visibleOrdered = order.filter((id) => visible.includes(id));
  const coreCount = Math.min(6, current.categories.core.length, visibleOrdered.length);
  return {
    ...current,
    categories: {
      ...current.categories,
      order,
      core: visibleOrdered.slice(0, coreCount),
    },
  };
}

export type SettingsPage =
  | "account"
  | "timers"
  | "categories"
  | "units"
  | "time"
  | "careAlerts"
  | "growthBook"
  | "billing"
  | "privacy"
  | "terms"
  | "medical"
  | "contact"
  | "dataExport"
  | "retention"
  | "legal";

export const SETTINGS_PAGE_TITLES: Record<SettingsPage, MessageKey> = {
  account: "settings.critical.086",
  timers: "settings.critical.062",
  categories: "settings.critical.058",
  units: "settings.critical.064",
  time: "settings.critical.065",
  careAlerts: "settings.critical.105",
  growthBook: "settings.critical.074",
  billing: "settings.critical.077",
  privacy: "settings.critical.106",
  terms: "settings.critical.107",
  medical: "settings.critical.108",
  contact: "settings.critical.083",
  dataExport: "settings.critical.109",
  retention: "settings.critical.110",
  legal: "settings.critical.081",
};

const LEGAL_ACCORDION_SECTIONS: Array<{
  title: MessageKey;
  paragraphs: Array<[MessageKey, MessageKey]>;
}> = [
  {
    title: "settings.critical.111",
    paragraphs: [
      ["settings.critical.111", "settings.critical.112"],
      ["settings.critical.113", "settings.critical.114"],
      ["settings.critical.115", "settings.critical.116"],
    ],
  },
  {
    title: "settings.critical.117",
    paragraphs: [
      ["settings.critical.118", "settings.critical.119"],
      ["settings.critical.089", "settings.critical.120"],
      ["settings.critical.121", "settings.critical.122"],
    ],
  },
  {
    title: "settings.critical.123",
    paragraphs: [
      ["settings.critical.124", "settings.critical.125"],
      ["settings.critical.126", "settings.critical.127"],
    ],
  },
  {
    title: "settings.critical.128",
    paragraphs: [
      ["settings.critical.129", "settings.critical.130"],
      ["settings.critical.131", "settings.critical.132"],
    ],
  },
  {
    title: "settings.critical.133",
    paragraphs: [["settings.critical.134", "settings.critical.135"]],
  },
  {
    title: "settings.critical.106",
    paragraphs: [
      ["settings.critical.136", "settings.critical.137"],
      ["settings.critical.138", "settings.critical.139"],
      ["settings.critical.140", "settings.critical.141"],
      ["settings.critical.142", "settings.critical.143"],
      ["settings.critical.144", "settings.critical.145"],
      ["settings.critical.146", "settings.critical.147"],
      ["settings.critical.115", "settings.critical.148"],
      ["settings.critical.149", "settings.critical.150"],
    ],
  },
  {
    title: "settings.critical.151",
    paragraphs: [
      ["settings.critical.136", "settings.critical.152"],
      ["settings.critical.153", "settings.critical.154"],
      ["settings.critical.155", "settings.critical.156"],
      ["settings.critical.157", "settings.critical.158"],
      ["settings.critical.318", "settings.critical.159"],
      ["settings.critical.160", "settings.critical.161"],
      ["settings.critical.054", "settings.critical.162"],
      ["settings.critical.115", "settings.critical.163"],
      ["settings.critical.164", "settings.critical.165"],
    ],
  },
  {
    title: "settings.critical.319",
    paragraphs: [
      ["settings.critical.136", "settings.critical.166"],
      ["settings.critical.167", "settings.critical.168"],
      ["settings.critical.169", "settings.critical.170"],
      ["settings.critical.171", "settings.critical.172"],
      ["settings.critical.173", "settings.critical.174"],
    ],
  },
];

export function AppSettingsModal({
  page,
  onClose,
  embedded = false,
  onOpenMyProfile,
}: {
  page: SettingsPage | null;
  onClose: () => void;
  embedded?: boolean;
  onOpenMyProfile?: () => void;
}) {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const { settings, setSettings } = useAppSettings();
  const { careSetup } = useApp();
  const {
    localDataScope,
    customCategories,
    upsertCustomCategory,
    removeCustomCategory,
  } = useBabyLog();
  const [exporting, setExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState("");
  const [contactCategory, setContactCategory] = useState<ContactRequestCategory>("feedback");
  const [contactEmail, setContactEmail] = useState(settings.account.email);
  const [contactMessage, setContactMessage] = useState("");
  const [contactBusy, setContactBusy] = useState(false);
  const [contactStatus, setContactStatus] = useState("");
  const [openLegalSection, setOpenLegalSection] = useState<string | null>(null);
  const [googleLinked, setGoogleLinked] = useState(false);
  const [googleLinkReady, setGoogleLinkReady] = useState(false);
  const [googleLinkBusy, setGoogleLinkBusy] = useState(false);
  const [kakaoLinked, setKakaoLinked] = useState(false);
  const [kakaoLinkReady, setKakaoLinkReady] = useState(false);
  const [kakaoLinkBusy, setKakaoLinkBusy] = useState(false);
  const [addCategoryOpen, setAddCategoryOpen] = useState(false);
  const [categoryDragging, setCategoryDragging] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(() => getMarketingConsent()?.optIn ?? false);
  const pregnancy = isPregnancyStage(careSetup.child);
  const stageCustomCategories = customCategoriesForStage(customCategories, pregnancy);

  useEffect(() => {
    if (page !== "legal") setOpenLegalSection(null);
    if (page !== "categories") setAddCategoryOpen(false);
    if (page === "careAlerts") setMarketingOptIn(getMarketingConsent()?.optIn ?? false);
  }, [page]);

  useEffect(() => {
    if (page !== "account") {
      setGoogleLinkReady(false);
      setKakaoLinkReady(false);
      return;
    }
    let active = true;
    void AuthRepository.getUser()
      .then((user) => {
        if (!active) return;
        setGoogleLinked(Boolean(user?.identities?.some((identity) => identity.provider === "google")));
        setKakaoLinked(Boolean(user?.identities?.some((identity) => identity.provider === "kakao")));
        setGoogleLinkReady(Boolean(user));
        setKakaoLinkReady(Boolean(user));
      })
      .catch(() => {
        if (active) {
          setGoogleLinkReady(false);
          setKakaoLinkReady(false);
        }
      });
    return () => {
      active = false;
    };
  }, [page]);

  useEffect(() => {
    if (page !== "contact") return;
    setContactEmail(settings.account.email);
    setContactStatus("");
  }, [page, settings.account.email]);

  const actionById = useMemo(
    () => new Map(QUICK_RECORD_ACTIONS.map((action) => [action.id, action])),
    [],
  );

  if (!page) return null;

  const showGoogleLogin = authProviderFlags.google.visible && googleLinkReady;
  const showKakaoLogin = authProviderFlags.kakao.enabled && kakaoLinkReady;

  const requestClose = () => {
    onClose();
  };

  const connectGoogle = async () => {
    if (googleLinkBusy) return;
    setGoogleLinkBusy(true);
    try {
      const user = await AuthRepository.linkGoogleIdentity();
      if (!user) return;
      setGoogleLinked(true);
      Alert.alert(t("settings.critical.175"), t("settings.critical.176"));
    } catch {
      Alert.alert(
        t("settings.critical.177"),
        t("settings.critical.178"),
      );
    } finally {
      setGoogleLinkBusy(false);
    }
  };

  const connectKakao = async () => {
    if (kakaoLinkBusy) return;
    setKakaoLinkBusy(true);
    try {
      const user = await AuthRepository.linkKakaoIdentity();
      if (!user) return;
      setKakaoLinked(true);
      Alert.alert(t("settings.critical.175"), t("settings.critical.179"));
    } catch {
      Alert.alert(
        t("settings.critical.177"),
        t("settings.critical.180"),
      );
    } finally {
      setKakaoLinkBusy(false);
    }
  };

  const toggleVisible = (id: OneTouchAction, enabled: boolean) => {
    if (!enabled && settings.categories.visible.length <= 1) {
      Alert.alert(t("settings.critical.181"), t("settings.critical.182"));
      return;
    }
    setSettings((current) => {
      const visible = enabled
        ? [...current.categories.visible, id]
        : current.categories.visible.filter((item) => item !== id);
      const core = enabled
        ? current.categories.core
        : current.categories.core.filter((item) => item !== id);
      return { ...current, categories: { ...current.categories, visible, core } };
    });
  };

  const toggleCore = (id: OneTouchAction, enabled: boolean) => {
    if (enabled && settings.categories.core.length >= 6) {
      Alert.alert(t("settings.critical.183"), t("settings.critical.184"));
      return;
    }
    setSettings((current) => ({
      ...current,
      categories: {
        ...current.categories,
        visible: current.categories.visible.includes(id)
          ? current.categories.visible
          : [...current.categories.visible, id],
        core: enabled
          ? [...current.categories.core, id]
          : current.categories.core.filter((item) => item !== id),
      },
    }));
  };

  const content = (
    <View style={styles.root}>
        {!embedded ? <NavigationHeader
          title={t(SETTINGS_PAGE_TITLES[page])}
          onBack={requestClose}
        /> : null}
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom + 24, 36) }]}
          keyboardShouldPersistTaps="handled"
          scrollEnabled={!categoryDragging}
        >
          {page === "account" ? (
            <>
              <SettingsSection title={t("settings.critical.185")}>
                <InfoRow label={t("settings.critical.027")} value={loginMethodLabel(settings.account.loginMethod, t)} />
                <InfoRow
                  label={t("settings.critical.002")}
                  value={settings.account.email.trim() || t("settings.critical.026")}
                  last={!showGoogleLogin && !showKakaoLogin}
                />
                {showGoogleLogin ? (
                  googleLinked ? (
                    <InfoRow
                      label="Google"
                      value={t("settings.critical.186")}
                      last={!showKakaoLogin}
                    />
                  ) : (
                    <ActionRow
                      label={t("settings.critical.187")}
                      meta={googleLinkBusy ? t("settings.critical.188") : t("settings.critical.189")}
                      action={googleLinkBusy ? t("settings.critical.190") : t("settings.critical.191")}
                      disabled={googleLinkBusy}
                      last={!showKakaoLogin}
                      onPress={() => void connectGoogle()}
                    />
                  )
                ) : null}
                {showKakaoLogin ? (
                  kakaoLinked ? (
                    <InfoRow label={t("settings.critical.192")} value={t("settings.critical.186")} last />
                  ) : (
                    <ActionRow
                      label={t("settings.critical.193")}
                      meta={kakaoLinkBusy ? t("settings.critical.188") : t("settings.critical.194")}
                      action={kakaoLinkBusy ? t("settings.critical.190") : t("settings.critical.191")}
                      disabled={kakaoLinkBusy}
                      last
                      onPress={() => void connectKakao()}
                    />
                  )
                ) : null}
              </SettingsSection>
              {onOpenMyProfile ? (
                <SettingsSection title={t("settings.critical.195")}>
                  <ActionRow
                    label={t("settings.critical.046")}
                    meta={t("settings.critical.196")}
                    action={t("settings.critical.197")}
                    last
                    onPress={onOpenMyProfile}
                  />
                </SettingsSection>
              ) : null}
              <SettingsSection title={t("settings.critical.198")}>
                <View style={styles.actionBlock}>
                  <Text style={styles.actionTitle}>{t("settings.critical.199")}</Text>
                  <Text style={styles.actionBody}>
                    {t("settings.critical.200")}</Text>
                  {exportMessage ? (
                    <Text style={exportMessage.includes(t("settings.critical.201")) || exportMessage.includes(t("settings.critical.202")) ? styles.actionError : styles.actionStatus}>
                      {exportMessage}
                    </Text>
                  ) : null}
                  <Pressable
                    style={[styles.primaryButton, exporting && styles.secondaryButtonDisabled]}
                    onPress={() => {
                      if (exporting) return;
                      const babyId = localDataScope?.babyId;
                      if (!babyId) {
                        setExportMessage(t("settings.critical.203"));
                        return;
                      }
                      setExporting(true);
                      setExportMessage("");
                      void DataExportRepository.exportAndShare(babyId)
                        .then(() => setExportMessage(t("settings.critical.204")))
                        .catch((error) => setExportMessage(error instanceof Error ? error.message : t("settings.critical.205")))
                        .finally(() => setExporting(false));
                    }}
                    disabled={exporting}
                    accessibilityRole="button"
                    accessibilityLabel={t("settings.critical.109")}
                  >
                    <Text style={styles.primaryButtonText}>{exporting ? t("settings.critical.206") : t("settings.critical.207")}</Text>
                  </Pressable>
                </View>
              </SettingsSection>
            </>
          ) : null}

          {page === "timers" ? (
            <SettingsSection title={t("settings.critical.208")}>
              <ToggleRow label={t("settings.critical.209")} value={settings.timers.breastfeeding} onChange={(value) => setSettings((s) => ({ ...s, timers: { ...s.timers, breastfeeding: value } }))} />
              <ToggleRow label={t("settings.critical.210")} value={settings.timers.switchBreastSide} onChange={(value) => setSettings((s) => ({ ...s, timers: { ...s.timers, switchBreastSide: value } }))} />
              <ToggleRow label={t("settings.critical.211")} value={settings.timers.sleep} onChange={(value) => setSettings((s) => ({ ...s, timers: { ...s.timers, sleep: value } }))} />
              <ToggleRow label={t("settings.critical.212")} value={settings.timers.pump} onChange={(value) => setSettings((s) => ({ ...s, timers: { ...s.timers, pump: value } }))} />
              <ToggleRow label={t("settings.critical.213")} value={settings.timers.tummy} onChange={(value) => setSettings((s) => ({ ...s, timers: { ...s.timers, tummy: value } }))} />
              <ToggleRow label={t("settings.critical.214")} value={settings.timers.restoreAfterRestart} onChange={(value) => setSettings((s) => ({ ...s, timers: { ...s.timers, restoreAfterRestart: value } }))} />
              <ToggleRow label={t("settings.critical.215")} value={settings.timers.keepScreenAwake} onChange={(value) => setSettings((s) => ({ ...s, timers: { ...s.timers, keepScreenAwake: value } }))} />
            </SettingsSection>
          ) : null}

          {page === "categories" ? (
            <>
              <Text style={styles.help}>
                {t("settings.critical.216")}</Text>
              <SettingsSection title={t("settings.critical.320", { count: settings.categories.core.length })} overflowVisible>
                <DraggableCategoryList
                  items={settings.categories.order}
                  onReorder={(order) => setSettings((current) => applyCategoryOrder(current, order))}
                  onDragActiveChange={setCategoryDragging}
                  renderRow={(id) => {
                    const action = actionById.get(id);
                    if (!action) return null;
                    const visible = settings.categories.visible.includes(id);
                    const core = settings.categories.core.includes(id);
                    return (
                      <>
                        <View style={styles.categoryCopy}>
                          <Text style={styles.categoryTitle} numberOfLines={1}>{action.label}</Text>
                          <Text style={styles.categoryMeta}>{core ? t("settings.critical.217") : visible ? t("settings.critical.218") : t("settings.critical.219")}</Text>
                        </View>
                        <Pressable style={[styles.stateButton, visible && styles.stateButtonOn]} onPress={() => toggleVisible(id, !visible)}>
                          <Text style={[styles.stateButtonText, visible && styles.stateButtonTextOn]}>{visible ? t("settings.critical.220") : t("settings.critical.219")}</Text>
                        </Pressable>
                        <Pressable style={[styles.stateButton, core && styles.coreButtonOn]} onPress={() => toggleCore(id, !core)}>
                          <Text style={[styles.stateButtonText, core && styles.stateButtonTextOn]}>{t("settings.critical.221")}</Text>
                        </Pressable>
                      </>
                    );
                  }}
                />
              </SettingsSection>
              <SettingsSection title={pregnancy ? t("settings.critical.222") : t("settings.critical.223")}>
                {stageCustomCategories.length === 0 ? (
                  <View style={styles.settingRow}>
                    <Text style={styles.rowMeta}>
                      {pregnancy ? t("settings.critical.224") : t("settings.critical.225")}
                    </Text>
                  </View>
                ) : (
                  stageCustomCategories.map((category) => (
                    <View key={category.id} style={styles.categoryRow}>
                      <View style={[styles.customColorDot, { backgroundColor: category.color }]} />
                      <View style={styles.categoryCopy}>
                        <Text style={styles.categoryTitle} numberOfLines={1}>{category.label}</Text>
                        <Text style={styles.categoryMeta}>{t("settings.critical.226")}</Text>
                      </View>
                      <Pressable
                        style={styles.stateButton}
                        onPress={() => {
                          Alert.alert(
                            t("settings.critical.227"),
                            t("settings.critical.321", { label: category.label }),
                            [
                              { text: t("settings.critical.032"), style: "cancel" },
                              {
                                text: t("settings.critical.036"),
                                style: "destructive",
                                onPress: () => removeCustomCategory(category.id),
                              },
                            ],
                          );
                        }}
                      >
                        <Text style={styles.stateButtonText}>{t("settings.critical.036")}</Text>
                      </Pressable>
                    </View>
                  ))
                )}
                <Pressable
                  style={styles.addCategoryRow}
                  onPress={() => setAddCategoryOpen(true)}
                  accessibilityRole="button"
                  accessibilityLabel={t("settings.critical.228")}
                >
                  <Text style={styles.addCategoryText}>{t("settings.critical.228")}</Text>
                </Pressable>
              </SettingsSection>
              <AddCustomCategorySheet
                visible={addCategoryOpen}
                existingCategories={stageCustomCategories}
                pregnancy={pregnancy}
                onClose={() => setAddCategoryOpen(false)}
                onSave={(input) => {
                  upsertCustomCategory({
                    id: createId(),
                    label: input.label,
                    color: input.color,
                    iconKey: input.iconKey,
                    templateId: input.iconKey,
                    kind: "custom",
                    inputMode: input.inputMode,
                    isEnabled: true,
                    duration: input.inputMode === "duration",
                    amount: input.inputMode === "amount" ? t("settings.critical.229") : undefined,
                    chips: input.inputMode === "check" ? [t("settings.critical.230"), t("settings.critical.231")] : undefined,
                    stage: pregnancy ? "pregnancy" : "born",
                  });
                  setAddCategoryOpen(false);
                }}
              />
            </>
          ) : null}

          {page === "units" ? (
            <SettingsSection title={t("settings.critical.232")}>
              <ChoiceRow label={t("settings.critical.233")} value={settings.units.volume} options={[{ value: "ml", label: "ml" }, { value: "oz", label: "oz" }]} onChange={(volume) => setSettings((s) => ({ ...s, units: { ...s.units, volume: volume as "ml" | "oz" } }))} help={t("settings.critical.234")} />
              <ChoiceRow label={t("settings.critical.235")} value={settings.units.temperature} options={[{ value: "c", label: "℃" }, { value: "f", label: "℉" }]} onChange={(temperature) => setSettings((s) => ({ ...s, units: { ...s.units, temperature: temperature as "c" | "f" } }))} help={t("settings.critical.236")} />
              <ChoiceRow label={t("settings.critical.237")} value={`${settings.units.weight}/${settings.units.height}`} options={[{ value: "kg/cm", label: "kg/cm" }, { value: "lb/inch", label: "lb/in" }]} onChange={(value) => setSettings((s) => ({ ...s, units: { ...s.units, weight: value === "kg/cm" ? "kg" : "lb", height: value === "kg/cm" ? "cm" : "inch" } }))} help={t("settings.critical.238")} />
              <ChoiceRow label={t("settings.critical.239")} value={settings.units.medicationDefaultUnit} options={[
                { value: "none", label: t("settings.critical.240") }, { value: "ml", label: "ml" }, { value: "drop", label: "drop" }, { value: "\uBC29\uC6B8", label: t("settings.critical.241") }, { value: "\uD3EC", label: t("settings.critical.242") }, { value: "\uC815", label: t("settings.critical.243") }, { value: "\uD68C", label: t("settings.critical.244") }, { value: "\uC2A4\uD47C", label: t("settings.critical.245") }, { value: "g", label: "g" }, { value: "mg", label: "mg" }, { value: "other", label: t("settings.critical.246") },
              ]} onChange={(medicationDefaultUnit) => setSettings((s) => ({ ...s, units: { ...s.units, medicationDefaultUnit: medicationDefaultUnit as typeof s.units.medicationDefaultUnit } }))} help={t("settings.critical.247")} />
            </SettingsSection>
          ) : null}

          {page === "time" ? (
            <SettingsSection title={t("settings.critical.248")}>
              <ChoiceRow label={t("settings.critical.249")} value={settings.time.clock} options={[{ value: "12h", label: t("settings.critical.250") }, { value: "24h", label: t("settings.critical.251") }]} onChange={(clock) => setSettings((s) => ({ ...s, time: { ...s.time, clock: clock as "12h" | "24h" } }))} />
              <ChoiceRow label={t("settings.critical.252")} value={settings.time.dayStart} options={[{ value: "midnight", label: t("settings.critical.253") }, { value: "04:00", label: t("settings.critical.254") }]} onChange={(dayStart) => setSettings((s) => ({ ...s, time: { ...s.time, dayStart: dayStart as "midnight" | "04:00" } }))} />
              <ChoiceRow label={t("settings.critical.255")} value={settings.time.weekStart} options={[{ value: "sunday", label: t("settings.critical.256") }, { value: "monday", label: t("settings.critical.257") }]} onChange={(weekStart) => setSettings((s) => ({ ...s, time: { ...s.time, weekStart: weekStart as "sunday" | "monday" } }))} />
              <ChoiceRow label={t("settings.critical.258")} value={settings.time.babyAge} options={[{ value: "days", label: "D+" }, { value: "monthsDays", label: t("settings.critical.259") }, { value: "weeks", label: t("settings.critical.260") }]} onChange={(babyAge) => setSettings((s) => ({ ...s, time: { ...s.time, babyAge: babyAge as "days" | "monthsDays" | "weeks" } }))} />
            </SettingsSection>
          ) : null}

          {page === "careAlerts" ? (
            <SettingsSection title={t("settings.critical.261")}>
              <ToggleRow label={t("settings.critical.262")} value={settings.notifications.feedingEnabled} onChange={(feedingEnabled) => setSettings((s) => ({ ...s, notifications: { ...s.notifications, feedingEnabled } }))} />
              {settings.notifications.feedingEnabled ? <ChoiceRow label={t("settings.critical.263")} value={String(settings.notifications.feedingIntervalMinutes)} options={[{ value: "120", label: t("settings.critical.264") }, { value: "180", label: t("settings.critical.265") }, { value: "240", label: t("settings.critical.266") }]} onChange={(value) => setSettings((s) => ({ ...s, notifications: { ...s.notifications, feedingIntervalMinutes: Number(value) } }))} /> : null}
              <ToggleRow label={t("settings.critical.267")} value={settings.notifications.sleepEnabled} onChange={(sleepEnabled) => setSettings((s) => ({ ...s, notifications: { ...s.notifications, sleepEnabled } }))} />
              {settings.notifications.sleepEnabled ? <ChoiceRow label={t("settings.critical.268")} value={String(settings.notifications.sleepIntervalMinutes)} options={[{ value: "60", label: t("settings.critical.269") }, { value: "120", label: t("settings.critical.264") }, { value: "180", label: t("settings.critical.265") }]} onChange={(value) => setSettings((s) => ({ ...s, notifications: { ...s.notifications, sleepIntervalMinutes: Number(value) } }))} /> : null}
            </SettingsSection>
          ) : null}

          {page === "careAlerts" ? (
            <SettingsSection title={t("settings.critical.270")}>
              <ToggleRow
                label={t("settings.critical.271")}
                value={marketingOptIn}
                onChange={(next) => {
                  setMarketingOptIn(next);
                  void saveMarketingConsent(next);
                }}
              />
              <Text style={styles.help}>{t("settings.critical.272")}</Text>
            </SettingsSection>
          ) : null}

          {page === "growthBook" ? (
            <SettingsSection title={t("settings.critical.273")}>
              <ToggleRow label={t("settings.critical.274")} value={settings.growthBook.showDates} onChange={(showDates) => setSettings((s) => ({ ...s, growthBook: { ...s.growthBook, showDates } }))} />
              <ToggleRow label={t("settings.critical.275")} value={settings.growthBook.showAuthorNames} onChange={(showAuthorNames) => setSettings((s) => ({ ...s, growthBook: { ...s.growthBook, showAuthorNames } }))} />
              <ChoiceRow label={t("settings.critical.276")} value={String(settings.growthBook.defaultLayout)} options={[1, 2, 3, 4].map((value) => ({ value: String(value), label: t("settings.critical.322", { count: value }) }))} onChange={(value) => setSettings((s) => ({ ...s, growthBook: { ...s.growthBook, defaultLayout: Number(value) as 1 | 2 | 3 | 4 } }))} />
            </SettingsSection>
          ) : null}

          {page === "billing" ? (
            <>
              <SettingsSection title={t("settings.critical.277")}>
                <InfoRow label="K-Nanny MVP" value={t("settings.critical.278")} />
                <InfoRow label={t("settings.critical.279")} value={t("settings.critical.280")} />
              </SettingsSection>
              <Text style={styles.help}>{t("settings.critical.281")}</Text>
              <SecondaryButton label={t("settings.critical.282")} onPress={() => Alert.alert(t("settings.critical.283"), t("settings.critical.284"))} />
            </>
          ) : null}

          {page === "privacy" ? (
            <PolicyDocument
              lead={t("settings.critical.137")}
              sections={[
                [t("settings.critical.138"), t("settings.critical.139")],
                [t("settings.critical.285"), t("settings.critical.132")],
                [t("settings.critical.140"), t("settings.critical.141")],
                [t("settings.critical.142"), t("settings.critical.143")],
                [t("settings.critical.286"), t("settings.critical.127")],
                [t("settings.critical.144"), t("settings.critical.145")],
                [t("settings.critical.146"), t("settings.critical.147")],
                [t("settings.critical.115"), t("settings.critical.148")],
                [t("settings.critical.149"), t("settings.critical.150")],
              ]}
            />
          ) : null}

          {page === "terms" ? (
            <PolicyDocument
              lead={t("settings.critical.287")}
              sections={[
                [t("settings.critical.111"), t("settings.critical.112")],
                [t("settings.critical.117"), t("settings.critical.119")],
                [t("settings.critical.123"), t("settings.critical.125")],
                [t("settings.critical.128"), t("settings.critical.130")],
                [t("settings.critical.133"), t("settings.critical.135")],
                [t("settings.critical.113"), t("settings.critical.114")],
                [t("settings.critical.089"), t("settings.critical.120")],
                [t("settings.critical.121"), t("settings.critical.122")],
                [t("settings.critical.115"), t("settings.critical.116")],
              ]}
            />
          ) : null}

          {page === "medical" ? (
            <PolicyDocument
              lead={t("settings.critical.166")}
              sections={[
                [t("settings.critical.167"), t("settings.critical.168")],
                [t("settings.critical.169"), t("settings.critical.170")],
                [t("settings.critical.171"), t("settings.critical.172")],
                [t("settings.critical.173"), t("settings.critical.174")],
              ]}
            />
          ) : null}

          {page === "retention" ? (
            <PolicyDocument
              lead={t("settings.critical.152")}
              sections={[
                [t("settings.critical.153"), t("settings.critical.154")],
                [t("settings.critical.155"), t("settings.critical.156")],
                [t("settings.critical.157"), t("settings.critical.158")],
                ["Soft delete", t("settings.critical.159")],
                [t("settings.critical.160"), t("settings.critical.161")],
                [t("settings.critical.054"), t("settings.critical.162")],
                [t("settings.critical.115"), t("settings.critical.163")],
                [t("settings.critical.164"), t("settings.critical.165")],
              ]}
            />
          ) : null}

          {page === "legal" ? (
            <>
              <View style={styles.legalIntro}>
                <Text style={styles.policyLead}>{t("settings.critical.288")}</Text>
                <Text style={styles.help}>{t("settings.critical.287")}</Text>
                <Text style={styles.help}>{t("settings.critical.289")}</Text>
                <Text style={styles.legalUpdated}>{t("settings.critical.290")}</Text>
                <Text style={styles.help}>{t("settings.critical.291")}</Text>
              </View>
              {LEGAL_ACCORDION_SECTIONS.map((section) => (
                <PolicyAccordion
                  key={section.title}
                  title={t(section.title)}
                  open={openLegalSection === section.title}
                  onPress={() => setOpenLegalSection((current) => current === section.title ? null : section.title)}
                  paragraphs={section.paragraphs.map(([heading, body]) => [t(heading), t(body)])}
                />
              ))}
              <Text style={styles.policyFootnote}>{t("settings.critical.292")}</Text>
            </>
          ) : null}

          {page === "dataExport" ? (
            <>
              <PolicyDocument
                lead={t("settings.critical.293")}
                sections={[
                  [t("settings.critical.294"), t("settings.critical.295")],
                  [t("settings.critical.296"), t("settings.critical.297")],
                  [t("settings.critical.298"), t("settings.critical.299")],
                ]}
              />
              {exportMessage ? <Text style={styles.help}>{exportMessage}</Text> : null}
              <PrimaryButton
                label={exporting ? t("settings.critical.206") : t("settings.critical.300")}
                onPress={() => {
                  if (exporting) return;
                  const babyId = localDataScope?.babyId;
                  if (!babyId) {
                    setExportMessage(t("settings.critical.203"));
                    return;
                  }
                  setExporting(true);
                  setExportMessage("");
                  void DataExportRepository.exportAndShare(babyId)
                    .then(() => setExportMessage(t("settings.critical.204")))
                    .catch((error) => setExportMessage(error instanceof Error ? error.message : t("settings.critical.205")))
                    .finally(() => setExporting(false));
                }}
              />
            </>
          ) : null}

          {page === "contact" ? (
            <>
              <Text style={styles.help}>{t("settings.critical.301")}</Text>
              <SettingsSection title={t("settings.critical.302")}>
                <ChoiceRow
                  label={t("settings.critical.303")}
                  value={contactCategory}
                  options={[
                    { value: "bug", label: t("settings.critical.304") }, { value: "account", label: t("settings.critical.085") },
                    { value: "data", label: t("settings.critical.305") }, { value: "family", label: t("settings.critical.123") },
                    { value: "feedback", label: t("settings.critical.306") }, { value: "other", label: t("settings.critical.246") },
                  ]}
                  onChange={(value) => setContactCategory(value as ContactRequestCategory)}
                />
                <Field label={t("settings.critical.307")} value={contactEmail} onChangeText={setContactEmail} keyboardType="email-address" />
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>{t("settings.critical.308")}{contactMessage.length}/4000</Text>
                  <TextInput
                    value={contactMessage}
                    onChangeText={setContactMessage}
                    placeholder={t("settings.critical.309")}
                    placeholderTextColor={colors.faint}
                    multiline
                    maxLength={4000}
                    textAlignVertical="top"
                    style={[styles.input, styles.messageInput]}
                  />
                </View>
              </SettingsSection>
              {contactStatus ? <Text style={styles.help}>{contactStatus}</Text> : null}
              <PrimaryButton
                label={contactBusy ? t("settings.critical.310") : t("settings.critical.311")}
                onPress={() => {
                  if (contactBusy) return;
                  setContactBusy(true);
                  setContactStatus("");
                  void ContactRequestRepository.create({ email: contactEmail, category: contactCategory, message: contactMessage })
                    .then(() => {
                      setContactMessage("");
                      setContactStatus(t("settings.critical.312"));
                    })
                    .catch((error) => setContactStatus(error instanceof Error ? error.message : t("settings.critical.313")))
                    .finally(() => setContactBusy(false));
                }}
              />
              <SecondaryButton
                label={t("settings.critical.314")}
                onPress={() => void Linking.openURL(`mailto:${process.env.EXPO_PUBLIC_SUPPORT_EMAIL ?? "support@darin.app"}`)}
              />
            </>
          ) : null}
        </ScrollView>
      </View>
  );

  if (embedded) return content;

  return (
    <Modal visible animationType="slide" onRequestClose={requestClose}>
      {content}
    </Modal>
  );
}

function SettingsSection({
  title,
  children,
  overflowVisible,
}: {
  title: string;
  children: React.ReactNode;
  overflowVisible?: boolean;
}) {
  return (
    <View>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={[styles.card, overflowVisible && styles.cardOverflow]}>{children}</View>
    </View>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "email-address";
  editable?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{props.label}</Text>
      <TextInput
        value={props.value}
        onChangeText={props.onChangeText}
        placeholder={props.placeholder}
        placeholderTextColor={colors.faint}
        keyboardType={props.keyboardType}
        editable={props.editable}
        autoCapitalize="none"
        style={[styles.input, props.editable === false && { opacity: 0.6 }]}
      />
    </View>
  );
}

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  return (
    <View style={styles.settingRow}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Switch value={value} onValueChange={onChange} trackColor={{ false: colors.border, true: colors.amberSoft }} thumbColor={value ? colors.amber : "#FFFFFF"} />
    </View>
  );
}

function ChoiceRow({
  label,
  value,
  options,
  onChange,
  help,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string; disabled?: boolean }>;
  onChange: (value: string) => void;
  help?: string;
}) {
  return (
    <View style={styles.choiceBlock}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.choiceRow}>
        {options.map((option) => (
          <Pressable key={option.value} style={[styles.choice, value === option.value && styles.choiceOn, option.disabled && styles.choiceDisabled]} onPress={() => onChange(option.value)} disabled={option.disabled} accessibilityState={{ disabled: option.disabled, selected: value === option.value }}>
            <Text style={[styles.choiceText, value === option.value && styles.choiceTextOn]}>{option.label}</Text>
          </Pressable>
        ))}
      </View>
      {help ? <Text style={styles.choiceHelp}>{help}</Text> : null}
    </View>
  );
}

function InfoRow({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.settingRow, last && styles.rowLast]}>
      <Text style={[styles.rowLabel, styles.infoLabel]}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={2}>{value}</Text>
    </View>
  );
}

function ActionRow({
  label,
  meta,
  action,
  onPress,
  disabled = false,
  last = false,
}: {
  label: string;
  meta?: string;
  action: string;
  onPress: () => void;
  disabled?: boolean;
  last?: boolean;
}) {
  return (
    <Pressable
      style={[styles.settingRow, styles.actionRow, last && styles.rowLast, disabled && styles.secondaryButtonDisabled]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${action}`}
    >
      <View style={styles.actionRowCopy}>
        <Text style={styles.rowLabel}>{label}</Text>
        {meta ? <Text style={styles.rowMeta}>{meta}</Text> : null}
      </View>
      <Text style={styles.linkAction}>{action}</Text>
    </Pressable>
  );
}

function PolicyDocument({ lead, sections }: { lead: string; sections: Array<[string, string]> }) {
  const { t } = useLanguage();
  return (
    <>
      <Text style={styles.policyLead}>{lead}</Text>
      {sections.map(([title, body]) => (
        <View key={title} style={styles.policySection}>
          <Text style={styles.policyTitle}>{title}</Text>
          <Text style={styles.policyBody}>{body}</Text>
        </View>
      ))}
      <Text style={styles.policyFootnote}>{t("settings.critical.292")}</Text>
    </>
  );
}

function PolicyAccordion({
  title,
  open,
  onPress,
  paragraphs,
}: {
  title: string;
  open: boolean;
  onPress: () => void;
  paragraphs: Array<[string, string]>;
}) {
  const { t } = useLanguage();
  return (
    <View style={styles.accordionCard}>
      <Pressable
        style={styles.accordionHeader}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={t("settings.critical.323", { title, state: open ? t("settings.critical.315") : t("settings.critical.316") })}
      >
        <Text style={styles.accordionTitle}>{title}</Text>
        <Text style={styles.accordionChevron}>{open ? "︿" : "﹀"}</Text>
      </Pressable>
      {open ? (
        <View style={styles.accordionBody}>
          {paragraphs.map(([heading, body]) => (
            <View key={heading} style={styles.accordionParagraph}>
              <Text style={styles.policyTitle}>{heading}</Text>
              <Text style={styles.policyBody}>{body}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function PrimaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.primaryButton} onPress={onPress}>
      <Text style={styles.primaryButtonText}>{label}</Text>
    </Pressable>
  );
}

function SecondaryButton({
  label,
  onPress,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      style={[styles.secondaryButton, disabled && styles.secondaryButtonDisabled]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={styles.secondaryButtonText}>{label}</Text>
    </Pressable>
  );
}

function loginMethodLabel(method: string, t: ReturnType<typeof import("../../i18n").createT>) {
  return { apple: "Apple", google: "Google", kakao: t("settings.critical.192"), email: t("settings.critical.002"), demo: t("settings.critical.317") }[method] ?? method;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, backgroundColor: colors.card },
  headerButton: { width: 56, minHeight: 44, justifyContent: "center" },
  headerButtonText: { color: colors.amberText, fontSize: 14, fontWeight: "800" },
  headerTitle: { flex: 1, textAlign: "center", color: colors.text, fontSize: type.md, fontWeight: "800" },
  content: { padding: 20, gap: 20 },
  sectionTitle: { marginBottom: 8, marginLeft: 3, color: colors.muted, fontSize: type.xs, fontWeight: "800" },
  card: { borderRadius: 18, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, overflow: "hidden" },
  cardOverflow: { overflow: "visible" },
  field: { padding: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  fieldLabel: { color: colors.muted, fontSize: 11, fontWeight: "700", marginBottom: 7 },
  input: { minHeight: 42, borderRadius: 12, backgroundColor: colors.backgroundSecondary, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, color: colors.text, fontSize: 14 },
  messageInput: { minHeight: 140, paddingTop: 12, paddingBottom: 12 },
  settingRow: { minHeight: 62, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  rowLast: { borderBottomWidth: 0 },
  rowLabel: { color: colors.text, fontSize: 14, fontWeight: "700" },
  infoLabel: { flex: 1, minWidth: 88 },
  rowMeta: { marginTop: 3, color: colors.faint, fontSize: type.xs, lineHeight: 18 },
  infoValue: { flexShrink: 1, maxWidth: "58%", color: colors.muted, fontSize: 13, fontWeight: "700", textAlign: "right" },
  actionRow: { minHeight: 68, paddingVertical: 12, alignItems: "center" },
  actionRowCopy: { flex: 1, minWidth: 0 },
  linkAction: { color: colors.amberText, fontSize: 13, fontWeight: "800" },
  actionBlock: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 18, gap: 14 },
  actionTitle: { color: colors.text, fontSize: 15, fontWeight: "800" },
  actionBody: { color: colors.muted, fontSize: 13.5, lineHeight: 21 },
  actionStatus: { color: colors.amberText, fontSize: 12.5, fontWeight: "700", lineHeight: 18 },
  actionError: { color: colors.dangerText, fontSize: 12.5, fontWeight: "700", lineHeight: 18 },
  choiceBlock: { paddingHorizontal: 14, paddingVertical: 13, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, gap: 9 },
  choiceRow: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  choice: { minHeight: 44, justifyContent: "center", borderRadius: 999, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, backgroundColor: colors.backgroundSecondary },
  choiceDisabled: { opacity: 0.48 },
  choiceOn: { backgroundColor: colors.amberSoft, borderColor: colors.amber },
  choiceText: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  choiceTextOn: { color: colors.amberText },
  choiceHelp: { color: colors.faint, fontSize: type.xs, lineHeight: 16 },
  categoryRow: { minHeight: 66, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  categoryCopy: { flex: 1, minWidth: 0, justifyContent: "center" },
  categoryTitle: { color: colors.text, fontSize: 14, fontWeight: "800" },
  categoryMeta: { marginTop: 2, color: colors.muted, fontSize: type.xs, fontWeight: "600" },
  customColorDot: { width: 12, height: 12, borderRadius: 6, marginLeft: 4 },
  addCategoryRow: {
    minHeight: 54,
    marginHorizontal: 10,
    marginVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.amber,
    backgroundColor: colors.amberSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  addCategoryText: { color: colors.amberText, fontSize: 13, fontWeight: "800" },
  stateButton: { minWidth: 44, minHeight: 44, borderRadius: 9, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
  stateButtonOn: { backgroundColor: colors.cardHi, borderColor: "#7FC8B2" },
  coreButtonOn: { backgroundColor: colors.amberSoft, borderColor: colors.amber },
  stateButtonText: { color: colors.faint, fontSize: 10, fontWeight: "800" },
  stateButtonTextOn: { color: colors.text },
  help: { color: colors.muted, fontSize: 12.5, lineHeight: 19, paddingHorizontal: 2 },
  legalIntro: { gap: 7, marginBottom: 2 },
  legalUpdated: { color: colors.faint, fontSize: 11.5, lineHeight: 18, fontWeight: "700" },
  accordionCard: { borderRadius: 16, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, overflow: "hidden" },
  accordionHeader: { minHeight: 58, paddingHorizontal: 15, flexDirection: "row", alignItems: "center", gap: 12 },
  accordionTitle: { flex: 1, color: colors.text, fontSize: 14, fontWeight: "800" },
  accordionChevron: { color: colors.muted, fontSize: 15, fontWeight: "800" },
  accordionBody: { padding: 15, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, gap: 17, backgroundColor: colors.backgroundSecondary },
  accordionParagraph: { gap: 6 },
  primaryButton: { minHeight: 50, borderRadius: 15, backgroundColor: colors.amber, alignItems: "center", justifyContent: "center" },
  primaryButtonText: { color: colors.amberDark, fontSize: 14, fontWeight: "800" },
  secondaryButton: { minHeight: 48, borderRadius: 15, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  secondaryButtonDisabled: { opacity: 0.55 },
  secondaryButtonText: { color: colors.text, fontSize: 14, fontWeight: "800" },
  policyLead: { color: colors.text, fontSize: 15, lineHeight: 23, fontWeight: "700" },
  policySection: { borderRadius: 16, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, padding: 16 },
  policyTitle: { color: colors.text, fontSize: 14, fontWeight: "800", marginBottom: 7 },
  policyBody: { color: colors.muted, fontSize: 12.5, lineHeight: 20 },
  policyFootnote: { color: colors.faint, fontSize: 11, lineHeight: 17 },
});
