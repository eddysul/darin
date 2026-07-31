import { useEffect, useMemo, useState } from "react";
import {
  Alert,
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
  | "terms";

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
  const { applyOwnerFromSetup } = useBabyLog();
  const { setLocale } = useLanguage();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [language, setLanguage] = useState<PreferredLanguage>("ko");
  const [relationship, setRelationship] = useState<RelationshipToChild>("mom");
  const [accountReady, setAccountReady] = useState(false);

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
              lead="K-Nanny는 육아 기록 제공에 필요한 최소한의 정보만 처리합니다."
              sections={[
                ["수집 항목", "계정 정보, 아기 프로필, 육아 기록, 일기, 가족 공유 정보, 사용자가 선택한 사진과 음성 기록"],
                ["이용 목적", "기록 저장·복원, 가족 공유, 리포트와 AI 상담 컨텍스트 제공, 고객 지원"],
                ["보관과 삭제", "계정 삭제 요청 시 서버 계정과 연결된 데이터 삭제를 진행합니다. 기기 로컬 데이터 삭제 여부는 사용자가 선택할 수 있습니다."],
                ["문의", "출시 전 고객지원 이메일과 사업자 정보를 App Store 등록 정보와 함께 최종 고지합니다."],
              ]}
            />
          ) : null}

          {page === "terms" ? (
            <PolicyDocument
              lead="K-Nanny는 보호자의 육아 기록을 돕는 서비스이며 의료 진단을 대체하지 않습니다."
              sections={[
                ["서비스 이용", "사용자는 본인과 가족 구성원의 권한을 확인하고 정확한 정보를 입력해야 합니다."],
                ["AI 안내", "AI 답변은 참고 정보이며 응급하거나 의료 판단이 필요한 경우 전문 의료기관에 문의해야 합니다."],
                ["가족 공유", "초대받은 구성원의 접근 범위는 관리자가 설정한 역할과 권한에 따릅니다."],
                ["계정 종료", "사용자는 메뉴의 계정 삭제에서 서비스 탈퇴를 요청할 수 있습니다."],
              ]}
            />
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
      <Text style={styles.policyFootnote}>시행 예정일: 2026년 8월 31일 · 출시 전 법률 검토본으로 교체 필요</Text>
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
  return { apple: "Apple", google: "Google", email: "이메일", demo: "데모 계정" }[method] ?? method;
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
