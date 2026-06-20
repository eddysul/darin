import {
  View, Text, ScrollView, TouchableOpacity, Modal,
  TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Globe, Bell, ChevronRight, Check, Baby, Home, DollarSign, Award, Milk, X, MapPin } from 'lucide-react-native';
import { useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import type { Locale } from '../../context/i18n';

const PRIMARY = '#243036';
const CARD_BG = '#fff';
const BORDER = '#f0f0f0';
const MUTED = '#9ca3af';
const FG = '#1a1a1a';

type CareRequest = {
  dueDate: string;
  liveIn: boolean;
  budgetMin: string;
  budgetMax: string;
  location: string;
  newbornExp: boolean;
  nonSmoker: boolean;
  breastfeeding: boolean;
  notes: string;
};

function Badge({ label, active }: { label: string; active: boolean }) {
  return (
    <View style={{ paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, backgroundColor: active ? 'rgba(36,48,54,0.12)' : '#f3f4f6', borderWidth: 1, borderColor: active ? PRIMARY : 'transparent' }}>
      <Text style={{ fontSize: 12, fontWeight: '600', color: active ? PRIMARY : MUTED }}>{label}</Text>
    </View>
  );
}

function InfoRow({ icon: Icon, color, label, value }: { icon: any; color: string; label: string; value: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: BORDER }}>
      <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: `${color}18`, alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={16} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 11, color: MUTED }}>{label}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
          {typeof value === 'string'
            ? <Text style={{ fontSize: 13, fontWeight: '600', color: FG }}>{value}</Text>
            : value}
        </View>
      </View>
    </View>
  );
}

function ToggleChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, backgroundColor: active ? 'rgba(36,48,54,0.1)' : '#f9fafb', borderColor: active ? PRIMARY : BORDER }}
    >
      <Text style={{ fontSize: 13, fontWeight: '600', color: active ? PRIMARY : MUTED }}>{label}</Text>
    </TouchableOpacity>
  );
}

function EditField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: 20 }}>
      <Text style={{ fontSize: 12, fontWeight: '700', color: MUTED, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</Text>
      {children}
    </View>
  );
}

export default function ProfileTab() {
  const [langPickerOpen, setLangPickerOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const { locale, setLocale } = useLanguage();
  const ko = locale === 'ko';

  const [care, setCare] = useState<CareRequest>({
    dueDate: ko ? '2026년 8월 15일' : 'Aug 15, 2026',
    liveIn: true,
    budgetMin: '1500',
    budgetMax: '2000',
    location: 'Capitol Hill, Seattle',
    newbornExp: true,
    nonSmoker: true,
    breastfeeding: true,
    notes: '',
  });

  const [draft, setDraft] = useState<CareRequest>(care);

  function openEdit() {
    setDraft({ ...care });
    setEditOpen(true);
  }

  function saveEdit() {
    setCare({ ...draft });
    setEditOpen(false);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFDF7' }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

        {/* Profile Hero */}
        <View style={{ marginHorizontal: 16, marginTop: 16, marginBottom: 16, backgroundColor: CARD_BG, borderRadius: 24, borderWidth: 1, borderColor: BORDER, padding: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#fce7f3', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(236,72,153,0.15)' }}>
              <Text style={{ fontSize: 32 }}>👩</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: 'bold', fontSize: 20, color: FG }}>{ko ? '지은' : 'Jieun'}</Text>
              <Text style={{ fontSize: 13, color: MUTED, marginTop: 2 }}>{ko ? '부모' : 'Parent'}</Text>
              <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
                <View style={{ backgroundColor: '#eff6ff', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 }}>
                  <Text style={{ fontSize: 11, fontWeight: '600', color: '#3b82f6' }}>{ko ? '🇰🇷 한국어' : '🇺🇸 English'}</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Care Request Card */}
        <View style={{ marginHorizontal: 16, marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <Text style={{ fontWeight: 'bold', fontSize: 16, color: FG }}>{ko ? '돌봄 요청서' : 'Care Request'}</Text>
            <TouchableOpacity onPress={openEdit} style={{ paddingHorizontal: 14, paddingVertical: 6, borderRadius: 12, backgroundColor: 'rgba(36,48,54,0.1)' }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: PRIMARY }}>{ko ? '수정' : 'Edit'}</Text>
            </TouchableOpacity>
          </View>

          <View style={{ backgroundColor: CARD_BG, borderRadius: 24, borderWidth: 1, borderColor: BORDER, paddingHorizontal: 16, paddingTop: 4, paddingBottom: 2 }}>
            <InfoRow
              icon={Baby} color="#ec4899"
              label={ko ? '출산 예정일' : 'Due Date'}
              value={care.dueDate}
            />
            <InfoRow
              icon={Home} color="#8b5cf6"
              label={ko ? '입주 여부' : 'Live-in Preference'}
              value={
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <Badge label={ko ? '입주' : 'Live-in'} active={care.liveIn} />
                  <Badge label={ko ? '출퇴근' : 'Live-out'} active={!care.liveIn} />
                </View>
              }
            />
            <InfoRow
              icon={DollarSign} color="#22c55e"
              label={ko ? '예산' : 'Budget'}
              value={`$${care.budgetMin} – $${care.budgetMax} / week`}
            />
            <InfoRow
              icon={MapPin} color="#06b6d4"
              label={ko ? '위치 (지역)' : 'Location (Area)'}
              value={care.location || (ko ? '미입력' : 'Not set')}
            />
            <InfoRow
              icon={Award} color="#f59e0b"
              label={ko ? '경험 선호' : 'Experience Preference'}
              value={
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {care.newbornExp && <Badge label={ko ? '신생아 경험 필수' : 'Newborn exp. required'} active />}
                  {care.nonSmoker && <Badge label={ko ? '비흡연' : 'Non-smoker'} active />}
                  {!care.newbornExp && !care.nonSmoker && <Text style={{ fontSize: 13, color: MUTED }}>{ko ? '없음' : 'None'}</Text>}
                </View>
              }
            />
            <View style={{ paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: BORDER }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center' }}>
                  <Milk size={16} color={PRIMARY} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 11, color: MUTED }}>{ko ? '모유수유 지원' : 'Breastfeeding Support'}</Text>
                  <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
                    <Badge label={care.breastfeeding ? (ko ? '필수' : 'Required') : (ko ? '선택' : 'Optional')} active={care.breastfeeding} />
                  </View>
                </View>
              </View>
            </View>

            <View style={{ paddingVertical: 14 }}>
              <Text style={{ fontSize: 11, color: MUTED, marginBottom: 6 }}>{ko ? '특이사항' : 'Special Notes'}</Text>
              {care.notes
                ? <Text style={{ fontSize: 13, color: FG, lineHeight: 20 }}>{care.notes}</Text>
                : <Text style={{ fontSize: 13, color: MUTED, fontStyle: 'italic' }}>{ko ? '없음' : 'None'}</Text>}
            </View>
          </View>
        </View>

        {/* Settings */}
        <View style={{ marginHorizontal: 16 }}>
          <Text style={{ fontWeight: 'bold', fontSize: 16, color: FG, marginBottom: 10 }}>{ko ? '설정' : 'Settings'}</Text>
          <View style={{ backgroundColor: CARD_BG, borderRadius: 24, borderWidth: 1, borderColor: BORDER, overflow: 'hidden' }}>
            <TouchableOpacity onPress={() => setLangPickerOpen(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 }}>
              <View style={{ backgroundColor: '#f3f4f6', borderRadius: 12, padding: 8 }}>
                <Globe size={16} color={MUTED} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: FG }}>{ko ? '언어' : 'Language'}</Text>
                <Text style={{ fontSize: 11, color: MUTED, marginTop: 1 }}>{ko ? '한국어' : 'English'}</Text>
              </View>
              <ChevronRight size={14} color={MUTED} />
            </TouchableOpacity>
            <View style={{ height: 1, backgroundColor: BORDER, marginLeft: 60 }} />
            <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 }}>
              <View style={{ backgroundColor: '#f3f4f6', borderRadius: 12, padding: 8 }}>
                <Bell size={16} color={MUTED} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: FG }}>{ko ? '알림' : 'Notifications'}</Text>
                <Text style={{ fontSize: 11, color: MUTED, marginTop: 1 }}>{ko ? '모든 알림 켜짐' : 'All alerts on'}</Text>
              </View>
              <ChevronRight size={14} color={MUTED} />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Edit Modal */}
      <Modal visible={editOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setEditOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFDF7' }}>
            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, backgroundColor: CARD_BG, borderBottomWidth: 1, borderBottomColor: BORDER }}>
              <TouchableOpacity onPress={() => setEditOpen(false)}>
                <X size={22} color={MUTED} />
              </TouchableOpacity>
              <Text style={{ fontWeight: 'bold', fontSize: 16, color: FG }}>{ko ? '돌봄 요청서 수정' : 'Edit Care Request'}</Text>
              <TouchableOpacity onPress={saveEdit} style={{ paddingHorizontal: 16, paddingVertical: 7, backgroundColor: PRIMARY, borderRadius: 12 }}>
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>{ko ? '저장' : 'Save'}</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">

              {/* Due Date */}
              <EditField label={ko ? '출산 예정일' : 'Due Date'}>
                <TextInput
                  value={draft.dueDate}
                  onChangeText={(v) => setDraft((d) => ({ ...d, dueDate: v }))}
                  placeholder={ko ? '예: 2026년 8월 15일' : 'e.g. Aug 15, 2026'}
                  placeholderTextColor={MUTED}
                  style={{ backgroundColor: CARD_BG, borderWidth: 1.5, borderColor: BORDER, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 13, fontSize: 14, color: FG }}
                />
              </EditField>

              {/* Live-in */}
              <EditField label={ko ? '입주 여부' : 'Live-in Preference'}>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <ToggleChip label={ko ? '입주' : 'Live-in'} active={draft.liveIn} onPress={() => setDraft((d) => ({ ...d, liveIn: true }))} />
                  <ToggleChip label={ko ? '출퇴근' : 'Live-out'} active={!draft.liveIn} onPress={() => setDraft((d) => ({ ...d, liveIn: false }))} />
                </View>
              </EditField>

              {/* Budget */}
              <EditField label={ko ? '예산 (주당, USD)' : 'Budget (per week, USD)'}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: CARD_BG, borderWidth: 1.5, borderColor: BORDER, borderRadius: 14, paddingHorizontal: 16 }}>
                    <Text style={{ color: MUTED, fontSize: 15, marginRight: 4 }}>$</Text>
                    <TextInput
                      value={draft.budgetMin}
                      onChangeText={(v) => setDraft((d) => ({ ...d, budgetMin: v.replace(/[^0-9]/g, '') }))}
                      keyboardType="numeric"
                      placeholder="1500"
                      placeholderTextColor={MUTED}
                      style={{ flex: 1, paddingVertical: 13, fontSize: 14, color: FG }}
                    />
                  </View>
                  <Text style={{ color: MUTED }}>–</Text>
                  <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: CARD_BG, borderWidth: 1.5, borderColor: BORDER, borderRadius: 14, paddingHorizontal: 16 }}>
                    <Text style={{ color: MUTED, fontSize: 15, marginRight: 4 }}>$</Text>
                    <TextInput
                      value={draft.budgetMax}
                      onChangeText={(v) => setDraft((d) => ({ ...d, budgetMax: v.replace(/[^0-9]/g, '') }))}
                      keyboardType="numeric"
                      placeholder="2000"
                      placeholderTextColor={MUTED}
                      style={{ flex: 1, paddingVertical: 13, fontSize: 14, color: FG }}
                    />
                  </View>
                </View>
              </EditField>

              {/* Location */}
              <EditField label={ko ? '위치 (지역)' : 'Location (Area)'}>
                <TextInput
                  value={draft.location}
                  onChangeText={(v) => setDraft((d) => ({ ...d, location: v }))}
                  placeholder={ko ? '예: 캐피톨힐, 벨뷰 남부' : 'e.g. Capitol Hill, South Bellevue'}
                  placeholderTextColor={MUTED}
                  style={{ backgroundColor: CARD_BG, borderWidth: 1.5, borderColor: BORDER, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 13, fontSize: 14, color: FG }}
                />
              </EditField>

              {/* Experience */}
              <EditField label={ko ? '경험 선호' : 'Experience Preference'}>
                <View style={{ gap: 10 }}>
                  <TouchableOpacity
                    onPress={() => setDraft((d) => ({ ...d, newbornExp: !d.newbornExp }))}
                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: CARD_BG, borderWidth: 1.5, borderColor: draft.newbornExp ? PRIMARY : BORDER, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 13 }}
                  >
                    <Text style={{ fontSize: 14, color: draft.newbornExp ? FG : MUTED, fontWeight: draft.newbornExp ? '600' : '400' }}>
                      {ko ? '신생아 경험 필수' : 'Newborn experience required'}
                    </Text>
                    {draft.newbornExp && <Check size={16} color={PRIMARY} />}
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setDraft((d) => ({ ...d, nonSmoker: !d.nonSmoker }))}
                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: CARD_BG, borderWidth: 1.5, borderColor: draft.nonSmoker ? PRIMARY : BORDER, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 13 }}
                  >
                    <Text style={{ fontSize: 14, color: draft.nonSmoker ? FG : MUTED, fontWeight: draft.nonSmoker ? '600' : '400' }}>
                      {ko ? '비흡연자 선호' : 'Non-smoker preferred'}
                    </Text>
                    {draft.nonSmoker && <Check size={16} color={PRIMARY} />}
                  </TouchableOpacity>
                </View>
              </EditField>

              {/* Breastfeeding */}
              <EditField label={ko ? '모유수유 지원' : 'Breastfeeding Support'}>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <ToggleChip label={ko ? '필수' : 'Required'} active={draft.breastfeeding} onPress={() => setDraft((d) => ({ ...d, breastfeeding: true }))} />
                  <ToggleChip label={ko ? '선택' : 'Optional'} active={!draft.breastfeeding} onPress={() => setDraft((d) => ({ ...d, breastfeeding: false }))} />
                </View>
              </EditField>

              {/* Special Notes */}
              <EditField label={ko ? '특이사항' : 'Special Notes'}>
                <TextInput
                  value={draft.notes}
                  onChangeText={(v) => setDraft((d) => ({ ...d, notes: v }))}
                  placeholder={ko ? '추가 요구사항이나 특이사항을 입력하세요' : 'Enter any additional requirements or notes'}
                  placeholderTextColor={MUTED}
                  multiline
                  numberOfLines={4}
                  style={{ backgroundColor: CARD_BG, borderWidth: 1.5, borderColor: BORDER, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 13, fontSize: 14, color: FG, minHeight: 100, textAlignVertical: 'top' }}
                />
              </EditField>

            </ScrollView>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Language Picker Modal */}
      <Modal visible={langPickerOpen} transparent animationType="fade" onRequestClose={() => setLangPickerOpen(false)}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }} onPress={() => setLangPickerOpen(false)}>
          <View style={{ backgroundColor: CARD_BG, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24 }}>
            <Text style={{ fontSize: 16, fontWeight: 'bold', color: FG, marginBottom: 16, textAlign: 'center' }}>{ko ? '언어 선택' : 'Select Language'}</Text>
            {(['en', 'ko'] as Locale[]).map((l) => (
              <TouchableOpacity
                key={l}
                onPress={() => { setLocale(l); setLangPickerOpen(false); }}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16, borderTopWidth: l === 'ko' ? 1 : 0, borderTopColor: BORDER }}
              >
                <Text style={{ fontSize: 15, fontWeight: '600', color: FG }}>{l === 'en' ? '🇺🇸  English' : '🇰🇷  한국어'}</Text>
                {locale === l && <Check size={18} color={PRIMARY} />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}
