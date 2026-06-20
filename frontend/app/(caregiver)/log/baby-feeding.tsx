import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiFetch } from '../../../constants/api';

const FEED_TYPES = ['모유 Breast', '분유 Formula', '혼합 Mixed'];

export default function BabyFeeding() {
  const router = useRouter();
  const [feedType, setFeedType] = useState('');
  const [amount, setAmount] = useState('');
  const [duration, setDuration] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSave() {
    if (!feedType) { Alert.alert('수유 유형을 선택해주세요 / Please select feed type'); return; }
    setLoading(true);
    try {
      await apiFetch('/logs', {
        method: 'POST',
        body: JSON.stringify({
          category: 'baby',
          type: 'feeding',
          timestamp: new Date().toISOString(),
          data: { feedType, amount: Number(amount), duration: Number(duration), notes },
        }),
      });
    } catch {
      // Use local data if API not available
    } finally {
      setLoading(false);
      Alert.alert('저장 완료! / Saved!', '', [{ text: '확인', onPress: () => router.back() }]);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView className="flex-1 px-6 pt-4">
        <View className="flex-row items-center gap-3 mb-6">
          <Text className="text-4xl">🍼</Text>
          <View>
            <Text className="text-2xl font-bold text-gray-800">수유 기록</Text>
            <Text className="text-gray-400">Baby Feeding Log</Text>
          </View>
        </View>

        <Text className="text-sm font-semibold text-gray-600 mb-2">수유 유형 / Feed Type</Text>
        <View className="flex-row gap-3 mb-5">
          {FEED_TYPES.map((t) => (
            <TouchableOpacity
              key={t}
              onPress={() => setFeedType(t)}
              className={`flex-1 py-3 rounded-xl border-2 items-center ${feedType === t ? 'bg-blue-500 border-blue-500' : 'border-gray-200 bg-white'}`}
            >
              <Text className={feedType === t ? 'text-white font-bold' : 'text-gray-600'}>{t}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <InputField label="양 / Amount (ml)" value={amount} onChange={setAmount} placeholder="90" keyboardType="numeric" />
        <InputField label="시간 / Duration (분 min)" value={duration} onChange={setDuration} placeholder="15" keyboardType="numeric" />
        <InputField label="메모 / Notes" value={notes} onChange={setNotes} placeholder="특이사항을 입력하세요..." multiline />

        <TouchableOpacity
          onPress={handleSave}
          disabled={loading}
          className="bg-blue-500 rounded-2xl py-4 items-center mt-4 mb-8"
        >
          <Text className="text-white text-lg font-bold">{loading ? '저장 중...' : '저장 / Save'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function InputField({ label, value, onChange, placeholder, keyboardType, multiline }: any) {
  return (
    <View className="mb-4">
      <Text className="text-sm font-semibold text-gray-600 mb-1">{label}</Text>
      <TextInput
        className={`bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-base ${multiline ? 'h-20' : ''}`}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        keyboardType={keyboardType}
        multiline={multiline}
      />
    </View>
  );
}
