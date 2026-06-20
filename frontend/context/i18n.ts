export type Locale = 'en' | 'ko';

const messages = {
  en: {
    'tabs.home': 'Home', 'tabs.report': 'Reports', 'tabs.log': 'Log', 'tabs.match': 'Find', 'tabs.profile': 'Profile',
    'home.greeting': 'Good afternoon,', 'home.emmaWith': 'Emma is with', 'home.until': 'Until 7:00 PM',
    'home.todaysReport': "Today's Report", 'home.from': 'From Ji-yeon', 'home.quickActions': 'Quick Actions',
    'home.messageNanny': 'Message Ji-yeon', 'home.schedulePickup': 'Schedule Pickup',
    'home.translateReport': 'Translate Report', 'home.viewHistory': 'View History',
    'home.aiDraftReply': 'AI Draft Reply', 'home.suggestedMessage': 'Suggested message to Ji-yeon',
    'home.draftText': "Hi Ji-yeon! Thanks for the update on Emma. Could you let me know when the cough started and whether it continued throughout the afternoon? We'll keep an eye on it tonight.",
    'home.send': 'Send', 'home.edit': 'Edit', 'home.tagLunch': 'Lunch ✓', 'home.tagNap': 'Nap 1h20m', 'home.tagCough': '⚠ Cough',
    'report.title': 'Daily Reports', 'report.subtitle': "Emma's care history", 'report.submitted': 'Submitted 5:42 PM',
    'report.note': 'Note', 'report.meal': 'Meal', 'report.sleep': 'Sleep', 'report.activity': 'Activity', 'report.mood': 'Mood', 'report.health': 'Health',
    'log.title': 'Log Entry', 'log.subtitle': 'Emma · Today', 'log.voiceNote': 'Voice Note',
    'log.recording': 'Recording... 0:08', 'log.tapToRecord': 'Tap to record', 'log.autoTranscribed': 'Auto-transcribed & translated',
    'log.quickNotes': 'Quick Notes', 'log.placeholder': 'Lunch finished well. Nap 1 hour. Played outside. Slight cough after lunch...',
    'log.generateReport': 'Generate AI Report', 'log.aiDraft': 'AI Report Draft', 'log.readyToSend': 'Ready to send',
    'log.sendToParent': 'Send to Parent', 'log.todaysLog': "Today's Log",
    'match.title': 'Find Care', 'match.subtitle': 'Matches for Emma, age 2',
    'match.placeholder': 'Bilingual nanny, weekday afternoons...',
    'match.filterAll': 'All', 'match.filterBilingual': 'Korean+English', 'match.filterWeekday': 'Weekday PM',
    'match.filterInfant': 'Infant', 'match.filterCertified': 'Certified', 'match.viewProfile': 'View Profile',
    'profile.parent': 'Parent · Los Angeles', 'profile.children': 'Children', 'profile.add': 'Add',
    'profile.settings': 'Settings', 'profile.langPref': 'Language Preference', 'profile.notifications': 'Notifications',
    'profile.schedule': 'Schedule', 'profile.carePref': 'Care Preferences',
    'profile.notifValue': 'Daily reports, Alerts', 'profile.scheduleValue': 'Mon–Fri 3pm–7pm',
    'profile.careValue': 'Bilingual, Infant care', 'profile.langValueEn': 'English', 'profile.langValueKo': 'Korean',
  },
  ko: {
    'tabs.home': '홈', 'tabs.report': '리포트', 'tabs.log': '기록', 'tabs.match': '찾기', 'tabs.profile': '프로필',
    'home.greeting': '좋은 오후에요,', 'home.emmaWith': '엠마는 지금', 'home.until': '오후 7시까지',
    'home.todaysReport': '오늘의 리포트', 'home.from': '지연 님', 'home.quickActions': '빠른 실행',
    'home.messageNanny': '지연 님에게 메시지', 'home.schedulePickup': '픽업 일정',
    'home.translateReport': '리포트 번역', 'home.viewHistory': '기록 보기',
    'home.aiDraftReply': 'AI 답장 초안', 'home.suggestedMessage': '지연 님에게 보낼 추천 메시지',
    'home.draftText': '지연 님, 엠마 소식 감사합니다. 기침이 언제부터 시작됐는지, 오후 내내 계속됐는지 알려주실 수 있을까요? 오늘 밤에도 잘 살펴볼게요.',
    'home.send': '보내기', 'home.edit': '수정', 'home.tagLunch': '점심 ✓', 'home.tagNap': '낮잠 1h20m', 'home.tagCough': '⚠ 기침',
    'report.title': '일일 리포트', 'report.subtitle': '엠마 돌봄 기록', 'report.submitted': '오후 5:42 제출',
    'report.note': '참고', 'report.meal': '식사', 'report.sleep': '수면', 'report.activity': '활동', 'report.mood': '기분', 'report.health': '건강',
    'log.title': '기록 입력', 'log.subtitle': '엠마 · 오늘', 'log.voiceNote': '음성 메모',
    'log.recording': '녹음 중... 0:08', 'log.tapToRecord': '탭하여 녹음', 'log.autoTranscribed': '자동 전사 및 번역',
    'log.quickNotes': '간단 메모', 'log.placeholder': '점심 잘 먹음. 낮잠 1시간. 밖에서 놀음. 점심 후 살짝 기침...',
    'log.generateReport': 'AI 리포트 생성', 'log.aiDraft': 'AI 리포트 초안', 'log.readyToSend': '전송 준비 완료',
    'log.sendToParent': '부모에게 전송', 'log.todaysLog': '오늘의 기록',
    'match.title': '돌봄 찾기', 'match.subtitle': '엠마(2세) 맞춤 추천',
    'match.placeholder': '이중언어 돌보미, 평일 오후...',
    'match.filterAll': '전체', 'match.filterBilingual': '한국어+영어', 'match.filterWeekday': '평일 오후',
    'match.filterInfant': '영아', 'match.filterCertified': '자격증', 'match.viewProfile': '프로필 보기',
    'profile.parent': '부모 · 로스앤젤레스', 'profile.children': '아이', 'profile.add': '추가',
    'profile.settings': '설정', 'profile.langPref': '언어 설정', 'profile.notifications': '알림',
    'profile.schedule': '일정', 'profile.carePref': '돌봄 선호',
    'profile.notifValue': '일일 리포트, 알림', 'profile.scheduleValue': '월–금 오후 3–7시',
    'profile.careValue': '이중언어, 영아 돌봄', 'profile.langValueEn': 'English', 'profile.langValueKo': '한국어',
  },
} as const;

export type MessageKey = keyof typeof messages.en;

export function createT(locale: Locale) {
  return (key: MessageKey) => messages[locale][key];
}

export function getReportContent(locale: Locale) {
  if (locale === 'ko') {
    return {
      translation: '엠마가 오늘 아주 즐거운 하루를 보냈어요. 점심을 잘 먹었고, 낮잠을 편안하게 잤으며, 공원에서 신나게 놀았습니다. 점심 후 살짝 기침을 했으니 오늘 저녁에 확인해 주세요.',
      summary: '엠마가 오늘 아주 즐거운 하루를 보냈어요. 아침 내내 기분이 좋았고, 점심을 잘 먹었으며, 낮잠도 푹 잤습니다.',
      items: [
        { label: '식사', value: '점심 잘 먹음 · 간식도 먹음' },
        { label: '수면', value: '낮잠 1시간 20분 · 금방 잠듦' },
        { label: '활동', value: '공원 · 미술 · 동화 시간' },
        { label: '기분', value: '행복 · 아침에 활기참' },
        { label: '건강', value: '점심 후 살짝 기침 · 열 없음' },
      ],
      note: '내일 여벌 옷이 필요해요 — 오늘 셔츠에 물감이 묻었어요!',
    };
  }
  return {
    translation: "Emma had a wonderful day today. She finished her lunch well, had a restful nap, and played happily at the park. A slight cough appeared after lunch — worth monitoring this evening.",
    summary: "Emma had a wonderful day today. She was in great spirits throughout the morning, finished her lunch enthusiastically, and had a solid nap.",
    items: [
      { label: 'Meal', value: 'Finished lunch well · Had afternoon snack' },
      { label: 'Sleep', value: 'Nap 1hr 20min · Fell asleep easily' },
      { label: 'Activity', value: 'Park play · Arts & crafts · Story time' },
      { label: 'Mood', value: 'Happy · Energetic in the morning' },
      { label: 'Health', value: 'Slight cough after lunch · No fever' },
    ],
    note: "Extra clothes needed tomorrow — Emma got paint on her shirt today!",
  };
}

export function getLogEntries(locale: Locale) {
  if (locale === 'ko') {
    return [
      { time: '오후 2:15', text: '엠마가 점심을 다 먹었어요 — 밥, 채소, 국 조금.', type: 'meal' as const },
      { time: '오후 2:45', text: '낮잠 시작. 금방 잠들었고 오늘은 아주 차분했어요.', type: 'sleep' as const },
      { time: '오후 4:10', text: '낮잠에서 깼어요. 기분 좋음. 블록 놀이.', type: 'activity' as const },
      { time: '오후 5:30', text: '공원에서 놀았어요. 미끄럼틀을 정말 좋아했어요! 들어온 후 살짝 기침.', type: 'health' as const },
    ];
  }
  return [
    { time: '2:15 PM', text: "Emma finished her lunch — ate rice, veggies, and a little soup.", type: 'meal' as const },
    { time: '2:45 PM', text: "Started nap. Fell asleep quickly. Very calm today.", type: 'sleep' as const },
    { time: '4:10 PM', text: "Woke up from nap. Happy mood. Played with blocks.", type: 'activity' as const },
    { time: '5:30 PM', text: "Played at the park. She loved the slide! Slight cough noticed after coming back in.", type: 'health' as const },
  ];
}

export function getLogDraft(locale: Locale) {
  return locale === 'ko'
    ? '엠마가 생산적인 오후를 보냈어요. 점심을 잘 먹고, 편안한 낮잠을 잤으며, 공원에서 즐겁게 놀았습니다. 실내로 들어온 후 살짝 기침이 있어 부모님께 알렸습니다.'
    : "Emma had a productive afternoon. She finished lunch well, enjoyed a restful nap, and had a great time at the park. A slight cough was noticed after returning indoors — parents have been notified.";
}
