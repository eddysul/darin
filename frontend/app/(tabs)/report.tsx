import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Utensils, Moon, Activity, Heart, Thermometer, AlertCircle } from 'lucide-react-native';
import { useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { getReportContent } from '../../context/i18n';

const CARD_BG = '#fff';
const BORDER = '#f0f0f0';
const MUTED = '#9ca3af';
const FG = '#1a1a1a';

const ITEM_STYLES = [
  { icon: Utensils, color: '#f59e0b', bg: '#fffbeb' },
  { icon: Moon, color: '#818cf8', bg: '#eef2ff' },
  { icon: Activity, color: '#22c55e', bg: '#f0fdf4' },
  { icon: Heart, color: '#f87171', bg: '#fef2f2' },
  { icon: Thermometer, color: '#fb923c', bg: '#fff7ed' },
];

const DATES = ['June 20', 'June 19', 'June 18'];

export default function ReportTab() {
  const [expanded, setExpanded] = useState(0);
  const { locale, t } = useLanguage();
  const report = getReportContent(locale);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFDF7' }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
        <View style={{ marginHorizontal: 16, marginTop: 16, marginBottom: 16 }}>
          <Text style={{ fontSize: 24, fontWeight: 'bold', color: FG }}>{t('report.title')}</Text>
          <Text style={{ color: MUTED, fontSize: 13, marginTop: 2 }}>{t('report.subtitle')}</Text>
        </View>

        {DATES.map((date, i) => (
          <View key={date} style={{ marginHorizontal: 16, marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Text style={{ fontSize: 11, fontWeight: '600', color: MUTED }}>{date}</Text>
              <View style={{ flex: 1, height: 1, backgroundColor: BORDER }} />
            </View>

            <TouchableOpacity
              onPress={() => setExpanded(expanded === i ? -1 : i)}
              activeOpacity={0.9}
              style={{ backgroundColor: CARD_BG, borderRadius: 24, borderWidth: 1, borderColor: BORDER, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}
            >
              <View style={{ padding: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#e0e7ff', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 18 }}>👩‍⚕️</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: '600', fontSize: 13 }}>Ji-yeon Park</Text>
                    <Text style={{ fontSize: 11, color: MUTED }}>{t('report.submitted')}</Text>
                  </View>
                  {i === 0 && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#fff7ed', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 4 }}>
                      <AlertCircle size={11} color="#f97316" />
                      <Text style={{ fontSize: 11, color: '#f97316', fontWeight: '600' }}>{t('report.note')}</Text>
                    </View>
                  )}
                </View>

                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {ITEM_STYLES.slice(0, 3).map(({ icon: Icon, color, bg }, idx) => (
                    <View key={idx} style={{ flex: 1, backgroundColor: bg, borderRadius: 16, paddingVertical: 10, alignItems: 'center', gap: 4 }}>
                      <Icon size={16} color={color} />
                      <Text style={{ fontSize: 10, fontWeight: '600', color }}>{report.items[idx].label}</Text>
                    </View>
                  ))}
                </View>

                {expanded === i && (
                  <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: BORDER }}>
                    <Text style={{ fontSize: 13, color: '#374151', lineHeight: 20, marginBottom: 12 }}>{report.summary}</Text>
                    {ITEM_STYLES.map(({ icon: Icon, color, bg }, idx) => (
                      <View key={idx} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
                        <View style={{ backgroundColor: bg, borderRadius: 10, padding: 6, marginTop: 2 }}>
                          <Icon size={14} color={color} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 11, fontWeight: '600', color: MUTED }}>{report.items[idx].label}</Text>
                          <Text style={{ fontSize: 13, color: FG }}>{report.items[idx].value}</Text>
                        </View>
                      </View>
                    ))}
                    {report.note && (
                      <View style={{ backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fde68a', borderRadius: 16, padding: 12, flexDirection: 'row', gap: 8, marginTop: 4 }}>
                        <AlertCircle size={14} color="#d97706" style={{ marginTop: 2 }} />
                        <Text style={{ fontSize: 12, color: '#92400e', flex: 1 }}>{report.note}</Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
