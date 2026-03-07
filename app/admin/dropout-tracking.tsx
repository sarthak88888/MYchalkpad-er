import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, ActivityIndicator, Modal, ScrollView,
  Alert, RefreshControl,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  collection, getDocs, addDoc, query, orderBy,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getUserSession } from '@/lib/storage';
import { COLORS } from '@/lib/theme';
import { DropoutRecord, Student } from '@/lib/types';

const REASONS = ['financial','migration','marriage','illness','distance','other'] as const;
const REASON_LABELS: Record<string, string> = {
  financial: 'Financial', migration: 'Migration', marriage: 'Marriage',
  illness: 'Illness', distance: 'Distance', other: 'Other',
};
const REASON_COLORS: Record<string, string> = {
  financial: '#EF4444', migration: '#3B82F6', marriage: '#EC4899',
  illness: '#F59E0B', distance: '#8B5CF6', other: '#64748B',
};

export default function DropoutTrackingScreen() {
  const [dropouts, setDropouts] = useState<DropoutRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [schoolId, setSchoolId] = useState('school_001');
  const [totalStudents, setTotalStudents] = useState(0);
  const [showAddModal, setShowAddModal] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [studentSearch, setStudentSearch] = useState('');
  const [form, setForm] = useState({
    dropout_date: new Date().toISOString().split('T')[0],
    reason: 'financial' as typeof REASONS[number],
    remarks: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => { initScreen(); }, []);

  async function initScreen() {
    const session = await getUserSession();
    setSchoolId(session.schoolId);
    await Promise.all([fetchDropouts(session.schoolId), fetchTotalStudents(session.schoolId), fetchStudents(session.schoolId)]);
  }

  async function fetchDropouts(sid: string) {
    try {
      const snap = await getDocs(
        query(collection(db, 'schools', sid, 'dropouts'), orderBy('dropout_date', 'desc'))
      );
      setDropouts(snap.docs.map(d => ({ id: d.id, ...d.data() } as DropoutRecord)));
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  }

  async function fetchTotalStudents(sid: string) {
    try {
      const snap = await getDocs(collection(db, 'schools', sid, 'students'));
      setTotalStudents(snap.size);
    } catch (e) { console.error(e); }
  }

  async function fetchStudents(sid: string) {
    try {
      const snap = await getDocs(collection(db, 'schools', sid, 'students'));
      setStudents(snap.docs.map(d => ({ id: d.id, ...d.data() } as Student)));
    } catch (e) { console.error(e); }
  }

  async function handleAddDropout() {
    if (!selectedStudent) {
      Alert.alert('Error', 'Please select a student.');
      return;
    }
    setSaving(true);
    try {
      await addDoc(collection(db, 'schools', schoolId, 'dropouts'), {
        student_id: selectedStudent.id,
        student_name: selectedStudent.name,
        class: selectedStudent.class,
        section: selectedStudent.section,
        dropout_date: form.dropout_date,
        reason: form.reason,
        remarks: form.remarks.trim(),
        parent_phone: selectedStudent.parent_phone,
        follow_up_done: false,
        school_id: schoolId,
      });
      setShowAddModal(false);
      setSelectedStudent(null);
      setStudentSearch('');
      setForm({ dropout_date: new Date().toISOString().split('T')[0], reason: 'financial', remarks: '' });
      await fetchDropouts(schoolId);
    } catch (e) {
      Alert.alert('Error', 'Failed to add dropout record.');
    } finally {
      setSaving(false);
    }
  }

  const dropoutRate = totalStudents > 0
    ? ((dropouts.length / (totalStudents + dropouts.length)) * 100).toFixed(1)
    : '0.0';

  function getMonthlyData() {
    const months: Record<string, number> = {};
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      months[key] = 0;
    }
    dropouts.forEach(d => {
      const month = d.dropout_date?.substring(0, 7);
      if (month && months[month] !== undefined) months[month]++;
    });
    return Object.entries(months).map(([month, count]) => ({
      label: new Date(month + '-01').toLocaleString('default', { month: 'short' }),
      count,
    }));
  }

  function getReasonBreakdown() {
    const counts: Record<string, number> = {};
    REASONS.forEach(r => { counts[r] = 0; });
    dropouts.forEach(d => { if (d.reason in counts) counts[d.reason]++; });
    return counts;
  }

  const monthlyData = getMonthlyData();
  const maxMonthly = Math.max(...monthlyData.map(m => m.count), 1);
  const reasonBreakdown = getReasonBreakdown();

  const filteredStudents = students.filter(s =>
    s.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
    s.roll_number?.toString().includes(studentSearch)
  ).slice(0, 6);

  const onRefresh = useCallback(() => { setRefreshing(true); fetchDropouts(schoolId); }, [schoolId]);

  function renderDropoutCard({ item }: { item: DropoutRecord }) {
    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <View style={styles.cardLeft}>
            <Text style={styles.cardName}>{item.student_name}</Text>
            <Text style={styles.cardMeta}>Class {item.class}-{item.section} • {item.parent_phone}</Text>
            <Text style={styles.cardDate}>Date: {item.dropout_date}</Text>
            {item.remarks ? <Text style={styles.cardRemarks} numberOfLines={1}>{item.remarks}</Text> : null}
          </View>
          <View style={[styles.reasonBadge, { backgroundColor: REASON_COLORS[item.reason] + '18' }]}>
            <Text style={[styles.reasonText, { color: REASON_COLORS[item.reason] }]}>
              {REASON_LABELS[item.reason]}
            </Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Dropout Tracking</Text>
      </View>

      <FlatList
        data={dropouts}
        keyExtractor={item => item.id}
        renderItem={renderDropoutCard}
        contentContainerStyle={{ paddingBottom: 80 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
        ListHeaderComponent={
          <View>
            {/* Dropout Rate */}
            <View style={styles.rateCard}>
              <View style={styles.rateLeft}>
                <Text style={styles.rateLabel}>Dropout Rate</Text>
                <Text style={styles.rateValue}>{dropoutRate}%</Text>
                <Text style={styles.rateSubtext}>{dropouts.length} dropouts recorded</Text>
              </View>
              <View style={styles.rateCircle}>
                <Text style={styles.rateCircleText}>{dropoutRate}%</Text>
              </View>
            </View>

            {/* 6-Month Bar Chart */}
            <View style={styles.chartCard}>
              <Text style={styles.chartTitle}>Dropouts — Last 6 Months</Text>
              <View style={styles.barChart}>
                {monthlyData.map((item, i) => (
                  <View key={i} style={styles.barColumn}>
                    <Text style={styles.barValue}>{item.count > 0 ? item.count : ''}</Text>
                    <View style={styles.barWrapper}>
                      <View style={[
                        styles.bar,
                        {
                          height: item.count === 0 ? 4 : Math.max(8, (item.count / maxMonthly) * 80),
                          backgroundColor: item.count === 0 ? COLORS.border : COLORS.error,
                        }
                      ]} />
                    </View>
                    <Text style={styles.barLabel}>{item.label}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Reason Breakdown */}
            <View style={styles.reasonCard}>
              <Text style={styles.reasonCardTitle}>Reason Breakdown</Text>
              <View style={styles.reasonBadges}>
                {REASONS.map(r => (
                  <View key={r} style={[styles.reasonBadgeItem, { backgroundColor: REASON_COLORS[r] + '18' }]}>
                    <Text style={[styles.reasonBadgeCount, { color: REASON_COLORS[r] }]}>{reasonBreakdown[r]}</Text>
                    <Text style={[styles.reasonBadgeLabel, { color: REASON_COLORS[r] }]}>{REASON_LABELS[r]}</Text>
                  </View>
                ))}
              </View>
            </View>

            {loading ? (
              <View style={styles.centered}><ActivityIndicator color={COLORS.primary} size="large" /></View>
            ) : (
              <Text style={styles.listHeader}>DROPOUT RECORDS ({dropouts.length})</Text>
            )}
          </View>
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="account-check" size={48} color={COLORS.success} />
              <Text style={styles.emptyText}>No dropout records</Text>
            </View>
          ) : null
        }
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => setShowAddModal(true)}
        activeOpacity={0.85}
      >
        <MaterialCommunityIcons name="plus" size={28} color="#FFFFFF" />
      </TouchableOpacity>

      {/* Add Dropout Modal */}
      <Modal visible={showAddModal} animationType="slide" onRequestClose={() => setShowAddModal(false)}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalHeaderTitle}>Add Dropout Record</Text>
          <TouchableOpacity onPress={() => setShowAddModal(false)}>
            <MaterialCommunityIcons name="close" size={26} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
        <ScrollView style={{ flex: 1, backgroundColor: COLORS.background }} contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
          <Text style={styles.fieldLabel}>Search Student</Text>
          <TextInput
            style={styles.input}
            placeholder="Type student name or roll..."
            placeholderTextColor={COLORS.textSecondary}
            value={studentSearch}
            onChangeText={setStudentSearch}
          />
          {studentSearch.length > 0 && filteredStudents.length > 0 && !selectedStudent && (
            <View style={styles.studentDropdown}>
              {filteredStudents.map(s => (
                <TouchableOpacity
                  key={s.id}
                  style={styles.studentDropdownItem}
                  onPress={() => { setSelectedStudent(s); setStudentSearch(s.name); }}
                >
                  <Text style={styles.studentDropdownName}>{s.name}</Text>
                  <Text style={styles.studentDropdownMeta}>Class {s.class}-{s.section} • Roll {s.roll_number}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          {selectedStudent && (
            <View style={styles.selectedStudentCard}>
              <MaterialCommunityIcons name="account-check" size={20} color={COLORS.success} />
              <Text style={styles.selectedStudentText}>{selectedStudent.name} — Class {selectedStudent.class}-{selectedStudent.section}</Text>
              <TouchableOpacity onPress={() => { setSelectedStudent(null); setStudentSearch(''); }}>
                <MaterialCommunityIcons name="close-circle" size={18} color={COLORS.error} />
              </TouchableOpacity>
            </View>
          )}

          <Text style={styles.fieldLabel}>Dropout Date</Text>
          <TextInput
            style={styles.input}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={COLORS.textSecondary}
            value={form.dropout_date}
            onChangeText={v => setForm({ ...form, dropout_date: v })}
          />

          <Text style={styles.fieldLabel}>Reason</Text>
          <View style={styles.reasonGrid}>
            {REASONS.map(r => (
              <TouchableOpacity
                key={r}
                style={[styles.reasonSelectChip, form.reason === r && { backgroundColor: REASON_COLORS[r], borderColor: REASON_COLORS[r] }]}
                onPress={() => setForm({ ...form, reason: r })}
              >
                <Text style={[styles.reasonSelectText, form.reason === r && { color: '#FFFFFF', fontWeight: '600' }]}>
                  {REASON_LABELS[r]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.fieldLabel}>Remarks</Text>
          <TextInput
            style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
            placeholder="Additional notes (optional)"
            placeholderTextColor={COLORS.textSecondary}
            multiline
            value={form.remarks}
            onChangeText={v => setForm({ ...form, remarks: v })}
          />

          <TouchableOpacity
            style={[styles.saveButton, saving && { opacity: 0.6 }]}
            onPress={handleAddDropout}
            disabled={saving}
            activeOpacity={0.8}
          >
            {saving ? <ActivityIndicator color="#FFFFFF" size="small" /> : (
              <Text style={styles.saveButtonText}>Add Dropout Record</Text>
            )}
          </TouchableOpacity>
          <View style={{ height: 40 }} />
        </ScrollView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  header: { backgroundColor: COLORS.primary, paddingTop: 52, paddingBottom: 16, paddingHorizontal: 16 },
  headerTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: 'bold' },
  rateCard: { backgroundColor: COLORS.primary, margin: 16, borderRadius: 16, padding: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rateLeft: {},
  rateLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '600' },
  rateValue: { color: COLORS.accent, fontSize: 40, fontWeight: 'bold', marginTop: 4 },
  rateSubtext: { color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 4 },
  rateCircle: { width: 80, height: 80, borderRadius: 40, borderWidth: 4, borderColor: COLORS.accent, justifyContent: 'center', alignItems: 'center' },
  rateCircleText: { color: COLORS.accent, fontSize: 16, fontWeight: 'bold' },
  chartCard: { backgroundColor: '#FFFFFF', marginHorizontal: 16, marginBottom: 12, borderRadius: 12, padding: 16, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3 },
  chartTitle: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 16 },
  barChart: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around', height: 110 },
  barColumn: { flex: 1, alignItems: 'center' },
  barValue: { fontSize: 11, fontWeight: '600', color: COLORS.error, marginBottom: 4, height: 16 },
  barWrapper: { width: '60%', height: 80, justifyContent: 'flex-end' },
  bar: { width: '100%', borderRadius: 4 },
  barLabel: { fontSize: 10, color: COLORS.textSecondary, marginTop: 4 },
  reasonCard: { backgroundColor: '#FFFFFF', marginHorizontal: 16, marginBottom: 12, borderRadius: 12, padding: 16, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3 },
  reasonCardTitle: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 12 },
  reasonBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  reasonBadgeItem: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center', minWidth: 70 },
  reasonBadgeCount: { fontSize: 18, fontWeight: 'bold' },
  reasonBadgeLabel: { fontSize: 10, fontWeight: '600', marginTop: 2 },
  listHeader: { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary, letterSpacing: 1, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8, textTransform: 'uppercase' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14, marginHorizontal: 16, marginBottom: 10, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardLeft: { flex: 1 },
  cardName: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  cardMeta: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  cardDate: { fontSize: 11, color: COLORS.textSecondary, marginTop: 1 },
  cardRemarks: { fontSize: 12, color: COLORS.textSecondary, marginTop: 4, fontStyle: 'italic' },
  reasonBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  reasonText: { fontSize: 11, fontWeight: '700' },
  centered: { padding: 40, alignItems: 'center' },
  emptyContainer: { alignItems: 'center', paddingTop: 40 },
  emptyText: { color: COLORS.textSecondary, fontSize: 15, marginTop: 12 },
  fab: { position: 'absolute', bottom: 24, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: COLORS.accent, justifyContent: 'center', alignItems: 'center', elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 6 },
  modalHeader: { backgroundColor: COLORS.primary, paddingTop: 52, paddingBottom: 16, paddingHorizontal: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalHeaderTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 6, marginTop: 14, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: COLORS.textPrimary },
  studentDropdown: { backgroundColor: '#FFFFFF', borderRadius: 8, borderWidth: 1, borderColor: COLORS.border, marginTop: 4 },
  studentDropdownItem: { paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  studentDropdownName: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary },
  studentDropdownMeta: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  selectedStudentCard: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.success + '10', borderRadius: 8, padding: 12, marginTop: 8 },
  selectedStudentText: { flex: 1, fontSize: 14, color: COLORS.textPrimary, fontWeight: '500' },
  reasonGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  reasonSelectChip: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#FFFFFF' },
  reasonSelectText: { fontSize: 13, color: COLORS.textSecondary },
  saveButton: { backgroundColor: COLORS.primary, borderRadius: 8, paddingVertical: 14, alignItems: 'center', marginTop: 24 },
  saveButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
});