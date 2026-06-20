import { View, Text, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../../context/AppContext';

const MOCK_CAREGIVERS: Record<string, any> = {
  '1': { id: '1', name: '김영희', nameEn: 'Younghee Kim', experience: 8, language: '한국어 Korean', liveIn: true, price: 1800, specialty: '신생아 전문', rating: 4.9, reviews: 24, location: 'Los Angeles', cert: '산후조리사 1급', age: 42, bio: '8년간 100여 가정에서 신생아와 산모를 케어해왔습니다. 모유수유 전문 교육을 이수했으며, 초보 부모님들이 자신감을 가질 수 있도록 세심하게 도와드립니다.', bioEn: '8 years of experience caring for newborns and mothers in 100+ homes. Certified breastfeeding specialist. I help first-time parents build confidence.' },
  '2': { id: '2', name: '박수진', nameEn: 'Sujin Park', experience: 5, language: '영어 English', liveIn: false, price: 1400, specialty: '쌍둥이 경험', rating: 4.7, reviews: 18, location: 'Irvine', cert: '산후조리사 2급', age: 35, bio: '쌍둥이 케어 전문 경험 3회 보유. 영어 능통하며 미국 생활에 익숙한 한인 가정을 위한 서비스를 제공합니다.', bioEn: 'Experienced with twins 3 times. Fluent in English, specializing in supporting Korean-American families.' },
  '3': { id: '3', name: '이미경', nameEn: 'Mikyung Lee', experience: 12, language: '둘 다 Both', liveIn: true, price: 2200, specialty: '고위험 산모', rating: 5.0, reviews: 31, location: 'Torrance', cert: '산후조리사 1급, 간호조무사', age: 48, bio: '12년 경력의 베테랑으로 고위험 산모, 조산아 케어에 특화되어 있습니다. 한영 모두 가능합니다.', bioEn: '12 years of experience, specializing in high-risk mothers and premature babies. Bilingual Korean/English.' },
  '4': { id: '4', name: '최지영', nameEn: 'Jiyoung Choi', experience: 3, language: '한국어 Korean', liveIn: false, price: 1200, specialty: '초보 부모 케어', rating: 4.5, reviews: 9, location: 'Cerritos', cert: '산후조리사 2급', age: 28, bio: '젊고 에너지 넘치는 조리사로 초보 부모님들과 함께 아기 루틴을 만들어드립니다.', bioEn: 'Young and energetic, I help first-time parents establish routines.' },
  '5': { id: '5', name: '정혜원', nameEn: 'Hyewon Jung', experience: 7, language: '둘 다 Both', liveIn: true, price: 1600, specialty: '제왕절개 회복', rating: 4.8, reviews: 22, location: 'Gardena', cert: '산후조리사 1급', age: 39, bio: '제왕절개 후 산모 회복 전문. 식이 관리, 상처 케어, 심리적 지원까지 통합 케어를 제공합니다.', bioEn: 'C-section recovery specialist. Comprehensive care including diet, wound care, and emotional support.' },
};

export default function CaregiverDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { setMatchedCaregiverId } = useApp();
  const caregiver = MOCK_CAREGIVERS[id ?? '1'];

  function handleQuoteRequest() {
    Alert.alert(
      '견적 요청 / Quote Request',
      `${caregiver.name} 조리사님께 견적을 요청하시겠습니까?\nSend a quote request to ${caregiver.nameEn}?`,
      [
        { text: '취소 Cancel', style: 'cancel' },
        {
          text: '요청 Request',
          onPress: () => {
            setMatchedCaregiverId(caregiver.id);
            Alert.alert('요청 완료!', '견적 요청이 전송되었습니다.\nYour quote request has been sent!', [
              { text: '확인', onPress: () => router.push('/(family)/dashboard') },
            ]);
          },
        },
      ]
    );
  }

  if (!caregiver) return null;

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView>
        <View className="bg-primary px-6 pt-6 pb-10 items-center">
          <View className="w-20 h-20 rounded-full bg-blue-200 items-center justify-center mb-3">
            <Text className="text-4xl">👩‍⚕️</Text>
          </View>
          <Text className="text-white text-2xl font-bold">{caregiver.name}</Text>
          <Text className="text-blue-100">{caregiver.nameEn}</Text>
          <Text className="text-yellow-300 mt-1">★ {caregiver.rating} ({caregiver.reviews} reviews)</Text>
        </View>

        <View className="px-6 -mt-4">
          <View className="bg-white rounded-2xl shadow-sm p-4 mb-4">
            <View className="flex-row justify-around">
              <View className="items-center">
                <Text className="text-2xl font-bold text-primary">{caregiver.experience}년</Text>
                <Text className="text-gray-500 text-xs">경력 Experience</Text>
              </View>
              <View className="items-center">
                <Text className="text-2xl font-bold text-primary">${caregiver.price}</Text>
                <Text className="text-gray-500 text-xs">주당 /week</Text>
              </View>
              <View className="items-center">
                <Text className="text-2xl font-bold text-primary">{caregiver.age}세</Text>
                <Text className="text-gray-500 text-xs">나이 Age</Text>
              </View>
            </View>
          </View>

          <View className="bg-gray-50 rounded-2xl p-4 mb-4">
            <Text className="font-bold text-gray-700 mb-3">기본 정보 / Details</Text>
            <InfoRow icon="🗣️" label="언어 Language" value={caregiver.language} />
            <InfoRow icon="🏠" label="입주 여부 Live-in" value={caregiver.liveIn ? '가능 Available' : '불가 Not available'} />
            <InfoRow icon="📍" label="위치 Location" value={caregiver.location} />
            <InfoRow icon="🎓" label="자격증 Cert" value={caregiver.cert} />
            <InfoRow icon="⭐" label="전문 분야 Specialty" value={caregiver.specialty} />
          </View>

          <View className="bg-gray-50 rounded-2xl p-4 mb-6">
            <Text className="font-bold text-gray-700 mb-2">자기소개 / About</Text>
            <Text className="text-gray-600 text-sm leading-5">{caregiver.bio}</Text>
            <Text className="text-gray-400 text-sm leading-5 mt-2">{caregiver.bioEn}</Text>
          </View>

          <TouchableOpacity onPress={handleQuoteRequest} className="bg-primary rounded-2xl py-4 items-center mb-8">
            <Text className="text-white text-lg font-bold">견적 요청 / Request Quote</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View className="flex-row items-center mb-2">
      <Text className="text-base mr-2">{icon}</Text>
      <Text className="text-gray-500 text-sm w-32">{label}</Text>
      <Text className="text-gray-800 text-sm font-semibold flex-1">{value}</Text>
    </View>
  );
}
