import { Pressable, StyleSheet, Text, View } from "react-native";
import type { FamilyMember } from "../../types/family";
import { memberRelationshipLabel } from "../../types/family";
import { colors, radius } from "../../theme";

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
  const activeMembers = members.filter((member) => member.status === "active" && !member.isMe);
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>가족 태그</Text>
      {activeMembers.length === 0 ? (
        <Text style={styles.hint}>초대된 가족이 아직 없어요.</Text>
      ) : (
        <View style={styles.chips}>
          {activeMembers.map((member) => {
            const active = taggedIds.includes(member.id);
            return (
              <Pressable key={member.id} style={[styles.chip, active && styles.chipActive]} onPress={() => onToggleTagged(member.id)}>
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {member.name} · {memberRelationshipLabel(member)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {showSelectedPeople ? (
        <>
          <Text style={styles.label}>볼 수 있는 사람</Text>
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
  chipTextActive: { color: colors.amber },
});
