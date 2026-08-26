import { Pressable, StyleSheet, Text, View } from "react-native";
import type { FamilyMember } from "../../types/family";
import { memberRelationshipLabel } from "../../types/family";
import { PROFILE_RELATION_OPTIONS } from "../../types/profileSettings";
import type { RelationshipLabel } from "../../types/growthBook";
import { useLanguage } from "../../LanguageContext";
import type { MessageKey } from "../../i18n";
import { colors, radius } from "../../theme";

const RELATION_SUFFIXES = ["mom", "dad", "grandmother", "grandfather", "aunt", "uncle", "guardian", "family", "sitter", "friend", "other"] as const;

function localizedRelation(t: (key: MessageKey, params?: Record<string, string | number>) => string, member: FamilyMember) {
  const stored = memberRelationshipLabel(member);
  const suffix = RELATION_SUFFIXES[PROFILE_RELATION_OPTIONS.indexOf(stored as RelationshipLabel)] ?? "other";
  return t(`profileSetup.relation.${suffix}` as MessageKey);
}

export function MemoryPeoplePicker({
  members,
  taggedIds,
  selectedIds,
  showSelectedPeople,
  onToggleTagged,
  onToggleSelected,
}: {
  members: FamilyMember[];
  taggedIds: string[];
  selectedIds: string[];
  showSelectedPeople: boolean;
  onToggleTagged: (id: string) => void;
  onToggleSelected: (id: string) => void;
}) {
  const { t } = useLanguage();
  const activeMembers = members.filter((member) => member.status === "active" && !member.isMe);
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{t("memory.critical.077")}</Text>
      {activeMembers.length === 0 ? (
        <Text style={styles.hint}>{t("memory.critical.078")}</Text>
      ) : (
        <View style={styles.chips}>
          {activeMembers.map((member) => {
            const active = taggedIds.includes(member.id);
            return (
              <Pressable key={member.id} style={[styles.chip, active && styles.chipActive]} onPress={() => onToggleTagged(member.id)}>
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {member.name} · {localizedRelation(t, member)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {showSelectedPeople ? (
        <>
          <Text style={styles.label}>{t("memory.critical.079")}</Text>
          <View style={styles.chips}>
            {activeMembers.map((member) => {
              const active = selectedIds.includes(member.id);
              return (
                <Pressable key={member.id} style={[styles.chip, active && styles.chipActive]} onPress={() => onToggleSelected(member.id)}>
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{member.name}</Text>
                </Pressable>
              );
            })}
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 9 },
  label: { color: colors.text, fontSize: 13, fontWeight: "800", marginTop: 4 },
  hint: { color: colors.muted, fontSize: 11.5, lineHeight: 17 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  chip: { minHeight: 44, justifyContent: "center", paddingHorizontal: 12, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  chipActive: { borderColor: colors.amber, backgroundColor: colors.amberSoft },
  chipText: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  chipTextActive: { color: colors.amberText },
});
