import { View, Text, ScrollView, TouchableOpacity, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Globe, Bell, Calendar, Heart, ChevronRight, Plus, Check } from 'lucide-react-native';
import { useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import type { Locale } from '../../context/i18n';

const PRIMARY = '#4A90D9';
const CARD_BG = '#fff';
const BORDER = '#f0f0f0';
const MUTED = '#9ca3af';
const FG = '#1a1a1a';

export default function ProfileTab() {
  const [langPickerOpen, setLangPickerOpen] = useState(false);
  const { locale, setLocale, t } = useLanguage();

  const settings = [
    { icon: Globe, label: t('profile.langPref'), value: locale === 'ko' ? t('profile.langValueKo') : t('profile.langValueEn'), onPress: () => setLangPickerOpen(true) },
    { icon: Bell, label: t('profile.notifications'), value: t('profile.notifValue') },
    { icon: Calendar, label: t('profile.schedule'), value: t('profile.scheduleValue') },
    { icon: Heart, label: t('profile.carePref'), value: t('profile.careValue') },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fdf8f6' }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>

        {/* Profile Hero */}
        <View style={{ marginHorizontal: 16, marginTop: 16, marginBottom: 16, backgroundColor: CARD_BG, borderRadius: 24, borderWidth: 1, borderColor: BORDER, padding: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#e0e7ff', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(74,144,217,0.2)' }}>
              <Text style={{ fontSize: 32 }}>👩</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: 'bold', fontSize: 18, color: FG }}>Jisoo Kim</Text>
              <Text style={{ fontSize: 13, color: MUTED, marginTop: 2 }}>{t('profile.parent')}</Text>
              <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
                <View style={{ backgroundColor: '#eff6ff', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 }}>
                  <Text style={{ fontSize: 11, fontWeight: '600', color: '#3b82f6' }}>🇰🇷 Korean</Text>
                </View>
                <View style={{ backgroundColor: '#eff6ff', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 }}>
                  <Text style={{ fontSize: 11, fontWeight: '600', color: '#3b82f6' }}>🇺🇸 English</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Children */}
        <View style={{ marginHorizontal: 16, marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <Text style={{ fontWeight: 'bold', fontSize: 16, color: FG }}>{t('profile.children')}</Text>
            <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Plus size={14} color={PRIMARY} />
              <Text style={{ fontSize: 13, fontWeight: '600', color: PRIMARY }}>{t('profile.add')}</Text>
            </TouchableOpacity>
          </View>
          <View style={{ backgroundColor: CARD_BG, borderRadius: 16, borderWidth: 1, borderColor: BORDER, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#fce7f3', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 22 }}>👶</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '600', fontSize: 14, color: FG }}>Emma</Text>
              <Text style={{ fontSize: 12, color: MUTED }}>{locale === 'ko' ? '2세 4개월' : '2 yrs 4 mo'}</Text>
            </View>
            <ChevronRight size={16} color={MUTED} />
          </View>
        </View>

        {/* Settings */}
        <View style={{ marginHorizontal: 16 }}>
          <Text style={{ fontWeight: 'bold', fontSize: 16, color: FG, marginBottom: 10 }}>{t('profile.settings')}</Text>
          <View style={{ backgroundColor: CARD_BG, borderRadius: 24, borderWidth: 1, borderColor: BORDER, overflow: 'hidden' }}>
            {settings.map(({ icon: Icon, label, value, onPress }, i) => (
              <TouchableOpacity
                key={label}
                onPress={onPress}
                activeOpacity={onPress ? 0.7 : 1}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderTopWidth: i > 0 ? 1 : 0, borderTopColor: BORDER }}
              >
                <View style={{ backgroundColor: '#f3f4f6', borderRadius: 12, padding: 8 }}>
                  <Icon size={16} color={MUTED} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: FG }}>{label}</Text>
                  <Text style={{ fontSize: 11, color: MUTED, marginTop: 1 }}>{value}</Text>
                </View>
                <ChevronRight size={14} color={MUTED} />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Language Picker Modal */}
      <Modal visible={langPickerOpen} transparent animationType="fade" onRequestClose={() => setLangPickerOpen(false)}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }} onPress={() => setLangPickerOpen(false)}>
          <View style={{ backgroundColor: CARD_BG, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24 }}>
            <Text style={{ fontSize: 16, fontWeight: 'bold', color: FG, marginBottom: 16, textAlign: 'center' }}>Select Language / 언어 선택</Text>
            {(['en', 'ko'] as Locale[]).map((l) => (
              <TouchableOpacity
                key={l}
                onPress={() => { setLocale(l); setLangPickerOpen(false); }}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16, borderTopWidth: l === 'ko' ? 1 : 0, borderTopColor: BORDER }}
              >
                <Text style={{ fontSize: 15, fontWeight: '600', color: FG }}>{l === 'en' ? '🇺🇸  English' : '🇰🇷  한국어'}</Text>
                {locale === l && <Check size={18} color={PRIMARY} />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}
