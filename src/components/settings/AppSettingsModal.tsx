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
import { useLanguage } from "../../LanguageContext";
import { QUICK_RECORD_ACTIONS, type OneTouchAction } from "../../constants/quickRecordActions";
import { useApp } from "../../context/AppContext";
import { useAppSettings } from "../../context/AppSettingsContext";
import { useBabyLog } from "../../context/BabyLogContext";
import { colors } from "../../theme";
import {
  RELATIONSHIP_OPTIONS,
  type PreferredLanguage,
  type RelationshipToChild,
} from "../../types/careSetup";
import { NavigationHeader } from "../navigation/NavigationHeader";
import { DataExportRepository } from "../../repositories/DataExportRepository";
import { ContactRequestRepository } from "../../repositories/ContactRequestRepository";
import type { ContactRequestCategory } from "../../types/database";

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
  | "retention";

export const SETTINGS_PAGE_TITLES: Record<SettingsPage, string> = {
  account: "계정 설정",
  timers: "스탑워치 설정",
  categories: "기록 카테고리 설정",
  units: "단위 설정",
  time: "시간 설정",
  careAlerts: "수유/수면 알림 설정",
  growthBook: "성장책 설정",
  billing: "결제/구독",
  privacy: "개인정보처리방침",
  terms: "이용약관",
  medical: "Medical Disclaimer",
  contact: "문의하기",
  dataExport: "데이터 내보내기",
  retention: "데이터 보존 및 삭제",
};

export function AppSettingsModal({
  page,
  onClose,
  embedded = false,
}: {
  page: SettingsPage | null;
  onClose: () => void;
  embedded?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const { settings, setSettings } = useAppSettings();
  const { careSetup, profile, setCareSetup, setProfile } = useApp();
  const { applyOwnerFromSetup, localDataScope } = useBabyLog();
  const { setLocale } = useLanguage();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [language, setLanguage] = useState<PreferredLanguage>("ko");
  const [relationship, setRelationship] = useState<RelationshipToChild>("mom");
  const [accountReady, setAccountReady] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState("");
  const [contactCategory, setContactCategory] = useState<ContactRequestCategory>("feedback");
  const [contactEmail, setContactEmail] = useState(settings.account.email);
  const [contactMessage, setContactMessage] = useState("");
  const [contactBusy, setContactBusy] = useState(false);
  const [contactStatus, setContactStatus] = useState("");

  const accountDirty = page === "account" && accountReady && (
    name !== (careSetup.parent.parentName || profile.name) ||
    email !== settings.account.email ||
    language !== settings.account.language ||
    relationship !== settings.account.relationship
  );

  useEffect(() => {
    if (page !== "account") {
      setAccountReady(false);
      return;
    }
    setName(careSetup.parent.parentName || profile.name);
    setEmail(settings.account.email);
    setLanguage(settings.account.language);
    setRelationship(settings.account.relationship);
    setAccountReady(true);
  }, [
    careSetup.parent.parentName,
    page,
    profile.name,
    settings.account.email,
    settings.account.language,
    settings.account.relationship,
  ]);

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

  const requestClose = () => {
    if (accountDirty) {
      Alert.alert("변경사항을 취소할까요?", "저장하지 않은 계정 설정은 사라져요.", [
        { text: "계속 편집", style: "cancel" },
        { text: "변경사항 취소", style: "destructive", onPress: onClose },
      ]);
      return;
    }
    onClose();
  };

  const saveAccount = () => {
    const nextSetup = {
      ...careSetup,
      parent: {
        ...careSetup.parent,
        parentName: name.trim() || careSetup.parent.parentName,
        preferredLanguage: language,
        relationshipToChild: relationship,
      },
    };
    setCareSetup(nextSetup);
    setProfile({ ...profile, name: nextSetup.parent.parentName });
    setLocale(language);
    applyOwnerFromSetup(nextSetup);
    setSettings((current) => ({
      ...current,
      account: { ...current.account, email: email.trim(), language, relationship },
    }));
    onClose();
  };

  const toggleVisible = (id: OneTouchAction, enabled: boolean) => {
    if (!enabled && settings.categories.visible.length <= 1) {
      Alert.alert("카테고리가 필요해요", "최소 1개 카테고리는 표시해야 합니다.");
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
      Alert.alert("기본 노출은 6개까지", "먼저 다른 기본 카테고리를 해제해주세요.");
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

  const moveCategory = (id: OneTouchAction, delta: -1 | 1) => {
    setSettings((current) => {
      const order = [...current.categories.order];
      const index = order.indexOf(id);
      const target = index + delta;
      if (index < 0 || target < 0 || target >= order.length) return current;
      [order[index], order[target]] = [order[target], order[index]];
      return { ...current, categories: { ...current.categories, order } };
    });
  };

  const content = (
    <View style={styles.root}>
        {!embedded ? <NavigationHeader
          title={SETTINGS_PAGE_TITLES[page]}
          onBack={page === "account" ? requestClose : onClose}
          leftLabel={page === "account" ? "취소" : undefined}
          rightLabel={page === "account" ? "저장" : undefined}
          onRightPress={page === "account" ? saveAccount : undefined}
        /> : null}
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom + 24, 36) }]}
          keyboardShouldPersistTaps="handled"
        >
          {page === "account" ? (
            <>
              <SettingsSection title="기본 정보">
                <Field label="이름" value={name} onChangeText={setName} placeholder="이름" />
                <Field
                  label="이메일"
                  value={email}
                  onChangeText={setEmail}
                  placeholder="name@example.com"
                  keyboardType="email-address"
                  editable={settings.account.loginMethod !== "email"}
                />
                {settings.account.loginMethod === "email" ? (
                  <Text style={[styles.help, styles.accountEmailHelp]}>로그인 이메일 변경은 별도 인증 절차가 필요해 현재 화면에서는 수정할 수 없어요.</Text>
                ) : null}
                <ChoiceRow
                  label="언어"
                  value={language}
                  options={[
                    { value: "ko", label: "한국어" },
                    { value: "en", label: "English" },
                  ]}
                  onChange={(value) => setLanguage(value as PreferredLanguage)}
                />
                <ChoiceRow
                  label="아이와의 관계"
                  value={relationship}
                  options={RELATIONSHIP_OPTIONS}
                  onChange={(value) => setRelationship(value as RelationshipToChild)}
                />
                <InfoRow label="로그인 방식" value={loginMethodLabel(settings.account.loginMethod)} />
              </SettingsSection>
            </>
          ) : null}

          {page === "timers" ? (
            <SettingsSection title="길게 눌러 타이머 시작">
              <ToggleRow label="모유수유 타이머 사용" value={settings.timers.breastfeeding} onChange={(value) => setSettings((s) => ({ ...s, timers: { ...s.timers, breastfeeding: value } }))} />
              <ToggleRow label="좌/우 수유 전환 사용" value={settings.timers.switchBreastSide} onChange={(value) => setSettings((s) => ({ ...s, timers: { ...s.timers, switchBreastSide: value } }))} />
              <ToggleRow label="수면 타이머 사용" value={settings.timers.sleep} onChange={(value) => setSettings((s) => ({ ...s, timers: { ...s.timers, sleep: value } }))} />
              <ToggleRow label="유축 타이머 사용" value={settings.timers.pump} onChange={(value) => setSettings((s) => ({ ...s, timers: { ...s.timers, pump: value } }))} />
              <ToggleRow label="터미타임 타이머 사용" value={settings.timers.tummy} onChange={(value) => setSettings((s) => ({ ...s, timers: { ...s.timers, tummy: value } }))} />
              <ToggleRow label="앱 재시작 후 진행 중 타이머 복원" value={settings.timers.restoreAfterRestart} onChange={(value) => setSettings((s) => ({ ...s, timers: { ...s.timers, restoreAfterRestart: value } }))} />
              <ToggleRow label="타이머 중 화면 꺼짐 방지" value={settings.timers.keepScreenAwake} onChange={(value) => setSettings((s) => ({ ...s, timers: { ...s.timers, keepScreenAwake: value } }))} />
            </SettingsSection>
          ) : null}

          {page === "categories" ? (
            <>
              <Text style={styles.help}>
                표시 여부와 기본 6개를 선택하고 화살표로 순서를 바꿀 수 있어요. 기본에 포함되지 않은 표시 항목은 펼치기 영역에 나타납니다.
              </Text>
              <SettingsSection title={`기본 노출 ${settings.categories.core.length}/6`}>
                {settings.categories.order.map((id, index) => {
                  const action = actionById.get(id);
                  if (!action) return null;
                  const visible = settings.categories.visible.includes(id);
                  const core = settings.categories.core.includes(id);
                  return (
                    <View key={id} style={styles.categoryRow}>
                      <View style={styles.categoryCopy}>
                        <Text style={styles.rowLabel}>{action.label}</Text>
                        <Text style={styles.rowMeta}>{core ? "기본 노출" : visible ? "펼치기 영역" : "숨김"}</Text>
                      </View>
                      <Pressable style={styles.miniButton} onPress={() => moveCategory(id, -1)} disabled={index === 0}>
                        <Text style={[styles.miniButtonText, index === 0 && styles.disabledText]}>↑</Text>
                      </Pressable>
                      <Pressable style={styles.miniButton} onPress={() => moveCategory(id, 1)} disabled={index === settings.categories.order.length - 1}>
                        <Text style={[styles.miniButtonText, index === settings.categories.order.length - 1 && styles.disabledText]}>↓</Text>
                      </Pressable>
                      <Pressable style={[styles.stateButton, visible && styles.stateButtonOn]} onPress={() => toggleVisible(id, !visible)}>
                        <Text style={[styles.stateButtonText, visible && styles.stateButtonTextOn]}>{visible ? "표시" : "숨김"}</Text>
                      </Pressable>
                      <Pressable style={[styles.stateButton, core && styles.coreButtonOn]} onPress={() => toggleCore(id, !core)}>
                        <Text style={[styles.stateButtonText, core && styles.stateButtonTextOn]}>기본</Text>
                      </Pressable>
                    </View>
                  );
                })}
              </SettingsSection>
            </>
          ) : null}

          {page === "units" ? (
            <SettingsSection title="표시 단위">
              <ChoiceRow label="수유량" value={settings.units.volume} options={[{ value: "ml", label: "ml" }, { value: "oz", label: "oz" }]} onChange={(volume) => setSettings((s) => ({ ...s, units: { ...s.units, volume: volume as "ml" | "oz" } }))} />
              <ChoiceRow label="몸무게" value={settings.units.weight} options={[{ value: "kg", label: "kg" }, { value: "lb", label: "lb" }]} onChange={(weight) => setSettings((s) => ({ ...s, units: { ...s.units, weight: weight as "kg" | "lb" } }))} />
              <ChoiceRow label="체온" value={settings.units.temperature} options={[{ value: "c", label: "°C" }, { value: "f", label: "°F" }]} onChange={(temperature) => setSettings((s) => ({ ...s, units: { ...s.units, temperature: temperature as "c" | "f" } }))} />
              <ChoiceRow label="키" value={settings.units.height} options={[{ value: "cm", label: "cm" }, { value: "inch", label: "inch" }]} onChange={(height) => setSettings((s) => ({ ...s, units: { ...s.units, height: height as "cm" | "inch" } }))} />
            </SettingsSection>
          ) : null}

          {page === "time" ? (
            <SettingsSection title="날짜와 시간">
              <ChoiceRow label="시간 표시" value={settings.time.clock} options={[{ value: "12h", label: "12시간" }, { value: "24h", label: "24시간" }]} onChange={(clock) => setSettings((s) => ({ ...s, time: { ...s.time, clock: clock as "12h" | "24h" } }))} />
              <ChoiceRow label="하루 시작 기준" value={settings.time.dayStart} options={[{ value: "midnight", label: "자정" }, { value: "04:00", label: "새벽 4시" }]} onChange={(dayStart) => setSettings((s) => ({ ...s, time: { ...s.time, dayStart: dayStart as "midnight" | "04:00" } }))} />
              <ChoiceRow label="주 시작 요일" value={settings.time.weekStart} options={[{ value: "sunday", label: "일요일" }, { value: "monday", label: "월요일" }]} onChange={(weekStart) => setSettings((s) => ({ ...s, time: { ...s.time, weekStart: weekStart as "sunday" | "monday" } }))} />
              <ChoiceRow label="아기 나이 표시" value={settings.time.babyAge} options={[{ value: "days", label: "D+" }, { value: "monthsDays", label: "개월+일" }, { value: "weeks", label: "주수" }]} onChange={(babyAge) => setSettings((s) => ({ ...s, time: { ...s.time, babyAge: babyAge as "days" | "monthsDays" | "weeks" } }))} />
            </SettingsSection>
          ) : null}

          {page === "careAlerts" ? (
            <SettingsSection title="돌봄 알림">
              <ToggleRow label="수유 알림" value={settings.notifications.feedingEnabled} onChange={(feedingEnabled) => setSettings((s) => ({ ...s, notifications: { ...s.notifications, feedingEnabled } }))} />
              <ChoiceRow label="수유 간격" value={String(settings.notifications.feedingIntervalMinutes)} options={[{ value: "120", label: "2시간" }, { value: "180", label: "3시간" }, { value: "240", label: "4시간" }]} onChange={(value) => setSettings((s) => ({ ...s, notifications: { ...s.notifications, feedingIntervalMinutes: Number(value) } }))} />
              <ToggleRow label="수면 알림" value={settings.notifications.sleepEnabled} onChange={(sleepEnabled) => setSettings((s) => ({ ...s, notifications: { ...s.notifications, sleepEnabled } }))} />
              <ChoiceRow label="수면 간격" value={String(settings.notifications.sleepIntervalMinutes)} options={[{ value: "60", label: "1시간" }, { value: "120", label: "2시간" }, { value: "180", label: "3시간" }]} onChange={(value) => setSettings((s) => ({ ...s, notifications: { ...s.notifications, sleepIntervalMinutes: Number(value) } }))} />
            </SettingsSection>
          ) : null}

          {page === "growthBook" ? (
            <SettingsSection title="미리보기 기본값">
              <ToggleRow label="날짜 표시" value={settings.growthBook.showDates} onChange={(showDates) => setSettings((s) => ({ ...s, growthBook: { ...s.growthBook, showDates } }))} />
              <ToggleRow label="작성자 이름 표시" value={settings.growthBook.showAuthorNames} onChange={(showAuthorNames) => setSettings((s) => ({ ...s, growthBook: { ...s.growthBook, showAuthorNames } }))} />
              <ChoiceRow label="기본 사진 레이아웃" value={String(settings.growthBook.defaultLayout)} options={[1, 2, 3, 4].map((value) => ({ value: String(value), label: `${value}장` }))} onChange={(value) => setSettings((s) => ({ ...s, growthBook: { ...s.growthBook, defaultLayout: Number(value) as 1 | 2 | 3 | 4 } }))} />
            </SettingsSection>
          ) : null}

          {page === "billing" ? (
            <>
              <SettingsSection title="현재 플랜">
                <InfoRow label="K-Nanny MVP" value="무료" />
                <InfoRow label="구독 상태" value="활성" />
              </SettingsSection>
              <Text style={styles.help}>유료 상품은 App Store 상품 승인이 완료된 뒤 이 화면에서 조회·구매·복원할 수 있습니다.</Text>
              <SecondaryButton label="구매 복원" onPress={() => Alert.alert("복원할 구매 없음", "현재 계정에 복원 가능한 구매가 없습니다.")} />
            </>
          ) : null}

          {page === "privacy" ? (
            <PolicyDocument
              lead="Darin은 육아 기록과 가족 공유에 필요한 정보를 처리합니다. 아래 내용은 beta용 앱 내 안내 초안이며 외부 공개 전 법률 검토가 필요합니다."
              sections={[
                ["수집하는 정보", "로그인 식별 정보, 프로필 언어와 표시 이름, 아기 프로필, 수유·수면·기저귀·성장 기록, 일기와 성장책, 추억 및 가족 공유 정보를 처리합니다."],
                ["사진·미디어", "사용자가 선택한 일기·성장책·추억 사진과 관련 metadata를 비공개 Storage에 저장합니다. 접근 권한이 있는 가족에게만 제한된 signed URL을 발급합니다."],
                ["알림 정보", "알림 허용 시 기기 식별자와 Expo push token, 알림 설정 및 전송 상태를 처리합니다."],
                ["사용 목적", "기록 저장과 복원, 가족 공유, 요약 제공, 알림 전송, 고객 문의 처리를 위해 사용합니다."],
                ["가족 공유 범위", "아기의 활성 구성원만 공유 데이터에 접근합니다. 역할과 각 콘텐츠의 공개 범위에 따라 조회·작성·관리 권한이 달라집니다."],
                ["보관 및 삭제", "계정 삭제 시 개인 설정과 멤버십을 제거합니다. 혼자 관리하는 아기 데이터는 삭제하며, 공유 아기 데이터는 다른 가족을 위해 보존하고 작성자는 ‘탈퇴한 사용자’로 표시할 수 있습니다."],
                ["계정 삭제 방법", "설정의 계정 삭제에서 안내를 확인하고 ‘삭제’를 입력해 요청할 수 있습니다."],
                ["문의", "설정의 문의하기를 이용할 수 있습니다. 문의 내용에는 민감한 아기 건강정보를 입력하지 않는 것을 권장합니다."],
                ["시행일", "beta 안내 시행일: 2026년 8월 3일"],
              ]}
            />
          ) : null}

          {page === "terms" ? (
            <PolicyDocument
              lead="이 내용은 무료 beta/internal TestFlight를 위한 이용약관 초안입니다. 수익화 전에 별도 업데이트와 법률 검토가 필요합니다."
              sections={[
                ["서비스 목적", "Darin은 보호자의 육아 기록, 일기, 성장책과 초대된 가족 간 공유를 돕는 beta 서비스입니다."],
                ["사용자 책임", "사용자는 계정과 초대 링크를 안전하게 관리하고 입력한 기록의 정확성과 적법성에 책임을 집니다."],
                ["가족 공유", "사용자는 데이터 공유에 동의한 사람만 초대하고 적절한 역할을 설정해야 합니다."],
                ["사진·기록 업로드", "본인이 사용할 권한이 있는 사진과 기록만 업로드해야 하며 타인의 권리를 침해해서는 안 됩니다."],
                ["금지 행위", "무단 접근, 타인 사칭, 불법 콘텐츠 업로드, 서비스 안정성을 해치는 행위를 금지합니다."],
                ["서비스 변경", "beta 기간에는 기능이 변경되거나 점검을 위해 일시 중단될 수 있습니다."],
                ["계정 삭제", "설정에서 계정 삭제를 요청할 수 있으며 공유 데이터는 다른 가족의 권리에 따라 일부 보존될 수 있습니다."],
                ["면책", "서비스와 AI 안내는 의료 진단이나 응급 판단을 제공하지 않으며 사용자는 필요한 경우 의료 전문가에게 문의해야 합니다."],
                ["문의", "서비스 관련 문의는 설정의 문의하기를 이용해주세요."],
              ]}
            />
          ) : null}

          {page === "medical" ? (
            <PolicyDocument
              lead="Darin은 육아 기록과 가족 공유를 돕는 도구이며 의료 서비스가 아닙니다."
              sections={[
                ["진단·치료 아님", "앱은 의료 진단, 치료 계획 또는 응급 여부 판단을 제공하지 않습니다."],
                ["기록의 성격", "수유·수면·성장·체온·약 기록과 요약은 보호자가 참고하기 위한 정보입니다."],
                ["AI 안내", "AI 답변은 일반적인 참고 정보이며 의료 전문가의 진료나 판단을 대체하지 않습니다."],
                ["도움이 필요한 경우", "걱정되는 증상이나 응급 상황이 있다면 지역의 소아과, 의료기관 또는 응급서비스에 문의해주세요."],
              ]}
            />
          ) : null}

          {page === "retention" ? (
            <PolicyDocument
              lead="현재 beta에서 적용되는 데이터 보존·삭제 정책입니다. 실제 구현과 함께 갱신하며 외부 공개 전 법률 검토가 필요합니다."
              sections={[
                ["개인 계정", "계정 삭제 시 profile, 알림 token·설정과 baby membership을 제거하고 Auth 계정을 삭제합니다."],
                ["공유 아기 데이터", "다른 활성 가족이 있으면 아기 기록은 보존되고 탈퇴자의 작성자 식별값은 제거됩니다."],
                ["혼자 관리하는 아기", "다른 활성 구성원이 없는 아기는 관련 기록·일기·성장책·추억 DB 데이터와 비공개 미디어를 삭제합니다."],
                ["Soft delete", "사용자가 앱에서 삭제한 일부 일기·성장책·추억은 복원과 동기화 안전성을 위해 soft delete로 처리될 수 있습니다."],
                ["로컬 캐시", "로그아웃 시 화면 상태를 비우고 계정별 cache를 격리합니다. 계정 삭제에서 이 기기의 로컬 데이터 삭제를 선택할 수 있습니다."],
                ["알림", "계정 삭제 시 push token과 알림 설정을 삭제합니다. 일반 로그아웃 시 현재 기기의 token을 비활성화합니다."],
                ["문의", "문의 기록은 지원 이력 관리를 위해 계정 식별값을 제거한 뒤 보존될 수 있습니다."],
                ["가족 탈퇴", "가족 구성원이 탈퇴하면 membership과 접근 권한이 제거되며 다른 가족의 공유 데이터는 유지됩니다."],
              ]}
            />
          ) : null}

          {page === "dataExport" ? (
            <>
              <PolicyDocument
                lead="아기 기록과 일기 데이터를 JSON 파일로 내보냅니다. 사진 원본 파일은 이번 내보내기에 포함되지 않습니다."
                sections={[
                  ["포함 범위", "프로필 기본 정보, 아기 정보, 가족 역할 요약, 돌봄·성장 기록, 일기와 미디어 metadata, 성장책, 추억 metadata, 본인의 알림 설정을 포함합니다."],
                  ["개인정보 보호", "다른 가족의 계정 식별자는 self 또는 family-member 값으로 치환하며 signed URL은 포함하지 않습니다."],
                  ["권한", "현재 계정이 앱에서 읽을 수 있는 현재 아기의 데이터만 내보냅니다. 비구성원은 RLS에 의해 차단됩니다."],
                ]}
              />
              {exportMessage ? <Text style={styles.help}>{exportMessage}</Text> : null}
              <PrimaryButton
                label={exporting ? "파일 만드는 중…" : "JSON 파일 내보내기"}
                onPress={() => {
                  if (exporting) return;
                  const babyId = localDataScope?.babyId;
                  if (!babyId) {
                    setExportMessage("현재 선택된 아기가 없어요.");
                    return;
                  }
                  setExporting(true);
                  setExportMessage("");
                  void DataExportRepository.exportAndShare(babyId)
                    .then(() => setExportMessage("내보내기 파일을 만들었어요."))
                    .catch((error) => setExportMessage(error instanceof Error ? error.message : "내보내지 못했어요."))
                    .finally(() => setExporting(false));
                }}
              />
            </>
          ) : null}

          {page === "contact" ? (
            <>
              <Text style={styles.help}>민감한 아기 건강정보, 비밀번호 또는 인증 코드는 문의 내용에 입력하지 마세요.</Text>
              <SettingsSection title="문의 내용">
                <ChoiceRow
                  label="카테고리"
                  value={contactCategory}
                  options={[
                    { value: "bug", label: "버그" }, { value: "account", label: "계정" },
                    { value: "data", label: "데이터" }, { value: "family", label: "가족 공유" },
                    { value: "feedback", label: "제안" }, { value: "other", label: "기타" },
                  ]}
                  onChange={(value) => setContactCategory(value as ContactRequestCategory)}
                />
                <Field label="답변 받을 이메일" value={contactEmail} onChangeText={setContactEmail} keyboardType="email-address" />
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>문의 내용 · {contactMessage.length}/4000</Text>
                  <TextInput
                    value={contactMessage}
                    onChangeText={setContactMessage}
                    placeholder="도움이 필요한 내용을 적어주세요."
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
                label={contactBusy ? "보내는 중…" : "문의 보내기"}
                onPress={() => {
                  if (contactBusy) return;
                  setContactBusy(true);
                  setContactStatus("");
                  void ContactRequestRepository.create({ email: contactEmail, category: contactCategory, message: contactMessage })
                    .then(() => {
                      setContactMessage("");
                      setContactStatus("문의가 접수됐어요. 답변은 입력한 이메일로 안내드릴게요.");
                    })
                    .catch((error) => setContactStatus(error instanceof Error ? error.message : "문의를 보내지 못했어요."))
                    .finally(() => setContactBusy(false));
                }}
              />
              <SecondaryButton
                label="이메일 앱으로 문의하기"
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

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.card}>{children}</View>
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
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <View style={styles.choiceBlock}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.choiceRow}>
        {options.map((option) => (
          <Pressable key={option.value} style={[styles.choice, value === option.value && styles.choiceOn]} onPress={() => onChange(option.value)}>
            <Text style={[styles.choiceText, value === option.value && styles.choiceTextOn]}>{option.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.settingRow}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function PolicyDocument({ lead, sections }: { lead: string; sections: Array<[string, string]> }) {
  return (
    <>
      <Text style={styles.policyLead}>{lead}</Text>
      {sections.map(([title, body]) => (
        <View key={title} style={styles.policySection}>
          <Text style={styles.policyTitle}>{title}</Text>
          <Text style={styles.policyBody}>{body}</Text>
        </View>
      ))}
      <Text style={styles.policyFootnote}>Beta 앱 내 안내 초안 · 외부 공개 및 정식 출시 전 법률 검토 필요</Text>
    </>
  );
}

function PrimaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.primaryButton} onPress={onPress}>
      <Text style={styles.primaryButtonText}>{label}</Text>
    </Pressable>
  );
}

function SecondaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.secondaryButton} onPress={onPress}>
      <Text style={styles.secondaryButtonText}>{label}</Text>
    </Pressable>
  );
}

function loginMethodLabel(method: string) {
  return { apple: "Apple", google: "Google", kakao: "카카오", email: "이메일", demo: "데모 계정" }[method] ?? method;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, backgroundColor: colors.card },
  headerButton: { width: 56, minHeight: 34, justifyContent: "center" },
  headerButtonText: { color: colors.amber, fontSize: 14, fontWeight: "800" },
  headerTitle: { flex: 1, textAlign: "center", color: colors.text, fontSize: 17, fontWeight: "800" },
  content: { padding: 20, gap: 20 },
  sectionTitle: { marginBottom: 8, marginLeft: 3, color: colors.muted, fontSize: 12, fontWeight: "800" },
  card: { borderRadius: 18, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, overflow: "hidden" },
  field: { padding: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  fieldLabel: { color: colors.muted, fontSize: 11, fontWeight: "700", marginBottom: 7 },
  input: { minHeight: 42, borderRadius: 12, backgroundColor: colors.backgroundSecondary, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, color: colors.text, fontSize: 14 },
  messageInput: { minHeight: 140, paddingTop: 12, paddingBottom: 12 },
  settingRow: { minHeight: 62, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  rowLabel: { flex: 1, color: colors.text, fontSize: 14, fontWeight: "700" },
  rowMeta: { marginTop: 3, color: colors.faint, fontSize: 10.5 },
  infoValue: { color: colors.muted, fontSize: 13, fontWeight: "700" },
  choiceBlock: { paddingHorizontal: 14, paddingVertical: 13, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, gap: 9 },
  choiceRow: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  choice: { minHeight: 34, justifyContent: "center", borderRadius: 999, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, backgroundColor: colors.backgroundSecondary },
  choiceOn: { backgroundColor: colors.amberSoft, borderColor: colors.amber },
  choiceText: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  choiceTextOn: { color: colors.amberDark },
  categoryRow: { minHeight: 66, flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  categoryCopy: { flex: 1 },
  miniButton: { width: 28, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: colors.backgroundSecondary },
  miniButtonText: { color: colors.text, fontSize: 16, fontWeight: "800" },
  disabledText: { opacity: 0.25 },
  stateButton: { minWidth: 40, height: 32, borderRadius: 9, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
  stateButtonOn: { backgroundColor: colors.cardHi, borderColor: "#7FC8B2" },
  coreButtonOn: { backgroundColor: colors.amberSoft, borderColor: colors.amber },
  stateButtonText: { color: colors.faint, fontSize: 10, fontWeight: "800" },
  stateButtonTextOn: { color: colors.text },
  help: { color: colors.muted, fontSize: 12.5, lineHeight: 19 },
  accountEmailHelp: { paddingHorizontal: 14, paddingVertical: 10 },
  primaryButton: { minHeight: 50, borderRadius: 15, backgroundColor: colors.amber, alignItems: "center", justifyContent: "center" },
  primaryButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  secondaryButton: { minHeight: 48, borderRadius: 15, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  secondaryButtonText: { color: colors.text, fontSize: 14, fontWeight: "800" },
  policyLead: { color: colors.text, fontSize: 15, lineHeight: 23, fontWeight: "700" },
  policySection: { borderRadius: 16, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, padding: 16 },
  policyTitle: { color: colors.text, fontSize: 14, fontWeight: "800", marginBottom: 7 },
  policyBody: { color: colors.muted, fontSize: 12.5, lineHeight: 20 },
  policyFootnote: { color: colors.faint, fontSize: 11, lineHeight: 17 },
});
