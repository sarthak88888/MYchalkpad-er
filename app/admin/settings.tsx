import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { signOut } from '@/lib/firebase';
import { getUserSession, clearUserSession } from '@/lib/storage';
import { setLanguage } from '@/lib/i18n';
import { clearUserContext } from '@/lib/sentry';
import { COLORS } from '@/lib/theme';

export default function SettingsScreen() {
  const [schoolId, setSchoolId] = useState('school_001');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentLang, setCurrentLang] = useState<'en' | 'hi'>('en');

  const [schoolName, setSchoolName] = useState('');
  const [udiseCode, setUdiseCode] = useState('');
  const [academicYear, setAcademicYear] = useState('');
  const [principalName, setPrincipalName] = useState('');
  const [principalPhone, setPrincipalPhone] = useState('');
  const [address, setAddress] = useState('');

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    initSettings();
  }, []);

  async function initSettings() {
    const session = await getUserSession();
    setSchoolId(session.schoolId);
    const { getLanguagePreference } = await import('@/lib/storage');
    const lang = await getLanguagePreference();
    setCurrentLang(lang);
    await fetchSchool(session.schoolId);
  }

  async function fetchSchool(sid: string) {
    try {
      const snap = await getDoc(doc(db, 'schools', sid));
      if (snap.exists()) {
        const d = snap.data();
        setSchoolName(d.name ?? '');
        setUdiseCode(d.udise_code ?? '');
        setAcademicYear(d.academic_year ?? '');
        setPrincipalName(d.principal ?? '');
        setPrincipalPhone(d.phone ?? '');
        setAddress(d.address ?? '');
      }
    } catch (e) {
      console.error('Fetch school error:', e);
    } finally {
      setLoading(false);
    }
  }

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!schoolName.trim()) errs.schoolName = 'School name is required';
    if (!udiseCode.trim()) errs.udiseCode = 'UDISE code is required';
    if (!academicYear.trim()) errs.academicYear = 'Academic year is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'schools', schoolId), {
        name: schoolName.trim(),
        udise_code: udiseCode.trim(),
        academic_year: academicYear.trim(),
        principal: principalName.trim(),
        phone: principalPhone.trim(),
        address: address.trim(),
      });
      Alert.alert('Success', 'School settings saved successfully.');
    } catch (e) {
      Alert.alert('Error', 'Failed to save settings. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  function handleLanguageSwitch(lang: 'en' | 'hi') {
    setLanguage(lang);
    setCurrentLang(lang);
    Alert.alert(
      'Language Changed',
      lang === 'hi'
        ? 'भाषा हिंदी में बदल दी गई है।'
        : 'Language changed to English.'
    );
  }

  async function handleLogout() {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await signOut();
          await clearUserSession();
          clearUserContext();
          router.replace('/');
        },
      },
    ]);
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={COLORS.primary} size="large" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.root}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Settings</Text>
          <Text style={styles.headerSubtitle}>
            Manage school information
          </Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* School Info Section */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionTitleRow}>
              <MaterialCommunityIcons
                name="school"
                size={20}
                color={COLORS.primary}
              />
              <Text style={styles.sectionTitle}>School Information</Text>
            </View>

            <Text style={styles.label}>School Name *</Text>
            <TextInput
              style={[styles.input, errors.schoolName ? styles.inputErr : null]}
              placeholder="Enter school name"
              placeholderTextColor={COLORS.textSecondary}
              value={schoolName}
              onChangeText={setSchoolName}
            />
            {errors.schoolName ? (
              <Text style={styles.errorText}>{errors.schoolName}</Text>
            ) : null}

            <Text style={styles.label}>UDISE Code *</Text>
            <TextInput
              style={[styles.input, errors.udiseCode ? styles.inputErr : null]}
              placeholder="11-digit UDISE code"
              placeholderTextColor={COLORS.textSecondary}
              keyboardType="number-pad"
              maxLength={11}
              value={udiseCode}
              onChangeText={setUdiseCode}
            />
            {errors.udiseCode ? (
              <Text style={styles.errorText}>{errors.udiseCode}</Text>
            ) : null}

            <Text style={styles.label}>Academic Year *</Text>
            <TextInput
              style={[
                styles.input,
                errors.academicYear ? styles.inputErr : null,
              ]}
              placeholder="e.g. 2025-2026"
              placeholderTextColor={COLORS.textSecondary}
              value={academicYear}
              onChangeText={setAcademicYear}
            />
            {errors.academicYear ? (
              <Text style={styles.errorText}>{errors.academicYear}</Text>
            ) : null}

            <Text style={styles.label}>Address</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="School address"
              placeholderTextColor={COLORS.textSecondary}
              multiline
              numberOfLines={3}
              value={address}
              onChangeText={setAddress}
            />
          </View>

          {/* Principal Info Section */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionTitleRow}>
              <MaterialCommunityIcons
                name="account-tie"
                size={20}
                color={COLORS.primary}
              />
              <Text style={styles.sectionTitle}>Principal Information</Text>
            </View>

            <Text style={styles.label}>Principal Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Principal full name"
              placeholderTextColor={COLORS.textSecondary}
              value={principalName}
              onChangeText={setPrincipalName}
            />

            <Text style={styles.label}>Contact Number</Text>
            <TextInput
              style={styles.input}
              placeholder="10-digit phone number"
              placeholderTextColor={COLORS.textSecondary}
              keyboardType="number-pad"
              maxLength={10}
              value={principalPhone}
              onChangeText={(v) =>
                setPrincipalPhone(v.replace(/\D/g, ''))
              }
            />
          </View>

          {/* Save Button */}
          <TouchableOpacity
            style={[styles.saveButton, saving && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.8}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <MaterialCommunityIcons
                  name="content-save"
                  size={18}
                  color="#FFFFFF"
                />
                <Text style={styles.saveButtonText}>Save Settings</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Language Section */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionTitleRow}>
              <MaterialCommunityIcons
                name="translate"
                size={20}
                color={COLORS.primary}
              />
              <Text style={styles.sectionTitle}>Language / भाषा</Text>
            </View>

            <View style={styles.langRow}>
              <TouchableOpacity
                style={[
                  styles.langButton,
                  currentLang === 'en' && styles.langButtonActive,
                ]}
                onPress={() => handleLanguageSwitch('en')}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.langButtonText,
                    currentLang === 'en' && styles.langButtonTextActive,
                  ]}
                >
                  English
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.langButton,
                  currentLang === 'hi' && styles.langButtonActive,
                ]}
                onPress={() => handleLanguageSwitch('hi')}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.langButtonText,
                    currentLang === 'hi' && styles.langButtonTextActive,
                  ]}
                >
                  हिंदी
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* App Info Section */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionTitleRow}>
              <MaterialCommunityIcons
                name="information"
                size={20}
                color={COLORS.primary}
              />
              <Text style={styles.sectionTitle}>App Information</Text>
            </View>

            {[
              { label: 'App Name', value: 'MyChalkPad' },
              { label: 'Version', value: '1.0.0' },
              { label: 'Build', value: 'Production' },
              { label: 'Support', value: 'support@mychalkpad.com' },
            ].map((row, i) => (
              <View key={i} style={styles.infoRow}>
                <Text style={styles.infoLabel}>{row.label}</Text>
                <Text style={styles.infoValue}>{row.value}</Text>
              </View>
            ))}
          </View>

          {/* Logout */}
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={handleLogout}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="logout" size={20} color="#FFFFFF" />
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>

          <View style={{ height: 32 }} />
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  header: {
    backgroundColor: COLORS.primary,
    paddingTop: 52,
    paddingBottom: 20,
    paddingHorizontal: 16,
  },
  headerTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: 'bold' },
  headerSubtitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    marginTop: 4,
  },
  scrollContent: { padding: 16 },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 6,
    marginTop: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  inputErr: { borderColor: COLORS.error },
  textArea: { height: 80, textAlignVertical: 'top' },
  errorText: { color: COLORS.error, fontSize: 12, marginTop: 4 },
  saveButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
  },
  saveButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
  langRow: { flexDirection: 'row', gap: 12 },
  langButton: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  langButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  langButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  langButtonTextActive: { color: '#FFFFFF' },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  infoLabel: { fontSize: 14, color: COLORS.textSecondary },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  logoutButton: {
    backgroundColor: COLORS.error,
    borderRadius: 8,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 8,
  },
  logoutText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
});
```

---

**✅ FILE GROUP 5 COMPLETE**

**Folder summary — all 3 files go in `app/admin/`:**
```
app/
└── admin/
    ├── students.tsx
    ├── reports.tsx
    └── settings.tsx