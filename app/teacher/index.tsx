import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  collection, getDocs, query, where, doc, getDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getUserSession, clearUserSession } from '@/lib/storage';
import { signOut } from '@/lib/firebase';
import { COLORS } from '@/lib/theme';
import { Student } from '@/lib/types';

interface DashboardStats {
  totalStudents: number;
  presentToday: number;
  absentToday: number;
  attendancePercent: number;
}

export default function TeacherDashboard() {
  const [teacherName, setTeacherName] = useState('');
  const [assignedClass, setAssignedClass] = useState('');
  const [assignedSection, setAssignedSection] = useState('');
  const [schoolId, setSchoolId] = useState('school_001');
  const [stats, setStats] = useState<DashboardStats>({
    totalStudents: 0, presentToday: 0, absentToday: 0, attendancePercent: 0,
  });
  const [recentAbsent, setRecentAbsent] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { initDashboard(); }, []);

  async function initDashboard() {
    const session = await getUserSession();
    setTeacherName(session.name ?? 'Teacher');
    setSchoolId(session.schoolId);

    // Load teacher profile to get assigned class/section
    try {
      const staffSnap = await getDocs(
        query(collection(db, 'schools', session.schoolId, 'staff'),
          where('phone', '==', session.phone))
      );
      if (!staffSnap.empty) {
        const staffData = staffSnap.docs[0].data();
        const cls = staffData.assigned_class ?? '';
        const sec = staffData.assigned_section ?? '';
        setAssignedClass(cls);
        setAssignedSection(sec);
        await loadStats(session.schoolId, cls, sec);
      } else {
        setLoading(false);
      }
    } catch (e) {
      console.error('Init teacher dashboard error:', e);
      setLoading(false);
    }
  }

  async function loadStats(sid: string, cls: string, sec: string) {
    try {
      if (!cls || !sec) { setLoading(false); setRefreshing(false); return; }

      const studSnap = await getDocs(
        query(
          collection(db, 'schools', sid, 'students'),
          where('class', '==', cls),
          where('section', '==', sec)
        )
      );
      const students = studSnap.docs.map(d => ({ id: d.id, ...d.data() } as Student));
      const total = students.length;

      const today = new Date().toISOString().split('T')[0];
      const attSnap = await getDocs(
        query(
          collection(db, 'schools', sid, 'attendance'),
          where('class', '==', cls),
          where('section', '==', sec),
          where('date', '==', today)
        )
      );

      let present = 0, absent = 0;
      const absentIds = new Set<string>();
      attSnap.forEach(d => {
        const a = d.data();
        if (a.status === 'present') present++;
        else if (a.status === 'absent') { absent++; absentIds.add(a.student_id); }
      });

      const absentStudents = students.filter(s => absentIds.has(s.id)).slice(0, 5);
      const pct = total > 0 ? Math.round((present / total) * 100) : 0;

      setStats({ totalStudents: total, presentToday: present, absentToday: absent, attendancePercent: pct });
      setRecentAbsent(absentStudents);
    } catch (e) {
      console.error('Load stats error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadStats(schoolId, assignedClass, assignedSection);
  }, [schoolId, assignedClass, assignedSection]);

  async function handleLogout() {
    await signOut();
    await clearUserSession();
    router.replace('/');
  }

  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });

  const QUICK_ACTIONS = [
    { title: 'Mark Attendance', icon: 'clipboard-check', color: '#3B82F6', route: '/teacher/attendance' },
    { title: 'My Students', icon: 'account-group', color: '#10B981', route: '/teacher/students' },
    { title: 'Timetable', icon: 'calendar-month', color: '#8B5CF6', route: '/teacher/timetable' },
    { title: 'My Profile', icon: 'account-circle', color: '#F59E0B', route: '/teacher/profile' },
  ];

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.greeting}>Good {new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 17 ? 'Afternoon' : 'Evening'}!</Text>
            <Text style={styles.teacherName}>{teacherName}</Text>
          </View>
          <View style={styles.classBadge}>
            <Text style={styles.classBadgeText}>
              {assignedClass && assignedSection ? `Class ${assignedClass}-${assignedSection}` : 'No Class Assigned'}
            </Text>
          </View>
        </View>
        <Text style={styles.dateText}>{today}</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator color={COLORS.primary} size="large" />
          </View>
        ) : (
          <>
            {/* Attendance Stats */}
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <Text style={styles.statVal}>{stats.totalStudents}</Text>
                <Text style={styles.statLabel}>Total</Text>
              </View>
              <View style={[styles.statCard, styles.statCardPresent]}>
                <Text style={[styles.statVal, { color: COLORS.success }]}>{stats.presentToday}</Text>
                <Text style={styles.statLabel}>Present</Text>
              </View>
              <View style={[styles.statCard, styles.statCardAbsent]}>
                <Text style={[styles.statVal, { color: COLORS.error }]}>{stats.absentToday}</Text>
                <Text style={styles.statLabel}>Absent</Text>
              </View>
              <View style={[styles.statCard, styles.statCardPercent]}>
                <Text style={[styles.statVal, {
                  color: stats.attendancePercent >= 75 ? COLORS.success : stats.attendancePercent >= 60 ? COLORS.warning : COLORS.error
                }]}>
                  {stats.attendancePercent}%
                </Text>
                <Text style={styles.statLabel}>Today</Text>
              </View>
            </View>

            {/* Attendance Progress Bar */}
            <View style={styles.progressCard}>
              <View style={styles.progressTop}>
                <Text style={styles.progressLabel}>Today's Attendance</Text>
                <Text style={styles.progressPercent}>{stats.attendancePercent}%</Text>
              </View>
              <View style={styles.progressBar}>
                <View style={[
                  styles.progressFill,
                  {
                    width: `${stats.attendancePercent}%`,
                    backgroundColor: stats.attendancePercent >= 75 ? COLORS.success : stats.attendancePercent >= 60 ? COLORS.warning : COLORS.error,
                  }
                ]} />
              </View>
            </View>

            {/* Quick Actions */}
            <Text style={styles.sectionLabel}>QUICK ACTIONS</Text>
            <View style={styles.actionsGrid}>
              {QUICK_ACTIONS.map((action, i) => (
                <TouchableOpacity
                  key={i}
                  style={styles.actionCard}
                  onPress={() => router.push(action.route as any)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.actionIcon, { backgroundColor: action.color + '18' }]}>
                    <MaterialCommunityIcons name={action.icon as any} size={28} color={action.color} />
                  </View>
                  <Text style={styles.actionTitle}>{action.title}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Recent Absences */}
            {recentAbsent.length > 0 && (
              <>
                <Text style={styles.sectionLabel}>ABSENT TODAY</Text>
                <View style={styles.absentCard}>
                  {recentAbsent.map((student, i) => (
                    <View key={student.id} style={[styles.absentRow, i < recentAbsent.length - 1 && styles.absentRowBorder]}>
                      <View style={styles.absentAvatar}>
                        <Text style={styles.absentAvatarText}>{student.name.charAt(0)}</Text>
                      </View>
                      <View style={styles.absentInfo}>
                        <Text style={styles.absentName}>{student.name}</Text>
                        <Text style={styles.absentMeta}>Roll {student.roll_number} • {student.parent_phone}</Text>
                      </View>
                      <View style={styles.absentBadge}>
                        <Text style={styles.absentBadgeText}>Absent</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </>
            )}

            {/* No Class Warning */}
            {!assignedClass && !loading && (
              <View style={styles.warningCard}>
                <MaterialCommunityIcons name="alert-circle" size={24} color={COLORS.warning} />
                <Text style={styles.warningText}>
                  No class assigned yet. Contact your principal to get a class assigned to your profile.
                </Text>
              </View>
            )}

            {/* Logout Button */}
            <TouchableOpacity
              style={styles.logoutBtn}
              onPress={handleLogout}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="logout" size={18} color={COLORS.error} />
              <Text style={styles.logoutText}>Logout</Text>
            </TouchableOpacity>

            <View style={{ height: 20 }} />
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  header: { backgroundColor: COLORS.primary, paddingTop: 52, paddingBottom: 20, paddingHorizontal: 16 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  greeting: { color: 'rgba(255,255,255,0.7)', fontSize: 14 },
  teacherName: { color: '#FFFFFF', fontSize: 22, fontWeight: 'bold', marginTop: 2 },
  classBadge: { backgroundColor: COLORS.accent, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 },
  classBadgeText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  dateText: { color: 'rgba(255,255,255,0.6)', fontSize: 13, marginTop: 8 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  statsGrid: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  statCard: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 12, padding: 12, alignItems: 'center', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3 },
  statCardPresent: { borderBottomWidth: 3, borderBottomColor: COLORS.success },
  statCardAbsent: { borderBottomWidth: 3, borderBottomColor: COLORS.error },
  statCardPercent: { borderBottomWidth: 3, borderBottomColor: COLORS.accent },
  statVal: { fontSize: 22, fontWeight: 'bold', color: COLORS.textPrimary },
  statLabel: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  progressCard: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, marginBottom: 16, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3 },
  progressTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  progressLabel: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary },
  progressPercent: { fontSize: 14, fontWeight: 'bold', color: COLORS.primary },
  progressBar: { height: 10, backgroundColor: COLORS.border, borderRadius: 5, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 5 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary, letterSpacing: 1, marginBottom: 10, marginTop: 4, textTransform: 'uppercase' },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  actionCard: { width: '47%', backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, alignItems: 'center', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3 },
  actionIcon: { width: 56, height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  actionTitle: { fontSize: 13, fontWeight: '600', color: COLORS.textPrimary, textAlign: 'center' },
  absentCard: { backgroundColor: '#FFFFFF', borderRadius: 12, marginBottom: 16, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3, overflow: 'hidden' },
  absentRow: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10 },
  absentRowBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  absentAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.error + '18', justifyContent: 'center', alignItems: 'center' },
  absentAvatarText: { fontSize: 16, fontWeight: 'bold', color: COLORS.error },
  absentInfo: { flex: 1 },
  absentName: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary },
  absentMeta: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  absentBadge: { backgroundColor: COLORS.error + '18', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  absentBadgeText: { fontSize: 11, fontWeight: '700', color: COLORS.error },
  warningCard: { backgroundColor: '#FFF7ED', borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 16, borderWidth: 1, borderColor: COLORS.warning + '40' },
  warningText: { flex: 1, fontSize: 14, color: COLORS.textSecondary, lineHeight: 20 },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderColor: COLORS.error, borderRadius: 8, paddingVertical: 14 },
  logoutText: { color: COLORS.error, fontSize: 15, fontWeight: '700' },
});