/**
 * app/index.tsx — Login Screen
 * Uses mock OTP for development/APK testing.
 * Switch to real Firebase Phone Auth only after deploying to production web.
 */

import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  saveUserSession,
  getBiometricEnabled,
  setBiometricEnabled,
  getUserSession,
  UserRole,
} from '@/lib/storage';
import { COLORS } from '@/lib/theme';
import * as LocalAuthentication from 'expo-local-authentication';

export default function LoginScreen() {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [loadingSendOtp, setLoadingSendOtp] = useState(false);
  const [loadingVerify, setLoadingVerify] = useState(false);
  const [phoneError, setPhoneError] = useState('');
  const [otpError, setOtpError] = useState('');
  const [generalError, setGeneralError] = useState('');
  const [showBiometricModal, setShowBiometricModal] = useState(false);
  const [biometricChecked, setBiometricChecked] = useState(false);

  useEffect(() => {
    checkBiometricLogin();
  }, []);

  async function checkBiometricLogin() {
    try {
      const biometricEnabled = await getBiometricEnabled();
      if (!biometricEnabled) { setBiometricChecked(true); return; }
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      if (!hasHardware || !isEnrolled) { setBiometricChecked(true); return; }
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Login to MyChalkPad',
        fallbackLabel: 'Use OTP instead',
        cancelLabel: 'Cancel',
      });
      if (result.success) {
        const session = await getUserSession();
        if (session && session.role && session.phone) {
          navigateByRole(session.role);
          return;
        }
      }
      setBiometricChecked(true);
    } catch (error) {
      console.error('Biometric check error:', error);
      setBiometricChecked(true);
    }
  }

  function navigateByRole(role: UserRole) {
    switch (role) {
      case 'admin':
      case 'super_admin':
      case 'principal':
        router.replace('/admin');
        break;
      case 'teacher':
        router.replace('/teacher');
        break;
      case 'parent':
        router.replace('/parents');
        break;
      case 'driver':
        router.replace('/driver');
        break;
      case 'accountant':
        router.replace('/accountant');
        break;
      default:
        router.replace('/admin');
    }
  }

  function validatePhone(): boolean {
    setPhoneError('');
    if (!phone || phone.length !== 10 || !/^\d{10}$/.test(phone)) {
      setPhoneError('Please enter a valid 10-digit phone number');
      return false;
    }
    return true;
  }

  // ✅ FIXED — Mock OTP flow (no RecaptchaVerifier needed)
  async function handleSendOtp() {
    if (!validatePhone()) return;
    setLoadingSendOtp(true);
    setGeneralError('');
    try {
      // Check if phone exists in Firestore first
      const allSchoolsSnap = await getDocs(collection(db, 'schools'));
      let found = false;
      for (const schoolDoc of allSchoolsSnap.docs) {
        const sid = schoolDoc.id;
        const staffSnap = await getDocs(query(
          collection(db, 'schools', sid, 'staff'),
          where('phone', '==', phone)
        ));
        if (!staffSnap.empty) { found = true; break; }
        const parentSnap = await getDocs(query(
          collection(db, 'schools', sid, 'students'),
          where('parent_phone', '==', phone)
        ));
        if (!parentSnap.empty) { found = true; break; }
      }
      if (!found) {
        setGeneralError('This phone number is not registered. Contact your school admin.');
        return;
      }
      // Mock OTP sent — in production replace with Fast2SMS API call
      setOtpSent(true);
    } catch (error: any) {
      console.error('Send OTP error:', error);
      setGeneralError(error?.message ?? 'Failed to send OTP. Please try again.');
    } finally {
      setLoadingSendOtp(false);
    }
  }

  // ✅ FIXED — Mock OTP verify + Firestore role lookup
  async function handleVerifyOtp() {
    setOtpError('');
    setGeneralError('');
    if (!otp || otp.length !== 6) {
      setOtpError('Please enter the 6-digit OTP');
      return;
    }
    // ✅ For testing — accept any 6-digit OTP
    // In production — verify against Fast2SMS or Firebase
    setLoadingVerify(true);
    try {
      const allSchoolsSnap = await getDocs(collection(db, 'schools'));
      for (const schoolDoc of allSchoolsSnap.docs) {
        const sid = schoolDoc.id;

        // Check staff
        const staffSnap = await getDocs(query(
          collection(db, 'schools', sid, 'staff'),
          where('phone', '==', phone)
        ));
        if (!staffSnap.empty) {
          const staff = staffSnap.docs[0].data();
          const roleMap: Record<string, UserRole> = {
            'Principal': 'admin',
            'Vice Principal': 'admin',
            'Class Teacher': 'teacher',
            'Subject Teacher': 'teacher',
            'Accountant': 'accountant',
            'Bus Driver': 'driver',
            'Peon': 'teacher',
            'Clerk': 'accountant',
          };
          const role: UserRole = roleMap[staff.role] ?? 'teacher';
          await saveUserSession(phone, role, sid, staff.name ?? '');

          const biometricEnabled = await getBiometricEnabled();
          if (!biometricEnabled) {
            const hasHardware = await LocalAuthentication.hasHardwareAsync();
            const isEnrolled = await LocalAuthentication.isEnrolledAsync();
            if (hasHardware && isEnrolled) {
              setShowBiometricModal(true);
              setLoadingVerify(false);
              return;
            }
          }
          navigateByRole(role);
          return;
        }

        // Check parents
        const parentSnap = await getDocs(query(
          collection(db, 'schools', sid, 'students'),
          where('parent_phone', '==', phone)
        ));
        if (!parentSnap.empty) {
          const student = parentSnap.docs[0].data();
          await saveUserSession(phone, 'parent', sid, student.parent_name ?? 'Parent');

          const biometricEnabled = await getBiometricEnabled();
          if (!biometricEnabled) {
            const hasHardware = await LocalAuthentication.hasHardwareAsync();
            const isEnrolled = await LocalAuthentication.isEnrolledAsync();
            if (hasHardware && isEnrolled) {
              setShowBiometricModal(true);
              setLoadingVerify(false);
              return;
            }
          }
          navigateByRole('parent');
          return;
        }
      }
      setGeneralError('Account not found. Please contact your school administrator.');
    } catch (error: any) {
      console.error('Verify OTP error:', error);
      setGeneralError(error?.message ?? 'Verification failed. Please try again.');
    } finally {
      setLoadingVerify(false);
    }
  }

  async function handleEnableBiometric(enable: boolean) {
    await setBiometricEnabled(enable);
    setShowBiometricModal(false);
    const session = await getUserSession();
    if (session && session.role) {
      navigateByRole(session.role);
    }
  }

  if (!biometricChecked) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.accent} />
        <Text style={styles.loadingText}>MyChalkPad</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.topSection}>
          <Text style={styles.appName}>MyChalkPad</Text>
          <Text style={styles.appSubtitle}>School ERP System</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Login to Your Account</Text>
          <Text style={styles.cardSubtitle}>Enter your registered phone number</Text>

          <View style={styles.phoneRow}>
            <View style={styles.prefixBox}>
              <Text style={styles.prefixText}>🇮🇳 +91</Text>
            </View>
            <TextInput
              style={[styles.phoneInput, phoneError ? styles.inputError : null]}
              placeholder="10-digit phone number"
              placeholderTextColor={COLORS.textSecondary}
              keyboardType="number-pad"
              maxLength={10}
              value={phone}
              onChangeText={(text) => { setPhone(text.replace(/\D/g, '')); setPhoneError(''); setGeneralError(''); }}
              editable={!otpSent}
            />
          </View>
          {phoneError ? <Text style={styles.errorText}>{phoneError}</Text> : null}

          {!otpSent ? (
            <TouchableOpacity
              style={[styles.accentButton, loadingSendOtp && styles.buttonDisabled]}
              onPress={handleSendOtp}
              disabled={loadingSendOtp}
              activeOpacity={0.8}
            >
              {loadingSendOtp ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.buttonText}>Send OTP</Text>}
            </TouchableOpacity>
          ) : null}

          {otpSent ? <Text style={styles.otpSentText}>OTP sent to +91 {phone}</Text> : null}

          {otpSent ? (
            <>
              <TextInput
                style={[styles.otpInput, otpError ? styles.inputError : null]}
                placeholder="Enter 6-digit OTP"
                placeholderTextColor={COLORS.textSecondary}
                keyboardType="number-pad"
                maxLength={6}
                value={otp}
                onChangeText={(text) => { setOtp(text.replace(/\D/g, '')); setOtpError(''); setGeneralError(''); }}
              />
              {otpError ? <Text style={styles.errorText}>{otpError}</Text> : null}

              <TouchableOpacity
                style={[styles.primaryButton, loadingVerify && styles.buttonDisabled]}
                onPress={handleVerifyOtp}
                disabled={loadingVerify}
                activeOpacity={0.8}
              >
                {loadingVerify ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.buttonText}>Verify & Login</Text>}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.resendButton}
                onPress={() => { setOtpSent(false); setOtp(''); setOtpError(''); setGeneralError(''); }}
                activeOpacity={0.7}
              >
                <Text style={styles.resendText}>Resend OTP</Text>
              </TouchableOpacity>
            </>
          ) : null}

          {generalError ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorBoxText}>{generalError}</Text>
            </View>
          ) : null}
        </View>

        <Text style={styles.footerText}>
          Only registered school users can log in.{'\n'}
          Contact your school admin to get access.
        </Text>
      </ScrollView>

      <Modal visible={showBiometricModal} transparent animationType="fade" onRequestClose={() => handleEnableBiometric(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Enable Fingerprint Login?</Text>
            <Text style={styles.modalBody}>Use your fingerprint to log in quickly next time without entering your phone number.</Text>
            <TouchableOpacity style={styles.accentButton} onPress={() => handleEnableBiometric(true)} activeOpacity={0.8}>
              <Text style={styles.buttonText}>Yes, Enable</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.outlineButton} onPress={() => handleEnableBiometric(false)} activeOpacity={0.7}>
              <Text style={styles.outlineButtonText}>No, Skip</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.primary },
  loadingContainer: { flex: 1, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#FFFFFF', fontSize: 24, fontWeight: 'bold', marginTop: 16 },
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  topSection: { alignItems: 'center', marginBottom: 32 },
  appName: { color: '#FFFFFF', fontSize: 36, fontWeight: 'bold', letterSpacing: 1 },
  appSubtitle: { color: COLORS.accent, fontSize: 16, marginTop: 6, fontWeight: '500' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 24, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8 },
  cardTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.textPrimary, marginBottom: 4 },
  cardSubtitle: { fontSize: 14, color: COLORS.textSecondary, marginBottom: 24 },
  phoneRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  prefixBox: { backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 14, marginRight: 8 },
  prefixText: { fontSize: 16, color: COLORS.textPrimary, fontWeight: '500' },
  phoneInput: { flex: 1, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 14, fontSize: 16, color: COLORS.textPrimary, backgroundColor: '#FFFFFF' },
  otpInput: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 14, fontSize: 20, color: COLORS.textPrimary, backgroundColor: '#FFFFFF', textAlign: 'center', letterSpacing: 8, marginTop: 16, marginBottom: 4 },
  inputError: { borderColor: COLORS.error },
  errorText: { color: COLORS.error, fontSize: 12, marginTop: 4, marginBottom: 8 },
  errorBox: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: COLORS.error, borderRadius: 8, padding: 12, marginTop: 12 },
  errorBoxText: { color: COLORS.error, fontSize: 14 },
  otpSentText: { color: COLORS.success, fontSize: 13, marginBottom: 4, marginTop: 8, fontWeight: '500' },
  primaryButton: { backgroundColor: COLORS.primary, borderRadius: 8, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  accentButton: { backgroundColor: COLORS.accent, borderRadius: 8, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
  resendButton: { alignItems: 'center', marginTop: 12, paddingVertical: 8 },
  resendText: { color: COLORS.primary, fontSize: 14, fontWeight: '600' },
  outlineButton: { borderWidth: 1.5, borderColor: COLORS.primary, borderRadius: 8, paddingVertical: 14, alignItems: 'center', marginTop: 12 },
  outlineButtonText: { color: COLORS.primary, fontSize: 16, fontWeight: '600' },
  footerText: { color: 'rgba(255,255,255,0.7)', fontSize: 12, textAlign: 'center', marginTop: 24, lineHeight: 18 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 24, width: '100%', maxWidth: 400, elevation: 8 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.textPrimary, marginBottom: 12 },
  modalBody: { fontSize: 15, color: COLORS.textSecondary, lineHeight: 22, marginBottom: 8 },
});
