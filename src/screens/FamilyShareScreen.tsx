import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBabyLog } from "../context/BabyLogContext";
import { FamilyRepository } from "../repositories/FamilyRepository";
import { getSupabaseSync } from "../utils/supabaseSyncStore";
import { PROFILE_RELATION_OPTIONS } from "../types/profileSettings";
import { colors, radius } from "../theme";

type InviteKind = "family" | "friend";
type InvitePreview = NonNullable<Awaited<ReturnType<typeof FamilyRepository.previewInviteCode>>>;

const inviteMessage = (code: string) => `다린에서 우리 아기 기록을 함께 볼 수 있도록 초대했어요.\n\n초대코드: ${code}\n\n앱을 설치하고 초대코드를 입력하면 함께 볼 수 있어요.`;

export function FamilyShareScreen() {
  const insets = useSafeAreaInsets();
  const { babyName, myFamilyRole, familyMembers, rehydrateFromServer } = useBabyLog();
  const babyId = getSupabaseSync().babyId;
  const [kind, setKind] = useState<InviteKind>("family");
  const [role, setRole] = useState<"admin" | "editor">("editor");
  const [relation, setRelation] = useState("가족");
  const [createdCode, setCreatedCode] = useState("");
  const [code, setCode] = useState("");
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [nickname, setNickname] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const isAdmin = myFamilyRole === "owner" || myFamilyRole === "admin";

  useFocusEffect(useCallback(() => { void rehydrateFromServer().catch(() => undefined); }, [rehydrateFromServer]));

  const create = async () => {
    if (!babyId || !isAdmin || working) return;
    setWorking(true); setError("");
    try {
      const invite = await FamilyRepository.createInviteCode({
        babyId, inviteType: kind, role: kind === "friend" ? "viewer" : role,
        relationshipLabel: kind === "friend" ? "친구" : relation,
      });
      setCreatedCode(invite.code);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "초대코드를 만들지 못했어요."); }
    finally { setWorking(false); }
  };

  const share = async () => { if (createdCode) await Share.share({ message: inviteMessage(createdCode) }); };
  const copy = async () => { if (createdCode) { await Clipboard.setStringAsync(createdCode); Alert.alert("복사됨", "초대코드를 복사했어요."); } };
  const inspect = async () => {
    const normalized = code.trim().toUpperCase();
    if (!normalized) return;
    setWorking(true); setError("");
    try {
      const next = await FamilyRepository.previewInviteCode(normalized);
      if (!next) throw new Error("잘못된 초대코드예요.");
      if (!next.is_valid) throw new Error(next.invalid_reason === "expired" ? "만료된 초대코드예요." : next.invalid_reason === "revoked" ? "취소된 초대코드예요." : "이미 사용된 초대코드예요.");
      setPreview(next);
      if (next.relation) setRelation(next.relation);
    } catch (cause) { setPreview(null); setError(cause instanceof Error ? cause.message : "초대 정보를 확인하지 못했어요."); }
    finally { setWorking(false); }
  };
  const accept = async () => {
    if (!preview || !displayName.trim() || working) return;
    setWorking(true); setError("");
    try {
      await FamilyRepository.acceptInviteCode({ code, displayName: displayName.trim(), nickname: nickname.trim(), relation });
      await rehydrateFromServer();
      Alert.alert("연결 완료", preview.invite_type === "friend" ? "친구 공개 순간을 함께 볼 수 있어요." : "아기 공간에 연결됐어요.");
      setPreview(null); setCode("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "초대를 수락하지 못했어요."); }
    finally { setWorking(false); }
  };

  return <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={88}>
    <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]} keyboardShouldPersistTaps="handled">
      <View style={styles.card}><Text style={styles.title}>가족·친구 공유</Text><Text style={styles.copy}>함께 보는 사람 {familyMembers.filter((m) => m.status === "active").length}명</Text>
        {familyMembers.filter((m) => m.status === "active").slice(0, 6).map((m) => <Text key={m.id} style={styles.member} numberOfLines={1}>{m.name} · {m.relationshipLabel ?? "가족"}</Text>)}
      </View>
      {isAdmin ? <View style={styles.card}><Text style={styles.section}>초대코드 생성</Text><Text style={styles.copy}>{kind === "family" ? "기록과 일기를 함께 남길 가족을 초대해요." : "친구 공개 순간만 볼 수 있는 친구를 초대해요."}</Text>
        <View style={styles.row}>{(["family", "friend"] as const).map((v) => <Pressable key={v} style={[styles.chip, kind === v && styles.active]} onPress={() => { setKind(v); setCreatedCode(""); }}><Text style={[styles.chipText, kind === v && styles.activeText]}>{v === "family" ? "가족 초대하기" : "친구 초대하기"}</Text></Pressable>)}</View>
        {kind === "family" ? <View style={styles.row}>{(["admin", "editor"] as const).map((v) => <Pressable key={v} style={[styles.chip, role === v && styles.active]} onPress={() => setRole(v)}><Text style={[styles.chipText, role === v && styles.activeText]}>{v === "admin" ? "관리자" : "편집 가능"}</Text></Pressable>)}</View> : null}
        <Pressable style={styles.primary} onPress={() => void create()} disabled={working}><Text style={styles.primaryText}>{working ? "생성 중…" : "초대코드 생성"}</Text></Pressable>
        {createdCode ? <View style={styles.codeBox}><Text style={styles.code}>{createdCode}</Text><Text style={styles.copy}>초대받은 사람이 이 코드를 입력하면 연결돼요.</Text><View style={styles.row}><Pressable style={styles.secondary} onPress={() => void copy()}><Text style={styles.secondaryText}>코드 복사</Text></Pressable><Pressable style={styles.secondary} onPress={() => void share()}><Text style={styles.secondaryText}>iOS·카카오톡 공유</Text></Pressable></View></View> : null}
      </View> : null}
      <View style={styles.card}><Text style={styles.section}>초대코드 직접 입력</Text><TextInput style={styles.input} value={code} onChangeText={(v) => { setCode(v.toUpperCase()); setPreview(null); }} placeholder="DARIN-XXXXXXXXXX" autoCapitalize="characters" placeholderTextColor={colors.faint}/><Pressable style={styles.primary} onPress={() => void inspect()} disabled={!code.trim() || working}><Text style={styles.primaryText}>초대 정보 확인</Text></Pressable>
        {preview ? <View style={styles.preview}><Text style={styles.previewTitle}>{preview.baby_name}의 {preview.invite_type === "friend" ? "친구" : "가족/보호자"}로 초대받았어요</Text><Text style={styles.copy}>초대한 사람: {preview.inviter_name} · {preview.invite_type === "friend" ? "친구 공개 순간만 볼 수 있어요." : preview.role === "admin" ? "관리자 권한" : "편집 가능"}</Text><TextInput style={styles.input} value={displayName} onChangeText={setDisplayName} placeholder="표시 이름" placeholderTextColor={colors.faint} maxLength={40}/><TextInput style={styles.input} value={nickname} onChangeText={setNickname} placeholder="닉네임 (선택)" placeholderTextColor={colors.faint} maxLength={40}/><View style={styles.row}>{PROFILE_RELATION_OPTIONS.map((v) => <Pressable key={v} style={[styles.chip, relation === v && styles.active]} onPress={() => setRelation(v)}><Text style={[styles.chipText, relation === v && styles.activeText]}>{v}</Text></Pressable>)}</View><Pressable style={[styles.primary, !displayName.trim() && styles.disabled]} onPress={() => void accept()} disabled={!displayName.trim() || working}><Text style={styles.primaryText}>초대 수락</Text></Pressable></View> : null}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </ScrollView>
  </KeyboardAvoidingView>;
}

const styles = StyleSheet.create({ root:{flex:1,backgroundColor:colors.background}, content:{padding:16,gap:14}, card:{backgroundColor:colors.card,borderWidth:1,borderColor:colors.border,borderRadius:radius.lg,padding:16,gap:10}, title:{fontSize:21,fontWeight:"900",color:colors.text}, section:{fontSize:16,fontWeight:"800",color:colors.text}, copy:{fontSize:13,color:colors.muted,lineHeight:19}, member:{fontSize:14,color:colors.text}, row:{flexDirection:"row",flexWrap:"wrap",gap:8}, chip:{minHeight:38,paddingHorizontal:11,justifyContent:"center",borderWidth:1,borderColor:colors.border,borderRadius:radius.full}, active:{borderColor:colors.amber,backgroundColor:colors.amberSoft}, chipText:{fontSize:12,fontWeight:"700",color:colors.muted}, activeText:{color:colors.amber}, primary:{minHeight:48,borderRadius:radius.full,backgroundColor:colors.amber,alignItems:"center",justifyContent:"center",paddingHorizontal:16}, primaryText:{color:"#fff",fontWeight:"800"}, secondary:{minHeight:42,flex:1,borderRadius:radius.md,backgroundColor:colors.cardHi,alignItems:"center",justifyContent:"center",paddingHorizontal:8}, secondaryText:{color:colors.text,fontSize:12,fontWeight:"800"}, codeBox:{gap:8,padding:12,borderRadius:radius.md,backgroundColor:colors.amberSoft}, code:{fontSize:20,fontWeight:"900",letterSpacing:1,color:colors.text}, input:{minHeight:48,borderWidth:1,borderColor:colors.border,borderRadius:radius.md,paddingHorizontal:12,color:colors.text,backgroundColor:colors.cardHi}, preview:{gap:10,paddingTop:6}, previewTitle:{fontSize:15,fontWeight:"800",color:colors.text}, error:{color:colors.dangerText,backgroundColor:colors.dangerSoft,padding:12,borderRadius:radius.md}, disabled:{opacity:.5} } as any);
