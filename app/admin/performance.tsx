import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  collection, getDocs, addDoc, updateDoc, doc,
  query, where,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getUserSession } from '@/lib/storage';
import { COLORS } from '@/lib/theme';
import { Student, PerformanceRating } from '@/lib/types';

const CLASS_OPTIONS = ['6','7','8','9','10','11','12'];
const SECTION_OPTIONS = ['A','B','C','D'];
const SUBJECTS = ['English','Hindi','Mathematics','Science','Social Science','Sanskrit','Computer','Physical Education'];
const TRENDS = ['improving','stable','declining'] as const;
const TREND_COLORS: Record<string, string> = { improving: COLORS.success, stable: '#3B82F6', declining: COLORS.error };
const TREND_ICONS: Record<string, string> = { improving: 'trending-up', stable: 'trending-neutral', declining: 'trending-down' };

interface SubjectRating { subject: string; rating: number; remarks: string; trend: typeof TRENDS[number]; existingId?: string; }

export default function PerformanceScreen() {
  const [schoolId, setSchoolId] = useState('school_001');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [showStudentPicker, setShowStudentPicker] = useState(false);
  const [ratings, setRatings] = useState<SubjectRating[]>(
    SUBJECTS.map(s => ({ subject: s, rating: 0, remarks: '', trend: 'stable' }))
  );
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => { initScreen(); }, []);
  useEffect(() => { if (selectedClass && selectedSection) loadStudents(); }, [selectedClass, selectedSection]);
  useEffect(() => { if (selectedStudent) loadRatings(); }, [selectedStudent]);

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
      setRatings(SUBJECTS.map(s => ({ subject: s, rating: 0, remarks: '', trend: 'stable' })));
    } catch (e) { console.error(e); }
  }

  async function loadRatings() {
    if (!selectedStudent) return;
    setLoading(true);
    try {
      const snap = await getDocs(query(
        collection(db, 'schools', schoolId, 'performance_ratings'),
        where('student_id', '==', selectedStudent.id),
        where('academic_year', '==', '2025-2026')
      ));
      const existing = snap.docs.map(d => ({ id: d.id, ...d.data() } as PerformanceRating & { id: string });
      const updatedRatings = SUBJECTS.map(subject => {
        const found = existing.find(e => e.subject === subject);
        return {
          subject,
          rating: found?.rating ?? 0,
          remarks: found?.remarks ?? '',
          trend: (found?.trend ?? 'stable') as typeof TRENDS[number],
          existingId: found?.id,
        };
      });
      setRatings(updatedRatings);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  function updateRating(subject: string, field: 'rating' | 'remarks' | 'trend', value: any) {
    setRatings(prev => prev.map(r => r.subject === subject ? { ...r, [field]: value } : r));
  }

  async function handleSave() {
    if (!selectedStudent) return;
    setSaving(true);
    try {
      for (const r of ratings) {
        if (r.rating === 0 && !r.remarks) continue;
        const payload = {
          student_id: selectedStudent.id,
          student_name: selectedStudent.name,
          class: selectedClass,
          section: selectedSection,
          subject: r.subject,
          rating: r.rating,
          remarks: r.remarks,
          trend: r.trend,
          academic_year: '2025-2026',
          school_id: schoolId,
        };
        if (r.existingId) {
          await updateDoc(doc(db, 'schools', schoolId, 'performance_ratings', r.existingId), payload);
        } else {
          await addDoc(collection(db, 'schools', schoolId, 'performance_ratings'), payload);
        }
      }
      Alert.alert('Success', 'Performance ratings saved successfully.');
      await loadRatings();
    } catch (e) {
      Alert.alert('Error', 'Failed to save ratings.');
    } finally {
      setSaving(false);
    }
  }

  function renderStars(subject: string, currentRating: number) {
    return (
      <View style={styles.starsRow}>
        {[1, 2, 3, 4, 5].map(star => (
          <TouchableOpacity
            key={star}
            onPress={() => updateRating(subject, 'rating', star)}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons
              name={star <= currentRating ? 'star' : 'star-outline'}
              size={28}
              color={star <= currentRating ? COLORS.accent : COLORS.border}
            />
          </TouchableOpacity>
        ))}
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Performance Ratings</Text>
      </View>

      <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Class Selector */}
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

        {/* Section Selector */}
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

        {loading && (
          <View style={styles.centered}><ActivityIndicator color={COLORS.primary} size="large" /></View>
        )}

        {/* Ratings */}
        {!loading && selectedStudent && (
          <View style={styles.ratingsContainer}>
            <Text style={styles.ratingsTitle}>{selectedStudent.name} — Performance Ratings</Text>
            {ratings.map(r => (
              <View key={r.subject} style={styles.ratingCard}>
                <Text style={styles.ratingSubject}>{r.subject}</Text>
                {renderStars(r.subject, r.rating)}

                {/* Trend */}
                <View style={styles.trendRow}>
                  {TRENDS.map(trend => (
                    <TouchableOpacity
                      key={trend}
                      style={[
                        styles.trendChip,
                        { borderColor: TREND_COLORS[trend] },
                        r.trend === trend && { backgroundColor: TREND_COLORS[trend] }
                      ]}
                      onPress={() => updateRating(r.subject, 'trend', trend)}
                    >
                      <MaterialCommunityIcons
                        name={TREND_ICONS[trend] as any}
                        size={14}
                        color={r.trend === trend ? '#FFFFFF' : TREND_COLORS[trend]}
                      />
                      <Text style={[
                        styles.trendChipText,
                        { color: r.trend === trend ? '#FFFFFF' : TREND_COLORS[trend] }
                      ]}>
                        {trend.charAt(0).toUpperCase() + trend.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Remarks */}
                <TextInput
                  style={styles.remarksInput}
                  placeholder="Teacher remarks..."
                  placeholderTextColor={COLORS.textSecondary}
                  value={r.remarks}
                  onChangeText={v => updateRating(r.subject, 'remarks', v)}
                />
              </View>
            ))}

            <TouchableOpacity
              style={[styles.saveBtn, saving && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.8}
            >
              {saving ? <ActivityIndicator color="#FFFFFF" size="small" /> : (
                <>
                  <MaterialCommunityIcons name="content-save" size={18} color="#FFFFFF" />
                  <Text style={styles.saveBtnText}>Save All Ratings</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {!selectedStudent && selectedClass && selectedSection && students.length > 0 && (
          <View style={styles.placeholderContainer}>
            <MaterialCommunityIcons name="star-circle-outline" size={48} color={COLORS.textSecondary} />
            <Text style={styles.placeholderText}>Select a student to rate their performance</Text>
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
  ratingsContainer: { padding: 16 },
  ratingsTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 12 },
  ratingCard: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14, marginBottom: 10, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3 },
  ratingSubject: { fontSize: 15, fontWeight: '700', color: COLORS.primary, marginBottom: 10 },
  starsRow: { flexDirection: 'row', gap: 4, marginBottom: 10 },
  trendRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  trendChip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1.5, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  trendChipText: { fontSize: 12, fontWeight: '600' },
  remarksInput: { backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: COLORS.textPrimary },
  saveBtn: { backgroundColor: COLORS.primary, borderRadius: 8, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 8 },
  saveBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
  placeholderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  placeholderText: { color: COLORS.textSecondary, fontSize: 15, textAlign: 'center', marginTop: 12 },
});