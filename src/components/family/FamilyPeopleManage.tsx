import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { useEffect, useRef, useState } from "react";
import { ProfileAvatar } from "../profile/ProfileAvatar";
import { RoleBadge } from "../profile/RoleBadge";
import { useLanguage } from "../../LanguageContext";
import { FamilyRepository } from "../../repositories/FamilyRepository";
import { FriendRepository, type FriendDisplay } from "../../repositories/DarinFriendRepository";
import {
  canManageMembers,
  familyRoleMessageKey,
  type BabyAccessPermissions,
  type FamilyMember,
  type FamilyRole,
} from "../../types/family";
import { colors } from "../../theme";
import { familyErrorMessage, storedRelationshipLabel } from "../../utils/familyDisplay";

const TOUCH_MIN = Platform.select({ ios: 44, android: 48 }) ?? 44;
type PeopleFilter = "family" | "friend";

type Props = {
  babyId?: string | null;
  scopeKey: string;
  accountId: string | null;
  myRole: FamilyRole;
  familyMembers: FamilyMember[];
  friends: FriendDisplay[];
  accessByUser: ReadonlyMap<string, BabyAccessPermissions>;
  permissionsLoading: boolean;
  permissionsError?: string;
  peopleFilter?: PeopleFilter;
  onChangeFilter?: (filter: PeopleFilter) => void;
  onReload: () => Promise<void>;
};

export function FamilyPeopleManage({
  babyId,
  scopeKey,
  accountId,
  myRole,
  familyMembers,
  friends,
  accessByUser,
  permissionsLoading,
  permissionsError,
  peopleFilter = "family",
  onChangeFilter,
  onReload,
}: Props) {
  const { t } = useLanguage();
  const canManage = canManageMembers(myRole);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const scopeKeyRef = useRef(scopeKey);
  scopeKeyRef.current = scopeKey;
  const activeFamily = familyMembers.filter((member) => member.status === "active");
  const activeFriends = friends.filter((friend) => friend.status === "active");

  useEffect(() => {
    setExpandedUserId(null);
    setSavingUserId(null);
  }, [scopeKey]);

  const normalizedAccess = (permissions: BabyAccessPermissions, key: keyof BabyAccessPermissions, value: boolean) => {
    const next = { ...permissions, [key]: value };
    if (key === "careWrite" && value) next.careRead = true;
    if (key === "careRead" && !value) next.careWrite = false;
    if (key === "momentsWrite" && value) next.momentsRead = true;
    if ((key === "socialComment" || key === "socialReact") && value) next.momentsRead = true;
    if (key === "momentsRead" && !value) {
      next.momentsWrite = false;
      next.socialComment = false;
      next.socialReact = false;
    }
    return next;
  };

  const saveAccess = async (userId: string, permissions: BabyAccessPermissions) => {
    if (!babyId || !accountId || savingUserId) return;
    const requestScopeKey = scopeKey;
    setSavingUserId(userId);
    try {
      await FamilyRepository.setBabyAccessPermissions({ babyId, userId, permissions, expectedAccountId: accountId });
      if (requestScopeKey !== scopeKeyRef.current) return;
      await onReload();
    } catch (cause) {
      if (requestScopeKey !== scopeKeyRef.current) return;
      Alert.alert(t("family.critical.172"), cause instanceof Error ? familyErrorMessage(t, cause.message) : t("family.critical.172"));
    } finally {
      if (requestScopeKey === scopeKeyRef.current) setSavingUserId(null);
    }
  };

  const promoteFullAdmin = (member: FamilyMember) => {
    if (!babyId || !accountId || member.isMe || member.role === "owner" || member.role === "admin") return;
    Alert.alert(
      t("family.critical.168", { name: member.name }),
      t("family.critical.169"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("family.critical.170"),
          onPress: () => {
            const requestScopeKey = scopeKey;
            setSavingUserId(member.id);
            void FamilyRepository.promoteBabyFullAdmin(babyId, member.id, accountId)
              .then(() => requestScopeKey === scopeKeyRef.current ? onReload() : undefined)
              .catch((cause) => {
                if (requestScopeKey !== scopeKeyRef.current) return;
                Alert.alert(t("family.critical.172"), cause instanceof Error ? familyErrorMessage(t, cause.message) : t("family.critical.172"));
              })
              .finally(() => {
                if (requestScopeKey === scopeKeyRef.current) setSavingUserId(null);
              });
          },
        },
      ],
    );
  };

  const accessSummary = (permissions: BabyAccessPermissions | undefined, fullAdmin: boolean) => {
    if (fullAdmin) return t("family.critical.167");
    if (permissionsError) return permissionsError;
    if (!permissions) return permissionsLoading ? t("family.critical.156") : t("family.critical.173");
    const parts: string[] = [];
    if (permissions.careRead || permissions.careWrite) parts.push(t("family.critical.175"));
    if (permissions.momentsRead || permissions.momentsWrite) parts.push(t("family.critical.174"));
    if (permissions.socialComment || permissions.socialReact) parts.push(t("family.critical.176"));
    return parts.length ? parts.join(" · ") : t("family.critical.173");
  };

  const permissionEditor = (userId: string, fullAdmin: boolean, member?: FamilyMember) => {
    if (!canManage || expandedUserId !== userId) return null;
    if (fullAdmin) return <Text style={styles.adminNote}>{t("family.critical.169")}</Text>;
    if (permissionsLoading) return <ActivityIndicator style={styles.permissionLoader} color={colors.accentStrong} />;
    if (permissionsError) return <Text style={styles.error}>{permissionsError}</Text>;
    const permissions = accessByUser.get(userId);
    if (!permissions) return <Text style={styles.error}>{t("family.critical.157")}</Text>;
    const items: Array<{ key: keyof BabyAccessPermissions; label: string }> = [
      { key: "careRead", label: t("family.critical.158") },
      { key: "careWrite", label: t("family.critical.159") },
      { key: "momentsRead", label: t("family.critical.160") },
      { key: "momentsWrite", label: t("family.critical.161") },
      { key: "socialComment", label: t("family.critical.162") },
      { key: "socialReact", label: t("family.critical.163") },
    ];
    return (
      <View style={styles.permissionPanel} accessibilityLabel={t("family.critical.155")}>
        {items.map((item) => (
          <View key={item.key} style={styles.permissionRow}>
            <Text style={styles.permissionLabel}>{item.label}</Text>
            <Switch
              value={permissions[item.key]}
              disabled={savingUserId === userId || permissionsLoading}
              onValueChange={(value) => void saveAccess(userId, normalizedAccess(permissions, item.key, value))}
              accessibilityLabel={item.label}
              accessibilityState={{ checked: permissions[item.key], disabled: savingUserId === userId || permissionsLoading }}
              trackColor={{ false: colors.border, true: colors.accentSoft }}
              thumbColor={permissions[item.key] ? colors.accentStrong : colors.card}
            />
          </View>
        ))}
        {member ? (
          <Pressable
            style={styles.adminButton}
            onPress={() => promoteFullAdmin(member)}
            disabled={savingUserId === userId}
            accessibilityRole="button"
            accessibilityState={{ disabled: savingUserId === userId }}
          >
            <Text style={styles.adminButtonText}>{t("family.critical.170")}</Text>
          </Pressable>
        ) : null}
      </View>
    );
  };

  const removeFamily = (member: FamilyMember) => {
    if (!babyId || !accountId || member.isMe) return;
    Alert.alert(t("family.critical.149"), undefined, [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("family.critical.150"),
        style: "destructive",
        onPress: () => {
          const requestScopeKey = scopeKey;
          void FamilyRepository.removeMember({ babyId, userId: member.id, expectedAccountId: accountId })
            .then(() => {
              if (requestScopeKey !== scopeKeyRef.current) return undefined;
              Alert.alert(t("family.critical.150"));
              return onReload();
            })
            .catch((cause) => {
              if (requestScopeKey !== scopeKeyRef.current) return;
              Alert.alert(t("family.critical.042"), cause instanceof Error ? familyErrorMessage(t, cause.message) : t("family.critical.043"));
            });
        },
      },
    ]);
  };

  const removeFriend = (friend: FriendDisplay) => {
    if (!babyId || !accountId) return;
    Alert.alert(t("family.critical.147"), undefined, [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("family.critical.148"),
        style: "destructive",
        onPress: () => {
          const requestScopeKey = scopeKey;
          void FriendRepository.removeFriend(babyId, friend.userId, accountId)
            .then(() => {
              if (requestScopeKey !== scopeKeyRef.current) return undefined;
              Alert.alert(t("family.critical.148"));
              return onReload();
            })
            .catch((cause) => {
              if (requestScopeKey !== scopeKeyRef.current) return;
              Alert.alert(t("family.critical.152"), cause instanceof Error ? familyErrorMessage(t, cause.message) : t("family.critical.152"));
            });
        },
      },
    ]);
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.hint}>{t("family.critical.086")}</Text>
      {permissionsError ? <Text style={styles.error} accessibilityRole="alert">{permissionsError}</Text> : null}
      <View style={styles.filters} accessibilityRole="tablist">
        <Pressable
          style={[styles.filter, peopleFilter === "family" && styles.filterActive]}
          onPress={() => onChangeFilter?.("family")}
          accessibilityRole="tab"
          accessibilityState={{ selected: peopleFilter === "family" }}
        >
          <Text style={[styles.filterText, peopleFilter === "family" && styles.filterTextActive]}>
            {t("family.critical.087")} · {activeFamily.filter((member) => !member.isMe).length}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.filter, peopleFilter === "friend" && styles.filterActive]}
          onPress={() => onChangeFilter?.("friend")}
          accessibilityRole="tab"
          accessibilityState={{ selected: peopleFilter === "friend" }}
        >
          <Text style={[styles.filterText, peopleFilter === "friend" && styles.filterTextActive]}>
            {t("family.critical.088")} · {activeFriends.length}
          </Text>
        </Pressable>
      </View>

      {peopleFilter === "family" ? (
        activeFamily.length ? activeFamily.map((member) => (
          <View key={member.id} style={styles.person}>
            <ProfileAvatar uri={member.avatarUrl} size={48} fallback="profile" />
            <View style={styles.copy}>
              <Text style={styles.name}>{member.name}{member.isMe ? ` · ${t("family.critical.111")}` : ""}</Text>
              <Text style={styles.meta}>
                {storedRelationshipLabel(t, member.relationshipLabel ?? "가족")}
              </Text>
              {member.role === "owner" || member.role === "admin" ? (
                <RoleBadge
                  role={member.role}
                  label={member.role === "owner" ? t(familyRoleMessageKey(member.role)) : t("family.critical.166")}
                />
              ) : null}
              <Text style={styles.permissionSummary}>
                {accessSummary(accessByUser.get(member.id), member.role === "owner" || member.role === "admin")}
              </Text>
              {canManage && !member.isMe ? (
                <View style={styles.actions}>
                  {member.role !== "owner" && member.role !== "admin" ? (
                    <Pressable
                      style={styles.manage}
                      onPress={() => setExpandedUserId((current) => current === member.id ? null : member.id)}
                      accessibilityRole="button"
                      accessibilityState={{ expanded: expandedUserId === member.id }}
                    >
                      <Text style={styles.manageText}>{expandedUserId === member.id ? t("family.critical.165") : t("family.critical.164")}</Text>
                    </Pressable>
                  ) : null}
                  <Pressable style={styles.remove} onPress={() => removeFamily(member)} accessibilityRole="button" accessibilityLabel={t("family.critical.154")}>
                    <Text style={styles.removeText}>{t("family.critical.154")}</Text>
                  </Pressable>
                </View>
              ) : null}
              {member.role !== "owner" && member.role !== "admin" ? permissionEditor(member.id, false, member) : null}
            </View>
          </View>
        )) : <Text style={styles.empty}>{t("family.critical.046")}</Text>
      ) : (
        activeFriends.length ? activeFriends.map((friend) => (
          <View key={friend.membershipId} style={styles.person}>
            <ProfileAvatar size={48} fallback="profile" />
            <View style={styles.copy}>
              <Text style={styles.name}>{friend.displayName}</Text>
              {friend.realName ? <Text style={styles.meta}>{friend.realName}</Text> : null}
              <RoleBadge role="friend" label={t("family.critical.029")} />
              <Text style={styles.permissionSummary}>{accessSummary(accessByUser.get(friend.userId), false)}</Text>
              {canManage ? (
                <View style={styles.actions}>
                  <Pressable
                    style={styles.manage}
                    onPress={() => setExpandedUserId((current) => current === friend.userId ? null : friend.userId)}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: expandedUserId === friend.userId }}
                  >
                    <Text style={styles.manageText}>{expandedUserId === friend.userId ? t("family.critical.165") : t("family.critical.164")}</Text>
                  </Pressable>
                  <Pressable style={styles.remove} onPress={() => removeFriend(friend)} accessibilityRole="button" accessibilityLabel={t("family.critical.154")}>
                    <Text style={styles.removeText}>{t("family.critical.154")}</Text>
                  </Pressable>
                </View>
              ) : null}
              {permissionEditor(friend.userId, false)}
            </View>
          </View>
        )) : (
          <View style={styles.emptyGroup}>
            <Text style={styles.empty}>{t("family.critical.089")}</Text>
            <Text style={styles.empty}>{t("family.critical.090")}</Text>
          </View>
        )
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 40, gap: 12 },
  hint: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  filters: { flexDirection: "row", gap: 8 },
  filter: {
    minHeight: TOUCH_MIN,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: "center",
    backgroundColor: colors.chip,
  },
  filterActive: { backgroundColor: colors.accentSoft, borderColor: colors.accentSoft },
  filterText: { color: colors.muted, fontSize: 13, fontWeight: "800" },
  filterTextActive: { color: colors.accentStrong },
  person: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  copy: { flex: 1, minWidth: 0, gap: 4 },
  name: { color: colors.text, fontSize: 16, fontWeight: "700" },
  meta: { color: colors.muted, fontSize: 13 },
  permissionSummary: { color: colors.muted, fontSize: 12, lineHeight: 17 },
  actions: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 12, marginTop: 4 },
  manage: { minHeight: TOUCH_MIN, justifyContent: "center" },
  manageText: { color: colors.accentStrong, fontSize: 12, fontWeight: "800" },
  remove: { minHeight: TOUCH_MIN, justifyContent: "center" },
  removeText: { color: colors.dangerText, fontSize: 12, fontWeight: "800" },
  permissionPanel: { marginTop: 4, padding: 10, borderRadius: 14, backgroundColor: colors.chip, gap: 2 },
  permissionLoader: { minHeight: TOUCH_MIN, marginTop: 4 },
  permissionRow: { minHeight: TOUCH_MIN, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  permissionLabel: { flex: 1, color: colors.text, fontSize: 13, fontWeight: "700" },
  adminNote: { marginTop: 4, color: colors.muted, fontSize: 12, lineHeight: 18 },
  adminButton: { minHeight: TOUCH_MIN, marginTop: 6, alignItems: "center", justifyContent: "center", borderRadius: 12, borderWidth: 1, borderColor: colors.accentSoft, backgroundColor: colors.card },
  adminButtonText: { color: colors.accentStrong, fontSize: 13, fontWeight: "800" },
  error: { color: colors.dangerText, fontSize: 12, lineHeight: 18 },
  empty: { color: colors.faint, fontSize: 13, lineHeight: 18 },
  emptyGroup: { gap: 6 },
});
