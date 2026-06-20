import { View, Text, ScrollView, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, FileText, Check } from 'lucide-react-native';
import { useState } from 'react';
import { useApp } from '../../../context/AppContext';
import { useLanguage } from '../../../context/LanguageContext';

const PRIMARY = '#243036';
const GREEN = '#16a34a';
const CARD_BG = '#fff';
const BORDER = '#f0f0f0';
const MUTED = '#9ca3af';
const FG = '#1a1a1a';

function Field({ label, value, onChange, placeholder, multiline }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; multiline?: boolean }) {
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={{ fontSize: 11, fontWeight: '700', color: MUTED, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={MUTED}
        multiline={multiline}
        style={{ backgroundColor: '#f9fafb', borderWidth: 1.5, borderColor: BORDER, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: FG, minHeight: multiline ? 80 : undefined, textAlignVertical: multiline ? 'top' : undefined }}
      />
    </View>
  );
}

export default function ContractScreen() {
  const { bidId } = useLocalSearchParams<{ bidId: string }>();
  const router = useRouter();
  const { bids } = useApp();
  const { locale } = useLanguage();
  const ko = locale === 'ko';
  const [signed, setSigned] = useState(false);

  const bid = bids.find((b) => b.id === bidId);

  const [form, setForm] = useState({
    parentName: ko ? '김지은' : 'Jieun Kim',
    caregiverName: bid?.caregiverName ?? '',
    startDate: '',
    endDate: '',
    weeklyRate: bid?.price ?? '',
    liveIn: ko ? '입주' : 'Live-in',
    duties: ko ? '신생아 돌봄, 수유 지원, 모유수유 코칭, 수면 교육' : 'Newborn care, feeding support, breastfeeding coaching, sleep training',
    additionalTerms: '',
    parentSignature: '',
  });

  const set = (key: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [key]: v }));

  if (signed) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFDF7', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: '#f0fdf4', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
          <Check size={40} color={GREEN} />
        </View>
        <Text style={{ fontSize: 22, fontWeight: 'bold', color: FG, textAlign: 'center', marginBottom: 10 }}>
          {ko ? '계약이 완료되었습니다! 🎉' : 'Contract Signed! 🎉'}
        </Text>
        <Text style={{ fontSize: 14, color: MUTED, textAlign: 'center', lineHeight: 22, marginBottom: 32 }}>
          {ko
            ? `${bid?.caregiverName}과의 계약이 성공적으로 체결되었습니다.`
            : `Your contract with ${bid?.caregiverName} has been finalized.`}
        </Text>
        <TouchableOpacity onPress={() => router.push('/(tabs)/home')} style={{ backgroundColor: PRIMARY, borderRadius: 16, paddingHorizontal: 32, paddingVertical: 14 }}>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>{ko ? '홈으로 돌아가기' : 'Back to Home'}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFDF7' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: CARD_BG, borderBottomWidth: 1, borderBottomColor: BORDER }}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 4, marginRight: 8 }}>
          <ChevronLeft size={24} color={FG} />
        </TouchableOpacity>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <FileText size={18} color={GREEN} />
          <Text style={{ fontSize: 17, fontWeight: 'bold', color: FG }}>{ko ? '돌봄 계약서' : 'Care Agreement'}</Text>
        </View>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">

          {/* Header banner */}
          <View style={{ backgroundColor: '#f0fdf4', borderRadius: 16, padding: 14, marginBottom: 20, borderWidth: 1, borderColor: '#bbf7d0', flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <FileText size={16} color={GREEN} />
            <Text style={{ fontSize: 13, color: GREEN, fontWeight: '600', flex: 1 }}>
              {ko ? '아래 항목을 확인하고 서명하면 계약이 완료됩니다.' : 'Review and sign below to finalize your care agreement.'}
            </Text>
          </View>

          <View style={{ backgroundColor: CARD_BG, borderRadius: 24, borderWidth: 1, borderColor: BORDER, padding: 16, marginBottom: 16 }}>
            <Text style={{ fontSize: 14, fontWeight: '800', color: FG, marginBottom: 16, textAlign: 'center', textTransform: 'uppercase', letterSpacing: 1 }}>
              {ko ? '돌봄 서비스 계약서' : 'CHILDCARE SERVICE AGREEMENT'}
            </Text>

            <Field label={ko ? '부모 이름' : 'Parent Name'} value={form.parentName} onChange={set('parentName')} />
            <Field label={ko ? '케어기버 이름' : 'Caregiver Name'} value={form.caregiverName} onChange={set('caregiverName')} />
            <Field label={ko ? '시작일' : 'Start Date'} value={form.startDate} onChange={set('startDate')} placeholder={ko ? '예: Aug 15, 2026' : 'e.g. Aug 15, 2026'} />
            <Field label={ko ? '종료일' : 'End Date'} value={form.endDate} onChange={set('endDate')} placeholder={ko ? '예: Oct 10, 2026 (8주)' : 'e.g. Oct 10, 2026 (8 weeks)'} />
            <Field label={ko ? '주급' : 'Weekly Rate'} value={form.weeklyRate} onChange={set('weeklyRate')} />
            <Field label={ko ? '입주 여부' : 'Live-in / Live-out'} value={form.liveIn} onChange={set('liveIn')} />
            <Field label={ko ? '주요 업무' : 'Duties & Responsibilities'} value={form.duties} onChange={set('duties')} multiline />
            <Field label={ko ? '추가 조건 (선택)' : 'Additional Terms (optional)'} value={form.additionalTerms} onChange={set('additionalTerms')} placeholder={ko ? '기타 합의 사항...' : 'Any additional agreements...'} multiline />

            <View style={{ height: 1, backgroundColor: BORDER, marginVertical: 16 }} />

            <Field label={ko ? '부모 서명 (이름 입력)' : 'Parent Signature (type your name)'} value={form.parentSignature} onChange={set('parentSignature')} placeholder={ko ? '이름을 입력하면 서명으로 간주됩니다' : 'Typing your name acts as your signature'} />
          </View>

        </ScrollView>

        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, backgroundColor: '#FFFDF7', borderTopWidth: 1, borderTopColor: BORDER }}>
          <TouchableOpacity
            onPress={() => { if (form.parentSignature.trim()) setSigned(true); }}
            style={{ backgroundColor: form.parentSignature.trim() ? GREEN : '#d1fae5', borderRadius: 16, paddingVertical: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          >
            <Check size={18} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>{ko ? '서명하고 계약 완료' : 'Sign & Complete Contract'}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
