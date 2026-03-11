import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, ScrollView,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  collection, getDocs, query, where, orderBy,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getUserSession } from '@/lib/storage';
import { COLORS } from '@/lib/theme';
import { Student, AttendanceRecord } from '@/lib/types';

type MonthFilter = string;

export default function ParentAttendanceScreen() {
  const [schoolId, setSchoolId] = useState('school_001');
  const [children, setChildren] = useState<Student[]>([]);
  const [selectedChild, setSelectedChild] = useState<Student | null>(null);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<MonthFilter>('all');
  const [months, setMonths] = useState<string[]>([]);

  useEffect(() => { initScreen(); }, []);
  useEffect(() => { if (selectedChild) loadAttendance(selectedChild.id); }, [selectedChild]);
  useEffect(() => { applyFilter(); }, [records, selectedMonth]);

  async function initScreen() {
    const session = await getUserSession();
    setSchoolId(session.schoolId);
    try {
      const snap = await getDocs(query(
        collection(db, 'schools', session.schoolId, 'students'),
        where('parent_phone', '==', session.phone)
      ));
      const kids = snap.docs.map(d => ({ id: d.id, ...d.data() } as Student));
      setChildren(kids);
      if (kids.length > 0) setSelectedChild(kids[0]);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function loadAttendance(studentId: string) {
    setLoading(true);
    try {
      const snap = await getDocs(query(
        collection(db, 'schools', schoolId, 'attendance'),
        where('student_id', '==', studentId),
        orderBy('date', 'desc')
      ));
      const recs = snap.docs.map(d => d.data() as AttendanceRecord);
      setRecords(recs);
      const uniqueMonths = [...new Set(recs.map(r => r.date?.substring(0, 7)))].filter(Boolean);
      setMonths(uniqueMonths as string[]);
      if (uniqueMonths.length > 0) setSelectedMonth(uniqueMonths[0] as string);
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  }

  function applyFilter() {
    if (selectedMonth === 'all') {
      setFilteredRecords(records);
    } else {
      setFilteredRecords(records.filter(r => r.date?.startsWith(selectedMonth)));
    }
  }

  function getMonthStats(monthKey: string) {
    const monthRecs = records.filter(r => r.date?.startsWith(monthKey));
    const present = monthRecs.filter(r => r.status === 'present').length;
    const absent = monthRecs.filter(r => r.status === 'absent').length;
    const late = monthRecs.filter(r => r.status === 'late').length;
    const total = monthRecs.length;
    const pct = total > 0 ? Math.round((present / total) * 100) : 0;
    return { present, absent, late, total, pct };
  }

  function getStatusColor(status: string) {
    if (status === 'present') return COLORS.success;
    if (status === 'absent') return COLORS.error;
    return COLORS.warning;
  }

  function getMonthLabel(monthKey: string) {
    const d = new Date(monthKey + '-01');
    return d.toLocaleString('default', { month: 'short', year: '2-digit' });
  }

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    if (selectedChild) loadAttendance(selectedChild.id);
  }, [selectedChild]);

  const overallStats = selectedMonth !== 'all' ? getMonthStats(selectedMonth) : {
    present: records.filter(r => r.status === 'present').length,
    absent: records.filter(r => r.status === 'absent').length,
    late: records.filter(r => r.status === 'late').length,
    total: records.length,
    pct: records.length > 0
      ? Math.round((records.filter(r => r.status === 'present').length / records.length) * 100)
      : 0,
  };

  function renderRecord({ item }: { item: AttendanceRecord }) {
    const color = getStatusColor(item.status);
    const dayName = new Date(item.date).toLocaleDateString('en-US', { weekday: 'short' });
    return (
      <View style={styles.recordRow}>
        <View style={styles.recordDate}>
          <Text style={styles.recordDay}>{dayName}</Text>
          <Text style={styles.recordDateNum}>{item.date?.slice(8, 10)}</Text>
        </View>
        <View style={styles.recordLine} />
        <View style={[styles.recordStatus, { backgroundColor: color + '18', borderColor: color + '40' }]}>
          <MaterialCommunityIcons
            name={item.status === 'present' ? 'check-circle' : item.status === 'absent' ? 'close-circle' : 'clock-alert'}
            size={18}
            color={color}
          />
          <Text style={[styles.recordStatusText, { color }]}>
            {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Attendance</Text>
        {selectedChild && (
          <Text style={styles.headerSub}>{selectedChild.name} • Class {selectedChild.class}-{selectedChild.section}</Text>
        )}
      </View>

      {children.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.childSelector} contentContainerStyle={{ paddingHorizontal: 16, gap: 8, alignItems: 'center', paddingVertical: 8 }}>
          {children.map(c => (
            <TouchableOpacity
              key={c.id}
              style={[styles.childChip, selectedChild?.id === c.id && styles.childChipActive]}
              onPress={() => setSelectedChild(c)}
            >
              <Text style={[styles.childChipText, selectedChild?.id === c.id && styles.childChipTextActive]}>
                {c.name.split(' ')[0]}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {loading ? (
        <View style={styles.centered}><ActivityIndicator color={COLORS.primary} size="large" /></View>
      ) : (
        <FlatList
          data={filteredRecords}
          keyExtractor={(item, i) => `${item.date}-${i}`}
          renderItem={renderRecord}
          contentContainerStyle={{ paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
          ListHeaderComponent={
            <View>
              {/* Stats Card */}
              <View style={styles.statsCard}>
                <View style={styles.statsRow}>
                  <View style={styles.statItem}>
                    <Text style={[styles.statVal, { color: COLORS.success }]}>{overallStats.present}</Text>
                    <Text style={styles.statLabel}>Present</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={[styles.statVal, { color: COLORS.error }]}>{overallStats.absent}</Text>
                    <Text style={styles.statLabel}>Absent</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={[styles.statVal, { color: COLORS.warning }]}>{overallStats.late}</Text>
                    <Text style={styles.statLabel}>Late</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={[styles.statVal, {
                      color: overallStats.pct >= 75 ? COLORS.success : overallStats.pct >= 60 ? COLORS.warning : COLORS.error
                    }]}>
                      {overallStats.pct}%
                    </Text>
                    <Text style={styles.statLabel}>Rate</Text>
                  </View>
                </View>
                <View style={styles.progressBar}>
                  <View style={[
                    styles.progressFill,
                    {
                      width: `${overallStats.pct}%`,
                      backgroundColor: overallStats.pct >= 75 ? COLORS.success : overallStats.pct >= 60 ? COLORS.warning : COLORS.error,
                    }
                  ]} />
                </View>
                {overallStats.pct < 75 && (
                  <Text style={styles.lowAttWarning}>
                    ⚠️ Attendance below 75% — required for examinations
                  </Text>
                )}
              </View>

              {/* Month Filter */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.monthFilter} contentContainerStyle={{ paddingHorizontal: 16, gap: 8, alignItems: 'center', paddingVertical: 8 }}>
                <TouchableOpacity
                  style={[styles.monthChip, selectedMonth === 'all' && styles.monthChipActive]}
                  onPress={() => setSelectedMonth('all')}
                >
                  <Text style={[styles.monthChipText, selectedMonth === 'all' && styles.monthChipTextActive]}>All</Text>
                </TouchableOpacity>
                {months.map(m => (
                  <TouchableOpacity
                    key={m}
                    style={[styles.monthChip, selectedMonth === m && styles.monthChipActive]}
                    onPress={() => setSelectedMonth(m)}
                  >
                    <Text style={[styles.monthChipText, selectedMonth === m && styles.monthChipTextActive]}>
                      {getMonthLabel(m)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="clipboard-off" size={48} color={COLORS.textSecondary} />
              <Text style={styles.emptyText}>No attendance records found</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  header: { backgroundColor: COLORS.primary, paddingTop: 52, paddingBottom: 16, paddingHorizontal: 16 },
  headerTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: 'bold' },
  headerSub: { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 4 },
  childSelector: { backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: COLORS.border },
  childChip: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, backgroundColor: '#FFFFFF' },
  childChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  childChipText: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  childChipTextActive: { color: '#FFFFFF' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  statsCard: {
    backgroundColor: '#FFFFFF', margin: 16, borderRadius: 12, padding: 16,
    elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3,
  },
  statsRow: { flexDirection: 'row', marginBottom: 12 },
  statItem: { flex: 1, alignItems: 'center' },
  statVal: { fontSize: 22, fontWeight: 'bold' },
  statLabel: { fontSize: 11, color: COLORS.textSecondary, marginTop: 3 },
  progressBar: { height: 8, backgroundColor: COLORS.border, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  lowAttWarning: { fontSize: 12, color: COLORS.error, marginTop: 8, fontWeight: '500', textAlign: 'center' },
  monthFilter: { backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: COLORS.border },
  monthChip: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 6 },
  monthChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  monthChipText: { fontSize: 13, color: COLORS.textSecondary },
  monthChipTextActive: { color: '#FFFFFF', fontWeight: '600' },
  recordRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: COLORS.border, gap: 12,
  },
  recordDate: { width: 42, alignItems: 'center' },
  recordDay: { fontSize: 11, color: COLORS.textSecondary, fontWeight: '600' },
  recordDateNum: { fontSize: 18, fontWeight: 'bold', color: COLORS.textPrimary },
  recordLine: { width: 1, height: 36, backgroundColor: COLORS.border },
  recordStatus: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6,
  },
  recordStatusText: { fontSize: 14, fontWeight: '700' },
  emptyContainer: { alignItems: 'center', paddingTop: 60 },
  emptyText: { color: COLORS.textSecondary, fontSize: 15, marginTop: 12 },
});