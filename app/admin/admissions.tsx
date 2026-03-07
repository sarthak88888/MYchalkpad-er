import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Modal,
  ScrollView,
  Alert,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  query,
  orderBy,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getUserSession } from '@/lib/storage';
import { COLORS } from '@/lib/theme';
import { Admission } from '@/lib/types';

type FilterTab = 'all' | 'pending' | 'approved' | 'rejected';

const CLASS_OPTIONS = ['1','2','3','4','5','6','7','8','9','10','11','12'];
const SECTION_OPTIONS = ['A','B','C','D'];

const EMPTY_FORM = {
  student_name: '',
  dob: '',
  class_applying: '',
  parent_name: '',
  parent_phone: '',
  address: '',
  previous_school: '',
};

export default function AdmissionsScreen() {
  const [admissions, setAdmissions] = useState<Admission[]>([]);
  const [filtered, setFiltered] = useState<Admission[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [schoolId, setSchoolId] = useState('school_001');
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [selectedAdmission, setSelectedAdmission] = useState<Admission | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [approveClass, setApproveClass] = useState('');
  const [approveSection, setApproveSection] = useState('');
  const [approveRoll, setApproveRoll] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { initScreen(); }, []);
  useEffect(() => { applyFilter(); }, [admissions, activeTab]);

  async function initScreen() {
    const session = await getUserSession();
    setSchoolId(session.schoolId);
    await fetchAdmissions(session.schoolId);
  }

  async function fetchAdmissions(sid: string) {
    try {
      const snap = await getDocs(
        query(collection(db, 'schools', sid, 'admissions'), orderBy('applied_date', 'desc'))
      );
      setAdmissions(snap.docs.map(d => ({ id: d.id, ...d.data() } as Admission)));
    } catch (e) {
      console.error('Fetch admissions error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function applyFilter() {
    if (activeTab === 'all') {
      setFiltered(admissions);
    } else {
      setFiltered(admissions.filter(a => a.status === activeTab));
    }
  }

  function validateForm(): boolean {
    const errors: Record<string, string> = {};
    if (!form.student_name.trim()) errors.student_name = 'Name is required';
    if (!form.class_applying) errors.class_applying = 'Class is required';
    if (!form.parent_phone || form.parent_phone.length !== 10)
      errors.parent_phone = 'Valid 10-digit phone required';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleAddAdmission() {
    if (!validateForm()) return;
    setSaving(true);
    try {
      await addDoc(collection(db, 'schools', schoolId, 'admissions'), {
        student_name: form.student_name.trim(),
        dob: form.dob.trim(),
        class_applying: form.class_applying,
        parent_name: form.parent_name.trim(),
        parent_phone: form.parent_phone.trim(),
        address: form.address.trim(),
        previous_school: form.previous_school.trim(),
        status: 'pending',
        applied_date: new Date().toISOString().split('T')[0],
        school_id: schoolId,
      });
      setShowAddModal(false);
      setForm(EMPTY_FORM);
      await fetchAdmissions(schoolId);
    } catch (e) {
      Alert.alert('Error', 'Failed to add admission.');
    } finally {
      setSaving(false);
    }
  }

  async function handleApprove() {
    if (!selectedAdmission) return;
    if (!approveClass || !approveSection || !approveRoll) {
      Alert.alert('Error', 'Please fill class, section and roll number.');
      return;
    }
    setSaving(true);
    try {
      await updateDoc(
        doc(db, 'schools', schoolId, 'admissions', selectedAdmission.id),
        {
          status: 'approved',
          assigned_class: approveClass,
          assigned_section: approveSection,
          assigned_roll: parseInt(approveRoll) || 0,
          approved_date: new Date().toISOString().split('T')[0],
        }
      );
      await addDoc(collection(db, 'schools', schoolId, 'students'), {
        name: selectedAdmission.student_name,
        class: approveClass,
        section: approveSection,
        roll_number: parseInt(approveRoll) || 0,
        parent_phone: selectedAdmission.parent_phone,
        parent_name: selectedAdmission.parent_name,
        dob: selectedAdmission.dob,
        address: selectedAdmission.address,
        fees_due: 0,
        fees_paid: 0,
        admission_date: new Date().toISOString().split('T')[0],
        school_id: schoolId,
      });
      setShowApproveModal(false);
      setSelectedAdmission(null);
      await fetchAdmissions(schoolId);
    } catch (e) {
      Alert.alert('Error', 'Failed to approve admission.');
    } finally {
      setSaving(false);
    }
  }

  async function handleReject(admission: Admission) {
    Alert.alert(
      'Reject Admission',
      `Reject admission for ${admission.student_name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            try {
              await updateDoc(
                doc(db, 'schools', schoolId, 'admissions', admission.id),
                { status: 'rejected' }
              );
              await fetchAdmissions(schoolId);
            } catch (e) {
              Alert.alert('Error', 'Failed to reject admission.');
            }
          },
        },
      ]
    );
  }

  function getStatusColor(status: string) {
    if (status === 'approved') return COLORS.success;
    if (status === 'rejected') return COLORS.error;
    return COLORS.warning;
  }

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchAdmissions(schoolId);
  }, [schoolId]);

  const TABS: { key: FilterTab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'pending', label: 'Pending' },
    { key: 'approved', label: 'Approved' },
    { key: 'rejected', label: 'Rejected' },
  ];

  function renderCard({ item }: { item: Admission }) {
    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <View style={styles.cardLeft}>
            <Text style={styles.cardName}>{item.student_name}</Text>
            <Text style={styles.cardMeta}>Class {item.class_applying} • {item.parent_phone}</Text>
            <Text style={styles.cardDate}>Applied: {item.applied_date}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '18' }]}>
            <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
              {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
            </Text>
          </View>
        </View>
        {item.status === 'pending' && (
          <View style={styles.cardActions}>
            <TouchableOpacity
              style={styles.approveBtn}
              onPress={() => {
                setSelectedAdmission(item);
                setApproveClass('');
                setApproveSection('');
                setApproveRoll('');
                setShowApproveModal(true);
              }}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="check" size={16} color="#FFFFFF" />
              <Text style={styles.actionBtnText}>Approve</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.rejectBtn}
              onPress={() => handleReject(item)}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="close" size={16} color="#FFFFFF" />
              <Text style={styles.actionBtnText}>Reject</Text>
            </TouchableOpacity>
          </View>
        )}
        {item.status === 'approved' && (
          <Text style={styles.approvedInfo}>
            Assigned: Class {item.assigned_class}-{item.assigned_section} • Roll {item.assigned_roll}
          </Text>
        )}
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Admissions</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{filtered.length}</Text>
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.tabsRow}>
        {TABS.map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={COLORS.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          renderItem={renderCard}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="account-plus" size={48} color={COLORS.textSecondary} />
              <Text style={styles.emptyText}>No admissions found</Text>
            </View>
          }
        />
      )}

      <TouchableOpacity
        style={styles.fab}
        onPress={() => { setForm(EMPTY_FORM); setFormErrors({}); setShowAddModal(true); }}
        activeOpacity={0.85}
      >
        <MaterialCommunityIcons name="plus" size={28} color="#FFFFFF" />
      </TouchableOpacity>

      {/* Add Admission Modal */}
      <Modal visible={showAddModal} animationType="slide" onRequestClose={() => setShowAddModal(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalHeaderTitle}>New Admission</Text>
            <TouchableOpacity onPress={() => setShowAddModal(false)}>
              <MaterialCommunityIcons name="close" size={26} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
            <Text style={styles.fieldLabel}>Student Name *</Text>
            <TextInput
              style={[styles.input, formErrors.student_name ? styles.inputErr : null]}
              placeholder="Full name"
              placeholderTextColor={COLORS.textSecondary}
              value={form.student_name}
              onChangeText={v => setForm({ ...form, student_name: v })}
            />
            {formErrors.student_name ? <Text style={styles.fieldError}>{formErrors.student_name}</Text> : null}

            <Text style={styles.fieldLabel}>Date of Birth</Text>
            <TextInput
              style={styles.input}
              placeholder="DD/MM/YYYY"
              placeholderTextColor={COLORS.textSecondary}
              value={form.dob}
              onChangeText={v => setForm({ ...form, dob: v })}
            />

            <Text style={styles.fieldLabel}>Class Applying For *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
              {CLASS_OPTIONS.map(cls => (
                <TouchableOpacity
                  key={cls}
                  style={[styles.chip, form.class_applying === cls && styles.chipActive]}
                  onPress={() => setForm({ ...form, class_applying: cls })}
                >
                  <Text style={[styles.chipText, form.class_applying === cls && styles.chipTextActive]}>{cls}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            {formErrors.class_applying ? <Text style={styles.fieldError}>{formErrors.class_applying}</Text> : null}

            <Text style={styles.fieldLabel}>Parent Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Parent / guardian name"
              placeholderTextColor={COLORS.textSecondary}
              value={form.parent_name}
              onChangeText={v => setForm({ ...form, parent_name: v })}
            />

            <Text style={styles.fieldLabel}>Parent Phone *</Text>
            <TextInput
              style={[styles.input, formErrors.parent_phone ? styles.inputErr : null]}
              placeholder="10-digit phone"
              placeholderTextColor={COLORS.textSecondary}
              keyboardType="number-pad"
              maxLength={10}
              value={form.parent_phone}
              onChangeText={v => setForm({ ...form, parent_phone: v.replace(/\D/g, '') })}
            />
            {formErrors.parent_phone ? <Text style={styles.fieldError}>{formErrors.parent_phone}</Text> : null}

            <Text style={styles.fieldLabel}>Address</Text>
            <TextInput
              style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
              placeholder="Home address"
              placeholderTextColor={COLORS.textSecondary}
              multiline
              value={form.address}
              onChangeText={v => setForm({ ...form, address: v })}
            />

            <Text style={styles.fieldLabel}>Previous School</Text>
            <TextInput
              style={styles.input}
              placeholder="Previous school name (optional)"
              placeholderTextColor={COLORS.textSecondary}
              value={form.previous_school}
              onChangeText={v => setForm({ ...form, previous_school: v })}
            />

            <TouchableOpacity
              style={[styles.saveButton, saving && { opacity: 0.6 }]}
              onPress={handleAddAdmission}
              disabled={saving}
              activeOpacity={0.8}
            >
              {saving ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.saveButtonText}>Submit Admission</Text>}
            </TouchableOpacity>
            <View style={{ height: 40 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Approve Modal */}
      <Modal visible={showApproveModal} animationType="slide" transparent onRequestClose={() => setShowApproveModal(false)}>
        <View style={styles.overlayCenter}>
          <View style={styles.approveModalCard}>
            <Text style={styles.approveModalTitle}>Approve Admission</Text>
            {selectedAdmission && (
              <Text style={styles.approveModalName}>{selectedAdmission.student_name}</Text>
            )}
            <Text style={styles.fieldLabel}>Assign Class</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
              {CLASS_OPTIONS.map(cls => (
                <TouchableOpacity
                  key={cls}
                  style={[styles.chip, approveClass === cls && styles.chipActive]}
                  onPress={() => setApproveClass(cls)}
                >
                  <Text style={[styles.chipText, approveClass === cls && styles.chipTextActive]}>{cls}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Text style={styles.fieldLabel}>Assign Section</Text>
            <View style={styles.sectionRow}>
              {SECTION_OPTIONS.map(sec => (
                <TouchableOpacity
                  key={sec}
                  style={[styles.chip, approveSection === sec && styles.chipActive]}
                  onPress={() => setApproveSection(sec)}
                >
                  <Text style={[styles.chipText, approveSection === sec && styles.chipTextActive]}>{sec}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.fieldLabel}>Roll Number</Text>
            <TextInput
              style={styles.input}
              placeholder="Assign roll number"
              placeholderTextColor={COLORS.textSecondary}
              keyboardType="number-pad"
              value={approveRoll}
              onChangeText={setApproveRoll}
            />
            <View style={styles.approveModalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowApproveModal(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, saving && { opacity: 0.6 }]}
                onPress={handleApprove}
                disabled={saving}
              >
                {saving ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.confirmBtnText}>Approve</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  header: {
    backgroundColor: COLORS.primary, paddingTop: 52, paddingBottom: 16,
    paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  headerTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: 'bold' },
  countBadge: { backgroundColor: COLORS.accent, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  countText: { color: '#FFFFFF', fontSize: 13, fontWeight: 'bold' },
  tabsRow: {
    flexDirection: 'row', backgroundColor: '#FFFFFF',
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: COLORS.accent },
  tabText: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '500' },
  tabTextActive: { color: COLORS.accent, fontWeight: '700' },
  listContent: { padding: 16, paddingBottom: 80 },
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14,
    marginBottom: 10, elevation: 2, shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardLeft: { flex: 1 },
  cardName: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
  cardMeta: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  cardDate: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  statusBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { fontSize: 12, fontWeight: '700' },
  cardActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  approveBtn: {
    flex: 1, backgroundColor: COLORS.success, borderRadius: 8,
    paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  rejectBtn: {
    flex: 1, backgroundColor: COLORS.error, borderRadius: 8,
    paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  actionBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  approvedInfo: { fontSize: 12, color: COLORS.success, marginTop: 8, fontWeight: '500' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 80 },
  emptyText: { color: COLORS.textSecondary, fontSize: 16, marginTop: 12 },
  fab: {
    position: 'absolute', bottom: 24, right: 20, width: 56, height: 56,
    borderRadius: 28, backgroundColor: COLORS.accent, justifyContent: 'center',
    alignItems: 'center', elevation: 6, shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 6,
  },
  modalHeader: {
    backgroundColor: COLORS.primary, paddingTop: 52, paddingBottom: 16,
    paddingHorizontal: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  modalHeaderTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
  modalScroll: { flex: 1, backgroundColor: COLORS.background },
  modalContent: { padding: 16 },
  fieldLabel: {
    fontSize: 12, fontWeight: '600', color: COLORS.textSecondary,
    marginBottom: 6, marginTop: 14, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  input: {
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 8, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: COLORS.textPrimary,
  },
  inputErr: { borderColor: COLORS.error },
  fieldError: { color: COLORS.error, fontSize: 12, marginTop: 4 },
  chip: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 8,
    paddingHorizontal: 16, paddingVertical: 8, marginRight: 8, backgroundColor: '#FFFFFF',
  },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: 14, color: COLORS.textSecondary },
  chipTextActive: { color: '#FFFFFF', fontWeight: '600' },
  sectionRow: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  saveButton: {
    backgroundColor: COLORS.primary, borderRadius: 8, paddingVertical: 14,
    alignItems: 'center', marginTop: 24,
  },
  saveButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
  overlayCenter: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  approveModalCard: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20, width: '100%',
  },
  approveModalTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.textPrimary, marginBottom: 4 },
  approveModalName: { fontSize: 15, color: COLORS.textSecondary, marginBottom: 12 },
  approveModalActions: { flexDirection: 'row', gap: 12, marginTop: 20 },
  cancelBtn: {
    flex: 1, borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 8,
    paddingVertical: 12, alignItems: 'center',
  },
  cancelBtnText: { color: COLORS.textSecondary, fontSize: 15, fontWeight: '600' },
  confirmBtn: {
    flex: 1, backgroundColor: COLORS.success, borderRadius: 8,
    paddingVertical: 12, alignItems: 'center',
  },
  confirmBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
});