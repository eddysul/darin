import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Baby, CheckCircle, MessageCircle, Calendar, Globe, FileText, Send, Sparkles, Gavel, ChevronRight } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useLanguage } from '../../context/LanguageContext';
import { useApp } from '../../context/AppContext';
import { getReportContent } from '../../context/i18n';

const NAVY = '#243036';
const GOLD = '#D9A441';
const CREAM = '#FFF4D8';
const CARD_BG = '#fff';
const BORDER = 'rgba(0,0,0,0.08)';
const MUTED = '#717182';
const FG = '#243036';
const BG = '#FFFDF7';

export default function HomeTab() {
  const { locale, t } = useLanguage();
  const report = getReportContent(locale);
  const tags = [t('home.tagLunch'), t('home.tagNap'), t('home.tagCough')];
  const { bids } = useApp();
  const router = useRouter();
  const pendingBids = bids.filter((b) => b.parentId === 1 && b.status === 'pending').length;
  const totalBids = bids.filter((b) => b.parentId === 1).length;

  const quickActions = [
    { icon: MessageCircle, label: t('home.messageNanny'), bg: '#F0F3FA', color: '#6B7FA8' },
    { icon: Calendar, label: t('home.schedulePickup'), bg: CREAM, color: '#B8860B' },
    { icon: Globe, label: t('home.translateReport'), bg: '#EEF5F0', color: '#6B9080' },
    { icon: FileText, label: t('home.viewHistory'), bg: '#FFF9EB', color: '#D9A441' },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: BG }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>

        {/* Header card — warm gradient matching partner's design */}
        <View style={{ margin: 16, borderRadius: 24, padding: 20, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(217,164,65,0.2)', backgroundColor: '#FFF8E8' }}>
          <View style={{ position: 'absolute', right: -32, top: -32, width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(217,164,65,0.1)' }} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <Text style={{ color: MUTED, fontSize: 13, fontWeight: '500' }}>{t('home.greeting')}</Text>
              <Text style={{ color: NAVY, fontSize: 24, fontWeight: 'bold', marginTop: 2 }}>Jisoo 👋</Text>
            </View>
            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(217,164,65,0.2)', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(217,164,65,0.3)' }}>
              <Text style={{ fontSize: 24 }}>👩</Text>
            </View>
          </View>
          <View style={{ marginTop: 14, backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: 16, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: 'rgba(217,164,65,0.15)' }}>
            <View style={{ backgroundColor: CREAM, borderRadius: 12, padding: 8 }}>
              <Baby size={20} color="#B8860B" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: MUTED, fontSize: 11 }}>{t('home.emmaWith')}</Text>
              <Text style={{ color: NAVY, fontWeight: '600', fontSize: 13 }}>Ji-yeon Park · {t('home.until')}</Text>
            </View>
            <CheckCircle size={18} color="#6B9080" />
          </View>
        </View>

        {/* Bids Card */}
        <TouchableOpacity onPress={() => router.push('/(tabs)/bids')} activeOpacity={0.85} style={{ marginHorizontal: 16, marginBottom: 16, backgroundColor: CARD_BG, borderRadius: 20, borderWidth: 1, borderColor: BORDER, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: '#FFF9EB', alignItems: 'center', justifyContent: 'center' }}>
            <Gavel size={20} color={GOLD} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: '700', fontSize: 14, color: FG }}>{locale === 'ko' ? '받은 입찰' : 'Bids Received'}</Text>
            <Text style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>
              {locale === 'ko' ? `케어기버 ${totalBids}명 · 신규 ${pendingBids}건` : `${totalBids} caregivers · ${pendingBids} new`}
            </Text>
          </View>
          {pendingBids > 0 && (
            <View style={{ backgroundColor: NAVY, borderRadius: 10, width: 22, height: 22, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>{pendingBids}</Text>
            </View>
          )}
          <ChevronRight size={16} color={MUTED} />
        </TouchableOpacity>

        {/* Today's Report */}
        <View style={{ marginHorizontal: 16, marginBottom: 16 }}>
          <Text style={{ fontWeight: 'bold', fontSize: 16, color: FG, marginBottom: 10 }}>{t('home.todaysReport')}</Text>
          <View style={{ backgroundColor: CARD_BG, borderRadius: 24, borderWidth: 1, borderColor: BORDER, padding: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: CREAM, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 18 }}>👩‍⚕️</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, color: MUTED }}>{t('home.from')}</Text>
                <Text style={{ fontSize: 13, fontWeight: '600', color: FG }}>June 20 · 5:42 PM</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FFF9EB', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 }}>
                <Sparkles size={11} color={GOLD} />
                <Text style={{ fontSize: 11, color: '#B8860B', fontWeight: '600' }}>AI</Text>
              </View>
            </View>
            <Text style={{ fontSize: 13, color: MUTED, lineHeight: 20 }}>{report.translation}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
              {tags.map((tag) => (
                <View key={tag} style={{ backgroundColor: tag.includes('⚠') ? '#FFF9EB' : CREAM, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 }}>
                  <Text style={{ fontSize: 11, fontWeight: '600', color: tag.includes('⚠') ? '#A67C52' : '#B8860B' }}>{tag}</Text>
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
          <View style={{ backgroundColor: '#FFF9EB', borderWidth: 1, borderColor: 'rgba(217,164,65,0.25)', borderRadius: 24, padding: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <Sparkles size={11} color={GOLD} />
              <Text style={{ fontSize: 11, color: MUTED }}>{t('home.suggestedMessage')}</Text>
            </View>
            <Text style={{ fontSize: 13, color: '#A67C52', lineHeight: 20, fontStyle: 'italic' }}>"{t('home.draftText')}"</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
              <TouchableOpacity style={{ flex: 1, backgroundColor: NAVY, borderRadius: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <Send size={14} color="#fff" />
                <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>{t('home.send')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ paddingHorizontal: 20, backgroundColor: 'rgba(0,0,0,0.06)', borderRadius: 14, paddingVertical: 10, justifyContent: 'center' }}>
                <Text style={{ fontWeight: '600', fontSize: 13, color: MUTED }}>{t('home.edit')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}
