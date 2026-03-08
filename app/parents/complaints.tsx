import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, ActivityIndicator, Modal, ScrollView,
  Alert, RefreshControl, KeyboardAvoidingView, Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  collection, getDocs, addDoc, query, where, orderBy,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getUserSession } from '@/lib/storage';
import { COLORS } from '@/lib/theme';
import { Complaint, Student } from '@/lib/types';

const STATUS_COLORS: Record<string, string> = {
  open: COLORS.error,
  in_progress: COLORS.warning,
  resolved: COLORS.success,
};
const STATUS_LABELS: Record<string, string> = {
  open: 'Open', in_progress: 'In Progress', resolved: 'Resolved',
};

const COMPLAINT_TYPES = [
  'Academic Issue', 'Teacher Behaviour', 'Bullying', 'Infrastructure',
  'Fees Issue', 'Transport', 'Food Quality', 'Other',
];

export default function ParentComplaintsScreen() {
  const [schoolId, setSchoolId] = useState('school_001');
  const [parentPhone, setParentPhone] = useState('');
  const [parentName, setParentName] = useState('');
  const [children, setChildren] = useState<Student[]>([]);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showNewModal, setShowNewModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    subject: '',
    type: '',
    description: '',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  useEffect(() => { initScreen(); }, []);

  async function initScreen() {
    const session = await getUserSession();
    setSchoolId(session.schoolId);
    setParentPhone(session.phone);
    try {
      const snap = await getDocs(query(
        collection(db, 'schools', session.schoolId, 'students'),
        where('parent_phone', '==', session.phone)
      ));
      const kids = snap.docs.map(d => ({ id: d.id, ...d.data() } as Student));
      setChildren(kids);
      if (kids.length > 0) setParentName(kids[0].parent_name ?? '');
    } catch (e) { console.error(e); }
    await loadComplaints(session.schoolId, session.phone);
  }

  async function loadComplaints(sid: string, phone: string) {
    try {
      const snap = await getDocs(query(
        collection(db, 'schools', sid, 'complaints'),
        where('submitted_by_phone', '==', phone),
        orderBy('created_at', 'desc')
      ));
      setComplaints(snap.docs.map(d => ({ id: d.id, ...d.data() } as Complaint)));
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  }

  function validate(): boolean {
    const errors: Record<string, string> = {};
    if (!form.subject.trim()) errors.subject = 'Subject is required';
    if (!form.type) errors.type = 'Please select a complaint type';
    if (!form.description.trim() || form.description.trim().length < 20)
      errors.description = 'Please describe the issue (min 20 characters)';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    setSaving(true);
    try {
      const childName = children.length > 0 ? children[0].name : 'N/A';
      const childClass = children.length > 0 ? `${children[0].class}-${children[0].section}` : 'N/A';
      await addDoc(collection(db, 'schools', schoolId, 'complaints'), {
        subject: form.subject.trim(),
        type: form.type,
        description: form.description.trim(),
        submitted_by_name: parentName || 'Parent',
        submitted_by_phone: parentPhone,
        student_name: childName,
        student_class: childClass,
        status: 'open',
        admin_reply: null,
        created_at: new Date().toISOString(),
        school_id: schoolId,
      });
      setShowNewModal(false);
      setForm({ subject: '', type: '', description: '' });
      await loadComplaints(schoolId, parentPhone);
      Alert.alert('Submitted!', 'Your complaint has been submitted. The school will respond shortly.');
    } catch (e) {
      Alert.alert('Error', 'Failed to submit complaint.');
    } finally {
      setSaving(false);
    }
  }

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadComplaints(schoolId, parentPhone);
  }, [schoolId, parentPhone]);

  function renderComplaintCard({ item }: { item: Complaint }) {
    const hasReply = Boolean(item.admin_reply);
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => { setSelectedComplaint(item); setShowDetailModal(true); }}
        activeOpacity={0.8}
      >
        <View style={styles.cardTop}>
          <View style={styles.cardLeft}>
            <Text style={styles.cardSubject}>{item.subject}</Text>
            <Text style={styles.cardType}>{item.type}</Text>
            <Text style={styles.cardDate}>{item.created_at?.split('T')[0]}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[item.status] + '18' }]}>
            <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[item.status] }]} />
            <Text style={[styles.statusText, { color: STATUS_COLORS[item.status] }]}>
              {STATUS_LABELS[item.status]}
            </Text>
          </View>
        </View>
        <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>
        {hasReply && (
          <View style={styles.replyIndicator}>
            <MaterialCommunityIcons name="reply" size={14} color={COLORS.primary} />
            <Text style={styles.replyIndicatorText}>School replied</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Complaints</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{complaints.length}</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.centered}><ActivityIndicator color={COLORS.primary} size="large" /></View>
      ) : (
        <FlatList
          data={complaints}
          keyExtractor={item => item.id}
          renderItem={renderComplaintCard}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="message-check-outline" size={48} color={COLORS.textSecondary} />
              <Text style={styles.emptyText}>No complaints submitted</Text>
              <Text style={styles.emptySubText}>Tap + to raise a concern with the school</Text>
            </View>
          }
        />
      )}

      <TouchableOpacity
        style={styles.fab}
        onPress={() => { setForm({ subject: '', type: '', description: '' }); setFormErrors({}); setShowNewModal(true); }}
        activeOpacity={0.85}
      >
        <MaterialCommunityIcons name="plus" size={28} color="#FFFFFF" />
      </TouchableOpacity>

      {/* New Complaint Modal */}
      <Modal visible={showNewModal} animationType="slide" onRequestClose={() => setShowNewModal(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalHeaderTitle}>New Complaint</Text>
            <TouchableOpacity onPress={() => setShowNewModal(false)}>
              <MaterialCommunityIcons name="close" size={26} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
          <ScrollView style={{ flex: 1, backgroundColor: COLORS.background }} contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
            <Text style={styles.fieldLabel}>Subject *</Text>
            <TextInput
              style={[styles.input, formErrors.subject ? styles.inputErr : null]}
              placeholder="Brief subject of your complaint"
              placeholderTextColor={COLORS.textSecondary}
              value={form.subject}
              onChangeText={v => setForm({ ...form, subject: v })}
            />
            {formErrors.subject ? <Text style={styles.fieldError}>{formErrors.subject}</Text> : null}

            <Text style={styles.fieldLabel}>Type *</Text>
            <View style={styles.typeGrid}>
              {COMPLAINT_TYPES.map(type => (
                <TouchableOpacity
                  key={type}
                  style={[styles.typeChip, form.type === type && styles.typeChipActive]}
                  onPress={() => setForm({ ...form, type })}
                >
                  <Text style={[styles.typeChipText, form.type === type && styles.typeChipTextActive]}>
                    {type}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {formErrors.type ? <Text style={styles.fieldError}>{formErrors.type}</Text> : null}

            <Text style={styles.fieldLabel}>Description *</Text>
            <TextInput
              style={[styles.input, { height: 120, textAlignVertical: 'top' }, formErrors.description ? styles.inputErr : null]}
              placeholder="Describe the issue in detail (min 20 characters)..."
              placeholderTextColor={COLORS.textSecondary}
              multiline
              value={form.description}
              onChangeText={v => setForm({ ...form, description: v })}
            />
            <Text style={styles.charHint}>{form.description.length} characters</Text>
            {formErrors.description ? <Text style={styles.fieldError}>{formErrors.description}</Text> : null}

            {children.length > 0 && (
              <View style={styles.childInfoBox}>
                <MaterialCommunityIcons name="information" size={16} color={COLORS.primary} />
                <Text style={styles.childInfoText}>
                  Complaint will be submitted for {children[0].name} (Class {children[0].class}-{children[0].section})
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.submitBtn, saving && { opacity: 0.6 }]}
              onPress={handleSubmit}
              disabled={saving}
              activeOpacity={0.8}
            >
              {saving ? <ActivityIndicator color="#FFFFFF" size="small" /> : (
                <>
                  <MaterialCommunityIcons name="send" size={18} color="#FFFFFF" />
                  <Text style={styles.submitBtnText}>Submit Complaint</Text>
                </>
              )}
            </TouchableOpacity>
            <View style={{ height: 40 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Detail Modal */}
      <Modal visible={showDetailModal} animationType="slide" onRequestClose={() => setShowDetailModal(false)}>
        {selectedComplaint && (
          <View style={{ flex: 1, backgroundColor: COLORS.background }}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalHeaderTitle}>Complaint Detail</Text>
              <TouchableOpacity onPress={() => setShowDetailModal(false)}>
                <MaterialCommunityIcons name="close" size={26} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ padding: 16 }}>
              {/* Status */}
              <View style={[styles.statusCard, { backgroundColor: STATUS_COLORS[selectedComplaint.status] + '10', borderColor: STATUS_COLORS[selectedComplaint.status] + '30' }]}>
                <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[selectedComplaint.status], width: 10, height: 10, borderRadius: 5 }]} />
                <Text style={[styles.statusCardText, { color: STATUS_COLORS[selectedComplaint.status] }]}>
                  {STATUS_LABELS[selectedComplaint.status]}
                </Text>
              </View>

              <Text style={styles.detailSubject}>{selectedComplaint.subject}</Text>
              <Text style={styles.detailType}>{selectedComplaint.type} • {selectedComplaint.created_at?.split('T')[0]}</Text>

              <View style={styles.detailSection}>
                <Text style={styles.detailSectionLabel}>YOUR COMPLAINT</Text>
                <Text style={styles.detailDescription}>{selectedComplaint.description}</Text>
              </View>

              {selectedComplaint.admin_reply ? (
                <View style={styles.replyCard}>
                  <View style={styles.replyHeader}>
                    <MaterialCommunityIcons name="reply" size={18} color={COLORS.primary} />
                    <Text style={styles.replyHeaderText}>School's Response</Text>
                  </View>
                  <Text style={styles.replyText}>{selectedComplaint.admin_reply}</Text>
                </View>
              ) : (
                <View style={styles.pendingReplyCard}>
                  <MaterialCommunityIcons name="clock-outline" size={20} color={COLORS.warning} />
                  <Text style={styles.pendingReplyText}>
                    Awaiting response from school. We'll notify you when they reply.
                  </Text>
                </View>
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
  header: { backgroundColor: COLORS.primary, paddingTop: 52, paddingBottom: 16, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: 'bold' },
  countBadge: { backgroundColor: COLORS.accent, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  countText: { color: '#FFFFFF', fontSize: 13, fontWeight: 'bold' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  listContent: { padding: 16, paddingBottom: 80 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14, marginBottom: 10, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  cardLeft: { flex: 1, marginRight: 8 },
  cardSubject: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  cardType: { fontSize: 12, color: COLORS.primary, fontWeight: '500', marginTop: 2 },
  cardDate: { fontSize: 11, color: COLORS.textSecondary, marginTop: 1 },
  statusBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, flexDirection: 'row', alignItems: 'center', gap: 4 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: '700' },
  cardDesc: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 18 },
  replyIndicator: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: COLORS.border },
  replyIndicatorText: { fontSize: 12, color: COLORS.primary, fontWeight: '500' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 80 },
  emptyText: { color: COLORS.textSecondary, fontSize: 16, marginTop: 12 },
  emptySubText: { color: COLORS.textSecondary, fontSize: 13, marginTop: 6 },
  fab: { position: 'absolute', bottom: 24, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: COLORS.accent, justifyContent: 'center', alignItems: 'center', elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 6 },
  modalHeader: { backgroundColor: COLORS.primary, paddingTop: 52, paddingBottom: 16, paddingHorizontal: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalHeaderTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 6, marginTop: 14, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: COLORS.textPrimary },
  inputErr: { borderColor: COLORS.error },
  fieldError: { color: COLORS.error, fontSize: 12, marginTop: 4 },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeChip: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#FFFFFF' },
  typeChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  typeChipText: { fontSize: 13, color: COLORS.textSecondary },
  typeChipTextActive: { color: '#FFFFFF', fontWeight: '600' },
  charHint: { fontSize: 11, color: COLORS.textSecondary, textAlign: 'right', marginTop: 4 },
  childInfoBox: { backgroundColor: COLORS.primary + '08', borderRadius: 8, padding: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 14, borderWidth: 1, borderColor: COLORS.primary + '20' },
  childInfoText: { flex: 1, fontSize: 13, color: COLORS.primary, lineHeight: 18 },
  submitBtn: { backgroundColor: COLORS.primary, borderRadius: 8, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 24 },
  submitBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
  statusCard: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 16 },
  statusCardText: { fontSize: 14, fontWeight: '700' },
  detailSubject: { fontSize: 20, fontWeight: 'bold', color: COLORS.textPrimary, marginBottom: 4 },
  detailType: { fontSize: 13, color: COLORS.textSecondary, marginBottom: 16 },
  detailSection: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, marginBottom: 12, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 2 },
  detailSectionLabel: { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary, letterSpacing: 0.8, marginBottom: 10, textTransform: 'uppercase' },
  detailDescription: { fontSize: 15, color: COLORS.textPrimary, lineHeight: 22 },
  replyCard: { backgroundColor: COLORS.primary + '08', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: COLORS.primary + '20' },
  replyHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  replyHeaderText: { fontSize: 14, fontWeight: '700', color: COLORS.primary },
  replyText: { fontSize: 15, color: COLORS.textPrimary, lineHeight: 22 },
  pendingReplyCard: { backgroundColor: '#FFFBEB', borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderWidth: 1, borderColor: COLORS.warning + '30' },
  pendingReplyText: { flex: 1, fontSize: 14, color: COLORS.textSecondary, lineHeight: 20 },
});
