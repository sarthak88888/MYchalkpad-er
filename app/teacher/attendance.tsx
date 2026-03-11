import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  collection, getDocs, addDoc, updateDoc, doc,
  query, where,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getUserSession } from '@/lib/storage';
import { sendSMS } from '@/lib/fast2sms';
import { COLORS } from '@/lib/theme';
import { Student } from '@/lib/types';

type AttendanceStatus = 'present' | 'absent' | 'late';

interface StudentAttendance {
  student: Student;
  status: AttendanceStatus;
  existingDocId: string | null;
}

const STATUS_COLORS: Record<AttendanceStatus, string> = {
  present: COLORS.success,
  absent: COLORS.error,
  late: COLORS.warning,
};

const STATUS_ICONS: Record<AttendanceStatus, string> = {
  present: 'check-circle',
  absent: 'close-circle',
  late: 'clock-alert',
};

export default function TeacherAttendanceScreen() {
  const [schoolId, setSchoolId] = useState('school_001');
  const [assignedClass, setAssignedClass] = useState('');
  const [assignedSection, setAssignedSection] = useState('');
  const [teacherPhone, setTeacherPhone] = useState('');
  const [attendance, setAttendance] = useState<StudentAttendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendingSMS, setSendingSMS] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);

  useEffect(() => { initScreen(); }, []);
  useEffect(() => {
    if (assignedClass && assignedSection) loadAttendance();
  }, [selectedDate, assignedClass, assignedSection]);

  async function initScreen() {
    const session = await getUserSession();
    setSchoolId(session.schoolId);
    setTeacherPhone(session.phone);
    try {
      const staffSnap = await getDocs(query(
        collection(db, 'schools', session.schoolId, 'staff'),
        where('phone', '==', session.phone)
      ));
      if (!staffSnap.empty) {
        const staffData = staffSnap.docs[0].data();
        setAssignedClass(staffData.assigned_class ?? '');
        setAssignedSection(staffData.assigned_section ?? '');
      }
    } catch (e) { console.error(e); }
  }

  async function loadAttendance() {
    setLoading(true);
    try {
      const studSnap = await getDocs(query(
        collection(db, 'schools', schoolId, 'students'),
        where('class', '==', assignedClass),
        where('section', '==', assignedSection)
      ));
      const students = studSnap.docs.map(d => ({ id: d.id, ...d.data() } as Student));
      students.sort((a, b) => (a.roll_number ?? 0) - (b.roll_number ?? 0));

      const attSnap = await getDocs(query(
        collection(db, 'schools', schoolId, 'attendance'),
        where('class', '==', assignedClass),
        where('section', '==', assignedSection),
        where('date', '==', selectedDate)
      ));

      const attMap: Record<string, { status: AttendanceStatus; docId: string }> = {};
      attSnap.forEach(d => {
        const a = d.data();
        attMap[a.student_id] = { status: a.status, docId: d.id };
      });

      const submitted = attSnap.size > 0;
      setAlreadySubmitted(submitted);

      setAttendance(students.map(s => ({
        student: s,
        status: attMap[s.id]?.status ?? 'present',
        existingDocId: attMap[s.id]?.docId ?? null,
      })));
    } catch (e) {
      console.error('Load attendance error:', e);
    } finally {
      setLoading(false);
    }
  }

  function toggleStatus(studentId: string) {
    if (alreadySubmitted) return;
    setAttendance(prev => prev.map(a => {
      if (a.student.id !== studentId) return a;
      const cycle: AttendanceStatus[] = ['present', 'absent', 'late'];
      const idx = cycle.indexOf(a.status);
      return { ...a, status: cycle[(idx + 1) % cycle.length] };
    }));
  }

  function markAll(status: AttendanceStatus) {
    if (alreadySubmitted) return;
    setAttendance(prev => prev.map(a => ({ ...a, status })));
  }

  async function handleSubmit() {
    if (alreadySubmitted) {
      Alert.alert('Already Submitted', 'Attendance for this date has already been submitted.');
      return;
    }
    setSaving(true);
    try {
      for (const a of attendance) {
        const payload = {
          student_id: a.student.id,
          student_name: a.student.name,
          class: assignedClass,
          section: assignedSection,
          date: selectedDate,
          status: a.status,
          marked_by: teacherPhone,
          school_id: schoolId,
        };
        if (a.existingDocId) {
          await updateDoc(doc(db, 'schools', schoolId, 'attendance', a.existingDocId), payload);
        } else {
          await addDoc(collection(db, 'schools', schoolId, 'attendance'), payload);
        }
      }
      setAlreadySubmitted(true);
      Alert.alert('Success', `Attendance marked for ${attendance.length} students.`);
    } catch (e) {
      Alert.alert('Error', 'Failed to submit attendance.');
    } finally {
      setSaving(false);
    }
  }

  async function handleSendAbsenceSMS() {
    const absentStudents = attendance.filter(a => a.status === 'absent');
    if (absentStudents.length === 0) {
      Alert.alert('No Absences', 'No absent students today.');
      return;
    }
    Alert.alert(
      'Send SMS',
      `Send absence SMS to ${absentStudents.length} parents?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send',
          onPress: async () => {
            setSendingSMS(true);
            try {
              for (const a of absentStudents) {
                const msg = `MyChalkPad: Dear Parent, ${a.student.name} was absent from Class ${assignedClass}-${assignedSection} on ${selectedDate}. Please contact school if needed.`;
                await sendSMS([a.student.parent_phone], msg);
              }
              Alert.alert('Done', `Absence SMS sent to ${absentStudents.length} parents.`);
            } catch (e) {
              Alert.alert('Error', 'Failed to send SMS.');
            } finally {
              setSendingSMS(false);
            }
          },
        },
      ]
    );
  }

  const presentCount = attendance.filter(a => a.status === 'present').length;
  const absentCount = attendance.filter(a => a.status === 'absent').length;
  const lateCount = attendance.filter(a => a.status === 'late').length;
  const pct = attendance.length > 0 ? Math.round((presentCount / attendance.length) * 100) : 0;

  function renderRow({ item }: { item: StudentAttendance }) {
    return (
      <TouchableOpacity
        style={[styles.studentRow, alreadySubmitted && styles.studentRowReadOnly]}
        onPress={() => toggleStatus(item.student.id)}
        activeOpacity={alreadySubmitted ? 1 : 0.75}
      >
        <Text style={styles.rollNum}>{item.student.roll_number}</Text>
        <View style={styles.studentInfo}>
          <Text style={styles.studentName}>{item.student.name}</Text>
          {item.student.parent_phone ? (
            <Text style={styles.studentPhone}>{item.student.parent_phone}</Text>
          ) : null}
        </View>
        <View style={[styles.statusBtn, { backgroundColor: STATUS_COLORS[item.status] + '18', borderColor: STATUS_COLORS[item.status] }]}>
          <MaterialCommunityIcons name={STATUS_ICONS[item.status] as any} size={20} color={STATUS_COLORS[item.status]} />
          <Text style={[styles.statusBtnText, { color: STATUS_COLORS[item.status] }]}>
            {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
          </Text>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mark Attendance</Text>
        <Text style={styles.headerSubtitle}>
          {assignedClass ? `Class ${assignedClass}-${assignedSection}` : 'No class assigned'}
        </Text>
      </View>

      {/* Date Selector */}
      <View style={styles.dateRow}>
        <TouchableOpacity
          style={styles.dateArrow}
          onPress={() => {
            const d = new Date(selectedDate);
            d.setDate(d.getDate() - 1);
            setSelectedDate(d.toISOString().split('T')[0]);
          }}
        >
          <MaterialCommunityIcons name="chevron-left" size={24} color={COLORS.primary} />
        </TouchableOpacity>
        <View style={styles.dateCentre}>
          <Text style={styles.dateText}>{selectedDate}</Text>
          {alreadySubmitted && (
            <View style={styles.submittedBadge}>
              <MaterialCommunityIcons name="check-circle" size={12} color={COLORS.success} />
              <Text style={styles.submittedText}>Submitted</Text>
            </View>
          )}
        </View>
        <TouchableOpacity
          style={styles.dateArrow}
          onPress={() => {
            const d = new Date(selectedDate);
            d.setDate(d.getDate() + 1);
            const today = new Date().toISOString().split('T')[0];
            if (d.toISOString().split('T')[0] <= today) {
              setSelectedDate(d.toISOString().split('T')[0]);
            }
          }}
        >
          <MaterialCommunityIcons name="chevron-right" size={24} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      {/* Summary Bar */}
      <View style={styles.summaryBar}>
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryVal, { color: COLORS.success }]}>{presentCount}</Text>
          <Text style={styles.summaryLabel}>Present</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryVal, { color: COLORS.error }]}>{absentCount}</Text>
          <Text style={styles.summaryLabel}>Absent</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryVal, { color: COLORS.warning }]}>{lateCount}</Text>
          <Text style={styles.summaryLabel}>Late</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryVal, { color: COLORS.primary }]}>{pct}%</Text>
          <Text style={styles.summaryLabel}>Rate</Text>
        </View>
      </View>

      {/* Mark All Buttons */}
      {!alreadySubmitted && (
        <View style={styles.markAllRow}>
          <TouchableOpacity style={[styles.markAllBtn, { backgroundColor: COLORS.success + '18', borderColor: COLORS.success }]} onPress={() => markAll('present')}>
            <Text style={[styles.markAllText, { color: COLORS.success }]}>All Present</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.markAllBtn, { backgroundColor: COLORS.error + '18', borderColor: COLORS.error }]} onPress={() => markAll('absent')}>
            <Text style={[styles.markAllText, { color: COLORS.error }]}>All Absent</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.markAllBtn, { backgroundColor: COLORS.warning + '18', borderColor: COLORS.warning }]} onPress={() => markAll('late')}>
            <Text style={[styles.markAllText, { color: COLORS.warning }]}>All Late</Text>
          </TouchableOpacity>
        </View>
      )}

      {loading ? (
        <View style={styles.centered}><ActivityIndicator color={COLORS.primary} size="large" /></View>
      ) : attendance.length === 0 ? (
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons name="account-off" size={48} color={COLORS.textSecondary} />
          <Text style={styles.emptyText}>
            {assignedClass ? 'No students in this class' : 'No class assigned to your account'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={attendance}
          keyExtractor={item => item.student.id}
          renderItem={renderRow}
          contentContainerStyle={styles.listContent}
        />
      )}

      {/* Bottom Actions */}
      {attendance.length > 0 && (
        <View style={styles.bottomActions}>
          <TouchableOpacity
            style={[styles.smsBtn, (sendingSMS || !alreadySubmitted) && { opacity: 0.5 }]}
            onPress={handleSendAbsenceSMS}
            disabled={sendingSMS || !alreadySubmitted}
            activeOpacity={0.8}
          >
            {sendingSMS ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <MaterialCommunityIcons name="message-text" size={16} color="#FFFFFF" />
                <Text style={styles.smsBtnText}>SMS Absent</Text>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.submitBtn, (saving || alreadySubmitted) && { opacity: 0.5 }]}
            onPress={handleSubmit}
            disabled={saving || alreadySubmitted}
            activeOpacity={0.8}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <MaterialCommunityIcons name="check-all" size={18} color="#FFFFFF" />
                <Text style={styles.submitBtnText}>
                  {alreadySubmitted ? 'Submitted ✓' : 'Submit Attendance'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  header: { backgroundColor: COLORS.primary, paddingTop: 52, paddingBottom: 16, paddingHorizontal: 16 },
  headerTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: 'bold' },
  headerSubtitle: { color: 'rgba(255,255,255,0.7)', fontSize: 14, marginTop: 4 },
  dateRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  dateArrow: { padding: 4 },
  dateCentre: { flex: 1, alignItems: 'center' },
  dateText: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
  submittedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  submittedText: { fontSize: 12, color: COLORS.success, fontWeight: '600' },
  summaryBar: { flexDirection: 'row', backgroundColor: '#FFFFFF', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryVal: { fontSize: 20, fontWeight: 'bold' },
  summaryLabel: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  markAllRow: { flexDirection: 'row', gap: 8, padding: 10, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: COLORS.border },
  markAllBtn: { flex: 1, borderWidth: 1, borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
  markAllText: { fontSize: 12, fontWeight: '700' },
  listContent: { paddingBottom: 90 },
  studentRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border, gap: 10 },
  studentRowReadOnly: { opacity: 0.85 },
  rollNum: { width: 32, fontSize: 13, fontWeight: '700', color: COLORS.primary, textAlign: 'center' },
  studentInfo: { flex: 1 },
  studentName: { fontSize: 15, fontWeight: '600', color: COLORS.textPrimary },
  studentPhone: { fontSize: 12, color: COLORS.textSecondary, marginTop: 1 },
  statusBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1.5, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  statusBtnText: { fontSize: 12, fontWeight: '700' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  emptyText: { color: COLORS.textSecondary, fontSize: 15, marginTop: 12, textAlign: 'center', paddingHorizontal: 24 },
  bottomActions: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', gap: 10, padding: 12, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: COLORS.border },
  smsBtn: { flex: 1, backgroundColor: '#1E40AF', borderRadius: 8, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  smsBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  submitBtn: { flex: 2, backgroundColor: COLORS.primary, borderRadius: 8, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  submitBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
});