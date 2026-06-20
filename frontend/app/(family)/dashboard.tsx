import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
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
  { id: '4', category: 'baby', type: 'diaper', timestamp: new Date(Date.now() - 1800000).toISOString(), data: { diaperType: '젖은' } },
];

const LOG_ICONS: Record<string, string> = {
  feeding: '🍼', sleep: '😴', diaper: '👶', growth: '📏',
  meal: '🍲', rest: '💤',
};

const LOG_LABELS: Record<string, string> = {
  feeding: '수유 Feeding', sleep: '수면 Sleep', diaper: '기저귀 Diaper', growth: '성장 Growth',
  meal: '산모 식사 Mother Meal', rest: '산모 휴식 Mother Rest',
};

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
}

function logSummary(log: Log) {
  const { type, data } = log;
  if (type === 'feeding') return `${data.feedType} · ${data.amount}ml · ${data.duration}분`;
  if (type === 'sleep') return `${data.duration}분 수면`;
  if (type === 'diaper') return `${data.diaperType}`;
  if (type === 'growth') return `키 ${data.height}cm · 몸무게 ${data.weight}kg`;
  if (type === 'meal') return `${data.mealType} · ${data.notes}`;
  if (type === 'rest') return `${data.duration}시간 휴식 · 컨디션 ${data.quality}/5`;
  return '';
}

export default function FamilyDashboard() {
  const [logs, setLogs] = useState<Log[]>(MOCK_LOGS);
  const [suggestion, setSuggestion] = useState<string>('아기의 수유 간격이 규칙적입니다. 다음 수유는 약 3시간 후에 예정되어 있습니다. The baby\'s feeding schedule is regular. Next feeding is due in about 3 hours.');
  const router = useRouter();

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    apiFetch(`/logs?date=${today}`)
      .then(setLogs)
      .catch(() => {});
    apiFetch('/suggestions')
      .then((d) => setSuggestion(d.suggestion))
      .catch(() => {});
  }, []);

  const sorted = [...logs].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  const babyLogs = sorted.filter((l) => l.category === 'baby');
  const motherLogs = sorted.filter((l) => l.category === 'mother');

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="bg-primary px-6 pt-4 pb-4">
        <Text className="text-white text-xl font-bold">오늘의 케어 / Today's Care</Text>
        <Text className="text-blue-100 text-sm">{new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}</Text>
      </View>

      <ScrollView className="flex-1 px-4 pt-4">
        {/* AI Suggestion */}
        <View className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 mb-4">
          <Text className="text-yellow-800 font-bold mb-1">💡 AI 제안 / AI Suggestion</Text>
          <Text className="text-yellow-700 text-sm leading-5">{suggestion}</Text>
        </View>

        {/* Baby Logs */}
        <Text className="font-bold text-gray-700 mb-2">👶 아기 기록 / Baby Logs ({babyLogs.length})</Text>
        {babyLogs.length === 0 && <Text className="text-gray-400 text-sm mb-4">아직 기록이 없습니다</Text>}
        {babyLogs.map((log) => (
          <LogCard key={log.id} log={log} />
        ))}

        <Text className="font-bold text-gray-700 mt-4 mb-2">🌸 산모 기록 / Mother Logs ({motherLogs.length})</Text>
        {motherLogs.length === 0 && <Text className="text-gray-400 text-sm mb-4">아직 기록이 없습니다</Text>}
        {motherLogs.map((log) => (
          <LogCard key={log.id} log={log} />
        ))}

        <View className="h-8" />
      </ScrollView>
    </SafeAreaView>
  );
}

function LogCard({ log }: { log: Log }) {
  return (
    <View className="bg-white rounded-xl p-3 mb-2 flex-row items-center shadow-sm">
      <Text className="text-2xl mr-3">{LOG_ICONS[log.type] ?? '📝'}</Text>
      <View className="flex-1">
        <Text className="font-semibold text-gray-800 text-sm">{LOG_LABELS[log.type] ?? log.type}</Text>
        <Text className="text-gray-500 text-xs mt-0.5">{logSummary(log)}</Text>
      </View>
      <Text className="text-gray-400 text-xs">{formatTime(log.timestamp)}</Text>
    </View>
  );
}
