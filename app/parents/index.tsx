import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  collection, getDocs, query, where, orderBy, limit,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getUserSession, clearUserSession } from '@/lib/storage';
import { signOut } from '@/lib/firebase';
import { COLORS } from '@/lib/theme';
import { Student, AttendanceRecord, FeeRecord } from '@/lib/types';

export default function ParentDashboard() {
  const [parentPhone, setParentPhone] = useState('');
  const [schoolId, setSchoolId] = useState('school_001');
  const [children, setChildren] = useState<Student[]>([]);
  const [selectedChild, setSelectedChild] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [attendancePercent, setAttendancePercent] = useState<number | null>(null);
  const [pendingFees, setPendingFees] = useState(0);
  const [recentAttendance, setRecentAttendance] = useState<AttendanceRecord[]>([]);
  const [lastMarked, setLastMarked] = useState<string | null>(null);

  useEffect(() => { initDashboard(); }, []);
  useEffect(() => { if (selectedChild) loadChildData(selectedChild); }, [selectedChild]);

  async function initDashboard() {
    const session = await getUserSession();
    setParentPhone(session.phone);
    setSchoolId(session.schoolId);
    await loadChildren(session.schoolId, session.phone);
  }

  async function loadChildren(sid: string, phone: string) {
    try {
      const snap = await getDocs(query(
        collection(db, 'schools', sid, 'students'),
        where('parent_phone', '==', phone)
      ));
      const kids = snap.docs.map(d => ({ id: d.id, ...d.data() } as Student));
      setChildren(kids);
      if (kids.length > 0) setSelectedChild(kids[0]);
    } catch (e) {
      console.error('Load children error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function loadChildData(child: Student) {
    try {
      const [attSnap, feeSnap] = await Promise.all([
        getDocs(query(
          collection(db, 'schools', schoolId, 'attendance'),
          where('student_id', '==', child.id),
          orderBy('date', 'desc'),
          limit(30)
        )),
        getDocs(query(
          collection(db, 'schools', schoolId, 'fees'),
          where('student_id', '==', child.id),
          where('status', 'in', ['due', 'overdue'])
        )),
      ]);

      const attRecords = attSnap.docs.map(d => d.data() as AttendanceRecord);
      setRecentAttendance(attRecords.slice(0, 7));
      if (attRecords.length > 0) {
        const present = attRecords.filter(r => r.status === 'present').length;
        setAttendancePercent(Math.round((present / attRecords.length) * 100));
      } else {
        setAttendancePercent(null);
      }
      if (attRecords.length > 0) setLastMarked(attRecords[0].date);

      const pending = feeSnap.docs.reduce((sum, d) => sum + (d.data().amount ?? 0), 0);
      setPendingFees(pending);
    } catch (e) {
      console.error('Load child data error:', e);
    }
  }

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    if (selectedChild) loadChildData(selectedChild);
    else loadChildren(schoolId, parentPhone);
  }, [schoolId, parentPhone, selectedChild]);

  async function handleLogout() {
    await signOut();
    await clearUserSession();
    router.replace('/');
  }

  function getAttendanceColor() {
    if (attendancePercent === null) return COLORS.textSecondary;
    if (attendancePercent >= 75) return COLORS.success;
    if (attendancePercent >= 60) return COLORS.warning;
    return COLORS.error;
  }

  function getStatusColor(status: string) {
    if (status === 'present') return COLORS.success;
    if (status === 'absent') return COLORS.error;
    return COLORS.warning;
  }

  function getStatusIcon(status: string) {
    if (status === 'present') return 'check-circle';
    if (status === 'absent') return 'close-circle';
    return 'clock-alert';
  }

  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  const QUICK_LINKS = [
    { title: 'Attendance', icon: 'clipboard-check', color: '#3B82F6', route: '/parent/attendance' },
    { title: 'Marks', icon: 'pencil-box', color: '#8B5CF6', route: '/parent/marks' },
    { title: 'Fees', icon: 'cash', color: '#10B981', route: '/parent/fees' },
    { title: 'Complaints', icon: 'message-alert', color: '#F97316', route: '/parent/complaints' },
  ];

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.greeting}>Welcome back!</Text>
            <Text style={styles.parentPhone}>+91 {parentPhone}</Text>
          </View>
          <TouchableOpacity style={styles.logoutIcon} onPress={handleLogout} activeOpacity={0.8}>
            <MaterialCommunityIcons name="logout" size={22} color="rgba(255,255,255,0.8)" />
          </TouchableOpacity>
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
        ) : children.length === 0 ? (
          <View style={styles.noChildCard}>
            <MaterialCommunityIcons name="account-off" size={48} color={COLORS.textSecondary} />
            <Text style={styles.noChildText}>No student linked to your phone number.</Text>
            <Text style={styles.noChildSub}>Please contact your school to link your child's account.</Text>
          </View>
        ) : (
          <>
            {/* Child Selector */}
            {children.length > 1 && (
              <View style={styles.childSelector}>
                {children.map(child => (
                  <TouchableOpacity
                    key={child.id}
                    style={[styles.childChip, selectedChild?.id === child.id && styles.childChipActive]}
                    onPress={() => setSelectedChild(child)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.childChipText, selectedChild?.id === child.id && styles.childChipTextActive]}>
                      {child.name.split(' ')[0]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {selectedChild && (
              <>
                {/* Child Card */}
                <View style={styles.childCard}>
                  <View style={styles.childAvatar}>
                    <Text style={styles.childAvatarText}>{selectedChild.name.charAt(0)}</Text>
                  </View>
                  <View style={styles.childInfo}>
                    <Text style={styles.childName}>{selectedChild.name}</Text>
                    <Text style={styles.childClass}>
                      Class {selectedChild.class}-{selectedChild.section} • Roll {selectedChild.roll_number}
                    </Text>
                    {lastMarked && (
                      <Text style={styles.lastMarked}>Last attendance: {lastMarked}</Text>
                    )}
                  </View>
                </View>

                {/* Stats Row */}
                <View style={styles.statsRow}>
                  <View style={[styles.statBox, { borderColor: getAttendanceColor() + '40' }]}>
                    <MaterialCommunityIcons name="clipboard-check" size={22} color={getAttendanceColor()} />
                    <Text style={[styles.statVal, { color: getAttendanceColor() }]}>
                      {attendancePercent !== null ? `${attendancePercent}%` : 'N/A'}
                    </Text>
                    <Text style={styles.statLabel}>Attendance</Text>
                    <Text style={styles.statSub}>(last 30 days)</Text>
                  </View>
                  <View style={[styles.statBox, { borderColor: pendingFees > 0 ? COLORS.error + '40' : COLORS.success + '40' }]}>
                    <MaterialCommunityIcons
                      name="cash"
                      size={22}
                      color={pendingFees > 0 ? COLORS.error : COLORS.success}
                    />
                    <Text style={[styles.statVal, { color: pendingFees > 0 ? COLORS.error : COLORS.success }]}>
                      {pendingFees > 0 ? `₹${pendingFees}` : 'Clear'}
                    </Text>
                    <Text style={styles.statLabel}>Fees</Text>
                    <Text style={styles.statSub}>{pendingFees > 0 ? 'pending' : 'all paid'}</Text>
                  </View>
                </View>

                {/* Recent Attendance */}
                {recentAttendance.length > 0 && (
                  <View style={styles.recentCard}>
                    <Text style={styles.recentTitle}>RECENT ATTENDANCE</Text>
                    <View style={styles.recentDots}>
                      {recentAttendance.slice(0, 7).map((rec, i) => (
                        <View key={i} style={styles.recentDotItem}>
                          <View style={[
                            styles.recentDot,
                            { backgroundColor: getStatusColor(rec.status) }
                          ]}>
                            <MaterialCommunityIcons
                              name={getStatusIcon(rec.status) as any}
                              size={14}
                              color="#FFFFFF"
                            />
                          </View>
                          <Text style={styles.recentDotDate}>
                            {rec.date?.slice(8, 10)}
                          </Text>
                        </View>
                      ))}
                    </View>
                    <View style={styles.recentLegend}>
                      {[
                        { color: COLORS.success, label: 'Present' },
                        { color: COLORS.error, label: 'Absent' },
                        { color: COLORS.warning, label: 'Late' },
                      ].map((l, i) => (
                        <View key={i} style={styles.legendItem}>
                          <View style={[styles.legendDot, { backgroundColor: l.color }]} />
                          <Text style={styles.legendLabel}>{l.label}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {/* Quick Links */}
                <Text style={styles.sectionLabel}>QUICK ACCESS</Text>
                <View style={styles.quickLinks}>
                  {QUICK_LINKS.map((link, i) => (
                    <TouchableOpacity
                      key={i}
                      style={styles.quickLinkCard}
                      onPress={() => router.push(link.route as any)}
                      activeOpacity={0.8}
                    >
                      <View style={[styles.quickLinkIcon, { backgroundColor: link.color + '18' }]}>
                        <MaterialCommunityIcons name={link.icon as any} size={26} color={link.color} />
                      </View>
                      <Text style={styles.quickLinkTitle}>{link.title}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Fee Alert */}
                {pendingFees > 0 && (
                  <TouchableOpacity
                    style={styles.feeAlert}
                    onPress={() => router.push('/parent/fees')}
                    activeOpacity={0.8}
                  >
                    <MaterialCommunityIcons name="alert-circle" size={22} color="#FFFFFF" />
                    <View style={styles.feeAlertInfo}>
                      <Text style={styles.feeAlertTitle}>Fee Payment Pending</Text>
                      <Text style={styles.feeAlertAmount}>₹{pendingFees} due</Text>
                    </View>
                    <MaterialCommunityIcons name="chevron-right" size={22} color="#FFFFFF" />
                  </TouchableOpacity>
                )}

                {/* Low Attendance Alert */}
                {attendancePercent !== null && attendancePercent < 75 && (
                  <View style={styles.attAlert}>
                    <MaterialCommunityIcons name="alert" size={22} color={COLORS.error} />
                    <Text style={styles.attAlertText}>
                      Attendance is below 75%. Please ensure regular school attendance to avoid academic issues.
                    </Text>
                  </View>
                )}
              </>
            )}

            <View style={{ height: 20 }} />
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  header: {
    backgroundColor: COLORS.primary, paddingTop: 52,
    paddingBottom: 20, paddingHorizontal: 16,
  },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  greeting: { color: 'rgba(255,255,255,0.7)', fontSize: 14 },
  parentPhone: { color: '#FFFFFF', fontSize: 20, fontWeight: 'bold', marginTop: 2 },
  logoutIcon: { padding: 4 },
  dateText: { color: 'rgba(255,255,255,0.6)', fontSize: 13, marginTop: 8 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  noChildCard: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 24 },
  noChildText: { fontSize: 16, fontWeight: '600', color: COLORS.textPrimary, marginTop: 16, textAlign: 'center' },
  noChildSub: { fontSize: 14, color: COLORS.textSecondary, marginTop: 8, textAlign: 'center', lineHeight: 20 },
  childSelector: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  childChip: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#FFFFFF' },
  childChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  childChipText: { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary },
  childChipTextActive: { color: '#FFFFFF' },
  childCard: {
    backgroundColor: COLORS.primary, borderRadius: 16, padding: 16,
    flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 12,
  },
  childAvatar: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center',
  },
  childAvatarText: { fontSize: 24, fontWeight: 'bold', color: '#FFFFFF' },
  childInfo: { flex: 1 },
  childName: { fontSize: 20, fontWeight: 'bold', color: '#FFFFFF' },
  childClass: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 3 },
  lastMarked: { fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  statBox: {
    flex: 1, backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16,
    alignItems: 'center', borderWidth: 1.5, elevation: 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3,
  },
  statVal: { fontSize: 22, fontWeight: 'bold', marginTop: 8 },
  statLabel: { fontSize: 13, color: COLORS.textSecondary, marginTop: 4, fontWeight: '500' },
  statSub: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  recentCard: {
    backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16,
    marginBottom: 12, elevation: 2, shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3,
  },
  recentTitle: { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary, letterSpacing: 1, marginBottom: 12 },
  recentDots: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  recentDotItem: { alignItems: 'center', gap: 4 },
  recentDot: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  recentDotDate: { fontSize: 10, color: COLORS.textSecondary },
  recentLegend: { flexDirection: 'row', gap: 16 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { fontSize: 12, color: COLORS.textSecondary },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary, letterSpacing: 1, marginBottom: 10, textTransform: 'uppercase' },
  quickLinks: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  quickLinkCard: {
    width: '47%', backgroundColor: '#FFFFFF', borderRadius: 12,
    padding: 16, alignItems: 'center', elevation: 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3,
  },
  quickLinkIcon: { width: 52, height: 52, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  quickLinkTitle: { fontSize: 13, fontWeight: '600', color: COLORS.textPrimary },
  feeAlert: {
    backgroundColor: COLORS.error, borderRadius: 12, padding: 16,
    flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12,
  },
  feeAlertInfo: { flex: 1 },
  feeAlertTitle: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  feeAlertAmount: { color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 2 },
  attAlert: {
    backgroundColor: '#FFF1F2', borderRadius: 12, padding: 16,
    flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 12,
    borderWidth: 1, borderColor: COLORS.error + '30',
  },
  attAlertText: { flex: 1, fontSize: 13, color: COLORS.textSecondary, lineHeight: 18 },
});