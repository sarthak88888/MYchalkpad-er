import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getUserSession } from '@/lib/storage';
import { COLORS } from '@/lib/theme';
import { Student, MarksRecord } from '@/lib/types';

const CLASS_OPTIONS = ['6','7','8','9','10','11','12'];
const SECTION_OPTIONS = ['A','B','C','D'];
const SUBJECTS = ['English','Hindi','Mathematics','Science','Social Science','Sanskrit','Computer','Physical Education'];

interface TermData { UT1: number | null; 'Half-Yearly': number | null; Annual: number | null; trend: 'up' | 'down' | 'same' | 'none'; }
interface SubjectProgress { subject: string; terms: TermData; avgOverall: number | null; }

function getTrend(a: number | null, b: number | null): 'up' | 'down' | 'same' | 'none' {
  if (a === null || b === null) return 'none';
  if (b > a) return 'up';
  if (b < a) return 'down';
  return 'same';
}

function getTrendIcon(trend: string): { icon: string; color: string } {
  if (trend === 'up') return { icon: 'trending-up', color: COLORS.success };
  if (trend === 'down') return { icon: 'trending-down', color: COLORS.error };
  if (trend === 'same') return { icon: 'trending-neutral', color: '#3B82F6' };
  return { icon: 'minus', color: COLORS.textSecondary };
}

export default function ProgressReportScreen() {
  const [schoolId, setSchoolId] = useState('school_001');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [showStudentPicker, setShowStudentPicker] = useState(false);
  const [progress, setProgress] = useState<SubjectProgress[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { initScreen(); }, []);
  useEffect(() => { if (selectedClass && selectedSection) loadStudents(); }, [selectedClass, selectedSection]);
  useEffect(() => { if (selectedStudent) loadProgress(); }, [selectedStudent]);

  async function initScreen() {
    const session = await getUserSession();
    setSchoolId(session.schoolId);
  }

  async function loadStudents() {
    try {
      const snap = await getDocs(query(
        collection(db, 'schools', schoolId, 'students'),
        where('class', '==', selectedClass),
        where('section', '==', selectedSection)
      ));
      const studs = snap.docs.map(d => ({ id: d.id, ...d.data() } as Student));
      studs.sort((a, b) => (a.roll_number ?? 0) - (b.roll_number ?? 0));
      setStudents(studs);
      setSelectedStudent(null);
      setProgress([]);
    } catch (e) { console.error(e); }
  }

  async function loadProgress() {
    if (!selectedStudent) return;
    setLoading(true);
    try {
      const snap = await getDocs(query(
        collection(db, 'schools', schoolId, 'marks'),
        where('student_id', '==', selectedStudent.id)
      ));
      const marks = snap.docs.map(d => d.data() as MarksRecord);

      const subjectProgress: SubjectProgress[] = SUBJECTS.map(subject => {
        const subMarks = marks.filter(m => m.subject === subject);
        const get = (exam: string) => { const m = subMarks.find(m => m.exam_type === exam); return m ? (m.marks / m.max_marks) * 100 : null; };
        const ut1 = get('UT1');
        const halfYearly = get('Half-Yearly');
        const annual = get('Annual');
        const trend = getTrend(halfYearly ?? ut1, annual ?? halfYearly);
        const vals = [ut1, halfYearly, annual].filter(v => v !== null) as number[];
        const avg = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
        return { subject, terms: { UT1: ut1, 'Half-Yearly': halfYearly, Annual: annual, trend }, avgOverall: avg !== null ? parseFloat(avg.toFixed(1)) : null };
      }).filter(s => s.terms.UT1 !== null || s.terms['Half-Yearly'] !== null || s.terms.Annual !== null);

      setProgress(subjectProgress);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  function getOverallGPA() {
    const avgs = progress.map(p => p.avgOverall).filter(v => v !== null) as number[];
    if (avgs.length === 0) return null;
    return (avgs.reduce((a, b) => a + b, 0) / avgs.length).toFixed(1);
  }

  function renderBar(value: number | null, color: string) {
    if (value === null) return <View style={styles.barEmpty}><Text style={styles.barEmptyText}>N/A</Text></View>;
    return (
      <View style={styles.barContainer}>
        <View style={[styles.barFill, { width: `${Math.min(value, 100)}%`, backgroundColor: color }]} />
        <Text style={styles.barText}>{value.toFixed(0)}%</Text>
      </View>
    );
  }

  const gpa = getOverallGPA();

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Progress Report</Text>
      </View>

      <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Class */}
        <View style={styles.selectorSection}>
          <Text style={styles.selectorLabel}>CLASS</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {CLASS_OPTIONS.map(cls => (
              <TouchableOpacity key={cls} style={[styles.chip, selectedClass === cls && styles.chipActive]} onPress={() => setSelectedClass(cls)}>
                <Text style={[styles.chipText, selectedClass === cls && styles.chipTextActive]}>{cls}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Section */}
        <View style={styles.selectorSection}>
          <Text style={styles.selectorLabel}>SECTION</Text>
          <View style={styles.rowWrap}>
            {SECTION_OPTIONS.map(sec => (
              <TouchableOpacity key={sec} style={[styles.chip, selectedSection === sec && styles.chipActive]} onPress={() => setSelectedSection(sec)}>
                <Text style={[styles.chipText, selectedSection === sec && styles.chipTextActive]}>{sec}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Student Selector */}
        {students.length > 0 && (
          <View style={styles.selectorSection}>
            <Text style={styles.selectorLabel}>STUDENT</Text>
            <TouchableOpacity style={styles.studentSelector} onPress={() => setShowStudentPicker(!showStudentPicker)}>
              <Text style={selectedStudent ? styles.studentSelectorText : styles.studentSelectorPlaceholder}>
                {selectedStudent ? `${selectedStudent.name} (Roll ${selectedStudent.roll_number})` : 'Select a student...'}
              </Text>
              <MaterialCommunityIcons name={showStudentPicker ? 'chevron-up' : 'chevron-down'} size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>
            {showStudentPicker && (
              <View style={styles.studentDropdown}>
                {students.map(s => (
                  <TouchableOpacity key={s.id} style={styles.studentDropdownItem} onPress={() => { setSelectedStudent(s); setShowStudentPicker(false); }}>
                    <Text style={styles.studentDropdownText}>{s.roll_number}. {s.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}

        {loading && <View style={styles.centered}><ActivityIndicator color={COLORS.primary} size="large" /></View>}

        {/* Progress Table */}
        {!loading && selectedStudent && progress.length > 0 && (
          <View style={styles.reportContainer}>
            {/* GPA Card */}
            {gpa && (
              <View style={styles.gpaCard}>
                <Text style={styles.gpaLabel}>Overall Average</Text>
                <Text style={styles.gpaValue}>{gpa}%</Text>
                <Text style={styles.gpaStudent}>{selectedStudent.name}</Text>
              </View>
            )}

            {/* Column Headers */}
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderCell, styles.subjectHeaderCell]}>Subject</Text>
              <Text style={styles.tableHeaderCell}>UT1</Text>
              <Text style={styles.tableHeaderCell}>Half-Yr</Text>
              <Text style={styles.tableHeaderCell}>Annual</Text>
              <Text style={styles.tableHeaderCell}>Trend</Text>
            </View>

            {/* Rows */}
            {progress.map((row, i) => {
              const trendData = getTrendIcon(row.terms.trend);
              return (
                <View key={i} style={[styles.tableRow, i % 2 === 0 && styles.tableRowAlt]}>
                  <Text style={[styles.tableCell, styles.subjectCell]} numberOfLines={1}>{row.subject}</Text>
                  <Text style={styles.tableCell}>
                    {row.terms.UT1 !== null ? `${row.terms.UT1.toFixed(0)}%` : '--'}
                  </Text>
                  <Text style={styles.tableCell}>
                    {row.terms['Half-Yearly'] !== null ? `${row.terms['Half-Yearly'].toFixed(0)}%` : '--'}
                  </Text>
                  <Text style={styles.tableCell}>
                    {row.terms.Annual !== null ? `${row.terms.Annual.toFixed(0)}%` : '--'}
                  </Text>
                  <View style={[styles.tableCell, { alignItems: 'center' }]}>
                    <MaterialCommunityIcons name={trendData.icon as any} size={20} color={trendData.color} />
                  </View>
                </View>
              );
            })}

            {/* GPA Comparison Bars */}
            <View style={styles.barsSection}>
              <Text style={styles.barsSectionTitle}>Performance by Subject</Text>
              {progress.map((row, i) => (
                <View key={i} style={styles.barRow}>
                  <Text style={styles.barSubject} numberOfLines={1}>{row.subject}</Text>
                  <View style={styles.barGroup}>
                    {renderBar(row.terms.UT1, '#3B82F6')}
                    {renderBar(row.terms['Half-Yearly'], COLORS.warning)}
                    {renderBar(row.terms.Annual, COLORS.success)}
                  </View>
                </View>
              ))}
              <View style={styles.legendRow}>
                {[{ color: '#3B82F6', label: 'UT1' }, { color: COLORS.warning, label: 'Half-Yr' }, { color: COLORS.success, label: 'Annual' }].map((l, i) => (
                  <View key={i} style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: l.color }]} />
                    <Text style={styles.legendLabel}>{l.label}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Share Button */}
            <TouchableOpacity
              style={styles.shareBtn}
              onPress={() => Alert.alert('Share', 'Progress report sharing coming soon.')}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="share-variant" size={18} color="#FFFFFF" />
              <Text style={styles.shareBtnText}>Share Progress Report</Text>
            </TouchableOpacity>
          </View>
        )}

        {!loading && selectedStudent && progress.length === 0 && (
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="chart-timeline-variant" size={48} color={COLORS.textSecondary} />
            <Text style={styles.emptyText}>No marks data found for {selectedStudent.name}</Text>
          </View>
        )}

        {!selectedStudent && selectedClass && selectedSection && students.length > 0 && (
          <View style={styles.placeholderContainer}>
            <MaterialCommunityIcons name="trending-up" size={48} color={COLORS.textSecondary} />
            <Text style={styles.placeholderText}>Select a student to view progress</Text>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  header: { backgroundColor: COLORS.primary, paddingTop: 52, paddingBottom: 16, paddingHorizontal: 16 },
  headerTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: 'bold' },
  scroll: { flex: 1 },
  selectorSection: { backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  selectorLabel: { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary, letterSpacing: 0.8, marginBottom: 8 },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8, marginRight: 8, backgroundColor: '#FFFFFF' },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: 13, color: COLORS.textSecondary },
  chipTextActive: { color: '#FFFFFF', fontWeight: '600' },
  studentSelector: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 12 },
  studentSelectorText: { fontSize: 15, color: COLORS.textPrimary, fontWeight: '500' },
  studentSelectorPlaceholder: { fontSize: 15, color: COLORS.textSecondary },
  studentDropdown: { backgroundColor: '#FFFFFF', borderRadius: 8, borderWidth: 1, borderColor: COLORS.border, marginTop: 4 },
  studentDropdownItem: { paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  studentDropdownText: { fontSize: 14, color: COLORS.textPrimary },
  centered: { padding: 40, alignItems: 'center' },
  reportContainer: { padding: 16 },
  gpaCard: { backgroundColor: COLORS.primary, borderRadius: 12, padding: 20, marginBottom: 16, alignItems: 'center' },
  gpaLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '600', textTransform: 'uppercase' },
  gpaValue: { color: COLORS.accent, fontSize: 48, fontWeight: 'bold', marginTop: 4 },
  gpaStudent: { color: 'rgba(255,255,255,0.8)', fontSize: 14, marginTop: 4 },
  tableHeader: { flexDirection: 'row', backgroundColor: COLORS.primary + '10', paddingVertical: 10, borderRadius: 8, marginBottom: 2 },
  tableHeaderCell: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '700', color: COLORS.primary },
  subjectHeaderCell: { flex: 1.8, textAlign: 'left', paddingLeft: 8 },
  tableRow: { flexDirection: 'row', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  tableRowAlt: { backgroundColor: '#F8FAFC' },
  tableCell: { flex: 1, textAlign: 'center', fontSize: 13, color: COLORS.textPrimary },
  subjectCell: { flex: 1.8, textAlign: 'left', paddingLeft: 4, fontWeight: '500' },
  barsSection: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14, marginTop: 16, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3 },
  barsSectionTitle: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 12 },
  barRow: { marginBottom: 10 },
  barSubject: { fontSize: 12, color: COLORS.textSecondary, marginBottom: 4 },
  barGroup: { gap: 3 },
  barContainer: { height: 14, backgroundColor: COLORS.border, borderRadius: 7, overflow: 'hidden', position: 'relative', marginBottom: 2 },
  barFill: { height: '100%', borderRadius: 7 },
  barText: { position: 'absolute', right: 4, top: 0, fontSize: 9, color: '#FFFFFF', fontWeight: '700', lineHeight: 14 },
  barEmpty: { height: 14, backgroundColor: COLORS.border, borderRadius: 7, justifyContent: 'center', alignItems: 'center', marginBottom: 2 },
  barEmptyText: { fontSize: 9, color: COLORS.textSecondary },
  legendRow: { flexDirection: 'row', justifyContent: 'center', gap: 20, marginTop: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { fontSize: 12, color: COLORS.textSecondary },
  shareBtn: { backgroundColor: COLORS.accent, borderRadius: 8, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 16 },
  shareBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  emptyText: { color: COLORS.textSecondary, fontSize: 15, marginTop: 12, textAlign: 'center', paddingHorizontal: 24 },
  placeholderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  placeholderText: { color: COLORS.textSecondary, fontSize: 15, textAlign: 'center', marginTop: 12 },
});
