import { View, Text, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, MapPin, Clock, Globe, Star, CheckCircle } from 'lucide-react-native';
import { useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';

const PRIMARY = '#4A90D9';
const CARD_BG = '#fff';
const BORDER = '#f0f0f0';
const MUTED = '#9ca3af';
const FG = '#1a1a1a';

const CAREGIVERS = [
  { id: 1, name: 'Ji-yeon Park', role: 'Certified Nanny', rating: 4.9, reviews: 47, location: 'Gangnam-gu', distance: '1.2km', price: '$1,800/wk', languages: ['Korean', 'English'], tags: ['Infant Care', 'Bilingual', 'First Aid'], available: 'Mon–Fri 3pm–8pm', verified: true },
  { id: 2, name: 'Sarah Kim', role: 'Bilingual Babysitter', rating: 4.8, reviews: 33, location: 'Mapo-gu', distance: '2.4km', price: '$1,500/wk', languages: ['English', 'Korean'], tags: ['Toddler', 'Arts & Crafts', 'CPR Certified'], available: 'Weekends & Evenings', verified: true },
  { id: 3, name: 'Min-jun Lee', role: 'Postpartum Specialist', rating: 4.7, reviews: 89, location: 'Seodaemun-gu', distance: '3.1km', price: '$2,200/wk', languages: ['Korean'], tags: ['Newborn', 'Montessori', 'Licensed'], available: 'Mon–Fri 8am–6pm', verified: true },
];

export default function MatchTab() {
  const [activeFilter, setActiveFilter] = useState(0);
  const { t } = useLanguage();

  const filters = [
    t('match.filterAll'), t('match.filterBilingual'),
    t('match.filterWeekday'), t('match.filterInfant'), t('match.filterCertified'),
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fdf8f6' }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
        <View style={{ marginHorizontal: 16, marginTop: 16, marginBottom: 16 }}>
          <Text style={{ fontSize: 24, fontWeight: 'bold', color: FG }}>{t('match.title')}</Text>
          <Text style={{ color: MUTED, fontSize: 13, marginTop: 2 }}>{t('match.subtitle')}</Text>
        </View>

        {/* Search */}
        <View style={{ marginHorizontal: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: CARD_BG, borderWidth: 1, borderColor: BORDER, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12 }}>
          <Search size={16} color={MUTED} />
          <TextInput style={{ flex: 1, fontSize: 13, color: FG }} placeholder={t('match.placeholder')} placeholderTextColor={MUTED} />
        </View>

        {/* Filters */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8, marginBottom: 16 }}>
          {filters.map((f, idx) => (
            <TouchableOpacity
              key={f}
              onPress={() => setActiveFilter(idx)}
              style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, backgroundColor: activeFilter === idx ? PRIMARY : CARD_BG, borderColor: activeFilter === idx ? PRIMARY : BORDER }}
            >
              <Text style={{ fontSize: 12, fontWeight: '600', color: activeFilter === idx ? '#fff' : MUTED }}>{f}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Caregiver Cards */}
        <View style={{ marginHorizontal: 16, gap: 12 }}>
          {CAREGIVERS.map((c) => (
            <View key={c.id} style={{ backgroundColor: CARD_BG, borderRadius: 24, borderWidth: 1, borderColor: BORDER, padding: 16, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
                <View style={{ position: 'relative' }}>
                  <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: '#e0e7ff', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 24 }}>👩‍⚕️</Text>
                  </View>
                  {c.verified && (
                    <View style={{ position: 'absolute', bottom: -2, right: -2, backgroundColor: '#22c55e', borderRadius: 8, padding: 2 }}>
                      <CheckCircle size={12} color="#fff" />
                    </View>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={{ fontWeight: 'bold', fontSize: 14, color: FG }}>{c.name}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                      <Star size={12} color="#fbbf24" fill="#fbbf24" />
                      <Text style={{ fontSize: 12, fontWeight: '600', color: FG }}>{c.rating}</Text>
                      <Text style={{ fontSize: 11, color: MUTED }}>({c.reviews})</Text>
                    </View>
                  </View>
                  <Text style={{ fontSize: 12, color: MUTED, marginTop: 1 }}>{c.role}</Text>
                  <View style={{ flexDirection: 'row', gap: 12, marginTop: 6 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <MapPin size={11} color={MUTED} />
                      <Text style={{ fontSize: 11, color: MUTED }}>{c.distance}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Clock size={11} color={MUTED} />
                      <Text style={{ fontSize: 11, color: MUTED }}>{c.available.split(' ').slice(0, 2).join(' ')}</Text>
                    </View>
                  </View>
                </View>
              </View>

              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
                {c.languages.map((lang) => (
                  <View key={lang} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#eff6ff', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 }}>
                    <Globe size={10} color="#3b82f6" />
                    <Text style={{ fontSize: 11, fontWeight: '600', color: '#3b82f6' }}>{lang}</Text>
                  </View>
                ))}
                {c.tags.map((tag) => (
                  <View key={tag} style={{ backgroundColor: '#f3f4f6', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 }}>
                    <Text style={{ fontSize: 11, color: '#6b7280' }}>{tag}</Text>
                  </View>
                ))}
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: BORDER }}>
                <Text style={{ fontWeight: 'bold', fontSize: 14, color: PRIMARY }}>{c.price}</Text>
                <TouchableOpacity style={{ backgroundColor: PRIMARY, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 8 }}>
                  <Text style={{ color: '#fff', fontWeight: '600', fontSize: 12 }}>{t('match.viewProfile')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
