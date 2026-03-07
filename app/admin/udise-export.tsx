import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getUserSession } from '@/lib/storage';
import { COLORS } from '@/lib/theme';
import Papa from 'papaparse';

interface ExportCategory {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  lastExported?: string;
}

const CATEGORIES: ExportCategory[] = [
  { id: 'students', title: 'Student Enrollment', description: 'Class-wise student count with demographics', icon: 'account-school', color: '#3B82F6' },
  { id: 'staff', title: 'Teacher & Staff Data', description: 'Staff details, qualifications, subjects', icon: 'badge-account', color: '#8B5CF6' },
  { id: 'infrastructure', title: 'Infrastructure', description: 'Classrooms, toilets, facilities', icon: 'office-building', color: '#10B981' },
  { id: 'attendance', title: 'Attendance Summary', description: 'Monthly attendance averages', icon: 'clipboard-check', color: '#F59E0B' },
  { id: 'results', title: 'Exam Results', description: 'Pass/fail, grade distribution', icon: 'file-certificate', color: '#EF4444' },
];

export default function UDISEExportScreen() {
  const [schoolId, setSchoolId] = useState('school_001');
  const [udiseCode, setUdiseCode] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [loading, setLoading] = useState(true);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [lastExports, setLastExports] = useState<Record<string, string>>({});

  useEffect(() => { initScreen(); }, []);

  async function initScreen() {
    const session = await getUserSession();
    setSchoolId(session.schoolId);
    await fetchSchoolData(session.schoolId);
  }

  async function fetchSchoolData(sid: string) {
    try {
      const snap = await getDoc(doc(db, 'schools', sid));
      if (snap.exists()) {
        setUdiseCode(snap.data().udise_code ?? 'Not Set');
        setSchoolName(snap.data().name ?? 'My School');
      }
    } catch (e) {
      console.error('Fetch school error:', e);
    } finally {
      setLoading(false);
    }
  }

  async function handleExport(category: ExportCategory) {
    setExportingId(category.id);
    try {
      let rows: any[] = [];
      let filename = '';

      if (category.id === 'students') {
        const snap = await getDocs(collection(db, 'schools', schoolId, 'students'));
        rows = snap.docs.map(d => {
          const s = d.data();
          return { Name: s.name, Class: s.class, Section: s.section, Roll: s.roll_number, Parent: s.parent_name, Phone: s.parent_phone, DOB: s.dob, Address: s.address };
        });
        filename = `UDISE_Students_${udiseCode}_${new Date().toISOString().split('T')[0]}.csv`;
      } else if (category.id === 'staff') {
        const snap = await getDocs(collection(db, 'schools', schoolId, 'staff'));
        rows = snap.docs.map(d => {
          const s = d.data();
          return { Name: s.name, Role: s.role, Subject: s.subject, Phone: s.phone, Salary: s.salary, JoiningDate: s.joining_date };
        });
        filename = `UDISE_Staff_${udiseCode}_${new Date().toISOString().split('T')[0]}.csv`;
      } else if (category.id === 'attendance') {
        const snap = await getDocs(collection(db, 'schools', schoolId, 'attendance'));
        const byDate: Record<string, { present: number; absent: number; late: number }> = {};
        snap.forEach(d => {
          const a = d.data();
          if (!byDate[a.date]) byDate[a.date] = { present: 0, absent: 0, late: 0 };
          if (a.status === 'present') byDate[a.date].present++;
          else if (a.status === 'absent') byDate[a.date].absent++;
          else if (a.status === 'late') byDate[a.date].late++;
        });
        rows = Object.entries(byDate).map(([date, data]) => ({
          Date: date, Present: data.present, Absent: data.absent, Late: data.late,
          Total: data.present + data.absent + data.late,
          Percentage: Math.round((data.present / (data.present + data.absent + data.late)) * 100) + '%',
        }));
        filename = `UDISE_Attendance_${udiseCode}_${new Date().toISOString().split('T')[0]}.csv`;
      } else if (category.id === 'results') {
        const snap = await getDocs(collection(db, 'schools', schoolId, 'marks'));
        rows = snap.docs.map(d => {
          const m = d.data();
          return { Student: m.student_name, Class: m.class, Section: m.section, Subject: m.subject, ExamType: m.exam_type, Marks: m.marks, MaxMarks: m.max_marks, Grade: m.grade };
        });
        filename = `UDISE_Results_${udiseCode}_${new Date().toISOString().split('T')[0]}.csv`;
      } else {
        rows = [{ Note: 'Infrastructure data — please fill manually in UDISE portal', UDISE_Code: udiseCode, School: schoolName }];
        filename = `UDISE_Infrastructure_${udiseCode}_${new Date().toISOString().split('T')[0]}.csv`;
      }

      if (rows.length === 0) {
        Alert.alert('No Data', `No ${category.title} data found to export.`);
        return;
      }

      const csv = Papa.unparse(rows);
      const now = new Date().toISOString().split('T')[0];
      setLastExports(prev => ({ ...prev, [category.id]: now }));
      Alert.alert(
        'Export Ready',
        `${category.title} export prepared with ${rows.length} records.\n\nFilename: ${filename}\n\nIn production, this CSV would be saved to your device downloads folder.`,
        [{ text: 'OK' }]
      );
    } catch (e) {
      Alert.alert('Export Failed', 'Failed to generate CSV. Please try again.');
    } finally {
      setExportingId(null);
    }
  }

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator color={COLORS.primary} size="large" /></View>;
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>UDISE Export</Text>
        <Text style={styles.headerSubtitle}>Government compliance data export</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* UDISE Code Card */}
        <View style={styles.udiseCard}>
          <View style={styles.udiseLeft}>
            <Text style={styles.udiseTitleLabel}>UDISE CODE</Text>
            <Text style={styles.udiseCode}>{udiseCode}</Text>
            <Text style={styles.udiseSchool}>{schoolName}</Text>
          </View>
          <MaterialCommunityIcons name="shield-check" size={40} color={COLORS.accent} />
        </View>

        <Text style={styles.sectionLabel}>SELECT DATA TO EXPORT</Text>

        {CATEGORIES.map(cat => (
          <View key={cat.id} style={styles.exportCard}>
            <View style={styles.exportCardLeft}>
              <View style={[styles.iconBox, { backgroundColor: cat.color + '18' }]}>
                <MaterialCommunityIcons name={cat.icon as any} size={28} color={cat.color} />
              </View>
              <View style={styles.exportInfo}>
                <Text style={styles.exportTitle}>{cat.title}</Text>
                <Text style={styles.exportDesc}>{cat.description}</Text>
                {lastExports[cat.id] ? (
                  <Text style={styles.lastExport}>Last exported: {lastExports[cat.id]}</Text>
                ) : null}
              </View>
            </View>
            <TouchableOpacity
              style={[styles.exportBtn, { backgroundColor: cat.color }, exportingId === cat.id && { opacity: 0.6 }]}
              onPress={() => handleExport(cat)}
              disabled={exportingId === cat.id}
              activeOpacity={0.8}
            >
              {exportingId === cat.id ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <MaterialCommunityIcons name="download" size={20} color="#FFFFFF" />
              )}
            </TouchableOpacity>
          </View>
        ))}

        {/* Instructions */}
        <View style={styles.instructionCard}>
          <MaterialCommunityIcons name="information" size={20} color={COLORS.primary} />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.instructionTitle}>How to use UDISE exports</Text>
            <Text style={styles.instructionText}>
              1. Export each category as CSV{'\n'}
              2. Log in to udiseplus.gov.in{'\n'}
              3. Upload the CSV files in the respective sections{'\n'}
              4. Verify and submit before the deadline
            </Text>
          </View>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  header: { backgroundColor: COLORS.primary, paddingTop: 52, paddingBottom: 20, paddingHorizontal: 16 },
  headerTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: 'bold' },
  headerSubtitle: { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 4 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: 16 },
  udiseCard: { backgroundColor: COLORS.primary, borderRadius: 16, padding: 20, marginBottom: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  udiseLeft: {},
  udiseTitleLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  udiseCode: { color: COLORS.accent, fontSize: 28, fontWeight: 'bold', marginTop: 4, letterSpacing: 2 },
  udiseSchool: { color: 'rgba(255,255,255,0.8)', fontSize: 14, marginTop: 4 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary, letterSpacing: 1, marginBottom: 12, textTransform: 'uppercase' },
  exportCard: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'center', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3 },
  exportCardLeft: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  iconBox: { width: 52, height: 52, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  exportInfo: { flex: 1 },
  exportTitle: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  exportDesc: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  lastExport: { fontSize: 11, color: COLORS.success, marginTop: 3 },
  exportBtn: { width: 44, height: 44, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginLeft: 10 },
  instructionCard: { backgroundColor: '#EFF6FF', borderRadius: 12, padding: 16, flexDirection: 'row', marginTop: 8 },
  instructionTitle: { fontSize: 14, fontWeight: '700', color: COLORS.primary, marginBottom: 6 },
  instructionText: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 20 },
});