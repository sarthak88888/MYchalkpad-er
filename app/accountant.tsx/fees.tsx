import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, ActivityIndicator, Modal, ScrollView,
  Alert, RefreshControl,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  collection, getDocs, addDoc, updateDoc, doc, query, orderBy,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getUserSession } from '@/lib/storage';
import { COLORS } from '@/lib/theme';
import { FeeRecord, Student } from '@/lib/types';

const STATUS_COLORS: Record<string, string> = {
  paid: COLORS.success, due: COLORS.warning, overdue: COLORS.error,
};
const FEE_TYPES = ['Tuition Fee', 'Transport Fee', 'Library Fee', 'Lab Fee', 'Sports Fee', 'Exam Fee', 'Annual Fee', 'Other'];

export default function AccountantFeesScreen() {
  const [schoolId, setSchoolId] = useState('school_001');
  const [fees, setFees] = useState<FeeRecord[]>([]);
  const [filtered, setFiltered] = useState<FeeRecord[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'due' | 'overdue' | 'paid'>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedFee, setSelectedFee] = useState<FeeRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [form, setForm] = useState({
    fee_type: 'Tuition Fee',
    amount: '',
    due_date: '',
    remarks: '',
  });

  useEffect(() => { initScreen(); }, []);
  useEffect(() => { applyFilter(); }, [fees, activeTab, searchText]);

  async function initScreen() {
    const session = await getUserSession();
    setSchoolId(session.schoolId);
    await Promise.all([loadFees(session.schoolId), loadStudents(session.schoolId)]);
  }

  async function loadFees(sid: string) {
    try {
      const snap = await getDocs(query(collection(db, 'schools', sid, 'fees'), orderBy('due_date', 'desc')));
      setFees(snap.docs.map(d => ({ id: d.id, ...d.data() } as FeeRecord)));
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  }

  async function loadStudents(sid: string) {
    try {
      const snap = await getDocs(collection(db, 'schools', sid, 'students'));
      setStudents(snap.docs.map(d => ({ id: d.id, ...d.data() } as Student)));
    } catch (e) { console.error(e); }
  }

  function applyFilter() {
    let result = fees;
    if (activeTab !== 'all') result = result.filter(f => f.status === activeTab);
    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      result = result.filter(f =>
        f.student_name?.toLowerCase().includes(q) ||
        f.fee_type?.toLowerCase().includes(q)
      );
    }
    setFiltered(result);
  }

  async function handleAddFee() {
    if (!selectedStudent) { Alert.alert('Error', 'Please select a student.'); return; }
    if (!form.amount || isNaN(Number(form.amount))) { Alert.alert('Error', 'Enter valid amount.'); return; }
    if (!form.due_date.trim()) { Alert.alert('Error', 'Enter due date.'); return; }
    setSaving(true);
    try {
      await addDoc(collection(db, 'schools', schoolId, 'fees'), {
        student_id: selectedStudent.id,
        student_name: selectedStudent.name,
        class: selectedStudent.class,
        section: selectedStudent.section,
        fee_type: form.fee_type,
        amount: Number(form.amount),
        due_date: form.due_date.trim(),
        status: 'due',
        remarks: form.remarks.trim(),
        school_id: schoolId,
      });
      setShowAddModal(false);
      setSelectedStudent(null);
      setStudentSearch('');
      setForm({ fee_type: 'Tuition Fee', amount: '', due_date: '', remarks: '' });
      await loadFees(schoolId);
    } catch (e) {
      Alert.alert('Error', 'Failed to add fee record.');
    } finally {
      setSaving(false);
    }
  }

  async function handleMarkPaid(fee: FeeRecord) {
    Alert.alert(
      'Mark as Paid',
      `Mark ₹${fee.amount} as paid (Cash)?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark Paid',
          onPress: async () => {
            try {
              await updateDoc(doc(db, 'schools', schoolId, 'fees', fee.id), {
                status: 'paid',
                amount_paid: fee.amount,
                paid_date: new Date().toISOString().split('T')[0],
                payment_method: 'cash',
              });
              setShowDetailModal(false);
              await loadFees(schoolId);
            } catch (e) { Alert.alert('Error', 'Failed to update.'); }
          },
        },
      ]
    );
  }

  async function handleMarkOverdue(fee: FeeRecord) {
    try {
      await updateDoc(doc(db, 'schools', schoolId, 'fees', fee.id), { status: 'overdue' });
      setShowDetailModal(false);
      await loadFees(schoolId);
    } catch (e) { Alert.alert('Error', 'Failed to update.'); }
  }

  const onRefresh = useCallback(() => { setRefreshing(true); loadFees(schoolId); }, [schoolId]);

  const filteredStudents = students.filter(s =>
    s.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
    s.roll_number?.toString().includes(studentSearch)
  ).slice(0, 6);

  function renderFeeCard({ item }: { item: FeeRecord }) {
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => { setSelectedFee(item); setShowDetailModal(true); }}
        activeOpacity={0.8}
      >
        <View style={styles.cardTop}>
          <View style={styles.cardLeft}>
            <Text style={styles.cardName}>{item.student_name}</Text>
            <Text style={styles.cardMeta}>Class {item.class}-{item.section} • {item.fee_type}</Text>
            <Text style={styles.cardDate}>Due: {item.due_date}</Text>
          </View>
          <View style={styles.cardRight}>
            <Text style={[styles.cardAmount, { color: item.status === 'paid' ? COLORS.success : COLORS.error }]}>
              ₹{item.amount}
            </Text>
            <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[item.status] + '18' }]}>
              <Text style={[styles.statusText, { color: STATUS_COLORS[item.status] }]}>
                {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  const total = { all: fees.length, due: fees.filter(f => f.status === 'due').length, overdue: fees.filter(f => f.status === 'overdue').length, paid: fees.filter(f => f.status === 'paid').length };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Fee Management</Text>
        <Text style={styles.headerSub}>{fees.length} records</Text>
      </View>

      {/* Search */}
      <View style={styles.searchRow}>
        <MaterialCommunityIcons name="magnify" size={20} color={COLORS.textSecondary} style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search student or fee type..."
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

      {/* Tabs */}
      <View style={styles.tabs}>
        {(['all', 'due', 'overdue', 'paid'] as const).map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.tabBtn, activeTab === tab && styles.tabBtnActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
            <View style={[styles.tabCount, activeTab === tab && styles.tabCountActive]}>
              <Text style={[styles.tabCountText, activeTab === tab && styles.tabCountTextActive]}>
                {total[tab]}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.centered}><ActivityIndicator color={COLORS.primary} size="large" /></View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          renderItem={renderFeeCard}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="cash-off" size={48} color={COLORS.textSecondary} />
              <Text style={styles.emptyText}>No fee records found</Text>
            </View>
          }
        />
      )}

      <TouchableOpacity style={styles.fab} onPress={() => setShowAddModal(true)} activeOpacity={0.85}>
        <MaterialCommunityIcons name="plus" size={28} color="#FFFFFF" />
      </TouchableOpacity>

      {/* Add Fee Modal */}
      <Modal visible={showAddModal} animationType="slide" onRequestClose={() => setShowAddModal(false)}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalHeaderTitle}>Add Fee Record</Text>
          <TouchableOpacity onPress={() => setShowAddModal(false)}>
            <MaterialCommunityIcons name="close" size={26} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
        <ScrollView style={{ flex: 1, backgroundColor: COLORS.background }} contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
          <Text style={styles.fieldLabel}>Select Student</Text>
          <TextInput
            style={styles.input}
            placeholder="Search student..."
            placeholderTextColor={COLORS.textSecondary}
            value={studentSearch}
            onChangeText={v => { setStudentSearch(v); setSelectedStudent(null); }}
          />
          {studentSearch.length > 0 && !selectedStudent && filteredStudents.length > 0 && (
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
            <View style={styles.selectedStudentBadge}>
              <MaterialCommunityIcons name="account-check" size={16} color={COLORS.success} />
              <Text style={styles.selectedStudentText}>{selectedStudent.name} — Class {selectedStudent.class}-{selectedStudent.section}</Text>
            </View>
          )}

          <Text style={styles.fieldLabel}>Fee Type</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.feeTypeRow}>
              {FEE_TYPES.map(ft => (
                <TouchableOpacity
                  key={ft}
                  style={[styles.feeTypeChip, form.fee_type === ft && styles.feeTypeChipActive]}
                  onPress={() => setForm({ ...form, fee_type: ft })}
                >
                  <Text style={[styles.feeTypeText, form.fee_type === ft && styles.feeTypeTextActive]}>{ft}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          <Text style={styles.fieldLabel}>Amount (₹) *</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter amount"
            placeholderTextColor={COLORS.textSecondary}
            keyboardType="numeric"
            value={form.amount}
            onChangeText={v => setForm({ ...form, amount: v })}
          />

          <Text style={styles.fieldLabel}>Due Date *</Text>
          <TextInput
            style={styles.input}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={COLORS.textSecondary}
            value={form.due_date}
            onChangeText={v => setForm({ ...form, due_date: v })}
          />

          <Text style={styles.fieldLabel}>Remarks</Text>
          <TextInput
            style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
            placeholder="Optional remarks..."
            placeholderTextColor={COLORS.textSecondary}
            multiline
            value={form.remarks}
            onChangeText={v => setForm({ ...form, remarks: v })}
          />

          <TouchableOpacity
            style={[styles.saveBtn, saving && { opacity: 0.6 }]}
            onPress={handleAddFee}
            disabled={saving}
            activeOpacity={0.8}
          >
            {saving ? <ActivityIndicator color="#FFFFFF" size="small" /> : (
              <Text style={styles.saveBtnText}>Add Fee Record</Text>
            )}
          </TouchableOpacity>
          <View style={{ height: 40 }} />
        </ScrollView>
      </Modal>

      {/* Detail Modal */}
      <Modal visible={showDetailModal} animationType="slide" onRequestClose={() => setShowDetailModal(false)}>
        {selectedFee && (
          <View style={{ flex: 1, backgroundColor: COLORS.background }}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalHeaderTitle}>Fee Details</Text>
              <TouchableOpacity onPress={() => setShowDetailModal(false)}>
                <MaterialCommunityIcons name="close" size={26} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ padding: 16 }}>
              <View style={[styles.detailStatusCard, { backgroundColor: STATUS_COLORS[selectedFee.status] + '10' }]}>
                <Text style={[styles.detailStatusText, { color: STATUS_COLORS[selectedFee.status] }]}>
                  {selectedFee.status.toUpperCase()}
                </Text>
                <Text style={[styles.detailAmount, { color: STATUS_COLORS[selectedFee.status] }]}>
                  ₹{selectedFee.amount}
                </Text>
              </View>
              {[
                { label: 'Student', value: selectedFee.student_name },
                { label: 'Class', value: `${selectedFee.class}-${selectedFee.section}` },
                { label: 'Fee Type', value: selectedFee.fee_type },
                { label: 'Due Date', value: selectedFee.due_date },
                ...(selectedFee.paid_date ? [{ label: 'Paid Date', value: selectedFee.paid_date }] : []),
                ...(selectedFee.payment_method ? [{ label: 'Payment Method', value: selectedFee.payment_method }] : []),
                ...(selectedFee.transaction_id ? [{ label: 'Transaction ID', value: selectedFee.transaction_id }] : []),
                ...(selectedFee.remarks ? [{ label: 'Remarks', value: selectedFee.remarks }] : []),
              ].map((row, i) => (
                <View key={i} style={styles.detailRow}>
                  <Text style={styles.detailLabel}>{row.label}</Text>
                  <Text style={styles.detailValue}>{row.value}</Text>
                </View>
              ))}
              {selectedFee.status !== 'paid' && (
                <>
                  <TouchableOpacity style={styles.markPaidBtn} onPress={() => handleMarkPaid(selectedFee)} activeOpacity={0.8}>
                    <MaterialCommunityIcons name="cash-check" size={18} color="#FFFFFF" />
                    <Text style={styles.markPaidBtnText}>Mark as Paid (Cash)</Text>
                  </TouchableOpacity>
                  {selectedFee.status !== 'overdue' && (
                    <TouchableOpacity style={styles.markOverdueBtn} onPress={() => handleMarkOverdue(selectedFee)} activeOpacity={0.8}>
                      <Text style={styles.markOverdueBtnText}>Mark as Overdue</Text>
                    </TouchableOpacity>
                  )}
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
  tabs: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: COLORS.border },
  tabBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 4 },
  tabBtnActive: { borderBottomWidth: 2, borderBottomColor: COLORS.primary },
  tabText: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary },
  tabTextActive: { color: COLORS.primary },
  tabCount: { backgroundColor: COLORS.border, borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1 },
  tabCountActive: { backgroundColor: COLORS.primary },
  tabCountText: { fontSize: 10, fontWeight: '700', color: COLORS.textSecondary },
  tabCountTextActive: { color: '#FFFFFF' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  listContent: { padding: 16, paddingBottom: 80 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14, marginBottom: 10, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardLeft: { flex: 1 },
  cardName: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  cardMeta: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  cardDate: { fontSize: 11, color: COLORS.textSecondary, marginTop: 1 },
  cardRight: { alignItems: 'flex-end', gap: 4 },
  cardAmount: { fontSize: 20, fontWeight: 'bold' },
  statusBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontSize: 11, fontWeight: '700' },
  emptyContainer: { alignItems: 'center', paddingTop: 60 },
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
  selectedStudentBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.success + '10', borderRadius: 8, padding: 10, marginTop: 6 },
  selectedStudentText: { fontSize: 14, color: COLORS.textPrimary, fontWeight: '500' },
  feeTypeRow: { flexDirection: 'row', gap: 8, paddingVertical: 4 },
  feeTypeChip: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#FFFFFF' },
  feeTypeChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  feeTypeText: { fontSize: 13, color: COLORS.textSecondary },
  feeTypeTextActive: { color: '#FFFFFF', fontWeight: '600' },
  saveBtn: { backgroundColor: COLORS.primary, borderRadius: 8, paddingVertical: 14, alignItems: 'center', marginTop: 24 },
  saveBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
  detailStatusCard: { borderRadius: 12, padding: 20, alignItems: 'center', marginBottom: 16 },
  detailStatusText: { fontSize: 13, fontWeight: '700', letterSpacing: 1 },
  detailAmount: { fontSize: 44, fontWeight: 'bold', marginTop: 4 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border, backgroundColor: '#FFFFFF', paddingHorizontal: 16 },
  detailLabel: { fontSize: 13, color: COLORS.textSecondary },
  detailValue: { fontSize: 13, fontWeight: '600', color: COLORS.textPrimary, flex: 1, textAlign: 'right' },
  markPaidBtn: { backgroundColor: COLORS.success, borderRadius: 8, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 20 },
  markPaidBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: 'bold' },
  markOverdueBtn: { borderWidth: 1, borderColor: COLORS.error, borderRadius: 8, paddingVertical: 12, alignItems: 'center', marginTop: 10 },
  markOverdueBtnText: { color: COLORS.error, fontSize: 14, fontWeight: '600' },
});