import { View, Text, ScrollView, TouchableOpacity, Modal, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, Calendar, FileText, Gavel, Check } from 'lucide-react-native';
import { useState } from 'react';
import { useApp } from '../../../context/AppContext';
import { useLanguage } from '../../../context/LanguageContext';

const PRIMARY = '#243036';
const CARD_BG = '#fff';
const BORDER = '#f0f0f0';
const MUTED = '#9ca3af';
const FG = '#1a1a1a';

export default function BidDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { bids, updateBid } = useApp();
  const { locale } = useLanguage();
  const ko = locale === 'ko';

  const [interviewOpen, setInterviewOpen] = useState(false);
  const [interviewDate, setInterviewDate] = useState('');
  const [interviewTime, setInterviewTime] = useState('');

  const bid = bids.find((b) => b.id === id);
  if (!bid) return null;

  function scheduleInterview() {
    if (!interviewDate.trim()) return;
    updateBid(bid.id, {
      status: 'interview_scheduled',
      interviewDate: `${interviewDate}${interviewTime ? ' · ' + interviewTime : ''}`,
    });
    setInterviewOpen(false);
  }

  function acceptBid() {
    updateBid(bid.id, { status: 'accepted' });
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFDF7' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: CARD_BG, borderBottomWidth: 1, borderBottomColor: BORDER }}>
        <TouchableOpacity onPress={() => router.push('/(tabs)/bids')} style={{ padding: 4, marginRight: 8 }}>
          <ChevronLeft size={24} color={FG} />
        </TouchableOpacity>
        <Text style={{ fontSize: 17, fontWeight: 'bold', color: FG, flex: 1 }}>{ko ? '입찰 상세' : 'Bid Detail'}</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>

        {/* Caregiver Card */}
        <View style={{ backgroundColor: CARD_BG, borderRadius: 24, borderWidth: 1, borderColor: BORDER, padding: 20, marginBottom: 16, alignItems: 'center' }}>
          <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: '#e0e7ff', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
            <Text style={{ fontSize: 36 }}>{bid.caregiverAvatar}</Text>
          </View>
          <Text style={{ fontSize: 20, fontWeight: 'bold', color: FG }}>{bid.caregiverName}</Text>
          <Text style={{ fontSize: 13, color: MUTED, marginTop: 4 }}>{bid.caregiverRole}</Text>
          <View style={{ marginTop: 12, backgroundColor: 'rgba(36,48,54,0.1)', borderRadius: 14, paddingHorizontal: 20, paddingVertical: 10 }}>
            <Text style={{ fontSize: 24, fontWeight: '800', color: PRIMARY, textAlign: 'center' }}>{bid.price}</Text>
            <Text style={{ fontSize: 12, color: MUTED, textAlign: 'center', marginTop: 2 }}>{ko ? '케어기버 제안 가격' : 'Caregiver\'s bid price'}</Text>
          </View>
        </View>

        {/* Message */}
        <View style={{ backgroundColor: CARD_BG, borderRadius: 20, borderWidth: 1, borderColor: BORDER, padding: 16, marginBottom: 16 }}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: MUTED, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            {ko ? '자기소개' : 'Introduction'}
          </Text>
          <Text style={{ fontSize: 14, color: FG, lineHeight: 22 }}>{bid.message}</Text>
        </View>

        {/* Interview Status */}
        {bid.interviewDate && (
          <View style={{ backgroundColor: '#eff6ff', borderRadius: 20, borderWidth: 1, borderColor: 'rgba(36,48,54,0.2)', padding: 16, marginBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Calendar size={20} color={PRIMARY} />
            <View>
              <Text style={{ fontSize: 12, fontWeight: '700', color: PRIMARY }}>{ko ? '인터뷰 예정' : 'Interview Scheduled'}</Text>
              <Text style={{ fontSize: 14, fontWeight: '600', color: FG, marginTop: 2 }}>{bid.interviewDate}</Text>
            </View>
          </View>
        )}

        {/* Contract (only after accepted) */}
        {bid.status === 'accepted' && (
          <TouchableOpacity
            onPress={() => router.push(`/(tabs)/bid/contract?bidId=${bid.id}`)}
            style={{ backgroundColor: '#f0fdf4', borderRadius: 20, borderWidth: 1, borderColor: '#bbf7d0', padding: 16, marginBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}
          >
            <FileText size={20} color="#16a34a" />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#16a34a' }}>{ko ? '계약서 작성하기' : 'Sign Contract'}</Text>
              <Text style={{ fontSize: 12, color: '#4ade80', marginTop: 2 }}>{ko ? '템플릿을 채워서 계약을 완료하세요' : 'Fill in the template to finalize'}</Text>
            </View>
            <ChevronLeft size={16} color="#16a34a" style={{ transform: [{ rotate: '180deg' }] }} />
          </TouchableOpacity>
        )}

      </ScrollView>

      {/* Action Buttons */}
      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, backgroundColor: '#FFFDF7', borderTopWidth: 1, borderTopColor: BORDER, gap: 10 }}>
        {bid.status === 'pending' && (
          <>
            <TouchableOpacity
              onPress={() => setInterviewOpen(true)}
              style={{ backgroundColor: PRIMARY, borderRadius: 16, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            >
              <Calendar size={18} color="#fff" />
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>{ko ? '인터뷰 일정 잡기' : 'Schedule Interview'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => updateBid(bid.id, { status: 'rejected' })}
              style={{ borderWidth: 1.5, borderColor: '#fca5a5', borderRadius: 16, paddingVertical: 14, alignItems: 'center' }}
            >
              <Text style={{ color: '#ef4444', fontWeight: '600', fontSize: 15 }}>{ko ? '거절하기' : 'Decline'}</Text>
            </TouchableOpacity>
          </>
        )}
        {bid.status === 'interview_scheduled' && (
          <TouchableOpacity
            onPress={acceptBid}
            style={{ backgroundColor: '#22c55e', borderRadius: 16, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          >
            <Check size={18} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>{ko ? '케어기버 수락 & 계약 진행' : 'Accept & Proceed to Contract'}</Text>
          </TouchableOpacity>
        )}
        {bid.status === 'accepted' && (
          <TouchableOpacity
            onPress={() => router.push(`/(tabs)/bid/contract?bidId=${bid.id}`)}
            style={{ backgroundColor: '#16a34a', borderRadius: 16, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          >
            <FileText size={18} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>{ko ? '계약서 작성' : 'Sign Contract'}</Text>
          </TouchableOpacity>
        )}
        {bid.status === 'rejected' && (
          <View style={{ backgroundColor: '#fef2f2', borderRadius: 16, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: '#fca5a5' }}>
            <Text style={{ color: '#ef4444', fontWeight: '600' }}>{ko ? '거절된 입찰' : 'Bid Declined'}</Text>
          </View>
        )}
      </View>

      {/* Interview Modal */}
      <Modal visible={interviewOpen} transparent animationType="slide" onRequestClose={() => setInterviewOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end' }}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setInterviewOpen(false)} />
          <View style={{ backgroundColor: CARD_BG, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24 }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: FG, marginBottom: 4 }}>{ko ? '인터뷰 일정' : 'Schedule Interview'}</Text>
            <Text style={{ fontSize: 13, color: MUTED, marginBottom: 20 }}>{ko ? `${bid.caregiverName}과의 인터뷰 날짜를 선택하세요` : `Pick a date for your interview with ${bid.caregiverName}`}</Text>

            <Text style={{ fontSize: 12, fontWeight: '700', color: MUTED, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>{ko ? '날짜' : 'Date'}</Text>
            <TextInput
              value={interviewDate}
              onChangeText={setInterviewDate}
              placeholder={ko ? '예: Jun 22, 2026' : 'e.g. Jun 22, 2026'}
              placeholderTextColor={MUTED}
              style={{ backgroundColor: '#f9fafb', borderWidth: 1.5, borderColor: BORDER, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 13, fontSize: 14, color: FG, marginBottom: 14 }}
            />

            <Text style={{ fontSize: 12, fontWeight: '700', color: MUTED, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>{ko ? '시간' : 'Time'}</Text>
            <TextInput
              value={interviewTime}
              onChangeText={setInterviewTime}
              placeholder={ko ? '예: 2:00 PM' : 'e.g. 2:00 PM'}
              placeholderTextColor={MUTED}
              style={{ backgroundColor: '#f9fafb', borderWidth: 1.5, borderColor: BORDER, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 13, fontSize: 14, color: FG, marginBottom: 20 }}
            />

            <TouchableOpacity onPress={scheduleInterview} style={{ backgroundColor: PRIMARY, borderRadius: 16, paddingVertical: 14, alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>{ko ? '인터뷰 확정' : 'Confirm Interview'}</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}
