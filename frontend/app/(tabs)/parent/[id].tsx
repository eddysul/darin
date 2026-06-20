import { View, Text, ScrollView, TouchableOpacity, Modal, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, MapPin, Baby, DollarSign, Home, Milk, Award, CheckCircle, Gavel } from 'lucide-react-native';
import { useState } from 'react';
import { useLanguage } from '../../../context/LanguageContext';
import { useApp } from '../../../context/AppContext';
import { PARENTS } from '../../../constants/parents';

const PRIMARY = '#243036';
const CARD_BG = '#fff';
const BORDER = '#f0f0f0';
const MUTED = '#9ca3af';
const FG = '#1a1a1a';

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

export default function ParentProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { locale } = useLanguage();
  const { role, addBid } = useApp();
  const ko = locale === 'ko';

  const [bidOpen, setBidOpen] = useState(false);
  const [bidPrice, setBidPrice] = useState('');
  const [bidMessage, setBidMessage] = useState('');
  const [bidSubmitted, setBidSubmitted] = useState(false);

  const parent = PARENTS.find((p) => p.id === Number(id));
  if (!parent) return null;

  const isCaregiver = role === 'caregiver';

  function submitBid() {
    if (!bidPrice.trim()) return;
    addBid({
      caregiverId: 'cg-me',
      caregiverName: ko ? '지연 선생님' : 'Jiyeon (You)',
      caregiverAvatar: '👩‍⚕️',
      caregiverRole: ko ? '산후조리사' : 'Postpartum Specialist',
      parentId: parent.id,
      price: `$${bidPrice}/wk`,
      message: bidMessage,
    });
    setBidOpen(false);
    setBidSubmitted(true);
    setBidPrice('');
    setBidMessage('');
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFDF7' }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: CARD_BG, borderBottomWidth: 1, borderBottomColor: BORDER }}>
        <TouchableOpacity onPress={() => router.push('/(tabs)/match')} style={{ padding: 4, marginRight: 8 }}>
          <ChevronLeft size={24} color={FG} />
        </TouchableOpacity>
        <Text style={{ fontSize: 17, fontWeight: 'bold', color: FG, flex: 1 }}>
          {ko ? '가족 프로필' : 'Family Profile'}
        </Text>
        {parent.verified && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#f0fdf4', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 }}>
            <CheckCircle size={13} color="#22c55e" />
            <Text style={{ fontSize: 11, fontWeight: '700', color: '#22c55e' }}>{ko ? '인증됨' : 'Verified'}</Text>
          </View>
        )}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 110 }}>

        {/* Hero */}
        <View style={{ marginHorizontal: 16, marginTop: 16, marginBottom: 16, backgroundColor: CARD_BG, borderRadius: 24, borderWidth: 1, borderColor: BORDER, padding: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#fce7f3', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(236,72,153,0.15)' }}>
              <Text style={{ fontSize: 32 }}>{parent.avatar}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: 'bold', fontSize: 20, color: FG }}>{ko ? parent.name.ko : parent.name.en}</Text>
              <Text style={{ fontSize: 13, color: MUTED, marginTop: 2 }}>{ko ? '부모' : 'Parent'}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                <MapPin size={11} color={MUTED} />
                <Text style={{ fontSize: 12, color: MUTED }}>{parent.location}</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
                {parent.languages.map((l) => (
                  <View key={l} style={{ backgroundColor: '#eff6ff', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 }}>
                    <Text style={{ fontSize: 11, fontWeight: '600', color: '#3b82f6' }}>{l === 'Korean' ? '🇰🇷 한국어' : '🇺🇸 English'}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        </View>

        {/* Care Request */}
        <View style={{ marginHorizontal: 16, marginBottom: 16 }}>
          <Text style={{ fontWeight: 'bold', fontSize: 16, color: FG, marginBottom: 10 }}>
            {ko ? '돌봄 요청서' : 'Care Request'}
          </Text>
          <View style={{ backgroundColor: CARD_BG, borderRadius: 24, borderWidth: 1, borderColor: BORDER, paddingHorizontal: 16, paddingTop: 4, paddingBottom: 2 }}>
            <InfoRow icon={Baby} color="#ec4899" label={ko ? '출산 예정일' : 'Due Date'} value={ko ? parent.dueDate.ko : parent.dueDate.en} />
            <InfoRow icon={Home} color="#8b5cf6" label={ko ? '입주 여부' : 'Live-in Preference'}
              value={<View style={{ flexDirection: 'row', gap: 6 }}><Badge label={ko ? '입주' : 'Live-in'} active={parent.liveIn} /><Badge label={ko ? '출퇴근' : 'Live-out'} active={!parent.liveIn} /></View>}
            />
            <InfoRow icon={DollarSign} color="#22c55e" label={ko ? '예산' : 'Budget'} value={parent.budget} />
            <InfoRow icon={MapPin} color="#06b6d4" label={ko ? '위치' : 'Location'} value={parent.location} />
            <InfoRow icon={Award} color="#f59e0b" label={ko ? '경험 선호' : 'Experience Preference'}
              value={
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {parent.newbornExp && <Badge label={ko ? '신생아 경험 필수' : 'Newborn exp. required'} active />}
                  {parent.nonSmoker && <Badge label={ko ? '비흡연' : 'Non-smoker'} active />}
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
                    <Badge label={parent.breastfeeding ? (ko ? '필수' : 'Required') : (ko ? '선택' : 'Optional')} active={parent.breastfeeding} />
                  </View>
                </View>
              </View>
            </View>
            <View style={{ paddingVertical: 14 }}>
              <Text style={{ fontSize: 11, color: MUTED, marginBottom: 6 }}>{ko ? '특이사항' : 'Special Notes'}</Text>
              <Text style={{ fontSize: 13, color: FG, lineHeight: 20 }}>{ko ? parent.notes.ko : parent.notes.en}</Text>
            </View>
          </View>
        </View>

      </ScrollView>

      {/* Fixed CTA */}
      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, backgroundColor: '#FFFDF7', borderTopWidth: 1, borderTopColor: BORDER }}>
        {isCaregiver ? (
          bidSubmitted ? (
            <View style={{ backgroundColor: '#f0fdf4', borderRadius: 16, paddingVertical: 16, alignItems: 'center', borderWidth: 1, borderColor: '#bbf7d0' }}>
              <Text style={{ color: '#16a34a', fontWeight: '700', fontSize: 15 }}>✓ {ko ? '입찰이 제출되었습니다' : 'Bid submitted!'}</Text>
            </View>
          ) : (
            <TouchableOpacity onPress={() => setBidOpen(true)} style={{ backgroundColor: PRIMARY, borderRadius: 16, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <Gavel size={18} color="#fff" />
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>{ko ? '입찰하기' : 'Place Bid'}</Text>
            </TouchableOpacity>
          )
        ) : (
          <View style={{ backgroundColor: '#f3f4f6', borderRadius: 16, paddingVertical: 16, alignItems: 'center' }}>
            <Text style={{ color: MUTED, fontWeight: '600', fontSize: 14 }}>{ko ? '케어기버가 입찰할 수 있어요' : 'Caregivers can place bids here'}</Text>
          </View>
        )}
      </View>

      {/* Bid Modal */}
      <Modal visible={bidOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setBidOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFDF7' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, backgroundColor: CARD_BG, borderBottomWidth: 1, borderBottomColor: BORDER }}>
              <TouchableOpacity onPress={() => setBidOpen(false)}>
                <Text style={{ fontSize: 15, color: MUTED }}>{ko ? '취소' : 'Cancel'}</Text>
              </TouchableOpacity>
              <Text style={{ fontWeight: 'bold', fontSize: 16, color: FG }}>{ko ? '입찰하기' : 'Place a Bid'}</Text>
              <TouchableOpacity onPress={submitBid}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: PRIMARY }}>{ko ? '제출' : 'Submit'}</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
              <Text style={{ fontSize: 13, color: MUTED, marginBottom: 20, lineHeight: 20 }}>
                {ko
                  ? `${parent.name.ko} 가족에게 입찰을 보냅니다. 주당 가격과 자기소개를 입력하세요.`
                  : `Send a bid to ${parent.name.en}'s family. Enter your weekly rate and a short introduction.`}
              </Text>

              <Text style={{ fontSize: 12, fontWeight: '700', color: MUTED, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {ko ? '희망 주급 (USD)' : 'Weekly Rate (USD)'}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: CARD_BG, borderWidth: 1.5, borderColor: BORDER, borderRadius: 14, paddingHorizontal: 16, marginBottom: 20 }}>
                <Text style={{ color: MUTED, fontSize: 18, fontWeight: '600', marginRight: 4 }}>$</Text>
                <TextInput
                  value={bidPrice}
                  onChangeText={(v) => setBidPrice(v.replace(/[^0-9]/g, ''))}
                  keyboardType="numeric"
                  placeholder="1800"
                  placeholderTextColor={MUTED}
                  style={{ flex: 1, paddingVertical: 14, fontSize: 18, fontWeight: '600', color: FG }}
                />
                <Text style={{ color: MUTED, fontSize: 14 }}>/wk</Text>
              </View>

              <Text style={{ fontSize: 12, fontWeight: '700', color: MUTED, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {ko ? '자기소개 메시지' : 'Introduction Message'}
              </Text>
              <TextInput
                value={bidMessage}
                onChangeText={setBidMessage}
                placeholder={ko ? '경력, 전문 분야, 가족에게 하고 싶은 말을 적어주세요.' : 'Tell the family about your experience, specialties, and why you\'re a great fit.'}
                placeholderTextColor={MUTED}
                multiline
                numberOfLines={5}
                style={{ backgroundColor: CARD_BG, borderWidth: 1.5, borderColor: BORDER, borderRadius: 14, padding: 16, fontSize: 14, color: FG, minHeight: 120, textAlignVertical: 'top', marginBottom: 20 }}
              />

              <View style={{ backgroundColor: '#fffbeb', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#fde68a' }}>
                <Text style={{ fontSize: 12, color: '#92400e', lineHeight: 18 }}>
                  {ko
                    ? '💡 입찰이 수락되면 부모님이 인터뷰를 요청할 수 있습니다.'
                    : '💡 If your bid is accepted, the family will reach out to schedule an interview.'}
                </Text>
              </View>
            </ScrollView>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}
