import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, ActivityIndicator, ScrollView, Alert,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  collection, getDocs, addDoc, updateDoc, doc,
  query, where,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getUserSession } from '@/lib/storage';
import { COLORS } from '@/lib/theme';
import { Student, MarksRecord } from '@/lib/types';

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

export default function MarksScreen() {
  const [schoolId, setSchoolId] = useState('school_001');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedExam, setSelectedExam] = useState<typeof EXAM_TYPES[number]>('UT1');
  const [students, setStudents] = useState<Student[]>([]);
  const [marksMap, setMarksMap] = useState<Record<string, string>>({});
  const [existingMarksMap, setExistingMarksMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [maxMarks] = useState(100);

  useEffect(() => { initScreen(); }, []);
  useEffect(() => {
    if (selectedClass && selectedSection && selectedSubject && selectedExam) {
      loadStudentsAndMarks();
    }
  }, [selectedClass, selectedSection, selectedSubject, selectedExam]);

  async function initScreen() {
    const session = await getUserSession();
    setSchoolId(session.schoolId);
  }

  async function loadStudentsAndMarks() {
    setLoading(true);
    try {
      const studSnap = await getDocs(
        query(
          collection(db, 'schools', schoolId, 'students'),
          where('class', '==', selectedClass),
          where('section', '==', selectedSection)
        )
      );
      const studs = studSnap.docs.map(d => ({ id: d.id, ...d.data() } as Student));
      studs.sort((a, b) => (a.roll_number ?? 0) - (b.roll_number ?? 0));
      setStudents(studs);

      const marksSnap = await getDocs(
        query(
          collection(db, 'schools', schoolId, 'marks'),
          where('class', '==', selectedClass),
          where('section', '==', selectedSection),
          where('subject', '==', selectedSubject),
          where('exam_type', '==', selectedExam)
        )
      );
      const mMap: Record<string, string> = {};
      const eMap: Record<string, string> = {};
      marksSnap.forEach(d => {
        const data = d.data() as MarksRecord;
        mMap[data.student_id] = data.marks.toString();
        eMap[data.student_id] = d.id;
      });
      setMarksMap(mMap);
      setExistingMarksMap(eMap);
    } catch (e) {
      console.error('Load marks error:', e);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveMarks() {
    if (!selectedClass || !selectedSection || !selectedSubject) {
      Alert.alert('Error', 'Please select class, section and subject.');
      return;
    }
    setSaving(true);
    try {
      for (const student of students) {
        const marksVal = marksMap[student.id];
        if (marksVal === undefined || marksVal === '') continue;
        const marks = parseFloat(marksVal);
        if (isNaN(marks)) continue;
        const grade = getCBSEGrade(marks, maxMarks);
        const payload: Omit<MarksRecord, 'id'> = {
          student_id: student.id,
          student_name: student.name,
          class: selectedClass,
          section: selectedSection,
          subject: selectedSubject,
          exam_type: selectedExam,
          marks,
          max_marks: maxMarks,
          grade,
          academic_year: '2025-2026',
          school_id: schoolId,
        };
        if (existingMarksMap[student.id]) {
          await updateDoc(
            doc(db, 'schools', schoolId, 'marks', existingMarksMap[student.id]),
            payload
          );
        } else {
          await addDoc(collection(db, 'schools', schoolId, 'marks'), payload);
        }
      }
      Alert.alert('Success', 'Marks saved successfully.');
      await loadStudentsAndMarks();
    } catch (e) {
      Alert.alert('Error', 'Failed to save marks.');
    } finally {
      setSaving(false);
    }
  }

  function getStats() {
    const values = students
      .map(s => parseFloat(marksMap[s.id] ?? ''))
      .filter(v => !isNaN(v));
    if (values.length === 0) return null;
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const highest = Math.max(...values);
    const lowest = Math.min(...values);
    return { avg: avg.toFixed(1), highest, lowest, count: values.length };
  }

  const stats = getStats();

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Marks Entry</Text>
      </View>

      <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
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

        {/* Subject Selector */}
        <View style={styles.selectorSection}>
          <Text style={styles.selectorLabel}>SUBJECT</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {SUBJECTS.map(sub => (
              <TouchableOpacity
                key={sub}
                style={[styles.chip, selectedSubject === sub && styles.chipActive]}
                onPress={() => setSelectedSubject(sub)}
              >
                <Text style={[styles.chipText, selectedSubject === sub && styles.chipTextActive]}>{sub}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Exam Type Selector */}
        <View style={styles.selectorSection}>
          <Text style={styles.selectorLabel}>EXAM TYPE</Text>
          <View style={styles.rowWrap}>
            {EXAM_TYPES.map(exam => (
              <TouchableOpacity
                key={exam}
                style={[styles.chip, selectedExam === exam && styles.chipActive]}
                onPress={() => setSelectedExam(exam)}
              >
                <Text style={[styles.chipText, selectedExam === exam && styles.chipTextActive]}>{exam}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Stats Banner */}
        {stats && (
          <View style={styles.statsBanner}>
            <View style={styles.statItem}>
              <Text style={styles.statVal}>{stats.avg}</Text>
              <Text style={styles.statLbl}>Avg</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statVal, { color: COLORS.success }]}>{stats.highest}</Text>
              <Text style={styles.statLbl}>Highest</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statVal, { color: COLORS.error }]}>{stats.lowest}</Text>
              <Text style={styles.statLbl}>Lowest</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statVal}>{stats.count}</Text>
              <Text style={styles.statLbl}>Entered</Text>
            </View>
          </View>
        )}

        {/* Students List */}
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator color={COLORS.primary} size="large" />
          </View>
        ) : students.length === 0 && selectedClass && selectedSection ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No students in Class {selectedClass}-{selectedSection}</Text>
          </View>
        ) : (
          <>
            {students.map((student, index) => {
              const marksVal = marksMap[student.id] ?? '';
              const marksNum = parseFloat(marksVal);
              const grade = !isNaN(marksNum) ? getCBSEGrade(marksNum, maxMarks) : '';
              return (
                <View key={student.id} style={styles.markRow}>
                  <View style={styles.markRowLeft}>
                    <Text style={styles.rollNum}>{student.roll_number}</Text>
                    <Text style={styles.studentName} numberOfLines={1}>{student.name}</Text>
                  </View>
                  <TextInput
                    style={styles.marksInput}
                    placeholder="--"
                    placeholderTextColor={COLORS.textSecondary}
                    keyboardType="numeric"
                    maxLength={3}
                    value={marksVal}
                    onChangeText={v => {
                      const clean = v.replace(/[^0-9.]/g, '');
                      setMarksMap(prev => ({ ...prev, [student.id]: clean }));
                    }}
                  />
                  {grade ? (
                    <View style={[styles.gradeBadge, { backgroundColor: getGradeColor(grade) + '18' }]}>
                      <Text style={[styles.gradeText, { color: getGradeColor(grade) }]}>{grade}</Text>
                    </View>
                  ) : (
                    <View style={styles.gradeBadgePlaceholder} />
                  )}
                </View>
              );
            })}

            {students.length > 0 && (
              <TouchableOpacity
                style={[styles.saveButton, saving && { opacity: 0.6 }]}
                onPress={handleSaveMarks}
                disabled={saving}
                activeOpacity={0.8}
              >
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <>
                    <MaterialCommunityIcons name="content-save" size={18} color="#FFFFFF" />
                    <Text style={styles.saveButtonText}>Save All Marks</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </>
        )}

        {!selectedClass || !selectedSection || !selectedSubject ? (
          <View style={styles.placeholderContainer}>
            <MaterialCommunityIcons name="pencil-box-outline" size={48} color={COLORS.textSecondary} />
            <Text style={styles.placeholderText}>Select Class, Section and Subject to begin</Text>
          </View>
        ) : null}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  header: {
    backgroundColor: COLORS.primary, paddingTop: 52,
    paddingBottom: 16, paddingHorizontal: 16,
  },
  headerTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: 'bold' },
  scroll: { flex: 1 },
  selectorSection: {
    backgroundColor: '#FFFFFF', paddingHorizontal: 16,
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  selectorLabel: {
    fontSize: 11, fontWeight: '700', color: COLORS.textSecondary,
    letterSpacing: 0.8, marginBottom: 8,
  },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: 8, marginRight: 8, backgroundColor: '#FFFFFF',
  },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: 13, color: COLORS.textSecondary },
  chipTextActive: { color: '#FFFFFF', fontWeight: '600' },
  statsBanner: {
    flexDirection: 'row', backgroundColor: COLORS.primary,
    paddingVertical: 12, paddingHorizontal: 16,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statVal: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
  statLbl: { color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 2 },
  markRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  markRowLeft: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  rollNum: {
    width: 32, fontSize: 13, fontWeight: '700',
    color: COLORS.primary, textAlign: 'center',
  },
  studentName: { flex: 1, fontSize: 15, color: COLORS.textPrimary, marginLeft: 8 },
  marksInput: {
    width: 64, borderWidth: 1.5, borderColor: COLORS.accent,
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8,
    fontSize: 16, fontWeight: '600', color: COLORS.textPrimary,
    textAlign: 'center', marginRight: 10,
  },
  gradeBadge: { width: 44, borderRadius: 8, paddingVertical: 6, alignItems: 'center' },
  gradeBadgePlaceholder: { width: 44 },
  gradeText: { fontSize: 14, fontWeight: '700' },
  centered: { padding: 40, alignItems: 'center' },
  emptyContainer: { padding: 40, alignItems: 'center' },
  emptyText: { color: COLORS.textSecondary, fontSize: 15 },
  placeholderContainer: { padding: 40, alignItems: 'center', marginTop: 20 },
  placeholderText: {
    color: COLORS.textSecondary, fontSize: 15, textAlign: 'center',
    marginTop: 12, lineHeight: 22,
  },
  saveButton: {
    backgroundColor: COLORS.primary, borderRadius: 8, paddingVertical: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, margin: 16,
  },
  saveButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
});