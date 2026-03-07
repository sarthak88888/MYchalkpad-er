import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getUserSession } from '@/lib/storage';
import { COLORS } from '@/lib/theme';
import { MarksRecord } from '@/lib/types';
import Papa from 'papaparse';

const CLASS_OPTIONS = ['6','7','8','9','10','11','12'];
const SECTION_OPTIONS = ['A','B','C','D'];
const SUBJECTS = ['All Subjects','English','Hindi','Mathematics','Science','Social Science','Sanskrit','Computer','Physical Education'];
const EXAM_TYPES = ['UT1','UT2','Half-Yearly','Annual'];

interface RankedStudent {
  student_id: string;
  student_name: string;
  marks: number;
  max_marks: number;
  percentage: number;
  grade: string;
  rank: number;
}

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

export default function RankingsScreen() {
  const [schoolId, setSchoolId] = useState('school_001');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('All Subjects');
  const [selectedExam, setSelectedExam] = useState('Annual');
  const [rankings, setRankings] = useState<RankedStudent[]>([]);
  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState(false);

  useEffect(() => { initScreen(); }, []);

  async function initScreen() {
    const session = await getUserSession();
    setSchoolId(session.schoolId);
  }

  async function handleGenerate() {
    if (!selectedClass || !selectedSection) {
      Alert.alert('Error', 'Please select class and section.');
      return;
    }
    setLoading(true);
    setGenerated(false);
    try {
      let marksQuery;
      if (selectedSubject === 'All Subjects') {
        marksQuery = query(
          collection(db, 'schools', schoolId, 'marks'),
          where('class', '==', selectedClass),
          where('section', '==', selectedSection),
          where('exam_type', '==', selectedExam)
        );
      } else {
        marksQuery = query(
          collection(db, 'schools', schoolId, 'marks'),
          where('class', '==', selectedClass),
          where('section', '==', selectedSection),
          where('subject', '==', selectedSubject),
          where('exam_type', '==', selectedExam)
        );
      }

      const snap = await getDocs(marksQuery);
      const marksData = snap.docs.map(d => d.data() as MarksRecord);

      let ranked: RankedStudent[] = [];

      if (selectedSubject === 'All Subjects') {
        const studentTotals: Record<string, { name: string; total: number; count: number; maxTotal: number }> = {};
        marksData.forEach(m => {
          if (!studentTotals[m.student_id]) {
            studentTotals[m.student_id] = { name: m.student_name, total: 0, count: 0, maxTotal: 0 };
          }
          studentTotals[m.student_id].total += m.marks;
          studentTotals[m.student_id].count++;
          studentTotals[m.student_id].maxTotal += m.max_marks;
        });
        ranked = Object.entries(studentTotals).map(([id, data]) => {
          const pct = data.maxTotal > 0 ? (data.total / data.maxTotal) * 100 : 0;
          return {
            student_id: id,
            student_name: data.name,
            marks: data.total,
            max_marks: data.maxTotal,
            percentage: parseFloat(pct.toFixed(1)),
            grade: getCBSEGrade(pct, 100),
            rank: 0,
          };
        });
      } else {
        ranked = marksData.map(m => {
          const pct = m.max_marks > 0 ? (m.marks / m.max_marks) * 100 : 0;
          return {
            student_id: m.student_id,
            student_name: m.student_name,
            marks: m.marks,
            max_marks: m.max_marks,
            percentage: parseFloat(pct.toFixed(1)),
            grade: getCBSEGrade(m.marks, m.max_marks),
            rank: 0,
          };
        });
      }

      ranked.sort((a, b) => b.percentage - a.percentage);
      ranked = ranked.map((r, i) => ({ ...r, rank: i + 1 }));
      setRankings(ranked);
      setGenerated(true);
    } catch (e) {
      Alert.alert('Error', 'Failed to generate rankings.');
    } finally {
      setLoading(false);
    }
  }

  function handleExportCSV() {
    if (rankings.length === 0) return;
    const rows = rankings.map(r => ({
      Rank: r.rank,
      Name: r.student_name,
      Marks: r.marks,
      MaxMarks: r.max_marks,
      Percentage: r.percentage + '%',
      Grade: r.grade,
    }));
    const csv = Papa.unparse(rows);
    Alert.alert('Export Ready', `Rankings CSV prepared with ${rows.length} students.\n\nIn production, this would be saved to downloads.`);
  }

  function getMedalIcon(rank: number) {
    if (rank === 1) return { icon: 'medal', color: '#F59E0B' };
    if (rank === 2) return { icon: 'medal', color: '#94A3B8' };
    if (rank === 3) return { icon: 'medal', color: '#B45309' };
    return null;
  }

  function getGradeColor(grade: string): string {
    if (grade === 'A1' || grade === 'A2') return COLORS.success;
    if (grade === 'B1' || grade === 'B2') return '#3B82F6';
    if (grade === 'C1' || grade === 'C2') return COLORS.warning;
    if (grade === 'D') return '#F59E0B';
    return COLORS.error;
  }

  function renderRankRow({ item }: { item: RankedStudent }) {
    const medal = getMedalIcon(item.rank);
    return (
      <View style={[styles.rankRow, item.rank <= 3 && styles.rankRowTop]}>
        <View style={styles.rankNum}>
          {medal ? (
            <MaterialCommunityIcons name={medal.icon as any} size={24} color={medal.color} />
          ) : (
            <Text style={styles.rankNumText}>{item.rank}</Text>
          )}
        </View>
        <View style={styles.rankInfo}>
          <Text style={styles.rankName}>{item.student_name}</Text>
          <Text style={styles.rankMarks}>{item.marks}/{item.max_marks} • {item.percentage}%</Text>
        </View>
        <View style={[styles.gradeBadge, { backgroundColor: getGradeColor(item.grade) + '18' }]}>
          <Text style={[styles.gradeText, { color: getGradeColor(item.grade) }]}>{item.grade}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Student Rankings</Text>
      </View>

      <FlatList
        data={rankings}
        keyExtractor={item => item.student_id}
        renderItem={renderRankRow}
        contentContainerStyle={{ paddingBottom: 40 }}
        ListHeaderComponent={
          <View>
            {/* Selectors */}
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

            <View style={styles.selectorSection}>
              <Text style={styles.selectorLabel}>SUBJECT</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {SUBJECTS.map(sub => (
                  <TouchableOpacity key={sub} style={[styles.chip, selectedSubject === sub && styles.chipActive]} onPress={() => setSelectedSubject(sub)}>
                    <Text style={[styles.chipText, selectedSubject === sub && styles.chipTextActive]}>{sub}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View style={styles.selectorSection}>
              <Text style={styles.selectorLabel}>EXAM TYPE</Text>
              <View style={styles.rowWrap}>
                {EXAM_TYPES.map(exam => (
                  <TouchableOpacity key={exam} style={[styles.chip, selectedExam === exam && styles.chipActive]} onPress={() => setSelectedExam(exam)}>
                    <Text style={[styles.chipText, selectedExam === exam && styles.chipTextActive]}>{exam}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <TouchableOpacity
              style={[styles.generateBtn, loading && { opacity: 0.6 }]}
              onPress={handleGenerate}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? <ActivityIndicator color="#FFFFFF" size="small" /> : (
                <>
                  <MaterialCommunityIcons name="podium" size={18} color="#FFFFFF" />
                  <Text style={styles.generateBtnText}>Generate Rankings</Text>
                </>
              )}
            </TouchableOpacity>

            {generated && rankings.length > 0 && (
              <View style={styles.resultsHeader}>
                <Text style={styles.resultsTitle}>
                  Class {selectedClass}-{selectedSection} • {selectedSubject} • {selectedExam}
                </Text>
                <Text style={styles.resultsCount}>{rankings.length} students ranked</Text>
                <TouchableOpacity style={styles.exportBtn} onPress={handleExportCSV} activeOpacity={0.8}>
                  <MaterialCommunityIcons name="download" size={16} color={COLORS.primary} />
                  <Text style={styles.exportBtnText}>Export CSV</Text>
                </TouchableOpacity>
              </View>
            )}

            {generated && rankings.length === 0 && (
              <View style={styles.emptyContainer}>
                <MaterialCommunityIcons name="podium-remove" size={48} color={COLORS.textSecondary} />
                <Text style={styles.emptyText}>No marks data found for selected filters</Text>
              </View>
            )}
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  header: { backgroundColor: COLORS.primary, paddingTop: 52, paddingBottom: 16, paddingHorizontal: 16 },
  headerTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: 'bold' },
  selectorSection: { backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  selectorLabel: { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary, letterSpacing: 0.8, marginBottom: 8 },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8, marginRight: 8, backgroundColor: '#FFFFFF' },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: 13, color: COLORS.textSecondary },
  chipTextActive: { color: '#FFFFFF', fontWeight: '600' },
  generateBtn: { backgroundColor: COLORS.accent, borderRadius: 8, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, margin: 16 },
  generateBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
  resultsHeader: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: COLORS.border },
  resultsTitle: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary },
  resultsCount: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  exportBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  exportBtnText: { color: COLORS.primary, fontSize: 13, fontWeight: '600' },
  rankRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  rankRowTop: { backgroundColor: '#FFFBEB' },
  rankNum: { width: 40, alignItems: 'center' },
  rankNumText: { fontSize: 16, fontWeight: '700', color: COLORS.textSecondary },
  rankInfo: { flex: 1, marginLeft: 12 },
  rankName: { fontSize: 15, fontWeight: '600', color: COLORS.textPrimary },
  rankMarks: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  gradeBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  gradeText: { fontSize: 13, fontWeight: '700' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyText: { color: COLORS.textSecondary, fontSize: 15, marginTop: 12, textAlign: 'center' },
});
```

---

**✅ FILE GROUP 7 COMPLETE**

**All 6 files go in `app/admin/`:**
```
app/admin/
├── complaints.tsx
├── ptm.tsx
├── sms-dashboard.tsx
├── udise-export.tsx
├── fee-defaulters.tsx
└── rankings.tsx