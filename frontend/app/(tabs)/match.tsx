import { View, Text, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, MapPin, Baby, DollarSign, Home, CheckCircle, Star, Globe, Sparkles } from 'lucide-react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { useLanguage } from '../../context/LanguageContext';
import { useApp } from '../../context/AppContext';
import { PARENTS } from '../../constants/parents';
import { CAREGIVER_MATCHES } from '../../constants/caregivers';

const NAVY = '#243036';
const GOLD = '#D9A441';
const CREAM = '#FFF4D8';
const CARD_BG = '#fff';
const BORDER = '#f0f0f0';
const MUTED = '#9ca3af';
const FG = '#1a1a1a';

const PARENT_FILTERS = { en: ['All', 'Live-in', 'Korean', 'Newborn', 'Verified'], ko: ['전체', '입주', '한국어', '신생아', '인증'] };
const CARER_FILTERS = { en: ['All', 'Bilingual', 'Weekday', 'Infant', 'Certified'], ko: ['전체', '이중언어', '주중', '신생아', '자격증'] };

export default function MatchTab() {
  const [activeFilter, setActiveFilter] = useState(0);
  const { locale } = useLanguage();
  const { role } = useApp();
  const ko = locale === 'ko';
  const router = useRouter();
  const isParent = role === 'parent';

  const filters = isParent
    ? (ko ? CARER_FILTERS.ko : CARER_FILTERS.en)
    : (ko ? PARENT_FILTERS.ko : PARENT_FILTERS.en);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFDF7' }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>

        {/* Header */}
        <View style={{ marginHorizontal: 16, marginTop: 16, marginBottom: 16, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <View>
            <Text style={{ fontSize: 24, fontWeight: 'bold', color: FG }}>
              {isParent ? (ko ? '케어기버 찾기' : 'Find Caregivers') : (ko ? '가족 찾기' : 'Find Families')}
            </Text>
            <Text style={{ color: MUTED, fontSize: 13, marginTop: 2 }}>
              {isParent
                ? (ko ? 'AI가 추천하는 산후조리사를 찾아보세요' : 'Browse AI-recommended caregivers')
                : (ko ? '돌봄을 원하는 가족을 찾아보세요' : 'Browse families looking for a caregiver')}
            </Text>
          </View>
          {isParent && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: CREAM, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 }}>
              <Sparkles size={11} color="#B8860B" />
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#B8860B' }}>{ko ? 'AI 추천' : 'AI Match'}</Text>
            </View>
          )}
        </View>

        {/* Search */}
        <View style={{ marginHorizontal: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: CARD_BG, borderWidth: 1, borderColor: BORDER, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12 }}>
          <Search size={16} color={MUTED} />
          <TextInput
            style={{ flex: 1, fontSize: 13, color: FG }}
            placeholder={isParent ? (ko ? '이름, 지역 검색' : 'Search by name or area') : (ko ? '지역, 요구사항 검색' : 'Search by area or requirement')}
            placeholderTextColor={MUTED}
          />
        </View>

        {/* Filters */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8, marginBottom: 16 }}>
          {filters.map((f, idx) => (
            <TouchableOpacity key={f} onPress={() => setActiveFilter(idx)} style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, backgroundColor: activeFilter === idx ? NAVY : CARD_BG, borderColor: activeFilter === idx ? NAVY : BORDER }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: activeFilter === idx ? '#fff' : MUTED }}>{f}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Cards */}
        <View style={{ marginHorizontal: 16, gap: 14 }}>
          {isParent ? (
            /* ── Caregiver cards for parents ── */
            CAREGIVER_MATCHES.map((c) => (
              <View key={c.id} style={{ backgroundColor: CARD_BG, borderRadius: 24, borderWidth: 1, borderColor: BORDER, padding: 16 }}>
                {/* Top row */}
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
                  <View style={{ position: 'relative' }}>
                    <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: '#e0e7ff', alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontSize: 26 }}>{c.avatar}</Text>
                    </View>
                    {c.verified && (
                      <View style={{ position: 'absolute', bottom: -2, right: -2, backgroundColor: '#6B9080', borderRadius: 8, padding: 2 }}>
                        <CheckCircle size={12} color="#fff" />
                      </View>
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Text style={{ fontWeight: 'bold', fontSize: 15, color: FG }}>{c.name}</Text>
                      <View style={{ backgroundColor: CREAM, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 }}>
                        <Text style={{ fontSize: 11, fontWeight: '800', color: '#B8860B' }}>{c.matchScore}% {ko ? '매칭' : 'match'}</Text>
                      </View>
                    </View>
                    <Text style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>{ko ? c.roleKo : c.role}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                        <Star size={11} color={GOLD} fill={GOLD} />
                        <Text style={{ fontSize: 11, color: MUTED }}>{c.rating} ({c.reviews})</Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                        <MapPin size={11} color={MUTED} />
                        <Text style={{ fontSize: 11, color: MUTED }}>{c.location}</Text>
                      </View>
                    </View>
                  </View>
                </View>

                {/* AI explanation */}
                <View style={{ backgroundColor: '#FFF9EB', borderRadius: 14, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: '#EFE4CF' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                    <Sparkles size={11} color={GOLD} />
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#B8860B' }}>{ko ? 'AI 추천 이유' : 'Why Recommended'}</Text>
                  </View>
                  <Text style={{ fontSize: 12, color: FG, lineHeight: 18 }}>{ko ? c.aiExplanationKo : c.aiExplanationEn}</Text>
                </View>

                {/* Match reasons */}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                  {c.matchReasons.map((r) => (
                    <View key={r} style={{ backgroundColor: '#f3f4f6', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 }}>
                      <Text style={{ fontSize: 11, color: '#6b7280' }}>{r}</Text>
                    </View>
                  ))}
                </View>

                {/* Languages */}
                <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12 }}>
                  {c.languages.map((l) => (
                    <View key={l} style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#F0F3FA', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 }}>
                      <Globe size={10} color="#6B7FA8" />
                      <Text style={{ fontSize: 11, fontWeight: '600', color: '#6B7FA8' }}>{l === 'Korean' ? '한국어' : 'English'}</Text>
                    </View>
                  ))}
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, borderTopWidth: 1, borderTopColor: BORDER }}>
                  <Text style={{ fontWeight: 'bold', color: '#B8860B', fontSize: 15 }}>{c.price}</Text>
                  <TouchableOpacity style={{ backgroundColor: NAVY, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 8 }}>
                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>{ko ? '프로필 보기' : 'View Profile'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          ) : (
            /* ── Parent cards for caregivers ── */
            PARENTS.map((p) => (
              <TouchableOpacity key={p.id} activeOpacity={0.85} onPress={() => router.push(`/(tabs)/parent/${p.id}`)} style={{ backgroundColor: CARD_BG, borderRadius: 24, borderWidth: 1, borderColor: BORDER, padding: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
                  <View style={{ position: 'relative' }}>
                    <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: '#fce7f3', alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontSize: 26 }}>{p.avatar}</Text>
                    </View>
                    {p.verified && (
                      <View style={{ position: 'absolute', bottom: -2, right: -2, backgroundColor: '#22c55e', borderRadius: 8, padding: 2 }}>
                        <CheckCircle size={12} color="#fff" />
                      </View>
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: 'bold', fontSize: 15, color: FG }}>{ko ? p.name.ko : p.name.en}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 }}>
                      <MapPin size={11} color={MUTED} />
                      <Text style={{ fontSize: 12, color: MUTED }}>{p.location}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
                      {p.languages.map((l) => (
                        <View key={l} style={{ backgroundColor: '#eff6ff', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 }}>
                          <Text style={{ fontSize: 11, fontWeight: '600', color: '#3b82f6' }}>{l === 'Korean' ? '🇰🇷 한국어' : '🇺🇸 English'}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                </View>

                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
                  <View style={{ flex: 1, backgroundColor: '#FFFDF7', borderRadius: 12, padding: 10, gap: 3 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                      <Baby size={12} color="#ec4899" />
                      <Text style={{ fontSize: 10, color: MUTED, fontWeight: '600' }}>{ko ? '출산 예정일' : 'Due Date'}</Text>
                    </View>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: FG }}>{ko ? p.dueDate.ko : p.dueDate.en}</Text>
                  </View>
                  <View style={{ flex: 1, backgroundColor: '#FFFDF7', borderRadius: 12, padding: 10, gap: 3 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                      <DollarSign size={12} color="#22c55e" />
                      <Text style={{ fontSize: 10, color: MUTED, fontWeight: '600' }}>{ko ? '예산' : 'Budget'}</Text>
                    </View>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: FG }}>{p.budget}</Text>
                  </View>
                  <View style={{ flex: 1, backgroundColor: '#FFFDF7', borderRadius: 12, padding: 10, gap: 3 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                      <Home size={12} color="#8b5cf6" />
                      <Text style={{ fontSize: 10, color: MUTED, fontWeight: '600' }}>{ko ? '입주' : 'Live-in'}</Text>
                    </View>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: FG }}>{p.liveIn ? (ko ? '입주' : 'Yes') : (ko ? '출퇴근' : 'No')}</Text>
                  </View>
                </View>

                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                  {p.newbornExp && <View style={{ backgroundColor: 'rgba(36,48,54,0.08)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 }}><Text style={{ fontSize: 11, fontWeight: '600', color: NAVY }}>{ko ? '신생아 경험 필수' : 'Newborn exp.'}</Text></View>}
                  {p.nonSmoker && <View style={{ backgroundColor: 'rgba(36,48,54,0.08)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 }}><Text style={{ fontSize: 11, fontWeight: '600', color: NAVY }}>{ko ? '비흡연' : 'Non-smoker'}</Text></View>}
                  {p.breastfeeding && <View style={{ backgroundColor: 'rgba(36,48,54,0.08)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 }}><Text style={{ fontSize: 11, fontWeight: '600', color: NAVY }}>{ko ? '모유수유 지원' : 'Breastfeeding'}</Text></View>}
                </View>

                <Text style={{ fontSize: 12, color: '#6b7280', lineHeight: 18, marginBottom: 12 }}>{ko ? p.notes.ko : p.notes.en}</Text>

                <View style={{ backgroundColor: NAVY, borderRadius: 14, paddingVertical: 12, alignItems: 'center' }}>
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>{ko ? '프로필 보기 · 입찰하기' : 'View Profile & Bid'}</Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}
