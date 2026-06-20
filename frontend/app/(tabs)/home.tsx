import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Baby, CheckCircle, MessageCircle, Calendar, Globe, FileText, Send, Sparkles } from 'lucide-react-native';
import { useLanguage } from '../../context/LanguageContext';
import { getReportContent } from '../../context/i18n';

const PRIMARY = '#4A90D9';
const CARD_BG = '#fff';
const BORDER = '#f0f0f0';
const MUTED = '#9ca3af';
const FG = '#1a1a1a';

export default function HomeTab() {
  const { locale, t } = useLanguage();
  const report = getReportContent(locale);
  const tags = [t('home.tagLunch'), t('home.tagNap'), t('home.tagCough')];

  const quickActions = [
    { icon: MessageCircle, label: t('home.messageNanny'), bg: '#eff6ff', color: '#3b82f6' },
    { icon: Calendar, label: t('home.schedulePickup'), bg: '#f5f3ff', color: '#8b5cf6' },
    { icon: Globe, label: t('home.translateReport'), bg: '#f0fdf4', color: '#22c55e' },
    { icon: FileText, label: t('home.viewHistory'), bg: '#fffbeb', color: '#f59e0b' },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fdf8f6' }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>

        {/* Header card */}
        <View style={{ margin: 16, backgroundColor: PRIMARY, borderRadius: 24, padding: 20, overflow: 'hidden' }}>
          <View style={{ position: 'absolute', right: -32, top: -32, width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(255,255,255,0.1)' }} />
          <View style={{ position: 'absolute', right: -16, top: 48, width: 96, height: 96, borderRadius: 48, backgroundColor: 'rgba(255,255,255,0.1)' }} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13 }}>{t('home.greeting')}</Text>
              <Text style={{ color: '#fff', fontSize: 24, fontWeight: 'bold', marginTop: 2 }}>Jisoo 👋</Text>
            </View>
            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 24 }}>👩</Text>
            </View>
          </View>
          <View style={{ marginTop: 16, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 16, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 12, padding: 8 }}>
              <Baby size={20} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11 }}>{t('home.emmaWith')}</Text>
              <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>Ji-yeon Park · {t('home.until')}</Text>
            </View>
            <CheckCircle size={18} color="#86efac" />
          </View>
        </View>

        {/* Today's Report */}
        <View style={{ marginHorizontal: 16, marginBottom: 16 }}>
          <Text style={{ fontWeight: 'bold', fontSize: 16, color: FG, marginBottom: 10 }}>{t('home.todaysReport')}</Text>
          <View style={{ backgroundColor: CARD_BG, borderRadius: 24, borderWidth: 1, borderColor: BORDER, padding: 16, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#e0e7ff', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 18 }}>👩‍⚕️</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, color: MUTED }}>{t('home.from')}</Text>
                <Text style={{ fontSize: 13, fontWeight: '600' }}>June 20 · 5:42 PM</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#f0fdf4', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 }}>
                <Sparkles size={11} color="#16a34a" />
                <Text style={{ fontSize: 11, color: '#16a34a', fontWeight: '600' }}>AI</Text>
              </View>
            </View>
            <Text style={{ fontSize: 13, color: '#374151', lineHeight: 20 }}>{report.translation}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
              {tags.map((tag) => (
                <View key={tag} style={{ backgroundColor: tag.includes('⚠') ? '#fff7ed' : '#f3f4f6', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 }}>
                  <Text style={{ fontSize: 11, fontWeight: '600', color: tag.includes('⚠') ? '#ea580c' : '#6b7280' }}>{tag}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={{ marginHorizontal: 16, marginBottom: 16 }}>
          <Text style={{ fontWeight: 'bold', fontSize: 16, color: FG, marginBottom: 10 }}>{t('home.quickActions')}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            {quickActions.map(({ icon: Icon, label, bg, color }) => (
              <TouchableOpacity key={label} style={{ width: '47%', backgroundColor: CARD_BG, borderWidth: 1, borderColor: BORDER, borderRadius: 20, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ backgroundColor: bg, borderRadius: 12, padding: 8 }}>
                  <Icon size={18} color={color} />
                </View>
                <Text style={{ fontSize: 12, fontWeight: '600', color: FG, flex: 1 }}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* AI Draft Reply */}
        <View style={{ marginHorizontal: 16 }}>
          <Text style={{ fontWeight: 'bold', fontSize: 16, color: FG, marginBottom: 10 }}>{t('home.aiDraftReply')}</Text>
          <View style={{ backgroundColor: CARD_BG, borderWidth: 1, borderColor: BORDER, borderRadius: 24, padding: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <Sparkles size={11} color={PRIMARY} />
              <Text style={{ fontSize: 11, color: MUTED }}>{t('home.suggestedMessage')}</Text>
            </View>
            <Text style={{ fontSize: 13, color: '#374151', lineHeight: 20, fontStyle: 'italic' }}>"{t('home.draftText')}"</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
              <TouchableOpacity style={{ flex: 1, backgroundColor: PRIMARY, borderRadius: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <Send size={14} color="#fff" />
                <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>{t('home.send')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ paddingHorizontal: 20, backgroundColor: '#f3f4f6', borderRadius: 14, paddingVertical: 10, justifyContent: 'center' }}>
                <Text style={{ fontWeight: '600', fontSize: 13, color: '#6b7280' }}>{t('home.edit')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}
