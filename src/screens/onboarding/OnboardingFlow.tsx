import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Linking, Pressable, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import {
  ALL_LOG_CATEGORY_GROUPS,
  CATEGORY_OPTIONS,
  DEFAULT_CARE_SETUP,
  FEEDING_OPTIONS,
  RELATIONSHIP_OPTIONS,
  formatAuthorByline,
  relationshipToLabel,
  type CareSetup,
  type ChildGender,
  type DefaultFeedingMethod,
  type LogCategoryGroup,
  type PostpartumStatus,
  type PreferredLanguage,
  type RelationshipToChild,
} from "../../types/careSetup";
import type { RelationshipLabel } from "../../types/growthBook";
import type { InviteType } from "../../types/database";
import { FamilyRepository, type DarinInviteRequestView } from "../../repositories/FamilyRepository";
import { ProfileRepository } from "../../repositories/ProfileRepository";
import { colors } from "../../theme";
import { BabyLogIcon } from "../../components/babylog/BabyLogIcon";
import { RecordDatePickerModal } from "../../components/babylog/RecordDatePickerModal";
import { formatDateKey, offsetDateKey } from "../../utils/dateKey";
import {
  OnboardingField,
  OnboardingOptionRow,
  OnboardingShell,
  onboardingInputStyle,
} from "./OnboardingShell";

export type OnboardingResult =
  | { mode: "create"; setup: CareSetup }
  | {
      mode: "join";
      code: string;
      babyName: string;
      ownerName: string;
      myName: string;
      myRealName: string;
      relationship: RelationshipToChild;
      relationshipLabel: RelationshipLabel;
      inviteType: InviteType;
    }
  | { mode: "join-request"; babyId: string; myName: string };

type Props = {
  initialName?: string;
  initialRelation?: RelationshipLabel;
  initialInviteCode?: string;
  skipProfileStep?: boolean;
  startAtBabySetup?: boolean;
  initialChild?: Partial<CareSetup["child"]>;
  onComplete: (result: OnboardingResult) => void;
};

type Step =
  | "about"
  | "connect"
  | "requests"
  | "invite"
  | "invite-confirm"
  | "born"
  | "baby"
  | "care"
  | "complete";

type InvitePreview = { code: string; babyName: string; ownerName: string; inviteType: InviteType };

function relationshipFromLabel(label?: RelationshipLabel): RelationshipToChild {
  if (label === "엄마") return "mom";
  if (label === "아빠") return "dad";
  if (label === "시터") return "sitter";
  if (label === "가족" || label === "할머니" || label === "할아버지" || label === "이모" || label === "삼촌") return "family";
  return "guardian";
}

export function OnboardingFlow({
  initialName = "",
  initialRelation,
  initialInviteCode = "",
  skipProfileStep = false,
  startAtBabySetup = false,
  initialChild,
  onComplete,
}: Props) {
  const [step, setStep] = useState<Step>(
    initialInviteCode ? "invite" : startAtBabySetup ? "born" : skipProfileStep ? "connect" : "about",
  );
  const [setup, setSetup] = useState<CareSetup>(() => ({
    ...DEFAULT_CARE_SETUP,
    parent: {
      ...DEFAULT_CARE_SETUP.parent,
      parentName: initialName,
      relationshipToChild: relationshipFromLabel(initialRelation),
    },
    child: {
      ...DEFAULT_CARE_SETUP.child,
      ...initialChild,
    },
  }));
  const [inviteCode, setInviteCode] = useState(initialInviteCode);
  const [inviteError, setInviteError] = useState("");
  const [invitePreview, setInvitePreview] = useState<InvitePreview | null>(null);
  const [incomingRequests, setIncomingRequests] = useState<DarinInviteRequestView[]>([]);
  const [myDarinId, setMyDarinId] = useState("");
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [requestError, setRequestError] = useState("");
  const [datePickerTarget, setDatePickerTarget] = useState<"birthDate" | "dueDate" | null>(null);

  const setParent = <K extends keyof CareSetup["parent"]>(key: K, value: CareSetup["parent"][K]) =>
    setSetup((s) => ({ ...s, parent: { ...s.parent, [key]: value } }));
  const setChild = <K extends keyof CareSetup["child"]>(key: K, value: CareSetup["child"][K]) =>
    setSetup((s) => ({ ...s, child: { ...s.child, [key]: value } }));
  const setPref = <K extends keyof CareSetup["preferences"]>(
    key: K,
    value: CareSetup["preferences"][K],
  ) => setSetup((s) => ({ ...s, preferences: { ...s.preferences, [key]: value } }));

  const toggleCategory = (group: LogCategoryGroup) => {
    const current = setup.preferences.enabledLogCategories;
    const next = current.includes(group) ? current.filter((g) => g !== group) : [...current, group];
    setPref("enabledLogCategories", next.length ? next : [group]);
  };

  const progressStep = useMemo((): 1 | 2 | 3 | undefined => {
    if (step === "about") return 1;
    if (step === "born" || step === "baby") return 2;
    if (step === "care") return 3;
    return undefined;
  }, [step]);

  const feedingLabel =
    FEEDING_OPTIONS.find((o) => o.value === setup.preferences.defaultFeedingMethod)?.label ??
    "아직 모름";
  const relationshipLabel = initialRelation ?? relationshipToLabel(setup.parent.relationshipToChild);

  const previewInvite = useCallback(async () => {
    try {
      const row = await FamilyRepository.previewInviteCode(inviteCode);
      if (!row || !row.is_valid) {
        throw new Error(row?.invalid_reason === "expired" ? "만료된 초대코드예요." : "유효하지 않은 초대코드예요.");
      }
      if (row.invite_type === "darin_friend") {
        throw new Error("이전 버전 초대코드예요. 새로운 친구 초대코드를 요청해 주세요.");
      }
      setInvitePreview({
        code: inviteCode.trim().toUpperCase(),
        babyName: row.baby_name ?? "",
        ownerName: row.inviter_name,
        inviteType: row.invite_type,
      });
      setInviteError("");
      setStep("invite-confirm");
    } catch (cause) {
      setInviteError(cause instanceof Error ? cause.message : "초대 정보를 확인하지 못했어요.");
    }
  }, [inviteCode]);

  useEffect(() => {
    if (!initialInviteCode) return;
    void previewInvite();
  }, [initialInviteCode, previewInvite]);

  const loadIncomingRequests = useCallback(async () => {
    setRequestsLoading(true);
    setRequestError("");
    try {
      const [reqs, profile] = await Promise.all([
        FamilyRepository.listDarinInviteRequests().catch(() => []),
        ProfileRepository.getMyProfile().catch(() => null),
      ]);
      setIncomingRequests(reqs.filter((item) => item.direction === "incoming"));
      setMyDarinId(profile?.darin_id?.trim() ?? "");
    } catch (cause) {
      setIncomingRequests([]);
      setRequestError(cause instanceof Error ? cause.message : "받은 요청을 불러오지 못했어요.");
    } finally {
      setRequestsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (step !== "connect" && step !== "requests") return;
    void loadIncomingRequests();
  }, [loadIncomingRequests, step]);

  const acceptIncomingRequest = async (item: DarinInviteRequestView) => {
    if (respondingId) return;
    setRespondingId(item.id);
    setRequestError("");
    try {
      const accepted = await FamilyRepository.respondToDarinIdInviteRequest(item.id, true);
      const babyId = accepted?.baby_id ?? item.babyId;
      if (!babyId) throw new Error("연결된 아기 정보를 찾지 못했어요.");
      onComplete({
        mode: "join-request",
        babyId,
        myName: setup.parent.parentName.trim(),
      });
    } catch (cause) {
      setRequestError(cause instanceof Error ? cause.message : "요청을 수락하지 못했어요.");
    } finally {
      setRespondingId(null);
    }
  };

  const declineIncomingRequest = async (item: DarinInviteRequestView) => {
    if (respondingId) return;
    setRespondingId(item.id);
    setRequestError("");
    try {
      await FamilyRepository.respondToDarinIdInviteRequest(item.id, false);
      await loadIncomingRequests();
    } catch (cause) {
      setRequestError(cause instanceof Error ? cause.message : "요청을 거절하지 못했어요.");
    } finally {
      setRespondingId(null);
    }
  };

  const pickPhoto = async () => {
    try {
      const current = await ImagePicker.getMediaLibraryPermissionsAsync();
      let granted = current.granted || current.accessPrivileges === "limited";
      if (!granted) {
        const asked = await ImagePicker.requestMediaLibraryPermissionsAsync();
        granted = asked.granted || asked.accessPrivileges === "limited";
      }
      if (!granted) {
        Alert.alert(
          "사진 접근 권한",
          "아기 사진을 선택하려면 사진 라이브러리 권한이 필요해요.",
          [
            { text: "취소", style: "cancel" },
            { text: "설정 열기", onPress: () => void Linking.openSettings() },
          ],
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.7,
        allowsMultipleSelection: false,
        exif: false,
      });
      if (result.canceled || !result.assets?.[0]?.uri) return;
      setChild("photoUri", result.assets[0].uri);
    } catch (error) {
      Alert.alert(
        "사진을 열 수 없어요",
        error instanceof Error ? error.message : "잠시 후 다시 시도해 주세요.",
      );
    }
  };

  if (step === "about") {
    return (
      <OnboardingShell
        progressStep={progressStep}
        title="나에 대해"
        subtitle="기록에 표시될 기본 정보만 알려주세요."
        primaryLabel="다음"
        primaryDisabled={!setup.parent.parentName.trim()}
        onPrimary={() => setStep("connect")}
      >
        <OnboardingField label="이름" required>
          <TextInput
            style={onboardingInputStyle}
            value={setup.parent.parentName}
            onChangeText={(v) => setParent("parentName", v)}
            placeholder="예: 민지"
            placeholderTextColor={colors.faint}
            autoFocus
          />
        </OnboardingField>
        <OnboardingField label="아이와의 관계">
          <OnboardingOptionRow
            options={RELATIONSHIP_OPTIONS}
            value={setup.parent.relationshipToChild}
            onChange={(v) => setParent("relationshipToChild", v)}
          />
        </OnboardingField>
        <OnboardingField label="임신/산후 상태">
          <OnboardingOptionRow
            options={[
              { value: "pregnant", label: "임신 중" },
              { value: "expecting", label: "출산 예정" },
              { value: "postpartum", label: "산후" },
              { value: "not_applicable", label: "해당 없음" },
            ]}
            value={setup.parent.postpartumStatus}
            onChange={(v) => setParent("postpartumStatus", v as PostpartumStatus)}
          />
        </OnboardingField>
        <OnboardingField label="선호 언어">
          <OnboardingOptionRow
            options={[
              { value: "ko", label: "한국어" },
              { value: "en", label: "English" },
            ]}
            value={setup.parent.preferredLanguage}
            onChange={(v) => setParent("preferredLanguage", v as PreferredLanguage)}
          />
        </OnboardingField>
        <Text style={styles.hint}>
          성장책에는 {formatAuthorByline(setup.parent.parentName || "이름", setup.parent.relationshipToChild)}{" "}
          처럼 표시돼요.
        </Text>
      </OnboardingShell>
    );
  }

  if (step === "connect") {
    return (
      <OnboardingShell
        title="아기 정보를 어떻게 연결할까요?"
        subtitle="새로 만들거나, 가족이 ID로 보낸 요청을 수락해 참여할 수 있어요."
      >
        <ChoiceCard
          title="새 아기 등록하기"
          body="내가 아기 정보를 새로 만들어요."
          onPress={() => setStep("born")}
        />
        <ChoiceCard
          title="받은 요청으로 참여하기"
          body={
            incomingRequests.length
              ? `대기 중인 요청 ${incomingRequests.length}건이 있어요.`
              : "가족이 Darin ID로 보낸 요청을 수락해요."
          }
          onPress={() => {
            setRequestError("");
            setStep("requests");
          }}
        />
        <Pressable
          style={styles.linkButton}
          onPress={() => {
            setInviteError("");
            setStep("invite");
          }}
          accessibilityRole="button"
          accessibilityLabel="초대코드가 있으면 입력"
        >
          <Text style={styles.linkButtonText}>초대코드가 있으면 입력</Text>
        </Pressable>
      </OnboardingShell>
    );
  }

  if (step === "requests") {
    return (
      <OnboardingShell
        title="받은 요청으로 참여"
        subtitle="가족이 Darin ID로 보낸 요청을 수락하면 그 아기 기록에 연결돼요."
        secondaryLabel="뒤로"
        onSecondary={() => setStep("connect")}
      >
        {requestsLoading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={colors.amberText} />
            <Text style={styles.hint}>받은 요청을 확인하는 중이에요.</Text>
          </View>
        ) : incomingRequests.length ? (
          incomingRequests.map((item) => (
            <View key={item.id} style={styles.requestCard}>
              <Text style={styles.requestTitle}>{item.title}</Text>
              <Text style={styles.requestBody}>{item.body}</Text>
              <Text style={styles.hint}>{item.relation} · {item.roleLabel}</Text>
              <View style={styles.requestActions}>
                <Pressable
                  style={styles.declineButton}
                  disabled={respondingId === item.id}
                  onPress={() => void declineIncomingRequest(item)}
                  accessibilityRole="button"
                  accessibilityLabel="거절"
                >
                  <Text style={styles.declineText}>거절</Text>
                </Pressable>
                <Pressable
                  style={[styles.acceptButton, respondingId === item.id && styles.disabled]}
                  disabled={Boolean(respondingId)}
                  onPress={() => void acceptIncomingRequest(item)}
                  accessibilityRole="button"
                  accessibilityLabel="수락하고 참여"
                >
                  {respondingId === item.id ? (
                    <ActivityIndicator color={colors.amberDark} />
                  ) : (
                    <Text style={styles.acceptText}>수락하고 참여</Text>
                  )}
                </Pressable>
              </View>
            </View>
          ))
        ) : (
          <View style={styles.summaryCard}>
            <Text style={styles.choiceTitle}>아직 받은 요청이 없어요</Text>
            <Text style={styles.choiceBody}>
              {myDarinId
                ? `내 Darin ID는 ${myDarinId}예요. 가족에게 이 ID를 알려 주면 요청이 여기로 와요.`
                : "가족에게 내 Darin ID를 알려 주면, 요청이 여기로 와요."}
            </Text>
            <Pressable
              style={styles.linkButton}
              onPress={() => {
                setInviteError("");
                setStep("invite");
              }}
              accessibilityRole="button"
              accessibilityLabel="초대코드가 있으면 입력"
            >
              <Text style={styles.linkButtonText}>초대코드가 있으면 입력</Text>
            </Pressable>
          </View>
        )}
        {requestError ? <Text style={styles.error}>{requestError}</Text> : null}
      </OnboardingShell>
    );
  }

  if (step === "invite") {
    return (
      <OnboardingShell
        title="초대코드 입력"
        subtitle="카카오톡이나 문자로 공유받은 유효한 초대코드를 입력해 주세요."
        primaryLabel="코드 확인"
        primaryDisabled={!inviteCode.trim()}
        onPrimary={() => void previewInvite()}
        secondaryLabel="뒤로"
        onSecondary={() => setStep("connect")}
      >
        <OnboardingField label="초대코드" required>
          <TextInput
            style={[onboardingInputStyle, styles.codeInput]}
            value={inviteCode}
            onChangeText={(v) => setInviteCode(v.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 16))}
            placeholder="예: DARIN-8F3K2Q"
            placeholderTextColor={colors.faint}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={16}
          />
        </OnboardingField>
        {inviteError ? <Text style={styles.error}>{inviteError}</Text> : null}
        <Text style={styles.hint}>Darin ID 요청과 초대코드·링크는 상황에 맞게 선택하는 서로 다른 초대 방식이에요.</Text>
      </OnboardingShell>
    );
  }

  if (step === "invite-confirm" && invitePreview) {
    return (
      <OnboardingShell
        title={invitePreview.inviteType === "family" ? "가족 초대 확인" : "친구 초대 확인"}
        subtitle={
          invitePreview.inviteType === "family"
            ? "이 아기 기록에 가족으로 참여할까요?"
            : "친구 공개 순간을 함께 볼 수 있도록 연결할까요?"
        }
        primaryLabel="초대 수락"
        onPrimary={() =>
          onComplete({
            mode: "join",
            code: invitePreview.code,
            babyName: invitePreview.babyName,
            ownerName: invitePreview.ownerName,
            myName: setup.parent.parentName.trim(),
            myRealName: setup.parent.nickname?.trim() ?? "",
            relationship: setup.parent.relationshipToChild,
            relationshipLabel,
            inviteType: invitePreview.inviteType,
          })
        }
        secondaryLabel="코드 다시 입력"
        onSecondary={() => setStep("invite")}
      >
        <View style={styles.summaryCard}>
          {invitePreview.babyName ? <SummaryRow label="아기" value={invitePreview.babyName} /> : null}
          <SummaryRow label="초대한 사람" value={invitePreview.ownerName} />
          <SummaryRow label="초대코드" value={invitePreview.code} />
          {invitePreview.inviteType === "family" ? <SummaryRow label="나의 관계" value={relationshipLabel} /> : null}
          <SummaryRow label="내 이름" value={setup.parent.parentName.trim()} />
        </View>
      </OnboardingShell>
    );
  }

  if (step === "born") {
    return (
      <OnboardingShell
        progressStep={progressStep}
        title="아기가 태어났나요?"
        subtitle="상태에 맞게 입력 항목이 달라져요."
        secondaryLabel="뒤로"
        onSecondary={() => setStep("connect")}
      >
        <ChoiceCard
          title="네, 태어났어요"
          body="이름과 생년월일로 바로 시작해요."
          onPress={() => {
            setChild("childStatus", "newborn");
            setStep("baby");
          }}
        />
        <ChoiceCard
          title="아직 태어나지 않았어요"
          body="태명과 예정일로 준비해요."
          onPress={() => {
            setChild("childStatus", "unborn");
            setStep("baby");
          }}
        />
      </OnboardingShell>
    );
  }

  if (step === "baby") {
    const born = setup.child.childStatus !== "unborn";
    const canNext = born
      ? Boolean(setup.child.childName.trim() && setup.child.birthDate?.trim())
      : Boolean(setup.child.childName.trim() && setup.child.dueDate?.trim());

    return (
      <OnboardingShell
        progressStep={progressStep}
        title="아기 정보"
        subtitle={born ? "필수만 채우고 나중에 더 적을 수 있어요." : "태명과 예정일만 있으면 충분해요."}
        primaryLabel="다음"
        primaryDisabled={!canNext}
        onPrimary={() => setStep("care")}
        secondaryLabel="뒤로"
        onSecondary={() => setStep("born")}
      >
        <OnboardingField label={born ? "아기 이름/별명" : "태명/별명"} required>
          <TextInput
            style={onboardingInputStyle}
            value={setup.child.childName}
            onChangeText={(v) => setChild("childName", v)}
            placeholder={born ? "예: 콩이" : "예: 콩이"}
            placeholderTextColor={colors.faint}
          />
        </OnboardingField>

        {born ? (
          <OnboardingField label="생년월일" required>
            <DatePickerField
              value={setup.child.birthDate}
              label="생년월일 선택"
              onPress={() => setDatePickerTarget("birthDate")}
            />
          </OnboardingField>
        ) : (
          <OnboardingField label="예정일" required>
            <DatePickerField
              value={setup.child.dueDate}
              label="예정일 선택"
              onPress={() => setDatePickerTarget("dueDate")}
            />
          </OnboardingField>
        )}

        <OnboardingField label="성별" optional>
          <OnboardingOptionRow
            options={[
              { value: "girl", label: "여아" },
              { value: "boy", label: "남아" },
              { value: "unknown", label: "모름/나중에" },
            ]}
            value={(setup.child.gender ?? "unknown") as ChildGender}
            onChange={(v) => setChild("gender", v)}
          />
        </OnboardingField>

        {born ? (
          <>
            <OnboardingField label="출생 몸무게" optional>
              <TextInput
                style={onboardingInputStyle}
                value={setup.child.birthWeight ?? ""}
                onChangeText={(v) => setChild("birthWeight", v || undefined)}
                placeholder="예: 3.2kg"
                placeholderTextColor={colors.faint}
              />
            </OnboardingField>
            <OnboardingField label="예정일" optional>
              <DatePickerField
                value={setup.child.dueDate}
                label="예정일 선택"
                onPress={() => setDatePickerTarget("dueDate")}
              />
            </OnboardingField>
          </>
        ) : null}

        <OnboardingField label="사진" optional>
          <View style={styles.photoRow}>
            <Pressable
              style={styles.photoHit}
              onPress={() => void pickPhoto()}
              accessibilityRole="button"
              accessibilityLabel="아기 사진 선택"
            >
              {setup.child.photoUri ? (
                <Image source={{ uri: setup.child.photoUri }} style={styles.photo} contentFit="cover" />
              ) : (
                <View style={[styles.photo, styles.photoEmpty]}>
                  <Text style={styles.photoEmptyText}>사진</Text>
                </View>
              )}
            </Pressable>
            <Pressable
              style={styles.photoBtn}
              onPress={() => void pickPhoto()}
              accessibilityRole="button"
              accessibilityLabel={setup.child.photoUri ? "사진 바꾸기" : "사진 선택"}
            >
              <Text style={styles.photoBtnText}>
                {setup.child.photoUri ? "사진 바꾸기" : "사진 선택"}
              </Text>
            </Pressable>
            {setup.child.photoUri ? (
              <Pressable onPress={() => setChild("photoUri", undefined)} hitSlop={8}>
                <Text style={styles.skip}>나중에</Text>
              </Pressable>
            ) : null}
          </View>
        </OnboardingField>

        <RecordDatePickerModal
          visible={datePickerTarget !== null}
          selectedDateKey={
            (datePickerTarget === "birthDate" ? setup.child.birthDate : setup.child.dueDate)
              || formatDateKey()
          }
          minDateKey={formatDateKey(new Date(new Date().getFullYear() - 18, 0, 1), "midnight")}
          maxDateKey={datePickerTarget === "birthDate" ? formatDateKey() : offsetDateKey(formatDateKey(), 365)}
          title={datePickerTarget === "birthDate" ? "생년월일 선택" : "예정일 선택"}
          onSelect={(dateKey) => {
            if (datePickerTarget === "birthDate") setChild("birthDate", dateKey);
            if (datePickerTarget === "dueDate") setChild("dueDate", dateKey);
          }}
          onClose={() => setDatePickerTarget(null)}
        />
      </OnboardingShell>
    );
  }

  if (step === "care") {
    return (
      <OnboardingShell
        progressStep={progressStep}
        title="돌봄 설정"
        subtitle="자주 쓰는 기록만 켜 두면 더 편해요."
        primaryLabel="다음"
        onPrimary={() => setStep("complete")}
        secondaryLabel="뒤로"
        onSecondary={() => setStep("baby")}
      >
        <OnboardingField label="기본 수유 방식">
          <OnboardingOptionRow
            options={FEEDING_OPTIONS}
            value={setup.preferences.defaultFeedingMethod}
            onChange={(v) => setPref("defaultFeedingMethod", v as DefaultFeedingMethod)}
          />
        </OnboardingField>

        <OnboardingField label="표시할 기록 카테고리">
          <View style={styles.chipWrap}>
            {CATEGORY_OPTIONS.map((opt) => {
              const active = setup.preferences.enabledLogCategories.includes(opt.value);
              return (
                <Pressable
                  key={opt.value}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => toggleCategory(opt.value)}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{opt.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </OnboardingField>

        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.switchLabel}>가족 공유</Text>
            <Text style={styles.switchHint}>가족이 기록을 보고 함께 추가할 수 있어요.</Text>
          </View>
          <Switch
            value={setup.preferences.familySharingEnabled}
            onValueChange={(v) => setPref("familySharingEnabled", v)}
            trackColor={{ false: colors.border, true: colors.amber }}
          />
        </View>
      </OnboardingShell>
    );
  }

  // complete
  const dateLine = setup.child.childStatus === "unborn"
    ? `예정일: ${(setup.child.dueDate ?? "").replace(/-/g, ".")}`
    : `생년월일: ${(setup.child.birthDate ?? "").replace(/-/g, ".")}`;

  return (
    <OnboardingShell
      title={`${setup.child.childName.trim() || "아기"}의 기록을 시작할까요?`}
      subtitle="확인 후 바로 메인으로 이동해요."
      primaryLabel="시작하기"
      onPrimary={() =>
        onComplete({
          mode: "create",
          setup: {
            ...setup,
            preferences: {
              ...setup.preferences,
              enabledLogCategories: setup.preferences.enabledLogCategories.length
                ? setup.preferences.enabledLogCategories
                : [...ALL_LOG_CATEGORY_GROUPS],
            },
          },
        })
      }
      secondaryLabel="뒤로"
      onSecondary={() => setStep("care")}
    >
      <View style={styles.summaryCard}>
        <SummaryRow label="아기 이름" value={setup.child.childName.trim()} />
        <SummaryRow label={setup.child.childStatus === "unborn" ? "예정일" : "생년월일"} value={dateLine.split(": ")[1] ?? "-"} />
        <SummaryRow label="나의 관계" value={relationshipLabel} />
        <SummaryRow label="기본 수유" value={feedingLabel} />
        <SummaryRow
          label="작성자 표시"
          value={formatAuthorByline(setup.parent.parentName, setup.parent.relationshipToChild)}
        />
      </View>
    </OnboardingShell>
  );
}

function DatePickerField({
  value,
  label,
  onPress,
}: {
  value?: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[onboardingInputStyle, styles.dateField]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text style={[styles.dateFieldText, !value && styles.datePlaceholder]}>
        {value || "날짜를 선택해 주세요"}
      </Text>
      <BabyLogIcon kind="calendar" size={18} color={colors.amberText} />
    </Pressable>
  );
}

function ChoiceCard({
  title,
  body,
  onPress,
}: {
  title: string;
  body: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={({ pressed }) => [styles.choice, pressed && styles.choicePressed]} onPress={onPress}>
      <Text style={styles.choiceTitle}>{title}</Text>
      <Text style={styles.choiceBody}>{body}</Text>
    </Pressable>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value || "-"}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hint: { fontSize: 12.5, color: colors.faint, lineHeight: 18, marginTop: 4, marginBottom: 8 },
  error: { color: colors.dangerText, fontSize: 13, fontWeight: "600", marginBottom: 8 },
  codeInput: { letterSpacing: 4, fontWeight: "800", textAlign: "center", fontSize: 20 },
  dateField: { minHeight: 50, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  dateFieldText: { color: colors.text, fontSize: 15, fontWeight: "600" },
  datePlaceholder: { color: colors.faint, fontWeight: "500" },
  choice: {
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: 18,
    marginBottom: 12,
  },
  choicePressed: { borderColor: colors.amber, backgroundColor: colors.amberSoft },
  choiceTitle: { fontSize: 16, fontWeight: "800", color: colors.text, marginBottom: 6 },
  choiceBody: { fontSize: 13, color: colors.muted, lineHeight: 19 },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  chipActive: { backgroundColor: colors.amber, borderColor: colors.amber },
  chipText: { fontSize: 12.5, color: colors.muted, fontWeight: "700" },
  chipTextActive: { color: colors.amberDark },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 8,
    marginBottom: 8,
    paddingVertical: 8,
  },
  switchLabel: { fontSize: 14, fontWeight: "800", color: colors.text },
  switchHint: { fontSize: 12, color: colors.faint, marginTop: 3, lineHeight: 17 },
  summaryCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: 16,
    gap: 12,
  },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  summaryLabel: { fontSize: 13, color: colors.faint, fontWeight: "600" },
  summaryValue: { flex: 1, textAlign: "right", fontSize: 14, fontWeight: "800", color: colors.text },
  photoRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  photoHit: { borderRadius: 16, overflow: "hidden" },
  photo: { width: 56, height: 56, borderRadius: 16 },
  photoEmpty: {
    backgroundColor: colors.amberSoft,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  photoEmptyText: { fontSize: 11, color: colors.muted, fontWeight: "700" },
  photoBtn: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 44,
    justifyContent: "center",
    backgroundColor: colors.card,
  },
  photoBtnText: { fontSize: 13, fontWeight: "700", color: colors.text },
  skip: { fontSize: 12, color: colors.faint, fontWeight: "700" },
  linkButton: { minHeight: 44, alignItems: "center", justifyContent: "center", marginTop: 4 },
  linkButtonText: { color: colors.amberText, fontSize: 13, fontWeight: "800" },
  loadingRow: { alignItems: "center", gap: 10, paddingVertical: 18 },
  requestCard: {
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: 16,
    marginBottom: 12,
    gap: 8,
  },
  requestTitle: { fontSize: 15, fontWeight: "800", color: colors.text },
  requestBody: { fontSize: 13, color: colors.muted, lineHeight: 19 },
  requestActions: { flexDirection: "row", justifyContent: "flex-end", gap: 8, marginTop: 4 },
  declineButton: { minHeight: 44, paddingHorizontal: 14, borderRadius: 10, backgroundColor: colors.backgroundSecondary, justifyContent: "center" },
  declineText: { color: colors.muted, fontWeight: "700", fontSize: 13 },
  acceptButton: { minHeight: 44, minWidth: 120, paddingHorizontal: 14, borderRadius: 10, backgroundColor: colors.amber, alignItems: "center", justifyContent: "center" },
  acceptText: { color: colors.amberDark, fontWeight: "800", fontSize: 13 },
  disabled: { opacity: 0.48 },
});
