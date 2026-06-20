import { View, Text, TextInput, TouchableOpacity, Alert } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiFetch } from '../../../constants/api';

export default function BabyGrowth() {
  const router = useRouter();
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [headCirc, setHeadCirc] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSave() {
    if (!height && !weight) { Alert.alert('키 또는 몸무게를 입력해주세요'); return; }
    setLoading(true);
    try {
      await apiFetch('/logs', {
        method: 'POST',
        body: JSON.stringify({ category: 'baby', type: 'growth', timestamp: new Date().toISOString(), data: { height: Number(height), weight: Number(weight), headCirc: Number(headCirc) } }),
      });
    } catch {}
    setLoading(false);
    Alert.alert('저장 완료! / Saved!', '', [{ text: '확인', onPress: () => router.back() }]);
  }

  return (
    <SafeAreaView className="flex-1 bg-white px-6 pt-4">
      <View className="flex-row items-center gap-3 mb-6">
        <Text className="text-4xl">📏</Text>
        <View>
          <Text className="text-2xl font-bold text-gray-800">성장 기록</Text>
          <Text className="text-gray-400">Growth Measurement</Text>
        </View>
      </View>

      {[
        { label: '키 / Height (cm)', value: height, setter: setHeight, placeholder: '50.5' },
        { label: '몸무게 / Weight (kg)', value: weight, setter: setWeight, placeholder: '3.2' },
        { label: '머리둘레 / Head Circumference (cm)', value: headCirc, setter: setHeadCirc, placeholder: '34.0' },
      ].map(({ label, value, setter, placeholder }) => (
        <View key={label} className="mb-4">
          <Text className="text-sm font-semibold text-gray-600 mb-1">{label}</Text>
          <TextInput
            className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-base"
            value={value}
            onChangeText={setter}
            placeholder={placeholder}
            keyboardType="decimal-pad"
          />
        </View>
      ))}

      <TouchableOpacity onPress={handleSave} disabled={loading} className="bg-green-500 rounded-2xl py-4 items-center mt-4">
        <Text className="text-white text-lg font-bold">{loading ? '저장 중...' : '저장 / Save'}</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}
