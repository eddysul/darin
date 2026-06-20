import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiFetch } from '../../../constants/api';

export default function BabySleep() {
  const router = useRouter();
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  function calcDuration() {
    if (!startTime || !endTime) return null;
    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    const diff = (eh * 60 + em) - (sh * 60 + sm);
    return diff > 0 ? diff : null;
  }

  const duration = calcDuration();

  async function handleSave() {
    if (!startTime || !endTime) { Alert.alert('시작/종료 시간을 입력해주세요 / Enter start and end time'); return; }
    setLoading(true);
    try {
      await apiFetch('/logs', {
        method: 'POST',
        body: JSON.stringify({
          category: 'baby',
          type: 'sleep',
          timestamp: new Date().toISOString(),
          data: { startTime, endTime, duration, notes },
        }),
      });
    } catch {}
    setLoading(false);
    Alert.alert('저장 완료! / Saved!', '', [{ text: '확인', onPress: () => router.back() }]);
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView className="flex-1 px-6 pt-4">
        <View className="flex-row items-center gap-3 mb-6">
          <Text className="text-4xl">😴</Text>
          <View>
            <Text className="text-2xl font-bold text-gray-800">수면 기록</Text>
            <Text className="text-gray-400">Baby Sleep Log</Text>
          </View>
        </View>

        <View className="flex-row gap-4 mb-4">
          <View className="flex-1">
            <Text className="text-sm font-semibold text-gray-600 mb-1">시작 / Start (HH:MM)</Text>
            <TextInput
              className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-base text-center"
              value={startTime}
              onChangeText={setStartTime}
              placeholder="09:30"
              keyboardType="numbers-and-punctuation"
            />
          </View>
          <View className="flex-1">
            <Text className="text-sm font-semibold text-gray-600 mb-1">종료 / End (HH:MM)</Text>
            <TextInput
              className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-base text-center"
              value={endTime}
              onChangeText={setEndTime}
              placeholder="11:00"
              keyboardType="numbers-and-punctuation"
            />
          </View>
        </View>

        {duration !== null && (
          <View className="bg-purple-50 rounded-xl p-3 mb-4 items-center">
            <Text className="text-purple-600 font-bold text-lg">{duration}분 수면 / {duration} min sleep</Text>
          </View>
        )}

        <View className="mb-4">
          <Text className="text-sm font-semibold text-gray-600 mb-1">메모 / Notes</Text>
          <TextInput
            className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-base h-20"
            value={notes}
            onChangeText={setNotes}
            placeholder="특이사항..."
            multiline
          />
        </View>

        <TouchableOpacity onPress={handleSave} disabled={loading} className="bg-purple-500 rounded-2xl py-4 items-center mt-4 mb-8">
          <Text className="text-white text-lg font-bold">{loading ? '저장 중...' : '저장 / Save'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
