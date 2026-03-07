import { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
  ScrollView, Animated,
} from 'react-native';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  PhoneAuthProvider, signInWithCredential, RecaptchaVerifier,
} from 'firebase/auth';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import {
  saveUserSession, getBiometricEnabled, authenticateWithBiometric,
  getUserSession,
} from '@/lib/storage';
import { COLORS } from '@/lib/theme';

type Screen = 'phone' | 'otp' | 'biometric';

export default function PhoneAuthScreen() {
  const [screen, setScreen] = useState<Screen>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [verificationId, setVerificationId] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const otpRefs = useRef<(TextInput | null)[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    checkExistingSession();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  async function checkExistingSession() {
    const session = await getUserSession();
    const bioEnabled = await getBiometricEnabled();
    setBiometricAvailable(bioEnabled);
    if (session.phone && session.role) {
      if (bioEnabled) {
        setScreen('biometric');
      } else {
        navigateByRole(session.role);
      }
    }
  }

  async function handleBiometricLogin() {
    const result = await authenticateWithBiometric();
    if (result.success) {
      const session = await getUserSession();
      navigateByRole(session.role);
    } else {
      Alert.alert('Biometric Failed', 'Could not verify. Please log in with phone number.');
      setScreen('phone');
    }
  }

  function navigateByRole(role: string) {
    const routes: Record<string, string> = {
      admin: '/admin',
      class_teacher: '/teacher',
      parent: '/parent',
      bus_driver: '/driver',
      accountant: '/accountant',
    };
    router.replace((routes[role] ?? '/admin') as any);
  }

  async function handleSendOTP() {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length !== 10) {
      Alert.alert('Invalid Number', 'Please enter a valid 10-digit mobile number.');
      return;
    }
    setLoading(true);
    try {
      // In production: Use Firebase Phone Auth with RecaptchaVerifier
      // For development/testing: Use a mock verification ID
      const fullPhone = `+91${cleaned}`;

      // Mock flow for development — replace with real Firebase phone auth in production:
      // const recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', { size: 'invisible' });
      // const provider = new PhoneAuthProvider(auth);
      // const id = await provider.verifyPhoneNumber(fullPhone, recaptchaVerifier);
      // setVerificationId(id);

      // Development mock:
      setVerificationId('mock-verification-id');
      setScreen('otp');
      startResendTimer();
      animateToOTP();
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOTP() {
    const code = otp.join('');
    if (code.length < 6) {
      Alert.alert('Invalid OTP', 'Please enter the complete 6-digit OTP.');
      return;
    }
    setLoading(true);
    try {
      // In production: verify with Firebase credential
      // const credential = PhoneAuthProvider.credential(verificationId, code);
      // const result = await signInWithCredential(auth, credential);

      // Development mock — look up user by phone in Firestore:
      const phoneNum = phone.replace(/\D/g, '');
      await resolveUserRole(phoneNum);
    } catch (e: any) {
      Alert.alert('Verification Failed', 'Invalid OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function resolveUserRole(phoneNum: string) {
    // Try staff collection first (multiple schools)
    const allSchoolsSnap = await getDocs(collection(db, 'schools'));
    for (const schoolDoc of allSchoolsSnap.docs) {
      const sid = schoolDoc.id;

      // Check staff
      const staffSnap = await getDocs(query(
        collection(db, 'schools', sid, 'staff'),
        where('phone', '==', phoneNum)
      ));
      if (!staffSnap.empty) {
        const staff = staffSnap.docs[0].data();
        const roleMap: Record<string, string> = {
          'Principal': 'admin',
          'Vice Principal': 'admin',
          'Class Teacher': 'class_teacher',
          'Subject Teacher': 'class_teacher',
          'Accountant': 'accountant',
          'Bus Driver': 'bus_driver',
        };
        const role = roleMap[staff.role] ?? 'class_teacher';
        await saveUserSession({
          phone: phoneNum,
          name: staff.name,
          role,
          schoolId: sid,
          staffId: staffSnap.docs[0].id,
        });
        navigateByRole(role);
        return;
      }

      // Check parents via students
      const parentSnap = await getDocs(query(
        collection(db, 'schools', sid, 'students'),
        where('parent_phone', '==', phoneNum)
      ));
      if (!parentSnap.empty) {
        const student = parentSnap.docs[0].data();
        await saveUserSession({
          phone: phoneNum,
          name: student.parent_name ?? 'Parent',
          role: 'parent',
          schoolId: sid,
        });
        navigateByRole('parent');
        return;
      }
    }

    // If not found — check if this is the school setup (first-time admin)
    Alert.alert(
      'Account Not Found',
      'No account linked to this number. Are you setting up a new school?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Setup School',
          onPress: async () => {
            await saveUserSession({ phone: phoneNum, role: 'admin', schoolId: '' });
            router.replace('/school-setup');
          },
        },
      ]
    );
  }

  function animateToOTP() {
    Animated.timing(slideAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }

  function startResendTimer() {
    setResendTimer(30);
    timerRef.current = setInterval(() => {
      setResendTimer(prev => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  function handleOTPChange(val: string, index: number) {
    if (val.length > 1) {
      // Handle paste
      const digits = val.replace(/\D/g, '').slice(0, 6).split('');
      const newOtp = [...otp];
      digits.forEach((d, i) => { if (index + i < 6) newOtp[index + i] = d; });
      setOtp(newOtp);
      const nextIndex = Math.min(index + digits.length, 5);
      otpRefs.current[nextIndex]?.focus();
      return;
    }
    const newOtp = [...otp];
    newOtp[index] = val.replace(/\D/g, '');
    setOtp(newOtp);
    if (val && index < 5) otpRefs.current[index + 1]?.focus();
  }

  function handleOTPKeyPress(key: string, index: number) {
    if (key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  }

  // ── BIOMETRIC SCREEN ──────────────────────────────────────────────────────
  if (screen === 'biometric') {
    return (
      <View style={styles.root}>
        <View style={styles.biometricContainer}>
          <View style={styles.logoCircle}>
            <MaterialCommunityIcons name="school" size={48} color={COLORS.accent} />
          </View>
          <Text style={styles.appName}>MyChalkPad</Text>
          <Text style={styles.biometricTitle}>Welcome Back</Text>
          <Text style={styles.biometricSub}>Use fingerprint to login quickly</Text>

          <TouchableOpacity style={styles.fingerprintBtn} onPress={handleBiometricLogin} activeOpacity={0.85}>
            <MaterialCommunityIcons name="fingerprint" size={56} color="#FFFFFF" />
            <Text style={styles.fingerprintText}>Touch to Login</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.usePhoneBtn}
            onPress={() => setScreen('phone')}
            activeOpacity={0.7}
          >
            <Text style={styles.usePhoneText}>Use phone number instead</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── PHONE + OTP SCREENS ───────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.authHeader}>
          <View style={styles.logoCircle}>
            <MaterialCommunityIcons name="school" size={36} color={COLORS.accent} />
          </View>
          <Text style={styles.appName}>MyChalkPad</Text>
          <Text style={styles.authTagline}>School Management for Bharat 🇮🇳</Text>
        </View>

        {screen === 'phone' ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Login with Mobile</Text>
            <Text style={styles.cardSubtitle}>
              Enter your registered mobile number. We'll send an OTP to verify.
            </Text>

            <View style={styles.phoneInputRow}>
              <View style={styles.countryCode}>
                <Text style={styles.flagEmoji}>🇮🇳</Text>
                <Text style={styles.countryCodeText}>+91</Text>
              </View>
              <TextInput
                style={styles.phoneInput}
                placeholder="Mobile number"
                placeholderTextColor={COLORS.textSecondary}
                keyboardType="phone-pad"
                maxLength={10}
                value={phone}
                onChangeText={setPhone}
                autoFocus
              />
            </View>

            <TouchableOpacity
              style={[styles.primaryBtn, (loading || phone.replace(/\D/g, '').length !== 10) && styles.primaryBtnDisabled]}
              onPress={handleSendOTP}
              disabled={loading || phone.replace(/\D/g, '').length !== 10}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.primaryBtnText}>Send OTP</Text>
              )}
            </TouchableOpacity>

            <Text style={styles.termsText}>
              By continuing, you agree to MyChalkPad's Terms of Service and Privacy Policy.
            </Text>
          </View>
        ) : (
          <Animated.View
            style={[
              styles.card,
              {
                transform: [{
                  translateX: slideAnim.interpolate({ inputRange: [0, 1], outputRange: [width, 0] }),
                }],
              },
            ]}
          >
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => { setScreen('phone'); setOtp(['', '', '', '', '', '']); }}
            >
              <MaterialCommunityIcons name="arrow-left" size={20} color={COLORS.primary} />
              <Text style={styles.backBtnText}>Change Number</Text>
            </TouchableOpacity>

            <Text style={styles.cardTitle}>Enter OTP</Text>
            <Text style={styles.cardSubtitle}>
              We sent a 6-digit OTP to +91 {phone}
            </Text>

            <View style={styles.otpRow}>
              {otp.map((digit, i) => (
                <TextInput
                  key={i}
                  ref={ref => { otpRefs.current[i] = ref; }}
                  style={[styles.otpBox, digit ? styles.otpBoxFilled : null]}
                  value={digit}
                  onChangeText={v => handleOTPChange(v, i)}
                  onKeyPress={({ nativeEvent }) => handleOTPKeyPress(nativeEvent.key, i)}
                  keyboardType="number-pad"
                  maxLength={6}
                  selectTextOnFocus
                  textAlign="center"
                />
              ))}
            </View>

            <TouchableOpacity
              style={[styles.primaryBtn, (loading || otp.join('').length < 6) && styles.primaryBtnDisabled]}
              onPress={handleVerifyOTP}
              disabled={loading || otp.join('').length < 6}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.primaryBtnText}>Verify OTP</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.resendBtn, resendTimer > 0 && { opacity: 0.4 }]}
              onPress={resendTimer === 0 ? () => { setOtp(['', '', '', '', '', '']); handleSendOTP(); } : undefined}
              disabled={resendTimer > 0}
              activeOpacity={0.7}
            >
              <Text style={styles.resendText}>
                {resendTimer > 0 ? `Resend OTP in ${resendTimer}s` : 'Resend OTP'}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Features */}
        <View style={styles.featureRow}>
          {[
            { icon: 'shield-check', label: 'Secure Login' },
            { icon: 'translate', label: 'Hindi + English' },
            { icon: 'wifi-off', label: 'Works Offline' },
          ].map((f, i) => (
            <View key={i} style={styles.featureItem}>
              <MaterialCommunityIcons name={f.icon as any} size={20} color={COLORS.primary} />
              <Text style={styles.featureLabel}>{f.label}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const { width } = Dimensions;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { flexGrow: 1, padding: 20 },
  authHeader: { alignItems: 'center', paddingTop: 60, paddingBottom: 32 },
  logoCircle: { width: 80, height: 80, borderRadius: 24, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center', marginBottom: 12, elevation: 6, shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
  appName: { fontSize: 28, fontWeight: 'bold', color: COLORS.primary, letterSpacing: 0.5 },
  authTagline: { fontSize: 14, color: COLORS.textSecondary, marginTop: 4 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 24, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, marginBottom: 24 },
  cardTitle: { fontSize: 22, fontWeight: 'bold', color: COLORS.textPrimary, marginBottom: 8 },
  cardSubtitle: { fontSize: 14, color: COLORS.textSecondary, lineHeight: 20, marginBottom: 24 },
  phoneInputRow: { flexDirection: 'row', borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 12, overflow: 'hidden', marginBottom: 20 },
  countryCode: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 14, gap: 6, backgroundColor: COLORS.background, borderRightWidth: 1, borderRightColor: COLORS.border },
  flagEmoji: { fontSize: 20 },
  countryCodeText: { fontSize: 15, fontWeight: '600', color: COLORS.textPrimary },
  phoneInput: { flex: 1, paddingHorizontal: 14, fontSize: 18, fontWeight: '500', color: COLORS.textPrimary, letterSpacing: 1 },
  primaryBtn: { backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginBottom: 16 },
  primaryBtnDisabled: { opacity: 0.5 },
  primaryBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
  termsText: { fontSize: 12, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 18 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 },
  backBtnText: { fontSize: 14, color: COLORS.primary, fontWeight: '600' },
  otpRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  otpBox: { width: 46, height: 56, borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 12, fontSize: 22, fontWeight: 'bold', color: COLORS.textPrimary, backgroundColor: COLORS.background },
  otpBoxFilled: { borderColor: COLORS.primary, backgroundColor: COLORS.primary + '08' },
  resendBtn: { alignItems: 'center', paddingVertical: 8 },
  resendText: { fontSize: 14, color: COLORS.primary, fontWeight: '600' },
  featureRow: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 16 },
  featureItem: { alignItems: 'center', gap: 6 },
  featureLabel: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '500' },
  biometricContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  biometricTitle: { fontSize: 26, fontWeight: 'bold', color: COLORS.textPrimary, marginTop: 20 },
  biometricSub: { fontSize: 14, color: COLORS.textSecondary, marginTop: 8, marginBottom: 40 },
  fingerprintBtn: { width: 140, height: 140, borderRadius: 70, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center', gap: 8, elevation: 8, shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 12, marginBottom: 40 },
  fingerprintText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  usePhoneBtn: { paddingVertical: 12 },
  usePhoneText: { color: COLORS.primary, fontSize: 15, fontWeight: '600', textDecorationLine: 'underline' },
});