import { View, Text, TextInput, TouchableOpacity, Alert } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiFetch } from '../../../constants/api';

export default function MotherRest() {
  const router = useRouter();
  const [duration, setDuration] = useState('');
  const [quality, setQuality] = useState(0);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSave() {
    if (!duration) { Alert.alert('휴식 시간을 입력해주세요 / Enter rest duration'); return; }
    setLoading(true);
    try {
      await apiFetch('/logs', {
        method: 'POST',
        body: JSON.stringify({ category: 'mother', type: 'rest', timestamp: new Date().toISOString(), data: { duration: Number(duration), quality, notes } }),
      });
    } catch {}
    setLoading(false);
    Alert.alert('저장 완료! / Saved!', '', [{ text: '확인', onPress: () => router.back() }]);
  }

  return (
    <SafeAreaView className="flex-1 bg-white px-6 pt-4">
      <View className="flex-row items-center gap-3 mb-6">
        <Text className="text-4xl">💤</Text>
        <View>
          <Text className="text-2xl font-bold text-gray-800">산모 휴식</Text>
          <Text className="text-gray-400">Mother Rest Log</Text>
        </View>
      </View>

      <View className="mb-4">
        <Text className="text-sm font-semibold text-gray-600 mb-1">휴식 시간 / Duration (시간 hours)</Text>
        <TextInput
          className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-base"
          value={duration}
          onChangeText={setDuration}
          placeholder="2"
          keyboardType="decimal-pad"
        />
      </View>

      <Text className="text-sm font-semibold text-gray-600 mb-2">휴식 질 / Rest Quality (1–5)</Text>
      <View className="flex-row gap-2 mb-5">
        {[1, 2, 3, 4, 5].map((n) => (
          <TouchableOpacity
            key={n}
            onPress={() => setQuality(n)}
            className={`w-12 h-12 rounded-full items-center justify-center border-2 ${quality === n ? 'bg-orange-400 border-orange-400' : 'border-gray-200 bg-white'}`}
          >
            <Text className={quality === n ? 'text-white font-bold' : 'text-gray-600'}>{n}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View className="flex-row justify-between mb-5">
        <Text className="text-xs text-gray-400">매우 나쁨 Very Poor</Text>
        <Text className="text-xs text-gray-400">매우 좋음 Excellent</Text>
      </View>

      <View className="mb-6">
        <Text className="text-sm font-semibold text-gray-600 mb-1">메모 / Notes</Text>
        <TextInput
          className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-base h-20"
          value={notes}
          onChangeText={setNotes}
          placeholder="특이사항..."
          multiline
        />
      </View>

      <TouchableOpacity onPress={handleSave} disabled={loading} className="bg-orange-400 rounded-2xl py-4 items-center">
        <Text className="text-white text-lg font-bold">{loading ? '저장 중...' : '저장 / Save'}</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}
