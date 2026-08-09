import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ProfileAvatar } from "../components/profile/ProfileAvatar";
import { useApp } from "../context/AppContext";
import { useBabyLog } from "../context/BabyLogContext";
import { AuthRepository } from "../repositories/AuthRepository";
import { FamilyRepository } from "../repositories/FamilyRepository";
import { ProfileRepository } from "../repositories/ProfileRepository";
import { PROFILE_RELATION_OPTIONS } from "../types/profileSettings";
import type { RelationshipLabel } from "../types/growthBook";
import { getSupabaseSync } from "../utils/supabaseSyncStore";
import { presentAvatarPicker } from "../utils/profileAvatarPicker";
import { colors, radius } from "../theme";
import { FAMILY_ROLE_LABELS } from "../types/family";

export function MyProfileScreen() {
  const insets = useSafeAreaInsets();
  const { careSetup, setCareSetup } = useApp();
  const { myFamilyRole, applyOwnerFromSetup, rehydrateFromServer } = useBabyLog();
  const [displayName, setDisplayName] = useState(careSetup.parent.parentName);
  const [nickname, setNickname] = useState(careSetup.parent.nickname ?? "");
  const [relation, setRelation] = useState<RelationshipLabel>("엄마");
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>();
  const [email, setEmail] = useState("");
  const [provider, setProvider] = useState("이메일");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const user = await AuthRepository.getUser();
      setEmail(user?.email ?? "");
      const identities = user?.identities?.map((item) => item.provider) ?? [];
      if (identities.includes("apple")) setProvider("Apple");
      else if (identities.includes("google")) setProvider("Google");
      else if (identities.includes("kakao")) setProvider("Kakao");
      else setProvider("이메일");

      const profile = await ProfileRepository.getMyDisplayProfile();
      if (profile) {
        setDisplayName(profile.displayName);
        setNickname(profile.nickname ?? "");
        setAvatarUrl(profile.avatarUrl);
        if (profile.defaultRelation) setRelation(profile.defaultRelation as RelationshipLabel);
      } else {
        setDisplayName(careSetup.parent.parentName);
        setNickname(careSetup.parent.nickname ?? "");
      }

      const babyId = getSupabaseSync().babyId;
      if (babyId && user?.id) {
        const members = await FamilyRepository.listMembers(babyId);
        const mine = members.find((row) => row.user_id === user.id);
        if (mine?.relationship_label) setRelation(mine.relationship_label as RelationshipLabel);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "프로필을 불러오지 못했어요.");
    } finally {
      setLoading(false);
    }
  }, [careSetup.parent.nickname, careSetup.parent.parentName]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const save = async () => {
    if (saving) return;
    const name = displayName.trim();
    if (!name) {
      setError("표시 이름을 입력해 주세요.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const next = await ProfileRepository.updateMyProfile({
        displayName: name,
        nickname,
        defaultRelation: relation,
        preferredLanguage: careSetup.parent.preferredLanguage,
      });
      const babyId = getSupabaseSync().babyId;
      const user = await AuthRepository.getUser();
      if (babyId && user?.id) {
        await FamilyRepository.updateMemberRelation({
          babyId,
          userId: user.id,
          relation,
        }).catch(() => undefined);
      }
      const nextSetup = {
        ...careSetup,
        parent: {
          ...careSetup.parent,
          parentName: next.displayName,
          nickname: next.nickname,
          avatarUri: next.avatarUrl,
        },
      };
      setCareSetup(nextSetup);
      applyOwnerFromSetup(nextSetup);
      setAvatarUrl(next.avatarUrl);
      await rehydrateFromServer().catch(() => undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "프로필을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setSaving(false);
    }
  };

  const pickAvatar = () => {
    presentAvatarPicker({
      hasAvatar: Boolean(avatarUrl),
      onPick: (avatar) => {
        setSaving(true);
        setError("");
        void ProfileRepository.uploadMyAvatar(avatar)
          .then((next) => {
            setAvatarUrl(next.avatarUrl);
            const nextSetup = {
              ...careSetup,
              parent: { ...careSetup.parent, avatarUri: next.avatarUrl, parentName: next.displayName },
            };
            setCareSetup(nextSetup);
            applyOwnerFromSetup(nextSetup);
          })
          .catch((cause) => setError(cause instanceof Error ? cause.message : "사진을 올리지 못했어요. 다른 사진으로 다시 시도해 주세요."))
          .finally(() => setSaving(false));
      },
      onClear: () => {
        setSaving(true);
        void ProfileRepository.updateMyProfile({
          displayName: displayName.trim() || careSetup.parent.parentName || "나",
          nickname,
          defaultRelation: relation,
          clearAvatar: true,
        })
          .then((next) => {
            setAvatarUrl(undefined);
            setCareSetup({
              ...careSetup,
              parent: { ...careSetup.parent, avatarUri: undefined, parentName: next.displayName },
            });
          })
          .catch((cause) => setError(cause instanceof Error ? cause.message : "프로필을 저장하지 못했어요. 잠시 후 다시 시도해 주세요."))
          .finally(() => setSaving(false));
      },
    });
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.amber} />
        <Text style={styles.muted}>내 프로필을 불러오는 중…</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={88}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 28 }]} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
        <ProfileAvatar uri={avatarUrl} size={104} editable onPress={pickAvatar} label="내 사진 추가" />

        <View style={styles.card}>
          <Text style={styles.label}>표시 이름</Text>
          <TextInput style={styles.input} value={displayName} onChangeText={setDisplayName} placeholder="가족에게 보일 이름" placeholderTextColor={colors.faint} maxLength={40} />
          <Text style={styles.label}>닉네임</Text>
          <TextInput style={styles.input} value={nickname} onChangeText={setNickname} placeholder="선택 사항" placeholderTextColor={colors.faint} maxLength={40} />
          <Text style={styles.label}>아기와의 관계</Text>
          <View style={styles.chips}>
            {PROFILE_RELATION_OPTIONS.map((option) => {
              const active = relation === option;
              return (
                <Pressable key={option} style={[styles.chip, active && styles.chipActive]} onPress={() => setRelation(option)}>
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{option}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.metaLabel}>이메일</Text>
          <Text style={styles.metaValue}>{email || "연결되지 않음"}</Text>
          <Text style={styles.metaLabel}>로그인 방식</Text>
          <Text style={styles.metaValue}>{provider}</Text>
          <Text style={styles.metaLabel}>현재 역할</Text>
          <Text style={styles.metaValue}>{FAMILY_ROLE_LABELS[myFamilyRole]}</Text>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable style={[styles.save, saving && styles.disabled]} onPress={() => void save()} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>저장</Text>}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background, gap: 10 },
  muted: { color: colors.muted, fontSize: 13 },
  content: { padding: 20, gap: 16, alignItems: "stretch" },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: 16, gap: 10 },
  label: { color: colors.text, fontSize: 13, fontWeight: "800" },
  input: { minHeight: 48, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.cardHi, paddingHorizontal: 13, color: colors.text, fontSize: 15 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { minHeight: 40, paddingHorizontal: 12, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, justifyContent: "center" },
  chipActive: { borderColor: colors.amber, backgroundColor: colors.amberSoft },
  chipText: { color: colors.muted, fontWeight: "700", fontSize: 12.5 },
  chipTextActive: { color: colors.amber },
  metaLabel: { color: colors.faint, fontSize: 11.5, fontWeight: "700", marginTop: 4 },
  metaValue: { color: colors.text, fontSize: 14, fontWeight: "600" },
  error: { color: colors.dangerText, backgroundColor: colors.dangerSoft, padding: 12, borderRadius: radius.md, fontSize: 12.5 },
  save: { minHeight: 52, borderRadius: radius.full, backgroundColor: colors.amber, alignItems: "center", justifyContent: "center" },
  saveText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  disabled: { opacity: 0.55 },
});
