import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator,
} from 'react-native';
import { getDoc, doc } from 'firebase/firestore';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getUserSession } from '@/lib/storage';
import { COLORS } from '@/lib/theme';

const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat'];
const PERIODS = [1,2,3,4,5,6];

interface Cell { subject: string; teacher_name: string; }
type Grid = Record<string, Record<number, Cell>>;

const SUBJECT_COLORS: Record<string, string> = {
  English: '#DBEAFE', Hindi: '#FEF9C3', Mathematics: '#DCFCE7',
  Science: '#F3E8FF', 'Social Science': '#FFE4E6', Sanskrit: '#FFF7ED',
  Computer: '#E0F2FE', 'Physical Education': '#D1FAE5', Library: '#FDF4FF', Sports: '#F0FDF4',
};

export default function TeacherTimetableScreen() {
  const [schoolId, setSchoolId] = useState('school_001');
  const [assignedClass, setAssignedClass] = useState('');
  const [assignedSection, setAssignedSection] = useState('');
  const [grid, setGrid] = useState<Grid>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => { initScreen(); }, []);

  async function initScreen() {
    const session = await getUserSession();
    setSchoolId(session.schoolId);
    try {
      const staffSnap = await getDocs(query(
        collection(db, 'schools', session.schoolId, 'staff'),
        where('phone', '==', session.phone)
      ));
      if (!staffSnap.empty) {
        const s = staffSnap.docs[0].data();
        const cls = s.assigned_class ?? '';
        const sec = s.assigned_section ?? '';
        setAssignedClass(cls);
        setAssignedSection(sec);
        if (cls && sec) {
          const ttId = `${cls}_${sec}`;
          const snap = await getDoc(doc(db, 'schools', session.schoolId, 'timetables', ttId));
          if (snap.exists()) {
            setGrid(snap.data().grid ?? {});
          }
        }
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  function getCellColor(cell: Cell): string {
    if (!cell?.subject) return '#F8FAFC';
    return SUBJECT_COLORS[cell.subject] ?? '#F0F9FF';
  }

  const today = new Date().toLocaleDateString('en-US', { weekday: 'short' });

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator color={COLORS.primary} size="large" /></View>;
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Timetable</Text>
        <Text style={styles.headerSub}>
          {assignedClass ? `Class ${assignedClass}-${assignedSection}` : 'No class assigned'}
        </Text>
      </View>

      {!assignedClass ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>No class assigned. Contact your principal.</Text>
        </View>
      ) : Object.keys(grid).length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>No timetable set for Class {assignedClass}-{assignedSection} yet.</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Today Highlight */}
          <View style={styles.todayBanner}>
            <Text style={styles.todayLabel}>TODAY — {today.toUpperCase()}</Text>
            <View style={styles.todayPeriods}>
              {PERIODS.map(p => {
                const cell = grid[today]?.[p];
                if (!cell?.subject) return null;
                return (
                  <View key={p} style={[styles.todayPeriodCard, { backgroundColor: getCellColor(cell) }]}>
                    <Text style={styles.todayPeriodNum}>P{p}</Text>
                    <Text style={styles.todayPeriodSubject}>{cell.subject}</Text>
                  </View>
                );
              })}
            </View>
          </View>

          {/* Full Week Grid */}
          <ScrollView horizontal showsHorizontalScrollIndicator={true} style={styles.gridScroll}>
            <View>
              {/* Header Row */}
              <View style={styles.gridHeaderRow}>
                <View style={[styles.dayCell, styles.cornerCell]}>
                  <Text style={styles.cornerText}>Day</Text>
                </View>
                {PERIODS.map(p => (
                  <View key={p} style={styles.periodHeaderCell}>
                    <Text style={styles.periodHeaderText}>P{p}</Text>
                  </View>
                ))}
              </View>

              {/* Day Rows */}
              {DAYS.map(day => (
                <View key={day} style={[styles.gridRow, day === today && styles.todayRow]}>
                  <View style={[styles.dayCell, day === today && styles.todayDayCell]}>
                    <Text style={[styles.dayText, day === today && styles.todayDayText]}>{day}</Text>
                    {day === today && <View style={styles.todayDot} />}
                  </View>
                  {PERIODS.map(p => {
                    const cell = grid[day]?.[p] ?? { subject: '', teacher_name: '' };
                    return (
                      <View
                        key={p}
                        style={[
                          styles.gridCell,
                          { backgroundColor: getCellColor(cell) },
                          day === today && styles.todayCell,
                        ]}
                      >
                        {cell.subject ? (
                          <>
                            <Text style={styles.cellSubject} numberOfLines={1}>{cell.subject}</Text>
                          </>
                        ) : (
                          <Text style={styles.freeText}>Free</Text>
                        )}
                      </View>
                    );
                  })}
                </View>
              ))}
            </View>
          </ScrollView>

          {/* Legend */}
          <View style={styles.legend}>
            <Text style={styles.legendTitle}>SUBJECTS</Text>
            <View style={styles.legendGrid}>
              {Object.entries(SUBJECT_COLORS).map(([sub, color]) => (
                <View key={sub} style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: color, borderWidth: 1, borderColor: COLORS.border }]} />
                  <Text style={styles.legendLabel}>{sub}</Text>
                </View>
              ))}
            </View>
          </View>
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  header: { backgroundColor: COLORS.primary, paddingTop: 52, paddingBottom: 16, paddingHorizontal: 16 },
  headerTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: 'bold' },
  headerSub: { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 4 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyText: { color: COLORS.textSecondary, fontSize: 15, textAlign: 'center', lineHeight: 22 },
  todayBanner: { backgroundColor: COLORS.primary + '08', padding: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  todayLabel: { fontSize: 11, fontWeight: '700', color: COLORS.primary, letterSpacing: 1, marginBottom: 10 },
  todayPeriods: { flexDirection: 'row', gap: 8 },
  todayPeriodCard: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, alignItems: 'center', minWidth: 60 },
  todayPeriodNum: { fontSize: 10, fontWeight: '700', color: COLORS.textSecondary },
  todayPeriodSubject: { fontSize: 12, fontWeight: '600', color: COLORS.textPrimary, marginTop: 2 },
  gridScroll: { padding: 8 },
  gridHeaderRow: { flexDirection: 'row' },
  cornerCell: { backgroundColor: COLORS.primary },
  cornerText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  dayCell: { width: 48, height: 68, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.2)' },
  todayDayCell: { backgroundColor: COLORS.accent },
  dayText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  todayDayText: { color: '#FFFFFF', fontWeight: '800' },
  todayDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FFFFFF', marginTop: 3 },
  periodHeaderCell: { width: 90, height: 36, backgroundColor: COLORS.primary + 'DD', justifyContent: 'center', alignItems: 'center', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.2)' },
  periodHeaderText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },
  gridRow: { flexDirection: 'row' },
  todayRow: { elevation: 2 },
  gridCell: { width: 90, height: 68, borderWidth: 0.5, borderColor: COLORS.border, justifyContent: 'center', alignItems: 'center', padding: 4 },
  todayCell: { borderWidth: 1.5, borderColor: COLORS.accent + '60' },
  cellSubject: { fontSize: 11, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'center' },
  freeText: { fontSize: 11, color: COLORS.textSecondary, fontStyle: 'italic' },
  legend: { margin: 16 },
  legendTitle: { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary, letterSpacing: 1, marginBottom: 10 },
  legendGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 14, height: 14, borderRadius: 4 },
  legendLabel: { fontSize: 12, color: COLORS.textSecondary },
});