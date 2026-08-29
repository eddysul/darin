import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, Text, TextInput } from "react-native";
import { useLanguage } from "../../../LanguageContext";
import { colors } from "../../../theme";
import type { FamilyMember, FamilyRole } from "../../../types/family";
import {
  canDeleteGrowthBookNote,
  canEditOwnGrowthBookNote,
  canWriteGrowthBookNote,
  memberRelationshipLabel,
} from "../../../types/family";
import type { GrowthBookEdit, GrowthBookLetter } from "../../../types/growthBook";
import { formatGrowthAuthorLabel } from "../../../types/growthBook";
import { CommentRow } from "./CommentRow";
import { newId } from "./ids";
import { styles } from "./styles";
import type { GrowthBookEditorPatch } from "./types";

export function LetterEditor({
  babyName,
  edit,
  me,
  myRole,
  bottomPad,
  onPatch,
}: {
  babyName: string;
  edit: GrowthBookEdit;
  me?: FamilyMember;
  myRole: FamilyRole;
  bottomPad: number;
  onPatch: GrowthBookEditorPatch;
}) {
  const { t } = useLanguage();
  const myLetter = edit.letters.find((letter) => letter.authorId === me?.id);
  const [draft, setDraft] = useState(myLetter?.text ?? "");
  const canWrite = canWriteGrowthBookNote(myRole);

  useEffect(() => {
    setDraft(myLetter?.text ?? "");
  }, [myLetter?.text]);

  return (
    <ScrollView
      contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 28 }]}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.hint}>
        {t("growth.critical.056")}
      </Text>

      {edit.letters.map((letter) => (
        <CommentRow
          key={letter.id}
          authorLabel={t("growth.critical.057", { author: formatGrowthAuthorLabel(letter.authorRelationshipLabel, letter.authorName, t), babyName })}
          text={letter.text}
          canEdit={canEditOwnGrowthBookNote(myRole, letter.authorId, me)}
          canDelete={canDeleteGrowthBookNote(myRole, letter.authorId, me)}
          onEdit={() => {
            if (letter.authorId === me?.id) setDraft(letter.text);
          }}
          onDelete={() =>
            onPatch((prev) => ({
              ...prev,
              letters: prev.letters.filter((item) => item.id !== letter.id),
            }))
          }
        />
      ))}

      {canWrite && me ? (
        <>
          <Text style={styles.autoAuthor}>
            {t("growth.critical.057", { author: formatGrowthAuthorLabel(memberRelationshipLabel(me), me.name, t), babyName })}
          </Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            multiline
            value={draft}
            onChangeText={setDraft}
            placeholder={t("growth.critical.058")}
            placeholderTextColor={colors.faint}
          />
          <Pressable
            style={styles.primaryBtn}
            onPress={() => {
              const text = draft.trim();
              if (!text) return;
              const now = new Date().toISOString();
              onPatch((prev) => {
                const existing = prev.letters.find((letter) => letter.authorId === me.id);
                if (existing) {
                  return {
                    ...prev,
                    letters: prev.letters.map((letter) =>
                      letter.id === existing.id ? { ...letter, text, updatedAt: now } : letter,
                    ),
                  };
                }
                const next: GrowthBookLetter = {
                  id: newId("gbl"),
                  growthBookId: prev.id,
                  authorId: me.id,
                  authorName: me.name,
                  authorRelationshipLabel: memberRelationshipLabel(me),
                  text,
                  createdAt: now,
                  updatedAt: now,
                };
                return { ...prev, letters: [...prev.letters, next] };
              });
              Alert.alert(t("growth.critical.059"), t("growth.critical.060"));
            }}
          >
            <Text style={styles.primaryBtnText}>{myLetter ? t("growth.critical.061") : t("growth.critical.062")}</Text>
          </Pressable>
        </>
      ) : (
        <Text style={styles.hint}>{t("growth.critical.063")}</Text>
      )}
    </ScrollView>
  );
}
