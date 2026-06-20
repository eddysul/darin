import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiFetch } from '../../constants/api';

interface Log {
  id: string;
  category: 'baby' | 'mother';
  type: string;
  timestamp: string;
  data: Record<string, any>;
}

const MOCK_LOGS: Log[] = [
  { id: '1', category: 'baby', type: 'feeding', timestamp: new Date(Date.now() - 7200000).toISOString(), data: { feedType: '모유', amount: 90, duration: 15 } },
  { id: '2', category: 'baby', type: 'sleep', timestamp: new Date(Date.now() - 5400000).toISOString(), data: { duration: 120 } },
  { id: '3', category: 'mother', type: 'meal', timestamp: new Date(Date.now() - 3600000).toISOString(), data: { mealType: '점심', notes: '미역국, 밥' } },
];

const LOG_ICONS: Record<string, string> = {
  feeding: '🍼', sleep: '😴', diaper: '👶', growth: '📏',
  meal: '🍲', rest: '💤',
};

const LOG_LABELS: Record<string, string> = {
  feeding: '수유 Feeding', sleep: '수면 Sleep', diaper: '기저귀 Diaper', growth: '성장 Growth',
  meal: '산모 식사 Meal', rest: '산모 휴식 Rest',
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
}

function logSummary(log: Log) {
  const { type, data } = log;
  if (type === 'feeding') return `${data.feedType} · ${data.amount}ml · ${data.duration}분`;
  if (type === 'sleep') return `${data.duration}분 수면`;
  if (type === 'diaper') return data.diaperType;
  if (type === 'growth') return `키 ${data.height}cm · ${data.weight}kg`;
  if (type === 'meal') return `${data.mealType} · ${data.notes}`;
  if (type === 'rest') return `${data.duration}시간 · 컨디션 ${data.quality}/5`;
  return '';
}

export default function CaregiverDashboard() {
  const [logs, setLogs] = useState<Log[]>(MOCK_LOGS);
  const router = useRouter();

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    apiFetch(`/logs?date=${today}`).then(setLogs).catch(() => {});
  }, []);

  const sorted = [...logs].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="bg-secondary px-6 pt-4 pb-4">
        <Text className="text-white text-xl font-bold">오늘의 케어 / Today's Care</Text>
        <Text className="text-orange-100 text-sm">
          {new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })} · {logs.length}개 기록
        </Text>
      </View>

      <ScrollView className="flex-1 px-4 pt-4">
        {/* Quick stats */}
        <View className="flex-row gap-3 mb-4">
          <StatCard icon="🍼" label="수유" count={logs.filter(l => l.type === 'feeding').length} />
          <StatCard icon="😴" label="수면" count={logs.filter(l => l.type === 'sleep').length} />
          <StatCard icon="👶" label="기저귀" count={logs.filter(l => l.type === 'diaper').length} />
          <StatCard icon="🌸" label="산모" count={logs.filter(l => l.category === 'mother').length} />
        </View>

        <Text className="font-bold text-gray-700 mb-2">오늘 기록 / Today's Log</Text>
        {sorted.length === 0 && (
          <Text className="text-gray-400 text-sm text-center py-8">아직 기록이 없습니다\nNo entries yet</Text>
        )}
        {sorted.map((log) => (
          <View key={log.id} className="bg-white rounded-xl p-3 mb-2 flex-row items-center shadow-sm">
            <Text className="text-2xl mr-3">{LOG_ICONS[log.type] ?? '📝'}</Text>
            <View className="flex-1">
              <Text className="font-semibold text-gray-800 text-sm">{LOG_LABELS[log.type] ?? log.type}</Text>
              <Text className="text-gray-500 text-xs mt-0.5">{logSummary(log)}</Text>
            </View>
            <Text className="text-gray-400 text-xs">{formatTime(log.timestamp)}</Text>
          </View>
        ))}
        <View className="h-24" />
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        onPress={() => router.push('/(caregiver)/log/')}
        className="absolute bottom-8 right-6 w-16 h-16 bg-secondary rounded-full items-center justify-center shadow-lg"
      >
        <Text className="text-white text-3xl font-light">+</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

function StatCard({ icon, label, count }: { icon: string; label: string; count: number }) {
  return (
    <View className="flex-1 bg-white rounded-xl py-3 items-center shadow-sm">
      <Text className="text-xl">{icon}</Text>
      <Text className="text-lg font-bold text-gray-800">{count}</Text>
      <Text className="text-gray-400 text-xs">{label}</Text>
    </View>
  );
}
