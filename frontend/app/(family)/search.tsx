import { View, Text, TouchableOpacity, ScrollView, FlatList } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

const MOCK_CAREGIVERS = [
  { id: '1', name: '김영희', nameEn: 'Younghee Kim', experience: 8, language: '한국어 Korean', liveIn: true, price: 1800, specialty: '신생아 전문', rating: 4.9, reviews: 24, location: 'Los Angeles' },
  { id: '2', name: '박수진', nameEn: 'Sujin Park', experience: 5, language: '영어 English', liveIn: false, price: 1400, specialty: '쌍둥이 경험', rating: 4.7, reviews: 18, location: 'Irvine' },
  { id: '3', name: '이미경', nameEn: 'Mikyung Lee', experience: 12, language: '둘 다 Both', liveIn: true, price: 2200, specialty: '고위험 산모', rating: 5.0, reviews: 31, location: 'Torrance' },
  { id: '4', name: '최지영', nameEn: 'Jiyoung Choi', experience: 3, language: '한국어 Korean', liveIn: false, price: 1200, specialty: '초보 부모 케어', rating: 4.5, reviews: 9, location: 'Cerritos' },
  { id: '5', name: '정혜원', nameEn: 'Hyewon Jung', experience: 7, language: '둘 다 Both', liveIn: true, price: 1600, specialty: '제왕절개 회복', rating: 4.8, reviews: 22, location: 'Gardena' },
];

const FILTERS = ['전체 All', '한국어 Korean', '영어 English', '둘 다 Both'];
const EXPERIENCE = ['전체 All', '1-3년', '4-7년', '8년+'];

export default function SearchCaregivers() {
  const router = useRouter();
  const [langFilter, setLangFilter] = useState('전체 All');
  const [expFilter, setExpFilter] = useState('전체 All');
  const [liveInOnly, setLiveInOnly] = useState(false);

  const filtered = MOCK_CAREGIVERS.filter((c) => {
    if (langFilter !== '전체 All' && c.language !== langFilter) return false;
    if (liveInOnly && !c.liveIn) return false;
    if (expFilter === '1-3년' && c.experience > 3) return false;
    if (expFilter === '4-7년' && (c.experience < 4 || c.experience > 7)) return false;
    if (expFilter === '8년+' && c.experience < 8) return false;
    return true;
  });

  function FilterChips({ label, options, selected, onSelect }: { label: string; options: string[]; selected: string; onSelect: (v: string) => void }) {
    return (
      <View className="mb-3">
        <Text className="text-xs text-gray-500 mb-1 font-semibold">{label}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View className="flex-row gap-2">
            {options.map((opt) => (
              <TouchableOpacity
                key={opt}
                onPress={() => onSelect(opt)}
                className={`px-3 py-1.5 rounded-full border ${selected === opt ? 'bg-primary border-primary' : 'border-gray-300 bg-white'}`}
              >
                <Text className={`text-xs ${selected === opt ? 'text-white font-semibold' : 'text-gray-600'}`}>{opt}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="bg-white px-4 pt-4 pb-3 shadow-sm">
        <Text className="text-xl font-bold text-gray-800 mb-3">산후조리사 찾기 / Find Caregiver</Text>
        <FilterChips label="언어 Language" options={FILTERS} selected={langFilter} onSelect={setLangFilter} />
        <FilterChips label="경력 Experience" options={EXPERIENCE} selected={expFilter} onSelect={setExpFilter} />
        <TouchableOpacity
          onPress={() => setLiveInOnly(!liveInOnly)}
          className={`self-start px-3 py-1.5 rounded-full border mt-1 ${liveInOnly ? 'bg-primary border-primary' : 'border-gray-300 bg-white'}`}
        >
          <Text className={`text-xs ${liveInOnly ? 'text-white font-semibold' : 'text-gray-600'}`}>입주 가능 Live-in</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => router.push({ pathname: '/(family)/caregiver-detail', params: { id: item.id } })}
            className="bg-white rounded-2xl p-4 shadow-sm"
          >
            <View className="flex-row items-start justify-between">
              <View className="flex-row items-center gap-3">
                <View className="w-12 h-12 rounded-full bg-blue-100 items-center justify-center">
                  <Text className="text-xl">👩‍⚕️</Text>
                </View>
                <View>
                  <Text className="font-bold text-gray-800 text-base">{item.name}</Text>
                  <Text className="text-gray-400 text-xs">{item.nameEn}</Text>
                </View>
              </View>
              <View className="items-end">
                <Text className="text-primary font-bold">${item.price}<Text className="text-gray-400 text-xs font-normal">/wk</Text></Text>
                <Text className="text-yellow-500 text-xs">★ {item.rating} ({item.reviews})</Text>
              </View>
            </View>

            <View className="flex-row flex-wrap gap-2 mt-3">
              <View className="bg-blue-50 px-2 py-1 rounded-full">
                <Text className="text-primary text-xs">경력 {item.experience}년</Text>
              </View>
              <View className="bg-green-50 px-2 py-1 rounded-full">
                <Text className="text-green-600 text-xs">{item.language}</Text>
              </View>
              {item.liveIn && (
                <View className="bg-purple-50 px-2 py-1 rounded-full">
                  <Text className="text-purple-600 text-xs">입주 가능</Text>
                </View>
              )}
              <View className="bg-orange-50 px-2 py-1 rounded-full">
                <Text className="text-orange-600 text-xs">{item.specialty}</Text>
              </View>
            </View>

            <Text className="text-gray-400 text-xs mt-2">📍 {item.location}</Text>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}
