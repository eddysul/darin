import { View, Text, TouchableOpacity, Image, TextInput, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, Phone, ChevronRight, Heart, Baby } from 'lucide-react-native';
import { useApp } from '../context/AppContext';

const NAVY = '#243036';
const GOLD = '#D9A441';
const CREAM = '#FFF4D8';
const MUTED = '#717182';
const BORDER = 'rgba(0,0,0,0.1)';
const INPUT_BG = '#f3f3f5';

type Step = 'role' | 'auth';
type Role = 'family' | 'caregiver';
type AuthMode = 'login' | 'signup';

function GoogleIcon() {
  return <Text style={{ fontSize: 16 }}>G</Text>;
}

export default function LoginScreen() {
  const router = useRouter();
  const { setRole } = useApp();
  const [step, setStep] = useState<Step>('role');
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  function selectRole(r: Role) {
    setSelectedRole(r);
    setStep('auth');
  }

  function handleContinue() {
    setRole(selectedRole === 'caregiver' ? 'caregiver' : 'family');
    router.replace('/(tabs)/home');
  }

  const isSignup = mode === 'signup';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFDF7' }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={{ flex: 1, paddingHorizontal: 28, paddingTop: 32, paddingBottom: 32 }}>

            {/* Logo */}
            <View style={{ alignItems: 'center', marginBottom: step === 'role' ? 32 : 20 }}>
              <Image source={require('../assets/darin-logo.png')} style={{ width: 200, height: 200 }} resizeMode="contain" />
            </View>

            {step === 'role' ? (
              /* ── Role Selection ── */
              <View style={{ gap: 14 }}>
                <Text style={{ fontSize: 24, fontWeight: 'bold', color: NAVY, marginBottom: 4 }}>Welcome to Darin</Text>
                <Text style={{ fontSize: 14, color: MUTED, marginBottom: 8, lineHeight: 22 }}>누구세요? · Who are you?</Text>

                <TouchableOpacity onPress={() => selectRole('family')} style={{ borderWidth: 1, borderColor: BORDER, borderRadius: 20, padding: 20, flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: '#fff' }}>
                  <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: CREAM, alignItems: 'center', justifyContent: 'center' }}>
                    <Heart size={24} color={GOLD} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: 'bold', color: NAVY }}>부모 · Parent</Text>
                    <Text style={{ fontSize: 12, color: MUTED, marginTop: 3 }}>Find and manage your caregiver</Text>
                  </View>
                  <ChevronRight size={18} color={MUTED} />
                </TouchableOpacity>

                <TouchableOpacity onPress={() => selectRole('caregiver')} style={{ borderWidth: 1, borderColor: BORDER, borderRadius: 20, padding: 20, flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: '#fff' }}>
                  <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: '#F0F3FA', alignItems: 'center', justifyContent: 'center' }}>
                    <Baby size={24} color="#6B7FA8" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: 'bold', color: NAVY }}>산후조리사 · Caregiver</Text>
                    <Text style={{ fontSize: 12, color: MUTED, marginTop: 3 }}>Manage your families and care logs</Text>
                  </View>
                  <ChevronRight size={18} color={MUTED} />
                </TouchableOpacity>
              </View>
            ) : (
              /* ── Auth ── */
              <View>
                <TouchableOpacity onPress={() => setStep('role')} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 20 }}>
                  <ChevronRight size={14} color={MUTED} style={{ transform: [{ rotate: '180deg' }] }} />
                  <Text style={{ fontSize: 13, color: MUTED }}>Back</Text>
                </TouchableOpacity>

                {/* Toggle login / signup */}
                <View style={{ flexDirection: 'row', backgroundColor: INPUT_BG, borderRadius: 14, padding: 4, marginBottom: 24 }}>
                  {(['login', 'signup'] as AuthMode[]).map((m) => (
                    <TouchableOpacity key={m} onPress={() => setMode(m)} style={{ flex: 1, paddingVertical: 9, borderRadius: 10, backgroundColor: mode === m ? '#fff' : 'transparent', alignItems: 'center', shadowColor: mode === m ? '#000' : 'transparent', shadowOpacity: 0.06, shadowRadius: 4, elevation: mode === m ? 2 : 0 }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: mode === m ? NAVY : MUTED }}>{m === 'login' ? 'Log In' : 'Sign Up'}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={{ fontSize: 22, fontWeight: 'bold', color: NAVY, marginBottom: 4 }}>
                  {isSignup ? '계정 만들기' : selectedRole === 'caregiver' ? '산후조리사로 시작하기' : '다시 만나요!'}
                </Text>
                <Text style={{ fontSize: 13, color: MUTED, marginBottom: 20, lineHeight: 20 }}>
                  {isSignup ? 'Create your Darin account' : 'Sign in to continue'}
                </Text>

                <View style={{ gap: 12 }}>
                  {isSignup && (
                    <View>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: NAVY, marginBottom: 6 }}>NAME</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: INPUT_BG, borderRadius: 14, paddingHorizontal: 14, borderWidth: 1, borderColor: BORDER }}>
                        <TextInput value={name} onChangeText={setName} placeholder="Your name" placeholderTextColor={MUTED} style={{ flex: 1, paddingVertical: 13, fontSize: 14, color: NAVY }} />
                      </View>
                    </View>
                  )}

                  <View>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: NAVY, marginBottom: 6 }}>EMAIL</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: INPUT_BG, borderRadius: 14, paddingHorizontal: 14, gap: 10, borderWidth: 1, borderColor: BORDER }}>
                      <Mail size={16} color={MUTED} />
                      <TextInput value={email} onChangeText={setEmail} placeholder="you@email.com" placeholderTextColor={MUTED} keyboardType="email-address" autoCapitalize="none" style={{ flex: 1, paddingVertical: 13, fontSize: 14, color: NAVY }} />
                    </View>
                  </View>

                  {isSignup && (
                    <View>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: NAVY, marginBottom: 6 }}>PHONE</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: INPUT_BG, borderRadius: 14, paddingHorizontal: 14, gap: 10, borderWidth: 1, borderColor: BORDER }}>
                        <Phone size={16} color={MUTED} />
                        <TextInput value={phone} onChangeText={setPhone} placeholder="(555) 123-4567" placeholderTextColor={MUTED} keyboardType="phone-pad" style={{ flex: 1, paddingVertical: 13, fontSize: 14, color: NAVY }} />
                      </View>
                    </View>
                  )}

                  <View>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: NAVY, marginBottom: 6 }}>PASSWORD</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: INPUT_BG, borderRadius: 14, paddingHorizontal: 14, gap: 10, borderWidth: 1, borderColor: BORDER }}>
                      <Lock size={16} color={MUTED} />
                      <TextInput value={password} onChangeText={setPassword} placeholder="••••••••" placeholderTextColor={MUTED} secureTextEntry={!showPassword} style={{ flex: 1, paddingVertical: 13, fontSize: 14, color: NAVY }} />
                      <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                        {showPassword ? <EyeOff size={16} color={MUTED} /> : <Eye size={16} color={MUTED} />}
                      </TouchableOpacity>
                    </View>
                  </View>

                  {!isSignup && (
                    <TouchableOpacity style={{ alignSelf: 'flex-end' }}>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: GOLD }}>Forgot password?</Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity onPress={handleContinue} style={{ backgroundColor: NAVY, borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 4 }}>
                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>{isSignup ? 'Create Account' : 'Log In'}</Text>
                  </TouchableOpacity>

                  {!isSignup && (
                    <>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 4 }}>
                        <View style={{ flex: 1, height: 1, backgroundColor: BORDER }} />
                        <Text style={{ color: MUTED, fontSize: 12 }}>or</Text>
                        <View style={{ flex: 1, height: 1, backgroundColor: BORDER }} />
                      </View>

                      <TouchableOpacity onPress={handleContinue} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, borderWidth: 1, borderColor: BORDER, borderRadius: 14, paddingVertical: 14, backgroundColor: '#fff' }}>
                        <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#4285F4' }}>G</Text>
                        <Text style={{ fontSize: 14, fontWeight: '600', color: NAVY }}>Continue with Google</Text>
                      </TouchableOpacity>

                      <TouchableOpacity onPress={handleContinue} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: NAVY, borderRadius: 14, paddingVertical: 14 }}>
                        <Text style={{ fontSize: 16, color: '#fff' }}></Text>
                        <Text style={{ fontSize: 14, fontWeight: '600', color: '#FFFDF7' }}>Continue with Apple</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              </View>
            )}

            <Text style={{ fontSize: 11, color: MUTED, textAlign: 'center', lineHeight: 18, marginTop: 24 }}>
              By continuing you agree to our Terms of Service{'\n'}and Privacy Policy
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
