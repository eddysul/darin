import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Linking, Pressable, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import {
  ALL_LOG_CATEGORY_GROUPS,
  CATEGORY_OPTIONS,
  DEFAULT_CARE_SETUP,
  type CareSetup,
  type ChildGender,
  type DefaultFeedingMethod,
  type LogCategoryGroup,
  type PostpartumStatus,
  type PreferredLanguage,
  type RelationshipToChild,
} from "../../types/careSetup";
import type { RelationshipLabel } from "../../types/growthBook";
import { PROFILE_RELATION_OPTIONS } from "../../types/profileSettings";
import { useLanguage } from "../../LanguageContext";
import type { MessageKey } from "../../i18n";
import { isLocaleAvailable } from "../../config/featureFlags";
import { storedFamilyRoleLabel, storedRelationshipLabel, localizedErrorMessage, caughtErrorMessage } from "../../utils/familyDisplay";
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
  onComplete: (result: OnboardingResult) => void | Promise<void>;
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
  const index = label ? PROFILE_RELATION_OPTIONS.indexOf(label) : -1;
  if (index === 0) return "mom";
  if (index === 1) return "dad";
  if (index === 7) return "sitter";
  if ([3, 4, 5, 6, 9].includes(index)) return "family";
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
  const { t } = useLanguage();
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
  const [submittingSetup, setSubmittingSetup] = useState(false);
  const submittingSetupRef = useRef(false);

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

  const completeSetup = async () => {
    if (submittingSetupRef.current) return;
    submittingSetupRef.current = true;
    setSubmittingSetup(true);
    try {
      await onComplete({
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
      });
    } finally {
      submittingSetupRef.current = false;
      setSubmittingSetup(false);
    }
  };

  const progressStep = useMemo((): 1 | 2 | 3 | undefined => {
    if (step === "about") return 1;
    if (step === "born" || step === "baby") return 2;
    if (step === "care") return 3;
    return undefined;
  }, [step]);

  const labelFor = (group: string, value: string) => t(`onboardingFlow.${group}.${value}` as MessageKey);
  const feedingLabel = labelFor("feeding", setup.preferences.defaultFeedingMethod);
  const relationshipLabel = initialRelation ?? PROFILE_RELATION_OPTIONS[
    ({ mom: 0, dad: 1, guardian: 2, family: 9, sitter: 7 } as const)[setup.parent.relationshipToChild]
  ];
  const localizedRelationship = labelFor("relationship", setup.parent.relationshipToChild);
  const authorByline = t("onboardingFlow.authorByline", {
    relationship: localizedRelationship,
    name: setup.parent.parentName.trim() || t("onboardingFlow.nameFallback"),
  });

  const previewInvite = useCallback(async () => {
    try {
      const row = await FamilyRepository.previewInviteCode(inviteCode);
      if (!row || !row.is_valid) {
        throw new Error(t(row?.invalid_reason === "expired" ? "onboardingFlow.error.inviteExpired" : "onboardingFlow.error.inviteInvalid"));
      }
      if (row.invite_type === "darin_friend") {
        throw new Error(t("onboardingFlow.error.inviteLegacy"));
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
      setInviteError(caughtErrorMessage(t, cause, "onboardingFlow.error.invitePreview"));
    }
  }, [inviteCode, t]);

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
      setRequestError(caughtErrorMessage(t, cause, "onboardingFlow.error.requestsLoad"));
    } finally {
      setRequestsLoading(false);
    }
  }, [t]);

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
      if (!babyId) throw new Error(t("onboardingFlow.error.babyMissing"));
      onComplete({
        mode: "join-request",
        babyId,
        myName: setup.parent.parentName.trim(),
      });
    } catch (cause) {
      setRequestError(caughtErrorMessage(t, cause, "onboardingFlow.error.requestAccept"));
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
      setRequestError(caughtErrorMessage(t, cause, "onboardingFlow.error.requestDecline"));
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
          t("onboardingFlow.photo.permissionTitle"),
          t("onboardingFlow.photo.permissionBody"),
          [
            { text: t("common.cancel"), style: "cancel" },
            { text: t("onboardingFlow.photo.openSettings"), onPress: () => void Linking.openSettings() },
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
        t("onboardingFlow.photo.errorTitle"),
        error instanceof Error ? localizedErrorMessage(t, error.message) : t("onboardingFlow.error.retry"),
      );
    }
  };

  if (step === "about") {
    return (
      <OnboardingShell
        progressStep={progressStep}
        title={t("onboardingFlow.about.title")}
        subtitle={t("onboardingFlow.about.subtitle")}
        primaryLabel={t("onboardingFlow.next")}
        primaryDisabled={!setup.parent.parentName.trim()}
        onPrimary={() => setStep("connect")}
      >
        <OnboardingField label={t("onboardingFlow.name")} required>
          <TextInput
            style={onboardingInputStyle}
            value={setup.parent.parentName}
            onChangeText={(v) => setParent("parentName", v)}
            placeholder={t("onboardingFlow.namePlaceholder")}
            placeholderTextColor={colors.faint}
            autoFocus
          />
        </OnboardingField>
        <OnboardingField label={t("onboardingFlow.relationshipLabel")}>
          <OnboardingOptionRow
            options={(["mom", "dad", "guardian", "family", "sitter"] as RelationshipToChild[]).map((value) => ({ value, label: labelFor("relationship", value) }))}
            value={setup.parent.relationshipToChild}
            onChange={(v) => setParent("relationshipToChild", v)}
          />
        </OnboardingField>
        <OnboardingField label={t("onboardingFlow.postpartumLabel")}>
          <OnboardingOptionRow
            options={[
              { value: "pregnant", label: labelFor("postpartum", "pregnant") },
              { value: "expecting", label: labelFor("postpartum", "expecting") },
              { value: "postpartum", label: labelFor("postpartum", "postpartum") },
              { value: "not_applicable", label: labelFor("postpartum", "not_applicable") },
            ]}
            value={setup.parent.postpartumStatus}
            onChange={(v) => setParent("postpartumStatus", v as PostpartumStatus)}
          />
        </OnboardingField>
        <OnboardingField label={t("onboardingFlow.languageLabel")}>
          <OnboardingOptionRow
            options={(["ko", "en", "ja", "es", "zh-CN"] as PreferredLanguage[])
              .filter((value) => isLocaleAvailable(value))
              .map((value) => ({ value, label: t(`onboardingFlow.language.${value}` as MessageKey) }))}
            value={setup.parent.preferredLanguage}
            onChange={(v) => setParent("preferredLanguage", v as PreferredLanguage)}
          />
        </OnboardingField>
        <Text style={styles.hint}>
          {t("onboardingFlow.authorPreview", { byline: authorByline })}
        </Text>
      </OnboardingShell>
    );
  }

  if (step === "connect") {
    return (
      <OnboardingShell
        title={t("onboardingFlow.connect.title")}
        subtitle={t("onboardingFlow.connect.subtitle")}
      >
        <ChoiceCard
          title={t("onboardingFlow.connect.createTitle")}
          body={t("onboardingFlow.connect.createBody")}
          onPress={() => setStep("born")}
        />
        <ChoiceCard
          title={t("onboardingFlow.connect.requestTitle")}
          body={
            incomingRequests.length
              ? t("onboardingFlow.connect.pendingCount", { count: incomingRequests.length })
              : t("onboardingFlow.connect.requestBody")
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
          accessibilityLabel={t("onboardingFlow.invite.enterLink")}
        >
          <Text style={styles.linkButtonText}>{t("onboardingFlow.invite.enterLink")}</Text>
        </Pressable>
      </OnboardingShell>
    );
  }

  if (step === "requests") {
    return (
      <OnboardingShell
        title={t("onboardingFlow.requests.title")}
        subtitle={t("onboardingFlow.requests.subtitle")}
        secondaryLabel={t("onboardingFlow.back")}
        onSecondary={() => setStep("connect")}
      >
        {requestsLoading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={colors.amberText} />
            <Text style={styles.hint}>{t("onboardingFlow.requests.loading")}</Text>
          </View>
        ) : incomingRequests.length ? (
          incomingRequests.map((item) => (
            <View key={item.id} style={styles.requestCard}>
              <Text style={styles.requestTitle}>{t(`onboardingFlow.requests.${item.requestType}Title` as MessageKey)}</Text>
              <Text style={styles.requestBody}>{t("onboardingFlow.requests.received")}</Text>
              <Text style={styles.hint}>{t("onboardingFlow.requests.meta", { relation: storedRelationshipLabel(t, item.relation), role: storedFamilyRoleLabel(t, item.roleLabel) })}</Text>
              <View style={styles.requestActions}>
                <Pressable
                  style={styles.declineButton}
                  disabled={respondingId === item.id}
                  onPress={() => void declineIncomingRequest(item)}
                  accessibilityRole="button"
                  accessibilityLabel={t("onboardingFlow.requests.decline")}
                >
                  <Text style={styles.declineText}>{t("onboardingFlow.requests.decline")}</Text>
                </Pressable>
                <Pressable
                  style={[styles.acceptButton, respondingId === item.id && styles.disabled]}
                  disabled={Boolean(respondingId)}
                  onPress={() => void acceptIncomingRequest(item)}
                  accessibilityRole="button"
                  accessibilityLabel={t("onboardingFlow.requests.accept")}
                >
                  {respondingId === item.id ? (
                    <ActivityIndicator color={colors.amberDark} />
                  ) : (
                    <Text style={styles.acceptText}>{t("onboardingFlow.requests.accept")}</Text>
                  )}
                </Pressable>
              </View>
            </View>
          ))
        ) : (
          <View style={styles.summaryCard}>
            <Text style={styles.choiceTitle}>{t("onboardingFlow.requests.emptyTitle")}</Text>
            <Text style={styles.choiceBody}>
              {myDarinId
                ? t("onboardingFlow.requests.emptyWithId", { darinId: myDarinId })
                : t("onboardingFlow.requests.emptyBody")}
            </Text>
            <Pressable
              style={styles.linkButton}
              onPress={() => {
                setInviteError("");
                setStep("invite");
              }}
              accessibilityRole="button"
              accessibilityLabel={t("onboardingFlow.invite.enterLink")}
            >
              <Text style={styles.linkButtonText}>{t("onboardingFlow.invite.enterLink")}</Text>
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
        title={t("onboardingFlow.invite.title")}
        subtitle={t("onboardingFlow.invite.subtitle")}
        primaryLabel={t("onboardingFlow.invite.check")}
        primaryDisabled={!inviteCode.trim()}
        onPrimary={() => void previewInvite()}
        secondaryLabel={t("onboardingFlow.back")}
        onSecondary={() => setStep("connect")}
      >
        <OnboardingField label={t("onboardingFlow.invite.code")} required>
          <TextInput
            style={[onboardingInputStyle, styles.codeInput]}
            value={inviteCode}
            onChangeText={(v) => setInviteCode(v.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 16))}
            placeholder={t("onboardingFlow.invite.placeholder")}
            placeholderTextColor={colors.faint}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={16}
          />
        </OnboardingField>
        {inviteError ? <Text style={styles.error}>{inviteError}</Text> : null}
        <Text style={styles.hint}>{t("onboardingFlow.invite.hint")}</Text>
      </OnboardingShell>
    );
  }

  if (step === "invite-confirm" && invitePreview) {
    return (
      <OnboardingShell
        title={t(invitePreview.inviteType === "family" ? "onboardingFlow.invite.familyConfirm" : "onboardingFlow.invite.friendConfirm")}
        subtitle={
          invitePreview.inviteType === "family"
            ? t("onboardingFlow.invite.familyConfirmBody")
            : t("onboardingFlow.invite.friendConfirmBody")
        }
        primaryLabel={t("onboardingFlow.invite.accept")}
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
        secondaryLabel={t("onboardingFlow.invite.reenter")}
        onSecondary={() => setStep("invite")}
      >
        <View style={styles.summaryCard}>
          {invitePreview.babyName ? <SummaryRow label={t("onboardingFlow.summary.baby")} value={invitePreview.babyName} /> : null}
          <SummaryRow label={t("onboardingFlow.summary.inviter")} value={invitePreview.ownerName} />
          <SummaryRow label={t("onboardingFlow.invite.code")} value={invitePreview.code} />
          {invitePreview.inviteType === "family" ? <SummaryRow label={t("onboardingFlow.summary.relationship")} value={localizedRelationship} /> : null}
          <SummaryRow label={t("onboardingFlow.summary.myName")} value={setup.parent.parentName.trim()} />
        </View>
      </OnboardingShell>
    );
  }

  if (step === "born") {
    return (
      <OnboardingShell
        progressStep={progressStep}
        title={t("onboardingFlow.stage.title")}
        subtitle={t("onboardingFlow.stage.subtitle")}
        secondaryLabel={t("onboardingFlow.back")}
        onSecondary={() => setStep("connect")}
      >
        <ChoiceCard
          title={t("onboardingFlow.stage.bornTitle")}
          body={t("onboardingFlow.stage.bornBody")}
          onPress={() => {
            setSetup((s) => ({
              ...s,
              parent: { ...s.parent, postpartumStatus: "postpartum" },
              child: { ...s.child, childStatus: "newborn" },
            }));
            setStep("baby");
          }}
        />
        <ChoiceCard
          title={t("onboardingFlow.stage.unbornTitle")}
          body={t("onboardingFlow.stage.unbornBody")}
          onPress={() => {
            setSetup((s) => ({
              ...s,
              parent: { ...s.parent, postpartumStatus: "pregnant" },
              child: { ...s.child, childStatus: "unborn", birthDate: undefined },
            }));
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
        title={t("onboardingFlow.baby.title")}
        subtitle={t(born ? "onboardingFlow.baby.bornSubtitle" : "onboardingFlow.baby.unbornSubtitle")}
        primaryLabel={t("onboardingFlow.next")}
        primaryDisabled={!canNext}
        onPrimary={() => setStep(born ? "care" : "complete")}
        secondaryLabel={t("onboardingFlow.back")}
        onSecondary={() => setStep("born")}
      >
        <OnboardingField label={t(born ? "onboardingFlow.baby.name" : "onboardingFlow.baby.prenatalName")} required>
          <TextInput
            style={onboardingInputStyle}
            value={setup.child.childName}
            onChangeText={(v) => setChild("childName", v)}
            placeholder={t("onboardingFlow.baby.namePlaceholder")}
            placeholderTextColor={colors.faint}
          />
        </OnboardingField>

        {born ? (
          <OnboardingField label={t("onboardingFlow.baby.birthDate")} required>
            <DatePickerField
              value={setup.child.birthDate}
              label={t("onboardingFlow.baby.selectBirthDate")}
              placeholder={t("onboardingFlow.baby.selectDate")}
              onPress={() => setDatePickerTarget("birthDate")}
            />
          </OnboardingField>
        ) : (
          <OnboardingField label={t("onboardingFlow.baby.dueDate")} required>
            <DatePickerField
              value={setup.child.dueDate}
              label={t("onboardingFlow.baby.selectDueDate")}
              placeholder={t("onboardingFlow.baby.selectDate")}
              onPress={() => setDatePickerTarget("dueDate")}
            />
          </OnboardingField>
        )}

        <OnboardingField label={t("onboardingFlow.baby.gender")} optional>
          <OnboardingOptionRow
            options={[
              { value: "girl", label: labelFor("gender", "girl") },
              { value: "boy", label: labelFor("gender", "boy") },
              { value: "unknown", label: labelFor("gender", "unknown") },
            ]}
            value={(setup.child.gender ?? "unknown") as ChildGender}
            onChange={(v) => setChild("gender", v)}
          />
        </OnboardingField>

        {born ? (
          <>
            <OnboardingField label={t("onboardingFlow.baby.birthWeight")} optional>
              <TextInput
                style={onboardingInputStyle}
                value={setup.child.birthWeight ?? ""}
                onChangeText={(v) => setChild("birthWeight", v || undefined)}
                placeholder={t("onboardingFlow.baby.birthWeightPlaceholder")}
                placeholderTextColor={colors.faint}
              />
            </OnboardingField>
            <OnboardingField label={t("onboardingFlow.baby.dueDate")} optional>
              <DatePickerField
                value={setup.child.dueDate}
                label={t("onboardingFlow.baby.selectDueDate")}
                placeholder={t("onboardingFlow.baby.selectDate")}
                onPress={() => setDatePickerTarget("dueDate")}
              />
            </OnboardingField>
          </>
        ) : null}

        <OnboardingField label={t("onboardingFlow.photo.label")} optional>
          <View style={styles.photoRow}>
            <Pressable
              style={styles.photoHit}
              onPress={() => void pickPhoto()}
              accessibilityRole="button"
              accessibilityLabel={t("onboardingFlow.photo.selectBaby")}
            >
              {setup.child.photoUri ? (
                <Image source={{ uri: setup.child.photoUri }} style={styles.photo} contentFit="cover" />
              ) : (
                <View style={[styles.photo, styles.photoEmpty]}>
                  <Text style={styles.photoEmptyText}>{t("onboardingFlow.photo.label")}</Text>
                </View>
              )}
            </Pressable>
            <Pressable
              style={styles.photoBtn}
              onPress={() => void pickPhoto()}
              accessibilityRole="button"
              accessibilityLabel={t(setup.child.photoUri ? "onboardingFlow.photo.change" : "onboardingFlow.photo.select")}
            >
              <Text style={styles.photoBtnText}>
                {t(setup.child.photoUri ? "onboardingFlow.photo.change" : "onboardingFlow.photo.select")}
              </Text>
            </Pressable>
            {setup.child.photoUri ? (
              <Pressable onPress={() => setChild("photoUri", undefined)} hitSlop={8}>
                <Text style={styles.skip}>{t("onboardingFlow.photo.later")}</Text>
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
          title={t(datePickerTarget === "birthDate" ? "onboardingFlow.baby.selectBirthDate" : "onboardingFlow.baby.selectDueDate")}
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
        title={t("onboardingFlow.care.title")}
        subtitle={t("onboardingFlow.care.subtitle")}
        primaryLabel={t("onboardingFlow.next")}
        onPrimary={() => setStep("complete")}
        secondaryLabel={t("onboardingFlow.back")}
        onSecondary={() => setStep("baby")}
      >
        <OnboardingField label={t("onboardingFlow.care.feedingLabel")}>
          <OnboardingOptionRow
            options={(["breastfeeding", "formula", "mixed", "pumped_milk", "not_sure"] as DefaultFeedingMethod[]).map((value) => ({ value, label: labelFor("feeding", value) }))}
            value={setup.preferences.defaultFeedingMethod}
            onChange={(v) => setPref("defaultFeedingMethod", v as DefaultFeedingMethod)}
          />
        </OnboardingField>

        <OnboardingField label={t("onboardingFlow.care.categoriesLabel")}>
          <View style={styles.chipWrap}>
            {ALL_LOG_CATEGORY_GROUPS.map((value) => {
              const active = setup.preferences.enabledLogCategories.includes(value);
              return (
                <Pressable
                  key={value}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => toggleCategory(value)}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{labelFor("category", value)}</Text>
                </Pressable>
              );
            })}
          </View>
        </OnboardingField>

        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.switchLabel}>{t("onboardingFlow.care.familySharing")}</Text>
            <Text style={styles.switchHint}>{t("onboardingFlow.care.familySharingHint")}</Text>
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
  const dateValue = (setup.child.childStatus === "unborn" ? setup.child.dueDate : setup.child.birthDate)?.replace(/-/g, ".") ?? "-";

  return (
    <OnboardingShell
      title={t("onboardingFlow.complete.title", { babyName: setup.child.childName.trim() || t("onboardingFlow.babyFallback") })}
      subtitle={t("onboardingFlow.complete.subtitle")}
      primaryLabel={t(submittingSetup ? "onboardingFlow.complete.saving" : "onboardingFlow.complete.start")}
      primaryDisabled={submittingSetup}
      onPrimary={() => void completeSetup()}
      secondaryLabel={t("onboardingFlow.back")}
      onSecondary={() => setStep(setup.child.childStatus === "unborn" ? "baby" : "care")}
    >
      <View style={styles.summaryCard}>
        <SummaryRow label={t("onboardingFlow.summary.babyName")} value={setup.child.childName.trim()} />
        <SummaryRow label={t(setup.child.childStatus === "unborn" ? "onboardingFlow.baby.dueDate" : "onboardingFlow.baby.birthDate")} value={dateValue} />
        <SummaryRow label={t("onboardingFlow.summary.relationship")} value={localizedRelationship} />
        {setup.child.childStatus === "unborn" ? null : (
          <SummaryRow label={t("onboardingFlow.summary.feeding")} value={feedingLabel} />
        )}
        <SummaryRow
          label={t("onboardingFlow.summary.author")}
          value={authorByline}
        />
      </View>
    </OnboardingShell>
  );
}

function DatePickerField({
  value,
  label,
  placeholder,
  onPress,
}: {
  value?: string;
  label: string;
  placeholder: string;
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
        {value || placeholder}
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
  chipTextActive: { color: colors.brandCoralForeground },
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
  acceptButton: { minHeight: 44, minWidth: 120, paddingHorizontal: 14, borderRadius: 10, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  acceptText: { color: colors.primaryForeground, fontWeight: "800", fontSize: 13 },
  disabled: { opacity: 0.48 },
});
