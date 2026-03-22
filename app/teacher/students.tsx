import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, ActivityIndicator, Modal, ScrollView,
  RefreshControl,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getUserSession } from '@/lib/storage';
import { COLORS } from '@/lib/theme';
import { Student, MarksRecord, AttendanceRecord } from '@/lib/types';

export default function TeacherStudentsScreen() {
  const [schoolId, setSchoolId] = useState('school_001');
  const [assignedClass, setAssignedClass] = useState('');
  const [assignedSection, setAssignedSection] = useState('');
  const [students, setStudents] = useState<Student[]>([]);
  const [filtered, setFiltered] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [studentMarks, setStudentMarks] = useState<MarksRecord[]>([]);
  const [attendancePercent, setAttendancePercent] = useState<number | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => { initScreen(); }, []);
  useEffect(() => {
    const q = searchText.toLowerCase();
    setFiltered(students.filter(s =>
      s.name.toLowerCase().includes(q) ||
      s.roll_number?.toString().includes(q)
    ));
  }, [searchText, students]);

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
        setAssignedClass(s.assigned_class ?? '');
        setAssignedSection(s.assigned_section ?? '');
        await loadStudents(session.schoolId, s.assigned_class ?? '', s.assigned_section ?? '');
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function loadStudents(sid: string, cls: string, sec: string) {
    if (!cls || !sec) return;
    try {
      const snap = await getDocs(query(
        collection(db, 'schools', sid, 'students'),
        where('class', '==', cls),
        where('section', '==', sec)
      ));
      const studs = snap.docs.map(d => ({ id: d.id, ...d.data() } as Student));
      studs.sort((a, b) => (a.roll_number ?? 0) - (b.roll_number ?? 0));
      setStudents(studs);
      setFiltered(studs);
    } catch (e) { console.error(e); }
    finally { setRefreshing(false); }
  }

  async function openStudentDetail(student: Student) {
    setSelectedStudent(student);
    setShowDetail(true);
    setLoadingDetail(true);
    try {
      const [marksSnap, attSnap] = await Promise.all([
        getDocs(query(collection(db, 'schools', schoolId, 'marks'), where('student_id', '==', student.id))),
        getDocs(query(collection(db, 'schools', schoolId, 'attendance'), where('student_id', '==', student.id))),
      ]);
      setStudentMarks(marksSnap.docs.map(d => d.data() as MarksRecord));
      const attRecords = attSnap.docs.map(d => d.data() as AttendanceRecord);
      if (attRecords.length > 0) {
        const present = attRecords.filter(r => r.status === 'present').length;
        setAttendancePercent(Math.round((present / attRecords.length) * 100));
      } else {
        setAttendancePercent(null);
      }
    } catch (e) { console.error(e); }
    finally { setLoadingDetail(false); }
  }

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadStudents(schoolId, assignedClass, assignedSection);
  }, [schoolId, assignedClass, assignedSection]);

  function getLatestMarks(studentId: string): { avg: number; count: number } | null {
    const sm = studentMarks.filter(m => m.student_id === studentId);
    if (sm.length === 0) return null;
    const latest = sm.filter(m => m.exam_type === 'Annual').length > 0
      ? sm.filter(m => m.exam_type === 'Annual')
      : sm;
    const avg = latest.reduce((s, m) => s + (m.marks / m.max_marks) * 100, 0) / latest.length;
    return { avg: parseFloat(avg.toFixed(1)), count: latest.length };
  }

  function renderCard({ item }: { item: Student }) {
    return (
      <TouchableOpacity style={styles.card} onPress={() => openStudentDetail(item)} activeOpacity={0.8}>
        <View style={styles.cardLeft}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{item.name.charAt(0)}</Text>
          </View>
          <View style={styles.cardInfo}>
            <Text style={styles.cardName}>{item.name}</Text>
            <Text style={styles.cardMeta}>Roll {item.roll_number} • {item.parent_phone}</Text>
            {item.fees_due > 0 && (
              <Text style={styles.feeDue}>₹{item.fees_due} due</Text>
            )}
          </View>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={20} color={COLORS.textSecondary} />
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Students</Text>
        <Text style={styles.headerSub}>
          {assignedClass ? `Class ${assignedClass}-${assignedSection} • ${students.length} students` : 'No class assigned'}
        </Text>
      </View>

      <View style={styles.searchRow}>
        <MaterialCommunityIcons name="magnify" size={20} color={COLORS.textSecondary} style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name or roll number..."
          placeholderTextColor={COLORS.textSecondary}
          value={searchText}
          onChangeText={setSearchText}
        />
        {searchText.length > 0 && (
          <TouchableOpacity onPress={() => setSearchText('')}>
            <MaterialCommunityIcons name="close" size={18} color={COLORS.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.centered}><ActivityIndicator color={COLORS.primary} size="large" /></View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          renderItem={renderCard}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="account-group-outline" size={48} color={COLORS.textSecondary} />
              <Text style={styles.emptyText}>
                {assignedClass ? 'No students found' : 'No class assigned to your account'}
              </Text>
            </View>
          }
        />
      )}

      {/* Student Detail Modal */}
      <Modal visible={showDetail} animationType="slide" onRequestClose={() => setShowDetail(false)}>
        {selectedStudent && (
          <View style={{ flex: 1, backgroundColor: COLORS.background }}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalHeaderTitle}>Student Profile</Text>
              <TouchableOpacity onPress={() => setShowDetail(false)}>
                <MaterialCommunityIcons name="close" size={26} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ padding: 16 }}>
              {/* Avatar + Name */}
              <View style={styles.detailAvatar}>
                <View style={styles.detailAvatarCircle}>
                  <Text style={styles.detailAvatarText}>{selectedStudent.name.charAt(0)}</Text>
                </View>
                <Text style={styles.detailName}>{selectedStudent.name}</Text>
                <Text style={styles.detailMeta}>
                  Class {selectedStudent.class}-{selectedStudent.section} • Roll {selectedStudent.roll_number}
                </Text>
              </View>

              {loadingDetail ? (
                <ActivityIndicator color={COLORS.primary} style={{ marginTop: 20 }} />
              ) : (
                <>
                  {/* Stats Row */}
                  <View style={styles.detailStatsRow}>
                    <View style={styles.detailStat}>
                      <Text style={[styles.detailStatVal, { color: attendancePercent !== null && attendancePercent >= 75 ? COLORS.success : COLORS.error }]}>
                        {attendancePercent !== null ? `${attendancePercent}%` : 'N/A'}
                      </Text>
                      <Text style={styles.detailStatLabel}>Attendance</Text>
                    </View>
                    <View style={styles.detailStat}>
                      <Text style={styles.detailStatVal}>{studentMarks.length}</Text>
                      <Text style={styles.detailStatLabel}>Marks Entries</Text>
                    </View>
                    <View style={styles.detailStat}>
                      <Text style={[styles.detailStatVal, { color: selectedStudent.fees_due > 0 ? COLORS.error : COLORS.success }]}>
                        {selectedStudent.fees_due > 0 ? `₹${selectedStudent.fees_due}` : 'Clear'}
                      </Text>
                      <Text style={styles.detailStatLabel}>Fees Due</Text>
                    </View>
                  </View>

                  {/* Info Rows */}
                  {[
                    { label: 'Parent Name', value: selectedStudent.parent_name || 'N/A', icon: 'account' },
                    { label: 'Parent Phone', value: selectedStudent.parent_phone, icon: 'phone' },
                    { label: 'Date of Birth', value: selectedStudent.dob || 'N/A', icon: 'cake' },
                    { label: 'Address', value: selectedStudent.address || 'N/A', icon: 'map-marker' },
                    { label: 'Admission Date', value: selectedStudent.admission_date || 'N/A', icon: 'calendar' },
                  ].map((row, i) => (
                    <View key={i} style={styles.infoRow}>
                      <MaterialCommunityIcons name={row.icon as any} size={18} color={COLORS.primary} style={{ width: 26 }} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.infoLabel}>{row.label}</Text>
                        <Text style={styles.infoValue}>{row.value}</Text>
                      </View>
                    </View>
                  ))}
                </>
              )}
              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  header: { backgroundColor: COLORS.primary, paddingTop: 52, paddingBottom: 16, paddingHorizontal: 16 },
  headerTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: 'bold' },
  headerSub: { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 4 },
  searchRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  searchInput: { flex: 1, fontSize: 15, color: COLORS.textPrimary },
  listContent: { padding: 16, paddingBottom: 40 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3 },
  cardLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.primary + '18', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarText: { fontSize: 18, fontWeight: 'bold', color: COLORS.primary },
  cardInfo: { flex: 1 },
  cardName: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  cardMeta: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  feeDue: { fontSize: 12, color: COLORS.error, marginTop: 2, fontWeight: '600' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  emptyText: { color: COLORS.textSecondary, fontSize: 15, marginTop: 12, textAlign: 'center', paddingHorizontal: 24 },
  modalHeader: { backgroundColor: COLORS.primary, paddingTop: 52, paddingBottom: 16, paddingHorizontal: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalHeaderTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
  detailAvatar: { alignItems: 'center', paddingVertical: 20 },
  detailAvatarCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.primary + '18', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  detailAvatarText: { fontSize: 32, fontWeight: 'bold', color: COLORS.primary },
  detailName: { fontSize: 22, fontWeight: 'bold', color: COLORS.textPrimary },
  detailMeta: { fontSize: 14, color: COLORS.textSecondary, marginTop: 4 },
  detailStatsRow: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, marginBottom: 12, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3 },
  detailStat: { flex: 1, alignItems: 'center' },
  detailStatVal: { fontSize: 20, fontWeight: 'bold', color: COLORS.textPrimary },
  detailStatLabel: { fontSize: 11, color: COLORS.textSecondary, marginTop: 4 },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#FFFFFF', borderRadius: 10, padding: 14, marginBottom: 8, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 2 },
  infoLabel: { fontSize: 11, color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  infoValue: { fontSize: 15, color: COLORS.textPrimary, fontWeight: '500', marginTop: 2 },
});