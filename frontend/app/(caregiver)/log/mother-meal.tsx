import { View, Text, TouchableOpacity, TextInput, Alert } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiFetch } from '../../../constants/api';

const MEAL_TYPES = ['아침 Breakfast', '점심 Lunch', '저녁 Dinner', '간식 Snack'];

export default function MotherMeal() {
  const router = useRouter();
  const [mealType, setMealType] = useState('');
  const [notes, setNotes] = useState('');
  const [appetite, setAppetite] = useState(0);
  const [loading, setLoading] = useState(false);

  async function handleSave() {
    if (!mealType) { Alert.alert('식사 유형을 선택해주세요 / Select meal type'); return; }
    setLoading(true);
    try {
      await apiFetch('/logs', {
        method: 'POST',
        body: JSON.stringify({ category: 'mother', type: 'meal', timestamp: new Date().toISOString(), data: { mealType, notes, appetite } }),
      });
    } catch {}
    setLoading(false);
    Alert.alert('저장 완료! / Saved!', '', [{ text: '확인', onPress: () => router.back() }]);
  }

  return (
    <SafeAreaView className="flex-1 bg-white px-6 pt-4">
      <View className="flex-row items-center gap-3 mb-6">
        <Text className="text-4xl">🍲</Text>
        <View>
          <Text className="text-2xl font-bold text-gray-800">산모 식사</Text>
          <Text className="text-gray-400">Mother Meal Log</Text>
        </View>
      </View>

      <Text className="text-sm font-semibold text-gray-600 mb-2">식사 유형 / Meal Type</Text>
      <View className="flex-row flex-wrap gap-2 mb-5">
        {MEAL_TYPES.map((m) => (
          <TouchableOpacity
            key={m}
            onPress={() => setMealType(m)}
            className={`px-4 py-2 rounded-full border-2 ${mealType === m ? 'bg-rose-500 border-rose-500' : 'border-gray-200 bg-white'}`}
          >
            <Text className={mealType === m ? 'text-white font-bold' : 'text-gray-600'}>{m}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text className="text-sm font-semibold text-gray-600 mb-2">식욕 / Appetite (1–5)</Text>
      <View className="flex-row gap-2 mb-5">
        {[1, 2, 3, 4, 5].map((n) => (
          <TouchableOpacity
            key={n}
            onPress={() => setAppetite(n)}
            className={`w-12 h-12 rounded-full items-center justify-center border-2 ${appetite === n ? 'bg-rose-500 border-rose-500' : 'border-gray-200 bg-white'}`}
          >
            <Text className={appetite === n ? 'text-white font-bold' : 'text-gray-600'}>{n}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text className="text-sm font-semibold text-gray-600 mb-1">메뉴 및 메모 / Menu & Notes</Text>
      <TextInput
        className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-base h-24 mb-6"
        value={notes}
        onChangeText={setNotes}
        placeholder="미역국, 밥, 불고기..."
        multiline
      />

      <TouchableOpacity onPress={handleSave} disabled={loading} className="bg-rose-500 rounded-2xl py-4 items-center">
        <Text className="text-white text-lg font-bold">{loading ? '저장 중...' : '저장 / Save'}</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}
