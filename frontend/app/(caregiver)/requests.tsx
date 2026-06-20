import { View, Text, TouchableOpacity, FlatList, Alert } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

const MOCK_REQUESTS = [
  { id: '1', familyName: '김민수 가족', location: 'Los Angeles', startDate: '2026-07-01', duration: '4주', budget: '$1,800/wk', language: '한국어', liveIn: true, babyDue: '2026-06-25', status: 'pending' },
  { id: '2', familyName: '이준혁 가족', location: 'Irvine', startDate: '2026-07-15', duration: '3주', budget: '$1,600/wk', language: '둘 다', liveIn: false, babyDue: '2026-07-10', status: 'pending' },
  { id: '3', familyName: '박서연 가족', location: 'Torrance', startDate: '2026-08-01', duration: '6주', budget: '$2,000/wk', language: '한국어', liveIn: true, babyDue: '2026-07-28', status: 'pending' },
];

export default function CaregiverRequests() {
  const router = useRouter();
  const [requests, setRequests] = useState(MOCK_REQUESTS);

  function handleAccept(id: string, familyName: string) {
    Alert.alert(
      '매칭 수락 / Accept Match',
      `${familyName}의 견적을 수락하시겠습니까?\nAccept quote request from ${familyName}?`,
      [
        { text: '취소 Cancel', style: 'cancel' },
        {
          text: '수락 Accept',
          onPress: () => {
            setRequests((prev) => prev.map((r) => r.id === id ? { ...r, status: 'accepted' } : r));
            Alert.alert('매칭 완료!', '가족과 연결되었습니다. 케어를 시작하세요!\nYou are now matched! Start logging care.', [
              { text: '대시보드 / Dashboard', onPress: () => router.push('/(caregiver)/dashboard') },
            ]);
          },
        },
      ]
    );
  }

  function handleDecline(id: string) {
    setRequests((prev) => prev.filter((r) => r.id !== id));
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="bg-secondary px-6 pt-4 pb-4">
        <Text className="text-white text-xl font-bold">견적 요청 / Quote Requests</Text>
        <Text className="text-orange-100 text-sm">{requests.filter(r => r.status === 'pending').length}개 대기중</Text>
      </View>

      <FlatList
        data={requests}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        renderItem={({ item }) => (
          <View className="bg-white rounded-2xl p-4 shadow-sm">
            <View className="flex-row items-center justify-between mb-3">
              <View className="flex-row items-center gap-2">
                <Text className="text-2xl">👨‍👩‍👧</Text>
                <View>
                  <Text className="font-bold text-gray-800">{item.familyName}</Text>
                  <Text className="text-gray-400 text-xs">📍 {item.location}</Text>
                </View>
              </View>
              {item.status === 'accepted' && (
                <View className="bg-green-100 px-3 py-1 rounded-full">
                  <Text className="text-green-600 text-xs font-bold">✓ 수락됨</Text>
                </View>
              )}
            </View>

            <View className="bg-gray-50 rounded-xl p-3 mb-3 gap-1">
              <InfoRow label="아기 출생 예정" value={item.babyDue} />
              <InfoRow label="시작일 Start" value={item.startDate} />
              <InfoRow label="기간 Duration" value={item.duration} />
              <InfoRow label="예산 Budget" value={item.budget} />
              <InfoRow label="언어 Language" value={item.language} />
              <InfoRow label="입주 Live-in" value={item.liveIn ? '희망 Yes' : '불필요 No'} />
            </View>

            {item.status === 'pending' && (
              <View className="flex-row gap-3">
                <TouchableOpacity
                  onPress={() => handleDecline(item.id)}
                  className="flex-1 border border-gray-300 rounded-xl py-3 items-center"
                >
                  <Text className="text-gray-600 font-semibold">거절 Decline</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleAccept(item.id, item.familyName)}
                  className="flex-1 bg-secondary rounded-xl py-3 items-center"
                >
                  <Text className="text-white font-bold">수락 Accept</Text>
                </TouchableOpacity>
              </View>
            )}

            {item.status === 'accepted' && (
              <TouchableOpacity
                onPress={() => router.push('/(caregiver)/dashboard')}
                className="bg-primary rounded-xl py-3 items-center"
              >
                <Text className="text-white font-bold">케어 기록하기 / Start Logging</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      />
    </SafeAreaView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between">
      <Text className="text-gray-500 text-xs">{label}</Text>
      <Text className="text-gray-800 text-xs font-semibold">{value}</Text>
    </View>
  );
}
