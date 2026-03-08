import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, Switch,
} from 'react-native';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getUserSession, clearUserSession, getBiometricEnabled, setBiometricEnabled, getLanguagePreference, setLanguage } from '@/lib/storage';
import { signOut } from '@/lib/firebase';
import { COLORS } from '@/lib/theme';
import { Staff } from '@/lib/types';

export default function TeacherProfileScreen() {
  const [teacher, setTeacher] = useState<Staff | null>(null);
  const [loading, setLoading] = useState(true);
  const [phone, setPhone] = useState('');
  const [biometricEnabled, setBiometricEnabledState] = useState(false);
  const [currentLang, setCurrentLang] = useState('en');

  useEffect(() => { initScreen(); }, []);

  async function initScreen() {
    const session = await getUserSession();
    setPhone(session.phone);
    const bio = await getBiometricEnabled();
    setBiometricEnabledState(bio);
    const lang = await getLanguagePreference();
    setCurrentLang(lang);

    try {
      const snap = await getDocs(query(
        collection(db, 'schools', session.schoolId, 'staff'),
        where('phone', '==', session.phone)
      ));
      if (!snap.empty) {
        setTeacher({ id: snap.docs[0].id, ...snap.docs[0].data() } as Staff);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function handleBiometricToggle(val: boolean) {
    setBiometricEnabledState(val);
    await setBiometricEnabled(val);
  }

  async function handleLanguageChange(lang: string) {
    setCurrentLang(lang);
    await setLanguage(lang as any);
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
          router.replace('/');
        },
      },
    ]);
  }

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator color={COLORS.primary} size="large" /></View>;
  }

  const ROLE_COLORS: Record<string, string> = {
    'Principal': '#7C3AED', 'Vice Principal': '#6366F1', 'Class Teacher': '#0EA5E9',
    'Subject Teacher': '#10B981',
  };
  const roleColor = teacher ? (ROLE_COLORS[teacher.role] ?? COLORS.primary) : COLORS.primary;

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Profile</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Avatar */}
        <View style={styles.avatarSection}>
          <View style={[styles.avatarCircle, { backgroundColor: roleColor + '18' }]}>
            <Text style={[styles.avatarText, { color: roleColor }]}>
              {teacher?.name.charAt(0).toUpperCase() ?? phone.charAt(0)}
            </Text>
          </View>
          <Text style={styles.profileName}>{teacher?.name ?? 'Teacher'}</Text>
          {teacher?.role && (
            <View style={[styles.roleBadge, { backgroundColor: roleColor + '18' }]}>
              <Text style={[styles.roleText, { color: roleColor }]}>{teacher.role}</Text>
            </View>
          )}
          <Text style={styles.profilePhone}>+91 {phone}</Text>
        </View>

        {/* Class Assignment */}
        {teacher && (
          <View style={styles.assignmentCard}>
            <MaterialCommunityIcons name="school" size={20} color={COLORS.primary} />
            <View style={styles.assignmentInfo}>
              <Text style={styles.assignmentLabel}>Assigned Class</Text>
              <Text style={styles.assignmentValue}>
                {teacher.assigned_class && teacher.assigned_section
                  ? `Class ${teacher.assigned_class}-${teacher.assigned_section}`
                  : 'Not assigned yet'}
              </Text>
            </View>
          </View>
        )}

        {/* Profile Details */}
        {teacher && (
          <View style={styles.detailsCard}>
            <Text style={styles.cardSectionLabel}>PROFESSIONAL INFO</Text>
            {[
              { icon: 'book', label: 'Subject', value: teacher.subject || 'Not specified' },
              { icon: 'cash', label: 'Monthly Salary', value: `₹${teacher.salary?.toLocaleString() ?? 'N/A'}` },
              { icon: 'calendar', label: 'Joining Date', value: teacher.joining_date || 'N/A' },
              { icon: 'email', label: 'Email', value: teacher.email || 'N/A' },
              { icon: 'map-marker', label: 'Address', value: teacher.address || 'N/A' },
            ].map((row, i) => (
              <View key={i} style={[styles.detailRow, i < 4 && styles.detailRowBorder]}>
                <MaterialCommunityIcons name={row.icon as any} size={18} color={COLORS.primary} style={{ width: 26 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.detailLabel}>{row.label}</Text>
                  <Text style={styles.detailValue}>{row.value}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Settings */}
        <View style={styles.settingsCard}>
          <Text style={styles.cardSectionLabel}>SETTINGS</Text>

          {/* Biometric */}
          <View style={styles.settingRow}>
            <MaterialCommunityIcons name="fingerprint" size={22} color={COLORS.primary} />
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Fingerprint Login</Text>
              <Text style={styles.settingSubLabel}>Use biometric to login quickly</Text>
            </View>
            <Switch
              value={biometricEnabled}
              onValueChange={handleBiometricToggle}
              trackColor={{ false: COLORS.border, true: COLORS.primary + '60' }}
              thumbColor={biometricEnabled ? COLORS.primary : '#FFFFFF'}
            />
          </View>

          {/* Language */}
          <View style={[styles.settingRow, { borderTopWidth: 1, borderTopColor: COLORS.border }]}>
            <MaterialCommunityIcons name="translate" size={22} color={COLORS.primary} />
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Language</Text>
            </View>
            <View style={styles.langToggle}>
              {[
                { key: 'en', label: 'EN' },
                { key: 'hi', label: 'हि' },
              ].map(l => (
                <TouchableOpacity
                  key={l.key}
                  style={[styles.langBtn, currentLang === l.key && styles.langBtnActive]}
                  onPress={() => handleLanguageChange(l.key)}
                >
                  <Text style={[styles.langBtnText, currentLang === l.key && styles.langBtnTextActive]}>
                    {l.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* App Info */}
        <View style={styles.appInfoCard}>
          <Text style={styles.cardSectionLabel}>APP INFO</Text>
          <View style={styles.appInfoRow}>
            <Text style={styles.appInfoLabel}>App</Text>
            <Text style={styles.appInfoValue}>MyChalkPad</Text>
          </View>
          <View style={styles.appInfoRow}>
            <Text style={styles.appInfoLabel}>Version</Text>
            <Text style={styles.appInfoValue}>1.0.0</Text>
          </View>
          <View style={styles.appInfoRow}>
            <Text style={styles.appInfoLabel}>Role</Text>
            <Text style={styles.appInfoValue}>Class Teacher</Text>
          </View>
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
          <MaterialCommunityIcons name="logout" size={18} color="#FFFFFF" />
          <Text style={styles.logoutBtnText}>Logout</Text>
        </TouchableOpacity>

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  header: { backgroundColor: COLORS.primary, paddingTop: 52, paddingBottom: 16, paddingHorizontal: 16 },
  headerTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: 'bold' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: 16 },
  avatarSection: { alignItems: 'center', paddingVertical: 20 },
  avatarCircle: { width: 88, height: 88, borderRadius: 44, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  avatarText: { fontSize: 36, fontWeight: 'bold' },
  profileName: { fontSize: 24, fontWeight: 'bold', color: COLORS.textPrimary },
  roleBadge: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 5, marginTop: 8 },
  roleText: { fontSize: 13, fontWeight: '700' },
  profilePhone: { fontSize: 14, color: COLORS.textSecondary, marginTop: 6 },
  assignmentCard: { backgroundColor: COLORS.primary, borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  assignmentInfo: {},
  assignmentLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '600' },
  assignmentValue: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold', marginTop: 2 },
  detailsCard: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, marginBottom: 12, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3 },
  cardSectionLabel: { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary, letterSpacing: 0.8, marginBottom: 12, textTransform: 'uppercase' },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 10 },
  detailRowBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  detailLabel: { fontSize: 11, color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  detailValue: { fontSize: 14, color: COLORS.textPrimary, fontWeight: '500', marginTop: 2 },
  settingsCard: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, marginBottom: 12, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3 },
  settingRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12 },
  settingInfo: { flex: 1 },
  settingLabel: { fontSize: 15, fontWeight: '600', color: COLORS.textPrimary },
  settingSubLabel: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  langToggle: { flexDirection: 'row', borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border },
  langBtn: { paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#FFFFFF' },
  langBtnActive: { backgroundColor: COLORS.primary },
  langBtnText: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  langBtnTextActive: { color: '#FFFFFF' },
  appInfoCard: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, marginBottom: 12, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3 },
  appInfoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  appInfoLabel: { fontSize: 14, color: COLORS.textSecondary },
  appInfoValue: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary },
  logoutBtn: { backgroundColor: COLORS.error, borderRadius: 8, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  logoutBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: 'bold' },
});
