import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  getDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { signOut } from '@/lib/firebase';
import { getUserSession, clearUserSession } from '@/lib/storage';
import { COLORS } from '@/lib/theme';
import { clearUserContext } from '@/lib/sentry';

interface DashboardStats {
  totalStudents: number;
  totalStaff: number;
  todayAttendancePercent: number;
  smsSentThisMonth: number;
}

interface ModuleCard {
  id: string;
  title: string;
  icon: string;
  route: string;
  color: string;
}

const MODULES: ModuleCard[] = [
  { id: '1', title: 'Admissions', icon: 'account-plus', route: '/admin/admissions', color: '#3B82F6' },
  { id: '2', title: 'Marks Entry', icon: 'pencil-box', route: '/admin/marks', color: '#8B5CF6' },
  { id: '3', title: 'Fee Management', icon: 'cash-multiple', route: '/admin/fees', color: '#22C55E' },
  { id: '4', title: 'Report Cards', icon: 'file-certificate', route: '/admin/report-cards', color: '#F59E0B' },
  { id: '5', title: 'Timetable', icon: 'calendar-month', route: '/admin/timetable', color: '#06B6D4' },
  { id: '6', title: 'Staff', icon: 'badge-account', route: '/admin/staff', color: '#EC4899' },
  { id: '7', title: 'Complaints', icon: 'message-alert', route: '/admin/complaints', color: '#EF4444' },
  { id: '8', title: 'PTM Meetings', icon: 'account-group', route: '/admin/ptm', color: '#10B981' },
  { id: '9', title: 'SMS Dashboard', icon: 'message-text', route: '/admin/sms-dashboard', color: '#6366F1' },
  { id: '10', title: 'UDISE Export', icon: 'export', route: '/admin/udise-export', color: '#0EA5E9' },
  { id: '11', title: 'Fee Defaulters', icon: 'alert-circle', route: '/admin/fee-defaulters', color: '#DC2626' },
  { id: '12', title: 'Transfer Cert.', icon: 'file-move', route: '/admin/transfer-certificates', color: '#7C3AED' },
  { id: '13', title: 'Dropout Track', icon: 'account-remove', route: '/admin/dropout-tracking', color: '#B45309' },
  { id: '14', title: 'Rankings', icon: 'podium', route: '/admin/rankings', color: '#D97706' },
  { id: '15', title: 'Inspection', icon: 'clipboard-check', route: '/admin/inspection-prep', color: '#059669' },
  { id: '16', title: 'Performance', icon: 'star-circle', route: '/admin/performance', color: '#F97316' },
  { id: '17', title: 'Bulk SMS', icon: 'message-flash', route: '/admin/bulk-sms', color: '#0284C7' },
  { id: '18', title: 'Progress Report', icon: 'trending-up', route: '/admin/progress-report', color: '#16A34A' },
];

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalStudents: 0,
    totalStaff: 0,
    todayAttendancePercent: 0,
    smsSentThisMonth: 0,
  });
  const [schoolName, setSchoolName] = useState('My School');
  const [adminName, setAdminName] = useState('Admin');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [schoolId, setSchoolId] = useState('school_001');

  useEffect(() => {
    initDashboard();
  }, []);

  async function initDashboard() {
    const session = await getUserSession();
    if (!session) {
      router.replace('/');
      return;
    }
    setSchoolId(session.schoolId);
    setAdminName(session.name ?? 'Admin');
    await fetchDashboardData(session.schoolId);
  }

  async function fetchDashboardData(sid: string) {
    try {
      const schoolRef = doc(db, 'schools', sid);
      const schoolSnap = await getDoc(schoolRef);
      if (schoolSnap.exists()) {
        setSchoolName(schoolSnap.data().name ?? 'My School');
      }

      const studentsSnap = await getDocs(
        collection(db, 'schools', sid, 'students')
      );
      const totalStudents = studentsSnap.size;

      const staffSnap = await getDocs(
        collection(db, 'schools', sid, 'staff')
      );
      const totalStaff = staffSnap.size;

      const today = new Date().toISOString().split('T')[0];
      const attendanceSnap = await getDocs(
        query(
          collection(db, 'schools', sid, 'attendance'),
          where('date', '==', today)
        )
      );
      let presentCount = 0;
      let totalCount = 0;
      attendanceSnap.forEach((d) => {
        totalCount++;
        if (d.data().status === 'present') presentCount++;
      });
      const todayAttendancePercent =
        totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0;

      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
        .toISOString()
        .split('T')[0];
      const smsSnap = await getDocs(
        query(
          collection(db, 'schools', sid, 'sms_logs'),
          where('sent_at', '>=', monthStart)
        )
      );
      const smsSentThisMonth = smsSnap.size;

      setStats({
        totalStudents,
        totalStaff,
        todayAttendancePercent,
        smsSentThisMonth,
      });
    } catch (error) {
      console.error('Dashboard fetch error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchDashboardData(schoolId);
  }, [schoolId]);

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

  const statCards = [
    {
      label: 'Total Students',
      value: stats.totalStudents,
      icon: 'account-school',
      color: COLORS.primary,
    },
    {
      label: 'Total Staff',
      value: stats.totalStaff,
      icon: 'badge-account',
      color: '#8B5CF6',
    },
    {
      label: "Today's %",
      value: `${stats.todayAttendancePercent}%`,
      icon: 'clipboard-check',
      color: COLORS.success,
    },
    {
      label: 'SMS Sent',
      value: stats.smsSentThisMonth,
      icon: 'message-text',
      color: COLORS.accent,
    },
  ];

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerTitle}>MyChalkPad</Text>
            <Text style={styles.schoolName}>{schoolName}</Text>
          </View>
          <View style={styles.headerRight}>
            <MaterialCommunityIcons
              name="account-circle"
              size={36}
              color="rgba(255,255,255,0.8)"
            />
            <Text style={styles.adminName} numberOfLines={1}>
              {adminName}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Stats Row */}
        {loading ? (
          <View style={styles.statsLoadingContainer}>
            <ActivityIndicator color={COLORS.primary} size="large" />
          </View>
        ) : (
          <View style={styles.statsRow}>
            {statCards.map((stat, index) => (
              <View key={index} style={styles.statCard}>
                <MaterialCommunityIcons
                  name={stat.icon as any}
                  size={24}
                  color={stat.color}
                />
                <Text style={styles.statValue}>{stat.value}</Text>
                <Text style={styles.statLabel}>{stat.label}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Section Title */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>School Modules</Text>
          <Text style={styles.sectionSubtitle}>
            Tap any module to manage
          </Text>
        </View>

        {/* 3-Column Module Grid */}
        <View style={styles.modulesGrid}>
          {MODULES.map((module) => (
            <TouchableOpacity
              key={module.id}
              style={styles.moduleCard}
              onPress={() => router.push(module.route as any)}
              activeOpacity={0.75}
            >
              <View
                style={[
                  styles.moduleIconCircle,
                  { backgroundColor: module.color + '18' },
                ]}
              >
                <MaterialCommunityIcons
                  name={module.icon as any}
                  size={28}
                  color={module.color}
                />
              </View>
              <Text style={styles.moduleTitle} numberOfLines={2}>
                {module.title}
              </Text>
              <View
                style={[
                  styles.moduleBottomBorder,
                  { backgroundColor: COLORS.accent },
                ]}
              />
            </TouchableOpacity>
          ))}
        </View>

        {/* Logout Button */}
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons name="logout" size={20} color="#FFFFFF" />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>

        <View style={styles.bottomPadding} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    backgroundColor: COLORS.primary,
    paddingTop: 52,
    paddingBottom: 20,
    paddingHorizontal: 16,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: 'bold',
  },
  schoolName: {
    color: COLORS.accent,
    fontSize: 13,
    marginTop: 2,
    fontWeight: '500',
  },
  headerRight: {
    alignItems: 'center',
  },
  adminName: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 11,
    marginTop: 2,
    maxWidth: 80,
    textAlign: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  statsLoadingContainer: {
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginTop: 6,
  },
  statLabel: {
    fontSize: 10,
    color: COLORS.textSecondary,
    marginTop: 2,
    textAlign: 'center',
  },
  sectionHeader: {
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  modulesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 24,
  },
  moduleCard: {
    width: '31%',
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    overflow: 'hidden',
  },
  moduleIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  moduleTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textPrimary,
    textAlign: 'center',
    lineHeight: 15,
    minHeight: 30,
  },
  moduleBottomBorder: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  logoutButton: {
    backgroundColor: COLORS.error,
    borderRadius: 8,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
  },
  logoutText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  bottomPadding: {
    height: 20,
  },
});
