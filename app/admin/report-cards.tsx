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
import { Student, MarksRecord, AttendanceRecord } from '@/lib/types';

const CLASS_OPTIONS = ['6','7','8','9','10','11','12'];
const SECTION_OPTIONS = ['A','B','C','D'];
const SUBJECTS = ['English','Hindi','Mathematics','Science','Social Science','Sanskrit','Computer','Physical Education'];
const EXAM_TYPES = ['UT1','UT2','Half-Yearly','Annual'] as const;

function getCBSEGrade(marks: number, max: number): string {
  const pct = (marks / max) * 100;
  if (pct >= 91) return 'A1';
  if (pct >= 81) return 'A2';
  if (pct >= 71) return 'B1';
  if (pct >= 61) return 'B2';
  if (pct >= 51) return 'C1';
  if (pct >= 41) return 'C2';
  if (pct >= 33) return 'D';
  return 'E';
}

function getGradeColor(grade: string): string {
  if (grade === 'A1' || grade === 'A2') return COLORS.success;
  if (grade === 'B1' || grade === 'B2') return '#3B82F6';
  if (grade === 'C1' || grade === 'C2') return COLORS.warning;
  if (grade === 'D') return '#F59E0B';
  return COLORS.error;
}

interface SubjectRow {
  subject: string;
  UT1: number | null;
  UT2: number | null;
  'Half-Yearly': number | null;
  Annual: number | null;
  grade: string;
}

export default function ReportCardsScreen() {
  const [schoolId, setSchoolId] = useState('school_001');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [subjectRows, setSubjectRows] = useState<SubjectRow[]>([]);
  const [attendancePercent, setAttendancePercent] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [showStudentPicker, setShowStudentPicker] = useState(false);

  useEffect(() => { initScreen(); }, []);
  useEffect(() => {
    if (selectedClass && selectedSection) loadStudents();
  }, [selectedClass, selectedSection]);
  useEffect(() => {
    if (selectedStudent) loadReportCard();
  }, [selectedStudent]);

  async function initScreen() {
    const session = await getUserSession();
    setSchoolId(session.schoolId);
  }

  async function loadStudents() {
    try {
      const snap = await getDocs(
        query(
          collection(db, 'schools', schoolId, 'students'),
          where('class', '==', selectedClass),
          where('section', '==', selectedSection)
        )
      );
      const studs = snap.docs.map(d => ({ id: d.id, ...d.data() } as Student));
      studs.sort((a, b) => (a.roll_number ?? 0) - (b.roll_number ?? 0));
      setStudents(studs);
      setSelectedStudent(null);
      setSubjectRows([]);
    } catch (e) { console.error(e); }
  }

  async function loadReportCard() {
    if (!selectedStudent) return;
    setLoading(true);
    try {
      const marksSnap = await getDocs(
        query(
          collection(db, 'schools', schoolId, 'marks'),
          where('student_id', '==', selectedStudent.id)
        )
      );
      const marks = marksSnap.docs.map(d => d.data() as MarksRecord);

      const rows: SubjectRow[] = SUBJECTS.map(subject => {
        const subMarks = marks.filter(m => m.subject === subject);
        const getExam = (exam: string) => {
          const m = subMarks.find(m => m.exam_type === exam);
          return m ? m.marks : null;
        };
        const annualMark = getExam('Annual') ?? getExam('Half-Yearly') ?? getExam('UT1') ?? 0;
        const grade = getCBSEGrade(annualMark, 100);
        return {
          subject,
          UT1: getExam('UT1'),
          UT2: getExam('UT2'),
          'Half-Yearly': getExam('Half-Yearly'),
          Annual: getExam('Annual'),
          grade,
        };
      }).filter(row => row.UT1 !== null || row.UT2 !== null || row['Half-Yearly'] !== null || row.Annual !== null);

      setSubjectRows(rows);

      const attSnap = await getDocs(
        query(
          collection(db, 'schools', schoolId, 'attendance'),
          where('student_id', '==', selectedStudent.id)
        )
      );
      const attRecords = attSnap.docs.map(d => d.data() as AttendanceRecord);
      if (attRecords.length > 0) {
        const present = attRecords.filter(r => r.status === 'present').length;
        setAttendancePercent(Math.round((present / attRecords.length) * 100));
      } else {
        setAttendancePercent(null);
      }
    } catch (e) {
      console.error('Load report card error:', e);
    } finally {
      setLoading(false);
    }
  }

  function getOverallGrade() {
    if (subjectRows.length === 0) return null;
    const validMarks = subjectRows.map(r => r.Annual ?? r['Half-Yearly'] ?? r.UT1 ?? 0);
    const avg = validMarks.reduce((a, b) => a + b, 0) / validMarks.length;
    return { avg: avg.toFixed(1), grade: getCBSEGrade(avg, 100) };
  }

  const overall = getOverallGrade();

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Report Cards</Text>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Class Selector */}
        <View style={styles.selectorSection}>
          <Text style={styles.selectorLabel}>CLASS</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {CLASS_OPTIONS.map(cls => (
              <TouchableOpacity
                key={cls}
                style={[styles.chip, selectedClass === cls && styles.chipActive]}
                onPress={() => setSelectedClass(cls)}
              >
                <Text style={[styles.chipText, selectedClass === cls && styles.chipTextActive]}>{cls}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Section Selector */}
        <View style={styles.selectorSection}>
          <Text style={styles.selectorLabel}>SECTION</Text>
          <View style={styles.rowWrap}>
            {SECTION_OPTIONS.map(sec => (
              <TouchableOpacity
                key={sec}
                style={[styles.chip, selectedSection === sec && styles.chipActive]}
                onPress={() => setSelectedSection(sec)}
              >
                <Text style={[styles.chipText, selectedSection === sec && styles.chipTextActive]}>{sec}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Student Selector */}
        {students.length > 0 && (
          <View style={styles.selectorSection}>
            <Text style={styles.selectorLabel}>STUDENT</Text>
            <TouchableOpacity
              style={styles.studentSelector}
              onPress={() => setShowStudentPicker(true)}
            >
              <Text style={selectedStudent ? styles.studentSelectorText : styles.studentSelectorPlaceholder}>
                {selectedStudent ? `${selectedStudent.name} (Roll ${selectedStudent.roll_number})` : 'Select a student...'}
              </Text>
              <MaterialCommunityIcons name="chevron-down" size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>
        )}

        {/* Student Picker */}
        {showStudentPicker && (
          <View style={styles.pickerDropdown}>
            {students.map(s => (
              <TouchableOpacity
                key={s.id}
                style={styles.pickerItem}
                onPress={() => { setSelectedStudent(s); setShowStudentPicker(false); }}
              >
                <Text style={styles.pickerItemText}>{s.roll_number}. {s.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Loading */}
        {loading && (
          <View style={styles.centered}>
            <ActivityIndicator color={COLORS.primary} size="large" />
          </View>
        )}

        {/* Report Card */}
        {!loading && selectedStudent && subjectRows.length > 0 && (
          <View style={styles.reportCard}>
            {/* Student Header */}
            <View style={styles.reportHeader}>
              <Text style={styles.reportStudentName}>{selectedStudent.name}</Text>
              <Text style={styles.reportMeta}>
                Class {selectedStudent.class}-{selectedStudent.section} • Roll {selectedStudent.roll_number}
              </Text>
            </View>

            {/* Marks Table */}
            <ScrollView horizontal showsHorizontalScrollIndicator={true}>
              <View>
                {/* Table Header */}
                <View style={styles.tableHeaderRow}>
                  <Text style={[styles.tableCell, styles.subjectCell, styles.tableHeaderText]}>Subject</Text>
                  {EXAM_TYPES.map(et => (
                    <Text key={et} style={[styles.tableCell, styles.tableHeaderText]}>{et}</Text>
                  ))}
                  <Text style={[styles.tableCell, styles.tableHeaderText]}>Grade</Text>
                </View>

                {/* Table Rows */}
                {subjectRows.map((row, i) => (
                  <View key={i} style={[styles.tableRow, i % 2 === 0 && styles.tableRowAlt]}>
                    <Text style={[styles.tableCell, styles.subjectCell]} numberOfLines={1}>{row.subject}</Text>
                    {EXAM_TYPES.map(et => (
                      <Text key={et} style={styles.tableCell}>
                        {row[et] !== null ? row[et] : '--'}
                      </Text>
                    ))}
                    <View style={[styles.tableCell, { alignItems: 'center' }]}>
                      <Text style={[styles.gradeChip, { color: getGradeColor(row.grade), backgroundColor: getGradeColor(row.grade) + '18' }]}>
                        {row.grade}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </ScrollView>

            {/* Overall Summary */}
            {overall && (
              <View style={styles.overallRow}>
                <View style={styles.overallItem}>
                  <Text style={styles.overallVal}>{overall.avg}%</Text>
                  <Text style={styles.overallLabel}>Overall Avg</Text>
                </View>
                <View style={styles.overallItem}>
                  <Text style={[styles.overallVal, { color: getGradeColor(overall.grade) }]}>{overall.grade}</Text>
                  <Text style={styles.overallLabel}>Overall Grade</Text>
                </View>
                {attendancePercent !== null && (
                  <View style={styles.overallItem}>
                    <Text style={[styles.overallVal, {
                      color: attendancePercent >= 75 ? COLORS.success : attendancePercent >= 60 ? COLORS.warning : COLORS.error
                    }]}>
                      {attendancePercent}%
                    </Text>
                    <Text style={styles.overallLabel}>Attendance</Text>
                  </View>
                )}
              </View>
            )}

            {/* Share Button */}
            <TouchableOpacity
              style={styles.shareBtn}
              onPress={() => Alert.alert('Share', 'Report card sharing coming soon.')}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="share-variant" size={18} color="#FFFFFF" />
              <Text style={styles.shareBtnText}>Share Report Card</Text>
            </TouchableOpacity>
          </View>
        )}

        {!loading && selectedStudent && subjectRows.length === 0 && (
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="file-document-outline" size={48} color={COLORS.textSecondary} />
            <Text style={styles.emptyText}>No marks found for {selectedStudent.name}</Text>
          </View>
        )}

        {!selectedStudent && selectedClass && selectedSection && students.length > 0 && (
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="account-search" size={48} color={COLORS.textSecondary} />
            <Text style={styles.emptyText}>Select a student to view report card</Text>
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
  selectorSection: {
    backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  selectorLabel: { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary, letterSpacing: 0.8, marginBottom: 8 },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: 8, marginRight: 8, backgroundColor: '#FFFFFF',
  },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: 13, color: COLORS.textSecondary },
  chipTextActive: { color: '#FFFFFF', fontWeight: '600' },
  studentSelector: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: 12, backgroundColor: '#FFFFFF',
  },
  studentSelectorText: { fontSize: 15, color: COLORS.textPrimary, fontWeight: '500' },
  studentSelectorPlaceholder: { fontSize: 15, color: COLORS.textSecondary },
  pickerDropdown: {
    backgroundColor: '#FFFFFF', marginHorizontal: 16, borderRadius: 8,
    elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 4, marginTop: 4, marginBottom: 8,
  },
  pickerItem: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  pickerItemText: { fontSize: 15, color: COLORS.textPrimary },
  centered: { padding: 40, alignItems: 'center' },
  reportCard: { margin: 16, backgroundColor: '#FFFFFF', borderRadius: 12, overflow: 'hidden', elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4 },
  reportHeader: { backgroundColor: COLORS.primary, padding: 16 },
  reportStudentName: { fontSize: 20, fontWeight: 'bold', color: '#FFFFFF' },
  reportMeta: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 4 },
  tableHeaderRow: { flexDirection: 'row', backgroundColor: COLORS.primary + '18', paddingVertical: 10 },
  tableHeaderText: { fontWeight: '700', color: COLORS.primary, fontSize: 12 },
  tableRow: { flexDirection: 'row', paddingVertical: 10 },
  tableRowAlt: { backgroundColor: '#F8FAFC' },
  tableCell: { width: 80, textAlign: 'center', fontSize: 13, color: COLORS.textPrimary, paddingHorizontal: 4 },
  subjectCell: { width: 130, textAlign: 'left', paddingLeft: 12 },
  gradeChip: { fontSize: 12, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  overallRow: {
    flexDirection: 'row', paddingVertical: 16, paddingHorizontal: 16,
    borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  overallItem: { flex: 1, alignItems: 'center' },
  overallVal: { fontSize: 22, fontWeight: 'bold', color: COLORS.textPrimary },
  overallLabel: { fontSize: 11, color: COLORS.textSecondary, marginTop: 4 },
  shareBtn: {
    backgroundColor: COLORS.accent, borderRadius: 0, paddingVertical: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  shareBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  emptyText: { color: COLORS.textSecondary, fontSize: 15, marginTop: 12, textAlign: 'center', paddingHorizontal: 24 },
});