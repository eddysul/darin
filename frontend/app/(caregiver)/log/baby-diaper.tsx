import { View, Text, TouchableOpacity, TextInput, Alert } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiFetch } from '../../../constants/api';

const DIAPER_TYPES = [
  { key: '젖은 Wet', icon: '💧', color: 'bg-blue-50 border-blue-300' },
  { key: '대변 Dirty', icon: '💩', color: 'bg-yellow-50 border-yellow-400' },
  { key: '혼합 Mixed', icon: '🔄', color: 'bg-green-50 border-green-300' },
];

export default function BabyDiaper() {
  const router = useRouter();
  const [diaperType, setDiaperType] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSave() {
    if (!diaperType) { Alert.alert('유형을 선택해주세요 / Select diaper type'); return; }
    setLoading(true);
    try {
      await apiFetch('/logs', {
        method: 'POST',
        body: JSON.stringify({ category: 'baby', type: 'diaper', timestamp: new Date().toISOString(), data: { diaperType, notes } }),
      });
    } catch {}
    setLoading(false);
    Alert.alert('저장 완료! / Saved!', '', [{ text: '확인', onPress: () => router.back() }]);
  }

  return (
    <SafeAreaView className="flex-1 bg-white px-6 pt-4">
      <View className="flex-row items-center gap-3 mb-6">
        <Text className="text-4xl">👶</Text>
        <View>
          <Text className="text-2xl font-bold text-gray-800">기저귀 기록</Text>
          <Text className="text-gray-400">Diaper Log</Text>
        </View>
      </View>

      <Text className="text-sm font-semibold text-gray-600 mb-3">유형 / Type</Text>
      <View className="flex-row gap-3 mb-6">
        {DIAPER_TYPES.map((d) => (
          <TouchableOpacity
            key={d.key}
            onPress={() => setDiaperType(d.key)}
            className={`flex-1 py-6 rounded-2xl border-2 items-center ${diaperType === d.key ? d.color : 'border-gray-200 bg-white'}`}
          >
            <Text className="text-3xl mb-1">{d.icon}</Text>
            <Text className="text-xs text-gray-700 text-center font-semibold">{d.key}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text className="text-sm font-semibold text-gray-600 mb-1">메모 / Notes</Text>
      <TextInput
        className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-base h-20 mb-6"
        value={notes}
        onChangeText={setNotes}
        placeholder="특이사항..."
        multiline
      />

      <TouchableOpacity onPress={handleSave} disabled={loading} className="bg-yellow-500 rounded-2xl py-4 items-center">
        <Text className="text-white text-lg font-bold">{loading ? '저장 중...' : '저장 / Save'}</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}
