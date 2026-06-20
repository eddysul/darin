import { View, Text, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

const LANGUAGES = ['한국어 Korean', '영어 English', '둘 다 Both'];
const LIVE_IN = ['입주 가능 Live-in', '출퇴근만 Live-out only'];
const SPECIALTIES = ['신생아 Newborn', '쌍둥이 Twins', '제왕절개 C-section', '고위험 산모 High-risk', '모유수유 Breastfeeding'];

export default function CaregiverRegister() {
  const router = useRouter();
  const [form, setForm] = useState({ name: '', experience: '', cert: '', location: '', price: '', bio: '' });
  const [languages, setLanguages] = useState<string[]>([]);
  const [liveIn, setLiveIn] = useState('');
  const [specialties, setSpecialties] = useState<string[]>([]);

  function toggleMulti(arr: string[], setArr: (v: string[]) => void, val: string) {
    setArr(arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val]);
  }

  function Field({ label, key, placeholder, multiline }: { label: string; key: keyof typeof form; placeholder?: string; multiline?: boolean }) {
    return (
      <View className="mb-4">
        <Text className="text-sm font-semibold text-gray-600 mb-1">{label}</Text>
        <TextInput
          className={`bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-base ${multiline ? 'h-24' : ''}`}
          placeholder={placeholder}
          value={form[key]}
          multiline={multiline}
          onChangeText={(v) => setForm((f) => ({ ...f, [key]: v }))}
        />
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView className="flex-1 px-6 pt-4">
        <Text className="text-2xl font-bold text-gray-800 mb-1">프로필 등록</Text>
        <Text className="text-gray-400 mb-6">Caregiver Registration</Text>

        <Field label="이름 / Name" key="name" placeholder="김영희" />
        <Field label="경력 / Years of Experience" key="experience" placeholder="8" />
        <Field label="자격증 / Certifications" key="cert" placeholder="산후조리사 1급" />
        <Field label="가능 지역 / Service Area" key="location" placeholder="Los Angeles, Irvine" />
        <Field label="예상 가격 / Expected Price (per week)" key="price" placeholder="$1,800" />

        <View className="mb-4">
          <Text className="text-sm font-semibold text-gray-600 mb-2">언어 / Languages</Text>
          <View className="flex-row flex-wrap gap-2">
            {LANGUAGES.map((l) => (
              <TouchableOpacity
                key={l}
                onPress={() => toggleMulti(languages, setLanguages, l)}
                className={`px-4 py-2 rounded-full border ${languages.includes(l) ? 'bg-secondary border-secondary' : 'border-gray-300 bg-white'}`}
              >
                <Text className={languages.includes(l) ? 'text-white font-semibold' : 'text-gray-600'}>{l}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View className="mb-4">
          <Text className="text-sm font-semibold text-gray-600 mb-2">입주 여부 / Live-in</Text>
          <View className="flex-row flex-wrap gap-2">
            {LIVE_IN.map((l) => (
              <TouchableOpacity
                key={l}
                onPress={() => setLiveIn(l)}
                className={`px-4 py-2 rounded-full border ${liveIn === l ? 'bg-secondary border-secondary' : 'border-gray-300 bg-white'}`}
              >
                <Text className={liveIn === l ? 'text-white font-semibold' : 'text-gray-600'}>{l}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View className="mb-4">
          <Text className="text-sm font-semibold text-gray-600 mb-2">전문 분야 / Specialties</Text>
          <View className="flex-row flex-wrap gap-2">
            {SPECIALTIES.map((s) => (
              <TouchableOpacity
                key={s}
                onPress={() => toggleMulti(specialties, setSpecialties, s)}
                className={`px-4 py-2 rounded-full border ${specialties.includes(s) ? 'bg-secondary border-secondary' : 'border-gray-300 bg-white'}`}
              >
                <Text className={specialties.includes(s) ? 'text-white font-semibold' : 'text-gray-600'}>{s}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <Field label="자기소개 / Bio" key="bio" placeholder="간단한 자기소개를 입력하세요..." multiline />

        <TouchableOpacity
          onPress={() => router.push('/(caregiver)/requests')}
          className="bg-secondary rounded-2xl py-4 items-center mt-2 mb-8"
        >
          <Text className="text-white text-lg font-bold">프로필 등록 완료 / Complete Profile</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
