import { Tabs } from 'expo-router';
import { Home, FileText, Mic, Search, User } from 'lucide-react-native';
import { View, Text, TouchableOpacity } from 'react-native';
import { useLanguage } from '../../context/LanguageContext';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

const NAVY = '#243036';
const GOLD = '#D9A441';

const TABS = [
  { name: 'home', icon: Home, labelKey: 'tabs.home' as const },
  { name: 'match', icon: Search, labelKey: 'tabs.match' as const },
  { name: 'log', icon: Mic, labelKey: 'tabs.log' as const },
  { name: 'report', icon: FileText, labelKey: 'tabs.report' as const },
  { name: 'profile', icon: User, labelKey: 'tabs.profile' as const },
];

function TabBar({ state, navigation }: BottomTabBarProps) {
  const { t } = useLanguage();
  return (
    <View style={{ flexDirection: 'row', backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.08)', paddingBottom: 20, paddingTop: 8 }}>
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
                backgroundColor: focused ? NAVY : 'rgba(36,48,54,0.82)',
                alignItems: 'center', justifyContent: 'center',
                marginBottom: 2, marginTop: -24,
                shadowColor: NAVY, shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 },
                elevation: 6,
              }}>
                <Icon size={22} color="#fff" />
              </View>
            ) : (
              <View style={{
                padding: 8, borderRadius: 12,
                backgroundColor: focused ? 'rgba(217,164,65,0.12)' : 'transparent',
              }}>
                <Icon size={20} color={focused ? NAVY : '#9ca3af'} />
              </View>
            )}
            <Text style={{ fontSize: 11, fontWeight: '600', color: focused ? NAVY : '#9ca3af', marginTop: isLog ? 4 : 0 }}>
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
      <Tabs.Screen name="match" />
      <Tabs.Screen name="log" />
      <Tabs.Screen name="report" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
