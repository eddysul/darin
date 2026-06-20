import { Tabs } from 'expo-router';
import { Home, FileText, Mic, Search, User } from 'lucide-react-native';
import { View, Text, TouchableOpacity } from 'react-native';
import { useLanguage } from '../../context/LanguageContext';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

const TABS = [
  { name: 'home', icon: Home, labelKey: 'tabs.home' as const },
  { name: 'report', icon: FileText, labelKey: 'tabs.report' as const },
  { name: 'log', icon: Mic, labelKey: 'tabs.log' as const },
  { name: 'match', icon: Search, labelKey: 'tabs.match' as const },
  { name: 'profile', icon: User, labelKey: 'tabs.profile' as const },
];

function TabBar({ state, navigation }: BottomTabBarProps) {
  const { t } = useLanguage();
  return (
    <View style={{ flexDirection: 'row', backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#f0f0f0', paddingBottom: 20, paddingTop: 8 }}>
      {TABS.map((tab, index) => {
        const focused = state.index === index;
        const Icon = tab.icon;
        const isLog = tab.name === 'log';
        return (
          <TouchableOpacity
            key={tab.name}
            onPress={() => navigation.navigate(tab.name)}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end' }}
          >
            {isLog ? (
              <View style={{
                width: 52, height: 52, borderRadius: 26,
                backgroundColor: focused ? '#4A90D9' : 'rgba(74,144,217,0.85)',
                alignItems: 'center', justifyContent: 'center',
                marginBottom: 2, marginTop: -24,
                shadowColor: '#4A90D9', shadowOpacity: 0.35, shadowRadius: 8, shadowOffset: { width: 0, height: 4 },
                elevation: 6,
              }}>
                <Icon size={22} color="#fff" />
              </View>
            ) : (
              <View style={{
                padding: 8, borderRadius: 12,
                backgroundColor: focused ? 'rgba(74,144,217,0.1)' : 'transparent',
              }}>
                <Icon size={20} color={focused ? '#4A90D9' : '#9ca3af'} />
              </View>
            )}
            <Text style={{ fontSize: 11, fontWeight: '600', color: focused ? '#4A90D9' : '#9ca3af', marginTop: isLog ? 4 : 0 }}>
              {t(tab.labelKey)}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="home" />
      <Tabs.Screen name="report" />
      <Tabs.Screen name="log" />
      <Tabs.Screen name="match" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
