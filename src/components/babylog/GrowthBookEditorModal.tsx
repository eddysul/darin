import { useCallback, useEffect, useMemo, useState } from "react";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { DiaryEntry } from "../../types/babyLog";
import type { FamilyMember, FamilyRole } from "../../types/family";
import {
  canDeleteGrowthBookNote,
  canEditOwnGrowthBookNote,
  canWriteGrowthBookNote,
  memberRelationshipLabel,
} from "../../types/family";
import type {
  GrowthBookComment,
  GrowthBookEdit,
  GrowthBookLetter,
  GrowthBookPageEdit,
  PhotoLayout,
} from "../../types/growthBook";
import {
  PHOTO_LAYOUT_OPTIONS,
  defaultLayoutForPhotoCount,
  formatGrowthAuthorLabel,
} from "../../types/growthBook";
import {
  collectGrowthBookPhotoPool,
  resolvePageBody,
  resolvePageEdit,
  resolvePagePhotos,
} from "../../utils/growthBookPages";
import { createGrowthBookPdf } from "../../utils/growthBookPdf";
import { diaryMilestoneLabel, sortGrowthBookEntries } from "../../utils/diaryModel";
import { colors, radius } from "../../theme";
import { BabyLogIcon } from "./BabyLogIcon";
import { BabyStickerFromModel } from "./BabyStickerView";
import { BabyStickerVaultModal } from "./BabyStickerVaultModal";
import { useBabyLog } from "../../context/BabyLogContext";
import type { BabySticker } from "../../types/babySticker";

type Props = {
  visible: boolean;
  babyName: string;
  babyId: string;
  entries: DiaryEntry[];
  edit: GrowthBookEdit;
  me?: FamilyMember;
  myRole: FamilyRole;
  onChange: (next: GrowthBookEdit) => void;
  onClose: () => void;
  onOpenBookPreview?: () => void;
};

type Section = "hub" | "cover" | "page" | "letter" | "pdf";

function newId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

async function pickImageUri(): Promise<string | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    quality: 0.85,
    allowsMultipleSelection: false,
  });
  if (result.canceled || !result.assets?.[0]?.uri) return null;
  return result.assets[0].uri;
}

export function GrowthBookEditorModal({
  visible,
  babyName,
  babyId,
  entries,
  edit,
  me,
  myRole,
  onChange,
  onClose,
  onOpenBookPreview,
}: Props) {
  const insets = useSafeAreaInsets();
  const [section, setSection] = useState<Section>("hub");
  const [activeDiaryId, setActiveDiaryId] = useState<string | null>(null);

  const bookEntries = useMemo(
    () => sortGrowthBookEntries(entries.filter((e) => e.includedInGrowthBook)),
    [entries],
  );

  useEffect(() => {
    if (!visible) {
      setSection("hub");
      setActiveDiaryId(null);
    }
  }, [visible]);

  const patch = useCallback(
    (updater: (prev: GrowthBookEdit) => GrowthBookEdit) => {
      onChange({ ...updater(edit), babyId, updatedAt: new Date().toISOString() });
    },
    [babyId, edit, onChange],
  );

  const activeEntry = bookEntries.find((e) => e.id === activeDiaryId) ?? null;

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={[styles.root, { paddingTop: Math.max(insets.top, 12) }]}>
        <View style={styles.header}>
          <Pressable
            onPress={() => {
              if (section === "hub") onClose();
              else {
                setSection("hub");
                setActiveDiaryId(null);
              }
            }}
            hitSlop={10}
          >
            <Text style={styles.headerBtn}>{section === "hub" ? "닫기" : "뒤로"}</Text>
          </Pressable>
          <Text style={styles.headerTitle}>
            {section === "hub"
              ? "성장책 편집"
              : section === "cover"
                ? "표지 편집"
                : section === "page"
                  ? "페이지 편집"
                  : section === "letter"
                    ? "마지막 편지"
                    : "PDF"}
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        {section === "hub" ? (
          <ScrollView
            contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 28 }]}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.hint}>
              원본 일기는 그대로 두고, 성장책 편집본만 꾸며요. 가족 코멘트와 편지는 등록된 관계가 자동으로
              붙어요.
            </Text>

            <SectionCard
              title="1. 표지 편집"
              body={`${edit.coverTitle || `${babyName}의 성장책`}${edit.coverPhotoUri ? " · 사진 있음" : ""}`}
              primary
              onPress={() => setSection("cover")}
            />
            <SectionCard
              title="2. 페이지 편집"
              body={`담은 순간 ${bookEntries.length}개 · 사진·코멘트·롤링페이퍼`}
              onPress={() => setSection("page")}
            />
            <SectionCard
              title="3. 마지막 편지"
              body={edit.letters.length ? `${edit.letters.length}통의 편지` : "아직 편지가 없어요"}
              onPress={() => setSection("letter")}
            />
            <SectionCard
              title="4. PDF 생성"
              body="고정 템플릿으로 PDF를 만들어요"
              onPress={() => setSection("pdf")}
            />

            {onOpenBookPreview ? (
              <Pressable style={styles.secondaryBtn} onPress={onOpenBookPreview}>
                <Text style={styles.secondaryBtnText}>성장책 미리보기 열기</Text>
              </Pressable>
            ) : null}
          </ScrollView>
        ) : null}

        {section === "cover" ? (
          <CoverEditor
            babyName={babyName}
            edit={edit}
            entries={bookEntries}
            bottomPad={insets.bottom}
            onPatch={patch}
          />
        ) : null}

        {section === "page" && !activeEntry ? (
          <PageList
            entries={bookEntries}
            edit={edit}
            bottomPad={insets.bottom}
            onOpen={(id) => setActiveDiaryId(id)}
          />
        ) : null}

        {section === "page" && activeEntry ? (
          <PageEditor
            babyName={babyName}
            entry={activeEntry}
            edit={edit}
            me={me}
            myRole={myRole}
            bottomPad={insets.bottom}
            onPatch={patch}
          />
        ) : null}

        {section === "letter" ? (
          <LetterEditor
            babyName={babyName}
            edit={edit}
            me={me}
            myRole={myRole}
            bottomPad={insets.bottom}
            onPatch={patch}
          />
        ) : null}

        {section === "pdf" ? (
          <PdfActions
            babyName={babyName}
            entries={bookEntries}
            edit={edit}
            bottomPad={insets.bottom}
            onOpenBookPreview={onOpenBookPreview}
          />
        ) : null}
      </View>
    </Modal>
  );
}

function SectionCard({
  title,
  body,
  onPress,
  primary,
}: {
  title: string;
  body: string;
  onPress: () => void;
  primary?: boolean;
}) {
  return (
    <Pressable style={[styles.card, primary && styles.cardPrimary]} onPress={onPress}>
      <View style={styles.cardCopy}>
        <Text style={[styles.cardTitle, primary && styles.cardTitlePrimary]}>{title}</Text>
        <Text style={styles.cardBody}>{body}</Text>
      </View>
      <BabyLogIcon kind="chevron" size={16} color={primary ? colors.amberDark : colors.faint} />
    </Pressable>
  );
}

function CoverEditor({
  babyName,
  edit,
  entries,
  bottomPad,
  onPatch,
}: {
  babyName: string;
  edit: GrowthBookEdit;
  entries: DiaryEntry[];
  bottomPad: number;
  onPatch: (updater: (prev: GrowthBookEdit) => GrowthBookEdit) => void;
}) {
  const pool = useMemo(() => collectGrowthBookPhotoPool(entries, edit), [entries, edit]);
  const title = edit.coverTitle || `${babyName}의 성장책`;

  return (
    <ScrollView
      contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 28 }]}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.label}>표지 제목</Text>
      <TextInput
        style={styles.input}
        value={title}
        onChangeText={(text) => onPatch((prev) => ({ ...prev, coverTitle: text }))}
        placeholder={`${babyName}의 성장책`}
        placeholderTextColor={colors.faint}
      />

      <Text style={[styles.label, { marginTop: 18 }]}>표지 사진</Text>
      {edit.coverPhotoUri ? (
        <Image source={{ uri: edit.coverPhotoUri }} style={styles.coverPreview} contentFit="cover" />
      ) : (
        <View style={styles.coverPlaceholder}>
          <Text style={styles.coverPlaceholderText}>사진을 선택해 주세요</Text>
        </View>
      )}

      <Pressable
        style={styles.primaryBtn}
        onPress={async () => {
          const uri = await pickImageUri();
          if (uri) onPatch((prev) => ({ ...prev, coverPhotoUri: uri }));
        }}
      >
        <Text style={styles.primaryBtnText}>새 사진 업로드</Text>
      </Pressable>

      {pool.length > 0 ? (
        <>
          <Text style={[styles.label, { marginTop: 18 }]}>성장책 사진에서 고르기</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.poolRow}>
            {pool.map((uri) => (
              <Pressable
                key={uri}
                onPress={() => onPatch((prev) => ({ ...prev, coverPhotoUri: uri }))}
                style={[
                  styles.poolThumbWrap,
                  edit.coverPhotoUri === uri && styles.poolThumbSelected,
                ]}
              >
                <Image source={{ uri }} style={styles.poolThumb} contentFit="cover" />
              </Pressable>
            ))}
          </ScrollView>
        </>
      ) : null}
    </ScrollView>
  );
}

function PageList({
  entries,
  edit,
  bottomPad,
  onOpen,
}: {
  entries: DiaryEntry[];
  edit: GrowthBookEdit;
  bottomPad: number;
  onOpen: (id: string) => void;
}) {
  if (entries.length === 0) {
    return (
      <View style={[styles.content, { paddingBottom: bottomPad + 28 }]}>
        <Text style={styles.hint}>성장책에 담긴 일기가 없어요. 일기에서 📖 담기를 눌러 주세요.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 28 }]}>
      {entries.map((entry, index) => {
        const pageEdit = resolvePageEdit(entry.id, entry, edit);
        const photos = resolvePagePhotos(entry, pageEdit);
        const milestone = diaryMilestoneLabel(entry);
        return (
          <Pressable key={entry.id} style={styles.card} onPress={() => onOpen(entry.id)}>
            <Text style={styles.index}>{index + 1}</Text>
            {photos[0] ? (
              <Image source={{ uri: photos[0] }} style={styles.thumb} contentFit="cover" />
            ) : (
              <View style={styles.thumbPlaceholder}>
                <Text style={styles.thumbFallback}>📔</Text>
              </View>
            )}
            <View style={styles.cardCopy}>
              <Text style={styles.cardTitle} numberOfLines={1}>
                {milestone ?? entry.date}
              </Text>
              <Text style={styles.cardBody} numberOfLines={2}>
                사진 {photos.length}장 · 레이아웃 {pageEdit.layout}장 · 롤링{" "}
                {pageEdit.rollingComments.length}
              </Text>
            </View>
            <BabyLogIcon kind="chevron" size={16} color={colors.faint} />
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function PageEditor({
  babyName,
  entry,
  edit,
  me,
  myRole,
  bottomPad,
  onPatch,
}: {
  babyName: string;
  entry: DiaryEntry;
  edit: GrowthBookEdit;
  me?: FamilyMember;
  myRole: FamilyRole;
  bottomPad: number;
  onPatch: (updater: (prev: GrowthBookEdit) => GrowthBookEdit) => void;
}) {
  const pageEdit = resolvePageEdit(entry.id, entry, edit);
  const photos = resolvePagePhotos(entry, pageEdit);
  const [commentDraft, setCommentDraft] = useState(
    pageEdit.pageComment !== undefined ? pageEdit.pageComment : resolvePageBody(entry, pageEdit),
  );
  const [rollingDraft, setRollingDraft] = useState("");
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [stickerPickerOpen, setStickerPickerOpen] = useState(false);
  const { babyStickers, addBabySticker, deleteBabySticker, logAuthor } = useBabyLog();
  const canWrite = canWriteGrowthBookNote(myRole);
  const pageStickers = (pageEdit.stickerIds ?? [])
    .map((id) => babyStickers.find((item) => item.id === id))
    .filter((item): item is BabySticker => !!item);

  const upsertPage = (next: GrowthBookPageEdit) => {
    onPatch((prev) => ({
      ...prev,
      pages: { ...prev.pages, [entry.id]: next },
    }));
  };

  const setPhotos = (nextPhotos: string[]) => {
    const maxLayout = Math.min(4, Math.max(1, nextPhotos.length || 1)) as PhotoLayout;
    const layout = (pageEdit.layout > maxLayout ? maxLayout : pageEdit.layout) as PhotoLayout;
    upsertPage({
      ...pageEdit,
      photos: nextPhotos,
      layout,
    });
  };

  return (
    <ScrollView
      contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 28 }]}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.sectionTitle}>{diaryMilestoneLabel(entry) ?? entry.date}</Text>
      <Text style={styles.hint}>사진·코멘트 변경은 성장책 편집본에만 저장되고 원본 일기는 바뀌지 않아요.</Text>

      <Text style={styles.label}>사진 ({photos.length})</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.poolRow}>
        {photos.map((uri, index) => (
          <View key={`${uri}-${index}`} style={styles.photoEditWrap}>
            <Image source={{ uri }} style={styles.poolThumb} contentFit="cover" />
            <View style={styles.photoActions}>
              <Pressable
                disabled={index === 0}
                onPress={() => {
                  if (index === 0) return;
                  const next = [...photos];
                  [next[index - 1], next[index]] = [next[index], next[index - 1]];
                  setPhotos(next);
                }}
                style={styles.miniChip}
              >
                <Text style={styles.miniChipText}>←</Text>
              </Pressable>
              <Pressable
                disabled={index >= photos.length - 1}
                onPress={() => {
                  if (index >= photos.length - 1) return;
                  const next = [...photos];
                  [next[index], next[index + 1]] = [next[index + 1], next[index]];
                  setPhotos(next);
                }}
                style={styles.miniChip}
              >
                <Text style={styles.miniChipText}>→</Text>
              </Pressable>
              <Pressable
                onPress={() => setPhotos(photos.filter((_, i) => i !== index))}
                style={[styles.miniChip, styles.miniChipDanger]}
              >
                <Text style={styles.miniChipText}>삭제</Text>
              </Pressable>
            </View>
          </View>
        ))}
        <Pressable
          style={styles.addPhotoTile}
          onPress={async () => {
            const uri = await pickImageUri();
            if (!uri) return;
            const next = [...photos, uri];
            upsertPage({
              ...pageEdit,
              photos: next,
              layout: defaultLayoutForPhotoCount(next.length),
            });
          }}
        >
          <Text style={styles.addPhotoText}>+ 추가</Text>
        </Pressable>
      </ScrollView>

      <Text style={[styles.label, { marginTop: 16 }]}>사진 레이아웃</Text>
      <View style={styles.layoutRow}>
        {PHOTO_LAYOUT_OPTIONS.map((option) => {
          const selected = pageEdit.layout === option.value;
          const disabled = photos.length > 0 && option.value > Math.max(photos.length, 1);
          return (
            <Pressable
              key={option.value}
              disabled={disabled}
              style={[
                styles.layoutChip,
                selected && styles.layoutChipSelected,
                disabled && styles.layoutChipDisabled,
              ]}
              onPress={() => upsertPage({ ...pageEdit, layout: option.value })}
            >
              <Text style={[styles.layoutChipText, selected && styles.layoutChipTextSelected]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={[styles.label, { marginTop: 16 }]}>페이지 코멘트</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        multiline
        value={commentDraft}
        onChangeText={setCommentDraft}
        onBlur={() => upsertPage({ ...pageEdit, pageComment: commentDraft })}
        placeholder="성장책에만 남길 코멘트를 적어 주세요"
        placeholderTextColor={colors.faint}
      />
      <Pressable
        style={styles.secondaryBtn}
        onPress={() => {
          upsertPage({ ...pageEdit, pageComment: commentDraft });
          Alert.alert("저장됨", "페이지 코멘트가 성장책 편집본에 저장되었어요.");
        }}
      >
        <Text style={styles.secondaryBtnText}>코멘트 저장</Text>
      </Pressable>

      <Text style={[styles.label, { marginTop: 16 }]}>페이지 스티커</Text>
      <Pressable style={styles.secondaryBtn} onPress={() => setStickerPickerOpen(true)}>
        <Text style={styles.secondaryBtnText}>스티커 추가</Text>
      </Pressable>
      {pageStickers.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.poolRow}>
          {pageStickers.map((sticker) => (
            <Pressable
              key={sticker.id}
              onLongPress={() =>
                upsertPage({
                  ...pageEdit,
                  stickerIds: (pageEdit.stickerIds ?? []).filter((id) => id !== sticker.id),
                })
              }
            >
              <BabyStickerFromModel sticker={sticker} size={72} />
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
      <Text style={styles.hintMuted}>길게 누르면 페이지에서 스티커를 빼요</Text>

      <Text style={[styles.sectionTitle, { marginTop: 22 }]}>가족 롤링페이퍼</Text>
      {(pageEdit.rollingComments ?? []).map((comment) => (
        <View key={comment.id} style={styles.commentCard}>
          <Text style={styles.commentAuthor}>
            {formatGrowthAuthorLabel(comment.authorRelationshipLabel, comment.authorName)}
          </Text>
          {editingCommentId === comment.id ? (
            <>
              <TextInput
                style={[styles.input, styles.textArea]}
                multiline
                value={rollingDraft}
                onChangeText={setRollingDraft}
                autoFocus
              />
              <View style={styles.commentActions}>
                <Pressable
                  onPress={() => {
                    const text = rollingDraft.trim();
                    if (!text) return;
                    upsertPage({
                      ...pageEdit,
                      rollingComments: pageEdit.rollingComments.map((c) =>
                        c.id === comment.id
                          ? { ...c, text, updatedAt: new Date().toISOString() }
                          : c,
                      ),
                    });
                    setEditingCommentId(null);
                    setRollingDraft("");
                  }}
                >
                  <Text style={styles.commentAction}>저장</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setEditingCommentId(null);
                    setRollingDraft("");
                  }}
                >
                  <Text style={styles.commentAction}>취소</Text>
                </Pressable>
              </View>
            </>
          ) : (
            <>
              <Text style={styles.commentText}>“{comment.text}”</Text>
              <View style={styles.commentActions}>
                {canEditOwnGrowthBookNote(myRole, comment.authorId, me) ? (
                  <Pressable
                    onPress={() => {
                      setEditingCommentId(comment.id);
                      setRollingDraft(comment.text);
                    }}
                    hitSlop={8}
                  >
                    <Text style={styles.commentAction}>수정</Text>
                  </Pressable>
                ) : null}
                {canDeleteGrowthBookNote(myRole, comment.authorId, me) ? (
                  <Pressable
                    onPress={() =>
                      upsertPage({
                        ...pageEdit,
                        rollingComments: pageEdit.rollingComments.filter((c) => c.id !== comment.id),
                      })
                    }
                    hitSlop={8}
                  >
                    <Text style={[styles.commentAction, styles.commentDanger]}>삭제</Text>
                  </Pressable>
                ) : null}
              </View>
            </>
          )}
        </View>
      ))}

      {canWrite && me ? (
        <>
          <Text style={styles.autoAuthor}>
            {formatGrowthAuthorLabel(memberRelationshipLabel(me), me.name)}으로 남기기
          </Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            multiline
            value={rollingDraft}
            onChangeText={setRollingDraft}
            placeholder="가족에게 남길 한마디"
            placeholderTextColor={colors.faint}
          />
          <Pressable
            style={styles.primaryBtn}
            onPress={() => {
              const text = rollingDraft.trim();
              if (!text) return;
              const now = new Date().toISOString();
              const nextComment: GrowthBookComment = {
                id: newId("gbc"),
                pageId: entry.id,
                authorId: me.id,
                authorName: me.name,
                authorRelationshipLabel: memberRelationshipLabel(me),
                text,
                createdAt: now,
                updatedAt: now,
              };
              upsertPage({
                ...pageEdit,
                rollingComments: [...pageEdit.rollingComments, nextComment],
              });
              setRollingDraft("");
            }}
          >
            <Text style={styles.primaryBtnText}>롤링페이퍼 남기기</Text>
          </Pressable>
        </>
      ) : (
        <Text style={styles.hint}>보기만 가능 계정은 롤링페이퍼를 작성할 수 없어요.</Text>
      )}
      <Text style={styles.hintMuted}>{babyName}의 이 순간을 함께 남겨 보세요.</Text>

      <BabyStickerVaultModal
        embedded
        visible={stickerPickerOpen}
        babyName={babyName}
        stickers={babyStickers}
        createdBy={logAuthor.userId}
        pickMode
        onClose={() => setStickerPickerOpen(false)}
        onSaveSticker={addBabySticker}
        onDeleteSticker={deleteBabySticker}
        onPickSticker={(sticker) => {
          const ids = pageEdit.stickerIds ?? [];
          upsertPage({
            ...pageEdit,
            stickerIds: ids.includes(sticker.id) ? ids : [...ids, sticker.id],
          });
          setStickerPickerOpen(false);
        }}
      />
    </ScrollView>
  );
}

function LetterEditor({
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
  onPatch: (updater: (prev: GrowthBookEdit) => GrowthBookEdit) => void;
}) {
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
        성장책 마지막 페이지에 실리는 편지예요. 작성자 이름과 관계는 자동으로 표시됩니다.
      </Text>

      {edit.letters.map((letter) => (
        <CommentRow
          key={letter.id}
          authorLabel={`${formatGrowthAuthorLabel(letter.authorRelationshipLabel, letter.authorName)}가 ${babyName}에게`}
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
            {formatGrowthAuthorLabel(memberRelationshipLabel(me), me.name)}가 {babyName}에게
          </Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            multiline
            value={draft}
            onChangeText={setDraft}
            placeholder="사랑하는 마음을 편지로 남겨 보세요"
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
              Alert.alert("저장됨", "마지막 편지가 저장되었어요.");
            }}
          >
            <Text style={styles.primaryBtnText}>{myLetter ? "내 편지 수정" : "편지 작성"}</Text>
          </Pressable>
        </>
      ) : (
        <Text style={styles.hint}>보기만 가능 계정은 편지를 작성할 수 없어요.</Text>
      )}
    </ScrollView>
  );
}

function PdfActions({
  babyName,
  entries,
  edit,
  bottomPad,
  onOpenBookPreview,
}: {
  babyName: string;
  entries: DiaryEntry[];
  edit: GrowthBookEdit;
  bottomPad: number;
  onOpenBookPreview?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const { babyStickers } = useBabyLog();
  return (
    <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 28 }]}>
      <Text style={styles.hint}>
        PDF에는 표지, 페이지 사진·레이아웃·코멘트, 롤링페이퍼, 스티커, 마지막 편지가 모두 포함됩니다.
      </Text>
      <Pressable
        style={styles.primaryBtn}
        disabled={busy}
        onPress={async () => {
          setBusy(true);
          try {
            await createGrowthBookPdf({ babyName, entries, edit, stickers: babyStickers });
          } finally {
            setBusy(false);
          }
        }}
      >
        <Text style={styles.primaryBtnText}>PDF 만들기</Text>
      </Pressable>
      {onOpenBookPreview ? (
        <Pressable style={styles.ghostBtn} onPress={onOpenBookPreview}>
          <Text style={styles.ghostBtnText}>성장책 미리보기로 확인</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

function CommentRow({
  authorLabel,
  text,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
}: {
  authorLabel: string;
  text: string;
  canEdit: boolean;
  canDelete: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <View style={styles.commentCard}>
      <Text style={styles.commentAuthor}>{authorLabel}</Text>
      <Text style={styles.commentText}>“{text}”</Text>
      <View style={styles.commentActions}>
        {canEdit ? (
          <Pressable onPress={onEdit} hitSlop={8}>
            <Text style={styles.commentAction}>수정</Text>
          </Pressable>
        ) : null}
        {canDelete ? (
          <Pressable onPress={onDelete} hitSlop={8}>
            <Text style={[styles.commentAction, styles.commentDanger]}>삭제</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerBtn: { fontSize: 15, fontWeight: "600", color: colors.muted, minWidth: 48 },
  headerTitle: { fontSize: 16, fontWeight: "800", color: colors.text },
  headerSpacer: { minWidth: 48 },
  content: { paddingHorizontal: 18, paddingTop: 16 },
  hint: { fontSize: 13, color: colors.muted, lineHeight: 19, marginBottom: 14 },
  hintMuted: { fontSize: 12, color: colors.faint, marginTop: 10 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 14,
    marginBottom: 10,
  },
  cardPrimary: { backgroundColor: colors.amber, borderColor: colors.amber },
  cardCopy: { flex: 1, minWidth: 0 },
  cardTitle: { fontSize: 15, fontWeight: "800", color: colors.text },
  cardTitlePrimary: { color: colors.amberDark },
  cardBody: { fontSize: 12.5, color: colors.muted, marginTop: 4, lineHeight: 18 },
  label: { fontSize: 13, fontWeight: "700", color: colors.text, marginBottom: 8 },
  sectionTitle: { fontSize: 17, fontWeight: "800", color: colors.text, marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
  },
  textArea: { minHeight: 110, textAlignVertical: "top" },
  coverPreview: { width: "100%", height: 220, borderRadius: 16, marginBottom: 12 },
  coverPlaceholder: {
    height: 160,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    backgroundColor: colors.cardHi,
  },
  coverPlaceholderText: { color: colors.faint, fontWeight: "600" },
  primaryBtn: {
    backgroundColor: colors.amber,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  primaryBtnText: { color: colors.amberDark, fontWeight: "800", fontSize: 14.5 },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: "center",
    marginTop: 8,
  },
  secondaryBtnText: { color: colors.text, fontWeight: "700", fontSize: 14 },
  ghostBtn: { paddingVertical: 14, alignItems: "center", marginTop: 4 },
  ghostBtnText: { color: colors.amber, fontWeight: "700" },
  poolRow: { gap: 8, paddingRight: 8 },
  poolThumbWrap: { borderRadius: 12, borderWidth: 2, borderColor: "transparent", overflow: "hidden" },
  poolThumbSelected: { borderColor: colors.amber },
  poolThumb: { width: 72, height: 72, borderRadius: 10 },
  index: { width: 18, fontSize: 12, fontWeight: "800", color: colors.faint },
  thumb: { width: 52, height: 52, borderRadius: 12 },
  thumbPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: colors.cardHi,
    alignItems: "center",
    justifyContent: "center",
  },
  thumbFallback: { fontSize: 18 },
  photoEditWrap: { width: 84 },
  photoActions: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 6 },
  miniChip: {
    backgroundColor: colors.cardHi,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  miniChipDanger: { backgroundColor: colors.dangerSoft },
  miniChipText: { fontSize: 10, fontWeight: "700", color: colors.text },
  addPhotoTile: {
    width: 72,
    height: 72,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.amber,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.amberSoft,
  },
  addPhotoText: { color: colors.amber, fontWeight: "800", fontSize: 12 },
  layoutRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  layoutChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.card,
  },
  layoutChipSelected: { backgroundColor: colors.amberSoft, borderColor: colors.amber },
  layoutChipDisabled: { opacity: 0.35 },
  layoutChipText: { fontSize: 12.5, fontWeight: "700", color: colors.muted },
  layoutChipTextSelected: { color: colors.amber },
  autoAuthor: { fontSize: 13, fontWeight: "800", color: colors.amber, marginBottom: 8, marginTop: 8 },
  commentCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
  },
  commentAuthor: { fontSize: 12.5, fontWeight: "800", color: colors.amber },
  commentText: { fontSize: 13.5, color: colors.text, marginTop: 6, lineHeight: 20 },
  commentActions: { flexDirection: "row", gap: 14, marginTop: 10 },
  commentAction: { fontSize: 12, fontWeight: "700", color: colors.muted },
  commentDanger: { color: colors.dangerText },
});
