import { View, Text, TouchableOpacity, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { useApp } from '../context/AppContext';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function RoleSelector() {
  const router = useRouter();
  const { setRole } = useApp();

  function selectFamily() {
    setRole('family');
    router.push('/(family)/register');
  }

  function selectCaregiver() {
    setRole('caregiver');
    router.push('/(caregiver)/register');
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 items-center justify-center px-8">
        <Text className="text-4xl font-bold text-primary mb-2">Darin</Text>
        <Text className="text-base text-gray-500 mb-12 text-center">
          산후조리사 매칭 플랫폼{'\n'}Postpartum Care Matching
        </Text>

        <TouchableOpacity
          onPress={selectFamily}
          className="w-full bg-primary rounded-2xl py-6 mb-4 items-center"
        >
          <Text className="text-2xl mb-1">👨‍👩‍👧</Text>
          <Text className="text-white text-xl font-bold">가족 / Family</Text>
          <Text className="text-blue-100 text-sm mt-1">산후조리사를 찾고 있어요</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={selectCaregiver}
          className="w-full bg-secondary rounded-2xl py-6 items-center"
        >
          <Text className="text-2xl mb-1">👩‍⚕️</Text>
          <Text className="text-white text-xl font-bold">산후조리사 / Caregiver</Text>
          <Text className="text-orange-100 text-sm mt-1">가족을 도와드리고 싶어요</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
