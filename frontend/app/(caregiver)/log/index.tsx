import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

const LOG_TYPES = [
  { key: 'baby-feeding', icon: '🍼', label: '수유', sublabel: 'Feeding', color: 'bg-blue-50 border-blue-200' },
  { key: 'baby-sleep', icon: '😴', label: '수면', sublabel: 'Sleep', color: 'bg-purple-50 border-purple-200' },
  { key: 'baby-diaper', icon: '👶', label: '기저귀', sublabel: 'Diaper', color: 'bg-yellow-50 border-yellow-200' },
  { key: 'baby-growth', icon: '📏', label: '성장', sublabel: 'Growth', color: 'bg-green-50 border-green-200' },
  { key: 'mother-meal', icon: '🍲', label: '산모 식사', sublabel: 'Mother Meal', color: 'bg-rose-50 border-rose-200' },
  { key: 'mother-rest', icon: '💤', label: '산모 휴식', sublabel: 'Mother Rest', color: 'bg-orange-50 border-orange-200' },
];

export default function LogTypePicker() {
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 px-6 pt-6">
        <Text className="text-2xl font-bold text-gray-800 mb-1">기록 추가</Text>
        <Text className="text-gray-400 mb-6">Add Log Entry</Text>

        <View className="flex-row flex-wrap gap-4">
          {LOG_TYPES.map((type) => (
            <TouchableOpacity
              key={type.key}
              onPress={() => router.push(`/(caregiver)/log/${type.key}` as any)}
              className={`w-[46%] border-2 rounded-2xl p-5 items-center ${type.color}`}
            >
              <Text className="text-4xl mb-2">{type.icon}</Text>
              <Text className="font-bold text-gray-800 text-base">{type.label}</Text>
              <Text className="text-gray-500 text-xs">{type.sublabel}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}
