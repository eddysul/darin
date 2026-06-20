import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft, ChevronRight, Clock, Gavel } from 'lucide-react-native';
import { useApp } from '../../context/AppContext';
import { useLanguage } from '../../context/LanguageContext';

const PRIMARY = '#243036';
const CARD_BG = '#fff';
const BORDER = '#f0f0f0';
const MUTED = '#9ca3af';
const FG = '#1a1a1a';

const STATUS_CONFIG = {
  pending: { label: { en: 'New', ko: '신규' }, color: '#f59e0b', bg: '#fffbeb' },
  interview_scheduled: { label: { en: 'Interview Set', ko: '인터뷰 예정' }, color: '#243036', bg: '#eff6ff' },
  accepted: { label: { en: 'Accepted', ko: '수락됨' }, color: '#22c55e', bg: '#f0fdf4' },
  rejected: { label: { en: 'Declined', ko: '거절됨' }, color: '#ef4444', bg: '#fef2f2' },
};

export default function BidsScreen() {
  const router = useRouter();
  const { bids } = useApp();
  const { locale } = useLanguage();
  const ko = locale === 'ko';

  const parentBids = bids.filter((b) => b.parentId === 1);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFDF7' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: CARD_BG, borderBottomWidth: 1, borderBottomColor: BORDER }}>
        <TouchableOpacity onPress={() => router.push('/(tabs)/home')} style={{ padding: 4, marginRight: 8 }}>
          <ChevronLeft size={24} color={FG} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 17, fontWeight: 'bold', color: FG }}>{ko ? '받은 입찰' : 'Received Bids'}</Text>
          <Text style={{ fontSize: 12, color: MUTED }}>{parentBids.length}{ko ? '명의 케어기버가 입찰했어요' : ' caregivers placed a bid'}</Text>
        </View>
        <View style={{ backgroundColor: '#eff6ff', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: PRIMARY }}>{parentBids.filter(b => b.status === 'pending').length} {ko ? '신규' : 'New'}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        {parentBids.map((bid) => {
          const s = STATUS_CONFIG[bid.status];
          return (
            <TouchableOpacity
              key={bid.id}
              onPress={() => router.push(`/(tabs)/bid/${bid.id}`)}
              style={{ backgroundColor: CARD_BG, borderRadius: 20, borderWidth: 1, borderColor: BORDER, padding: 16 }}
              activeOpacity={0.85}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#e0e7ff', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 24 }}>{bid.caregiverAvatar}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={{ fontWeight: 'bold', fontSize: 15, color: FG }}>{bid.caregiverName}</Text>
                    <Text style={{ fontSize: 16, fontWeight: '800', color: PRIMARY }}>{bid.price}</Text>
                  </View>
                  <Text style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>{bid.caregiverRole}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: s.bg, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 }}>
                      <Gavel size={11} color={s.color} />
                      <Text style={{ fontSize: 11, fontWeight: '700', color: s.color }}>{ko ? s.label.ko : s.label.en}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                      <Clock size={11} color={MUTED} />
                      <Text style={{ fontSize: 11, color: MUTED }}>{bid.submittedAt}</Text>
                    </View>
                  </View>
                </View>
                <ChevronRight size={16} color={MUTED} />
              </View>
              <Text style={{ fontSize: 12, color: '#6b7280', marginTop: 10, lineHeight: 18 }} numberOfLines={2}>
                {bid.message}
              </Text>
              {bid.interviewDate && (
                <View style={{ marginTop: 10, backgroundColor: '#eff6ff', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Clock size={13} color={PRIMARY} />
                  <Text style={{ fontSize: 12, fontWeight: '600', color: PRIMARY }}>{ko ? '인터뷰: ' : 'Interview: '}{bid.interviewDate}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}
