import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getUserSession } from '@/lib/storage';
import { COLORS } from '@/lib/theme';
import { Student, MarksRecord } from '@/lib/types';

const EXAM_TYPES = ['UT1','UT2','Half-Yearly','Annual'] as const;

function getGrade(marks: number, max: number): string {
  const p = (marks / max) * 100;
  if (p >= 91) return 'A1'; if (p >= 81) return 'A2';
  if (p >= 71) return 'B1'; if (p >= 61) return 'B2';
  if (p >= 51) return 'C1'; if (p >= 41) return 'C2';
  if (p >= 33) return 'D'; return 'E';
}

function getGradeColor(grade: string): string {
  if (grade === 'A1' || grade === 'A2') return COLORS.success;
  if (grade === 'B1' || grade === 'B2') return '#3B82F6';
  if (grade === 'C1' || grade === 'C2') return COLORS.warning;
  if (grade === 'D') return '#F59E0B';
  return COLORS.error;
}

interface SubjectSummary {
  subject: string;
  UT1: number | null;
  UT2: number | null;
  'Half-Yearly': number | null;
  Annual: number | null;
  best: number;
  grade: string;
}

export default function ParentMarksScreen() {
  const [schoolId, setSchoolId] = useState('school_001');
  const [children, setChildren] = useState<Student[]>([]);
  const [selectedChild, setSelectedChild] = useState<Student | null>(null);
  const [marks, setMarks] = useState<MarksRecord[]>([]);
  const [subjectSummary, setSubjectSummary] = useState<SubjectSummary[]>([]);
  const [selectedExam, setSelectedExam] = useState<string>('Annual');
  const [loading, setLoading] = useState(true);

  useEffect(() => { initScreen(); }, []);
  useEffect(() => { if (selectedChild) loadMarks(selectedChild.id); }, [selectedChild]);
  useEffect(() => { buildSummary(); }, [marks, selectedExam]);

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

  async function loadMarks(studentId: string) {
    setLoading(true);
    try {
      const snap = await getDocs(query(
        collection(db, 'schools', schoolId, 'marks'),
        where('student_id', '==', studentId)
      ));
      setMarks(snap.docs.map(d => d.data() as MarksRecord));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  function buildSummary() {
    const subjects = [...new Set(marks.map(m => m.subject))];
    const summary: SubjectSummary[] = subjects.map(subject => {
      const subMarks = marks.filter(m => m.subject === subject);
      const get = (exam: string) => {
        const m = subMarks.find(m => m.exam_type === exam);
        return m ? parseFloat(((m.marks / m.max_marks) * 100).toFixed(1)) : null;
      };
      const ut1 = get('UT1'), ut2 = get('UT2'), hy = get('Half-Yearly'), annual = get('Annual');
      const vals = [ut1, ut2, hy, annual].filter(v => v !== null) as number[];
      const best = vals.length > 0 ? Math.max(...vals) : 0;
      const grade = getGrade(best, 100);
      return { subject, UT1: ut1, UT2: ut2, 'Half-Yearly': hy, Annual: annual, best, grade };
    });
    summary.sort((a, b) => b.best - a.best);
    setSubjectSummary(summary);
  }

  function getExamSummary(examType: string) {
    const examMarks = marks.filter(m => m.exam_type === examType);
    if (examMarks.length === 0) return null;
    const total = examMarks.reduce((s, m) => s + m.marks, 0);
    const maxTotal = examMarks.reduce((s, m) => s + m.max_marks, 0);
    const pct = maxTotal > 0 ? (total / maxTotal) * 100 : 0;
    return {
      total,
      maxTotal,
      pct: parseFloat(pct.toFixed(1)),
      grade: getGrade(pct, 100),
      count: examMarks.length,
    };
  }

  const currentExamSummary = getExamSummary(selectedExam);
  const currentExamMarks = marks.filter(m => m.exam_type === selectedExam);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Marks & Grades</Text>
        {selectedChild && (
          <Text style={styles.headerSub}>{selectedChild.name} • Class {selectedChild.class}-{selectedChild.section}</Text>
        )}
      </View>

      {children.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.childSelector} contentContainerStyle={{ paddingHorizontal: 16, gap: 8, alignItems: 'center', paddingVertical: 8 }}>
          {children.map(c => (
            <TouchableOpacity
              key={c.id}
              style={[styles.chip, selectedChild?.id === c.id && styles.chipActive]}
              onPress={() => setSelectedChild(c)}
            >
              <Text style={[styles.chipText, selectedChild?.id === c.id && styles.chipTextActive]}>
                {c.name.split(' ')[0]}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {loading ? (
        <View style={styles.centered}><ActivityIndicator color={COLORS.primary} size="large" /></View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Exam Selector */}
          <View style={styles.examSelector}>
            {EXAM_TYPES.map(exam => (
              <TouchableOpacity
                key={exam}
                style={[styles.examChip, selectedExam === exam && styles.examChipActive]}
                onPress={() => setSelectedExam(exam)}
              >
                <Text style={[styles.examChipText, selectedExam === exam && styles.examChipTextActive]}>
                  {exam}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Exam Summary Card */}
          {currentExamSummary ? (
            <View style={styles.summaryCard}>
              <View style={styles.summaryLeft}>
                <Text style={styles.summaryLabel}>{selectedExam} Summary</Text>
                <Text style={styles.summaryTotal}>
                  {currentExamSummary.total}/{currentExamSummary.maxTotal}
                </Text>
                <Text style={styles.summaryPct}>{currentExamSummary.pct}%</Text>
                <Text style={styles.summarySubjects}>{currentExamSummary.count} subjects</Text>
              </View>
              <View style={[styles.gradeCircle, { borderColor: getGradeColor(currentExamSummary.grade) }]}>
                <Text style={[styles.gradeCircleText, { color: getGradeColor(currentExamSummary.grade) }]}>
                  {currentExamSummary.grade}
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.noDataCard}>
              <MaterialCommunityIcons name="pencil-box-off" size={36} color={COLORS.textSecondary} />
              <Text style={styles.noDataText}>No marks entered for {selectedExam} yet</Text>
            </View>
          )}

          {/* Subject Marks */}
          {currentExamMarks.length > 0 && (
            <View style={styles.marksSection}>
              <Text style={styles.sectionLabel}>{selectedExam.toUpperCase()} — SUBJECT WISE</Text>
              {currentExamMarks
                .sort((a, b) => (b.marks / b.max_marks) - (a.marks / a.max_marks))
                .map((m, i) => {
                  const pct = parseFloat(((m.marks / m.max_marks) * 100).toFixed(1));
                  const grade = getGrade(m.marks, m.max_marks);
                  const color = getGradeColor(grade);
                  return (
                    <View key={i} style={styles.markRow}>
                      <View style={styles.markLeft}>
                        <Text style={styles.markSubject}>{m.subject}</Text>
                        <View style={styles.markBarContainer}>
                          <View style={[styles.markBarFill, { width: `${pct}%`, backgroundColor: color }]} />
                        </View>
                      </View>
                      <View style={styles.markRight}>
                        <Text style={styles.markScore}>{m.marks}/{m.max_marks}</Text>
                        <View style={[styles.markGrade, { backgroundColor: color + '18' }]}>
                          <Text style={[styles.markGradeText, { color }]}>{grade}</Text>
                        </View>
                      </View>
                    </View>
                  );
                })}
            </View>
          )}

          {/* All Exams Overview */}
          {subjectSummary.length > 0 && (
            <View style={styles.overviewSection}>
              <Text style={styles.sectionLabel}>ALL EXAMS OVERVIEW</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                <View>
                  {/* Header */}
                  <View style={styles.tableHeader}>
                    <Text style={[styles.tableCell, styles.subjectHeaderCell]}>Subject</Text>
                    {EXAM_TYPES.map(et => (
                      <Text key={et} style={styles.tableCell}>{et}</Text>
                    ))}
                    <Text style={styles.tableCell}>Best</Text>
                  </View>
                  {subjectSummary.map((row, i) => (
                    <View key={i} style={[styles.tableRow, i % 2 === 0 && styles.tableRowAlt]}>
                      <Text style={[styles.tableCell, styles.subjectCell]} numberOfLines={1}>{row.subject}</Text>
                      {EXAM_TYPES.map(et => (
                        <Text key={et} style={styles.tableCell}>
                          {row[et] !== null ? `${row[et]}%` : '--'}
                        </Text>
                      ))}
                      <View style={styles.tableCell}>
                        <Text style={[styles.gradeChip, { color: getGradeColor(row.grade), backgroundColor: getGradeColor(row.grade) + '18' }]}>
                          {row.grade}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              </ScrollView>
            </View>
          )}

          {marks.length === 0 && !loading && (
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="pencil-box-off" size={48} color={COLORS.textSecondary} />
              <Text style={styles.emptyText}>No marks available yet</Text>
            </View>
          )}

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
  childSelector: { backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: COLORS.border },
  chip: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  chipTextActive: { color: '#FFFFFF' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  examSelector: {
    flexDirection: 'row', backgroundColor: '#FFFFFF',
    paddingHorizontal: 16, paddingVertical: 10, gap: 8,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  examChip: { flex: 1, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
  examChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  examChipText: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary },
  examChipTextActive: { color: '#FFFFFF' },
  summaryCard: {
    backgroundColor: COLORS.primary, margin: 16, borderRadius: 16,
    padding: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  summaryLeft: {},
  summaryLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '600' },
  summaryTotal: { color: '#FFFFFF', fontSize: 28, fontWeight: 'bold', marginTop: 4 },
  summaryPct: { color: COLORS.accent, fontSize: 18, fontWeight: '700', marginTop: 2 },
  summarySubjects: { color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 4 },
  gradeCircle: { width: 72, height: 72, borderRadius: 36, borderWidth: 3, justifyContent: 'center', alignItems: 'center' },
  gradeCircleText: { fontSize: 22, fontWeight: 'bold' },
  noDataCard: { margin: 16, backgroundColor: '#FFFFFF', borderRadius: 12, padding: 24, alignItems: 'center' },
  noDataText: { color: COLORS.textSecondary, fontSize: 14, marginTop: 8 },
  marksSection: { marginHorizontal: 16, marginBottom: 12 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary, letterSpacing: 1, marginBottom: 10, marginTop: 4, textTransform: 'uppercase' },
  markRow: {
    backgroundColor: '#FFFFFF', borderRadius: 10, padding: 12, marginBottom: 8,
    flexDirection: 'row', alignItems: 'center',
    elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 2,
  },
  markLeft: { flex: 1, marginRight: 12 },
  markSubject: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary, marginBottom: 6 },
  markBarContainer: { height: 6, backgroundColor: COLORS.border, borderRadius: 3, overflow: 'hidden' },
  markBarFill: { height: '100%', borderRadius: 3 },
  markRight: { alignItems: 'flex-end', gap: 4 },
  markScore: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary },
  markGrade: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  markGradeText: { fontSize: 12, fontWeight: '700' },
  overviewSection: { marginHorizontal: 16, marginBottom: 12 },
  tableHeader: { flexDirection: 'row', backgroundColor: COLORS.primary + '10', paddingVertical: 10 },
  tableCell: { width: 70, textAlign: 'center', fontSize: 11, color: COLORS.textPrimary, paddingHorizontal: 2 },
  subjectHeaderCell: { width: 120, textAlign: 'left', paddingLeft: 8, fontWeight: '700', color: COLORS.primary },
  tableRow: { flexDirection: 'row', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  tableRowAlt: { backgroundColor: '#F8FAFC' },
  subjectCell: { width: 120, textAlign: 'left', paddingLeft: 8, fontWeight: '500' },
  gradeChip: { fontSize: 11, fontWeight: '700', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, textAlign: 'center' },
  emptyContainer: { alignItems: 'center', paddingTop: 60 },
  emptyText: { color: COLORS.textSecondary, fontSize: 15, marginTop: 12 },
});