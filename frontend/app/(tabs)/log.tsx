import { View, Text, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Mic, Pause, Sparkles, Send, Utensils, Moon, Activity, Thermometer } from 'lucide-react-native';
import { useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { getLogEntries, getLogDraft } from '../../context/i18n';

const PRIMARY = '#4A90D9';
const CARD_BG = '#fff';
const BORDER = '#f0f0f0';
const MUTED = '#9ca3af';
const FG = '#1a1a1a';

const ENTRY_STYLES = {
  meal: { icon: Utensils, color: '#f59e0b', bg: '#fffbeb' },
  sleep: { icon: Moon, color: '#818cf8', bg: '#eef2ff' },
  activity: { icon: Activity, color: '#22c55e', bg: '#f0fdf4' },
  health: { icon: Thermometer, color: '#fb923c', bg: '#fff7ed' },
};

export default function LogTab() {
  const [isRecording, setIsRecording] = useState(false);
  const [inputText, setInputText] = useState('');
  const [generated, setGenerated] = useState(false);
  const { locale, t } = useLanguage();
  const logEntries = getLogEntries(locale);
  const draftText = getLogDraft(locale);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fdf8f6' }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
        <View style={{ marginHorizontal: 16, marginTop: 16, marginBottom: 16 }}>
          <Text style={{ fontSize: 24, fontWeight: 'bold', color: FG }}>{t('log.title')}</Text>
          <Text style={{ color: MUTED, fontSize: 13, marginTop: 2 }}>{t('log.subtitle')}</Text>
        </View>

        {/* Voice Note */}
        <View style={{ marginHorizontal: 16, marginBottom: 12, backgroundColor: CARD_BG, borderRadius: 24, borderWidth: 1, borderColor: BORDER, padding: 16 }}>
          <Text style={{ fontWeight: '600', fontSize: 14, marginBottom: 12, color: FG }}>{t('log.voiceNote')}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <TouchableOpacity
              onPress={() => setIsRecording(!isRecording)}
              style={{
                width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center',
                backgroundColor: isRecording ? '#ef4444' : PRIMARY,
                shadowColor: isRecording ? '#ef4444' : PRIMARY,
                shadowOpacity: 0.35, shadowRadius: 10, elevation: 6,
              }}
            >
              {isRecording ? <Pause size={22} color="#fff" /> : <Mic size={22} color="#fff" />}
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              {isRecording ? (
                <View>
                  <Text style={{ fontWeight: '600', fontSize: 13, color: '#ef4444' }}>{t('log.recording')}</Text>
                  <View style={{ flexDirection: 'row', gap: 2, marginTop: 6, alignItems: 'flex-end', height: 24 }}>
                    {Array.from({ length: 20 }).map((_, i) => (
                      <View key={i} style={{ width: 3, backgroundColor: '#fca5a5', borderRadius: 2, height: Math.random() * 20 + 4 }} />
                    ))}
                  </View>
                </View>
              ) : (
                <View>
                  <Text style={{ fontWeight: '600', fontSize: 13, color: FG }}>{t('log.tapToRecord')}</Text>
                  <Text style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>{t('log.autoTranscribed')}</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Text Input */}
        <View style={{ marginHorizontal: 16, marginBottom: 12, backgroundColor: CARD_BG, borderRadius: 24, borderWidth: 1, borderColor: BORDER, padding: 16 }}>
          <Text style={{ fontWeight: '600', fontSize: 14, marginBottom: 8, color: FG }}>{t('log.quickNotes')}</Text>
          <TextInput
            style={{ backgroundColor: '#f9fafb', borderRadius: 16, padding: 12, fontSize: 13, color: FG, minHeight: 80, textAlignVertical: 'top' }}
            placeholder={t('log.placeholder')}
            placeholderTextColor={MUTED}
            value={inputText}
            onChangeText={setInputText}
            multiline
          />
          <TouchableOpacity
            onPress={() => inputText.trim() && setGenerated(true)}
            style={{ marginTop: 10, backgroundColor: PRIMARY, borderRadius: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          >
            <Sparkles size={15} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>{t('log.generateReport')}</Text>
          </TouchableOpacity>
        </View>

        {/* AI Draft */}
        {generated && (
          <View style={{ marginHorizontal: 16, marginBottom: 12, backgroundColor: CARD_BG, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(74,144,217,0.2)', padding: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <View style={{ backgroundColor: 'rgba(74,144,217,0.1)', borderRadius: 10, padding: 6 }}>
                <Sparkles size={14} color={PRIMARY} />
              </View>
              <Text style={{ fontWeight: '600', fontSize: 13, color: FG }}>{t('log.aiDraft')}</Text>
              <Text style={{ marginLeft: 'auto', fontSize: 11, color: MUTED }}>{t('log.readyToSend')}</Text>
            </View>
            <Text style={{ fontSize: 13, color: '#374151', lineHeight: 20 }}>{draftText}</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
              <TouchableOpacity style={{ flex: 1, backgroundColor: PRIMARY, borderRadius: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <Send size={14} color="#fff" />
                <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>{t('log.sendToParent')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ paddingHorizontal: 20, backgroundColor: '#f3f4f6', borderRadius: 14, justifyContent: 'center' }}>
                <Text style={{ fontWeight: '600', fontSize: 13, color: '#6b7280' }}>{t('home.edit')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Today's Log */}
        <View style={{ marginHorizontal: 16 }}>
          <Text style={{ fontWeight: 'bold', fontSize: 16, color: FG, marginBottom: 10 }}>{t('log.todaysLog')}</Text>
          {logEntries.map((entry, i) => {
            const style = ENTRY_STYLES[entry.type];
            const Icon = style.icon;
            return (
              <View key={i} style={{ backgroundColor: CARD_BG, borderRadius: 16, borderWidth: 1, borderColor: BORDER, padding: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
                <View style={{ backgroundColor: style.bg, borderRadius: 10, padding: 6, marginTop: 2 }}>
                  <Icon size={14} color={style.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, color: '#374151', lineHeight: 20 }}>{entry.text}</Text>
                  <Text style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>{entry.time}</Text>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
