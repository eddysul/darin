import { View, Text, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

const LANGUAGES = ['한국어 Korean', '영어 English', '둘 다 Both'];
const LIVE_IN = ['입주 Live-in', '출퇴근 Live-out'];

export default function FamilyRegister() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: '',
    babyDueDate: '',
    location: '',
    language: '',
    budget: '',
    liveIn: '',
    duration: '',
  });

  function Field({ label, key, placeholder }: { label: string; key: keyof typeof form; placeholder?: string }) {
    return (
      <View className="mb-4">
        <Text className="text-sm font-semibold text-gray-600 mb-1">{label}</Text>
        <TextInput
          className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-base"
          placeholder={placeholder}
          value={form[key]}
          onChangeText={(v) => setForm((f) => ({ ...f, [key]: v }))}
        />
      </View>
    );
  }

  function ChipGroup({ label, options, selected, onSelect }: { label: string; options: string[]; selected: string; onSelect: (v: string) => void }) {
    return (
      <View className="mb-4">
        <Text className="text-sm font-semibold text-gray-600 mb-2">{label}</Text>
        <View className="flex-row flex-wrap gap-2">
          {options.map((opt) => (
            <TouchableOpacity
              key={opt}
              onPress={() => onSelect(opt)}
              className={`px-4 py-2 rounded-full border ${selected === opt ? 'bg-primary border-primary' : 'border-gray-300 bg-white'}`}
            >
              <Text className={selected === opt ? 'text-white font-semibold' : 'text-gray-600'}>{opt}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView className="flex-1 px-6 pt-4">
        <Text className="text-2xl font-bold text-gray-800 mb-1">가족 등록</Text>
        <Text className="text-gray-400 mb-6">Family Registration</Text>

        <Field label="이름 / Name" key="name" placeholder="김민수" />
        <Field label="아기 출산 예정일 / Baby Due Date" key="babyDueDate" placeholder="2026-08-01" />
        <Field label="위치 / Location (City)" key="location" placeholder="Los Angeles, CA" />
        <Field label="희망 기간 / Care Duration" key="duration" placeholder="4주 / 4 weeks" />
        <Field label="예산 / Budget (per week)" key="budget" placeholder="$1,500" />

        <ChipGroup
          label="선호 언어 / Preferred Language"
          options={LANGUAGES}
          selected={form.language}
          onSelect={(v) => setForm((f) => ({ ...f, language: v }))}
        />
        <ChipGroup
          label="입주 여부 / Live-in Preference"
          options={LIVE_IN}
          selected={form.liveIn}
          onSelect={(v) => setForm((f) => ({ ...f, liveIn: v }))}
        />

        <TouchableOpacity
          onPress={() => router.push('/(family)/search')}
          className="bg-primary rounded-2xl py-4 items-center mt-4 mb-8"
        >
          <Text className="text-white text-lg font-bold">산후조리사 찾기 / Find Caregiver</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
