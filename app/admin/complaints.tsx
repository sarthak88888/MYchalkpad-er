import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, ActivityIndicator, Modal, ScrollView,
  Alert, RefreshControl, KeyboardAvoidingView, Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  collection, getDocs, updateDoc, doc,
  query, orderBy,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getUserSession } from '@/lib/storage';
import { sendSMS } from '@/lib/fast2sms';
import { sendWhatsApp } from '@/lib/whatsapp';
import { COLORS } from '@/lib/theme';
import { Complaint } from '@/lib/types';

type StatusFilter = 'all' | 'open' | 'in_progress' | 'resolved';

const STATUS_COLORS: Record<string, string> = {
  open: COLORS.error,
  in_progress: COLORS.warning,
  resolved: COLORS.success,
};

const STATUS_LABELS: Record<string, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  resolved: 'Resolved',
};

export default function ComplaintsScreen() {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [filtered, setFiltered] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [schoolId, setSchoolId] = useState('school_001');
  const [activeFilter, setActiveFilter] = useState<StatusFilter>('all');
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('open');
  const [saving, setSaving] = useState(false);
  const [sendingComm, setSendingComm] = useState(false);

  useEffect(() => { initScreen(); }, []);
  useEffect(() => { applyFilter(); }, [complaints, activeFilter]);

  async function initScreen() {
    const session = await getUserSession();
    setSchoolId(session.schoolId);
    await fetchComplaints(session.schoolId);
  }

  async function fetchComplaints(sid: string) {
    try {
      const snap = await getDocs(
        query(collection(db, 'schools', sid, 'complaints'), orderBy('created_at', 'desc'))
      );
      setComplaints(snap.docs.map(d => ({ id: d.id, ...d.data() } as Complaint)));
    } catch (e) {
      console.error('Fetch complaints error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function applyFilter() {
    if (activeFilter === 'all') setFiltered(complaints);
    else setFiltered(complaints.filter(c => c.status === activeFilter));
  }

  function openDetail(complaint: Complaint) {
    setSelectedComplaint(complaint);
    setReplyText(complaint.admin_reply ?? '');
    setSelectedStatus(complaint.status);
    setShowDetailModal(true);
  }

  async function handleUpdateComplaint() {
    if (!selectedComplaint) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'schools', schoolId, 'complaints', selectedComplaint.id), {
        status: selectedStatus,
        admin_reply: replyText.trim(),
        updated_at: new Date().toISOString(),
      });
      setShowDetailModal(false);
      await fetchComplaints(schoolId);
    } catch (e) {
      Alert.alert('Error', 'Failed to update complaint.');
    } finally {
      setSaving(false);
    }
  }

  async function handleSendSMS() {
    if (!selectedComplaint) return;
    setSendingComm(true);
    try {
      const msg = `MyChalkPad: Your complaint "${selectedComplaint.subject}" status: ${STATUS_LABELS[selectedStatus]}. ${replyText ? `Reply: ${replyText}` : ''}`;
      const result = await sendSMS([selectedComplaint.submitted_by_phone], msg);
      if (result.success) {
        Alert.alert('Success', 'SMS sent to parent.');
      } else {
        Alert.alert('SMS Failed', result.message);
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to send SMS.');
    } finally {
      setSendingComm(false);
    }
  }

  async function handleSendWhatsApp() {
    if (!selectedComplaint) return;
    setSendingComm(true);
    try {
      const msg = `*MyChalkPad Complaint Update*\n\nComplaint: ${selectedComplaint.subject}\nStatus: ${STATUS_LABELS[selectedStatus]}\n${replyText ? `Admin Reply: ${replyText}` : ''}`;
      const result = await sendWhatsApp(selectedComplaint.submitted_by_phone, msg);
      if (result.success) {
        Alert.alert('Success', 'WhatsApp message sent.');
      } else {
        Alert.alert('WhatsApp Failed', result.message);
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to send WhatsApp.');
    } finally {
      setSendingComm(false);
    }
  }

  const onRefresh = useCallback(() => { setRefreshing(true); fetchComplaints(schoolId); }, [schoolId]);

  const TABS: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'open', label: 'Open' },
    { key: 'in_progress', label: 'In Progress' },
    { key: 'resolved', label: 'Resolved' },
  ];

  function renderCard({ item }: { item: Complaint }) {
    return (
      <TouchableOpacity style={styles.card} onPress={() => openDetail(item)} activeOpacity={0.8}>
        <View style={styles.cardTop}>
          <View style={styles.cardLeft}>
            <Text style={styles.cardSubject}>{item.subject}</Text>
            <Text style={styles.cardBy}>{item.submitted_by_name} • {item.submitted_by_phone}</Text>
            <Text style={styles.cardDate}>{item.created_at?.split('T')[0] ?? ''}</Text>
            <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[item.status] + '18' }]}>
            <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[item.status] }]} />
            <Text style={[styles.statusText, { color: STATUS_COLORS[item.status] }]}>
              {STATUS_LABELS[item.status]}
            </Text>
          </View>
        </View>
        {item.admin_reply ? (
          <View style={styles.replyPreview}>
            <MaterialCommunityIcons name="reply" size={14} color={COLORS.primary} />
            <Text style={styles.replyPreviewText} numberOfLines={1}>{item.admin_reply}</Text>
          </View>
        ) : null}
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Complaints</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{filtered.length}</Text>
        </View>
      </View>

      <View style={styles.tabsRow}>
        {TABS.map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeFilter === tab.key && styles.tabActive]}
            onPress={() => setActiveFilter(tab.key)}
          >
            <Text style={[styles.tabText, activeFilter === tab.key && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
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
              <MaterialCommunityIcons name="message-alert-outline" size={48} color={COLORS.textSecondary} />
              <Text style={styles.emptyText}>No complaints found</Text>
            </View>
          }
        />
      )}

      {/* Detail Modal */}
      <Modal visible={showDetailModal} animationType="slide" onRequestClose={() => setShowDetailModal(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalHeaderTitle}>Complaint Detail</Text>
            <TouchableOpacity onPress={() => setShowDetailModal(false)}>
              <MaterialCommunityIcons name="close" size={26} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {selectedComplaint && (
            <ScrollView style={{ flex: 1, backgroundColor: COLORS.background }} contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
              {/* Subject */}
              <View style={styles.detailCard}>
                <Text style={styles.detailSubject}>{selectedComplaint.subject}</Text>
                <Text style={styles.detailBy}>{selectedComplaint.submitted_by_name} • {selectedComplaint.submitted_by_phone}</Text>
                <Text style={styles.detailDate}>{selectedComplaint.created_at?.split('T')[0] ?? ''}</Text>
              </View>

              {/* Description */}
              <View style={styles.sectionCard}>
                <Text style={styles.sectionLabel}>COMPLAINT</Text>
                <Text style={styles.descriptionText}>{selectedComplaint.description}</Text>
              </View>

              {/* Status Selector */}
              <View style={styles.sectionCard}>
                <Text style={styles.sectionLabel}>UPDATE STATUS</Text>
                <View style={styles.statusRow}>
                  {(['open','in_progress','resolved'] as const).map(s => (
                    <TouchableOpacity
                      key={s}
                      style={[
                        styles.statusChip,
                        { borderColor: STATUS_COLORS[s] },
                        selectedStatus === s && { backgroundColor: STATUS_COLORS[s] },
                      ]}
                      onPress={() => setSelectedStatus(s)}
                    >
                      <Text style={[styles.statusChipText, { color: selectedStatus === s ? '#FFFFFF' : STATUS_COLORS[s] }]}>
                        {STATUS_LABELS[s]}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Reply */}
              <View style={styles.sectionCard}>
                <Text style={styles.sectionLabel}>ADMIN REPLY</Text>
                <TextInput
                  style={styles.replyInput}
                  placeholder="Type your reply to the parent..."
                  placeholderTextColor={COLORS.textSecondary}
                  multiline
                  numberOfLines={4}
                  value={replyText}
                  onChangeText={setReplyText}
                />
              </View>

              {/* Save */}
              <TouchableOpacity
                style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                onPress={handleUpdateComplaint}
                disabled={saving}
                activeOpacity={0.8}
              >
                {saving ? <ActivityIndicator color="#FFFFFF" size="small" /> : (
                  <>
                    <MaterialCommunityIcons name="content-save" size={18} color="#FFFFFF" />
                    <Text style={styles.saveBtnText}>Save & Update Status</Text>
                  </>
                )}
              </TouchableOpacity>

              {/* Communication Buttons */}
              <View style={styles.commRow}>
                <TouchableOpacity
                  style={[styles.smsBtn, sendingComm && { opacity: 0.6 }]}
                  onPress={handleSendSMS}
                  disabled={sendingComm}
                  activeOpacity={0.8}
                >
                  {sendingComm ? <ActivityIndicator color="#FFFFFF" size="small" /> : (
                    <>
                      <MaterialCommunityIcons name="message-text" size={16} color="#FFFFFF" />
                      <Text style={styles.commBtnText}>Reply via SMS</Text>
                    </>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.waBtn, sendingComm && { opacity: 0.6 }]}
                  onPress={handleSendWhatsApp}
                  disabled={sendingComm}
                  activeOpacity={0.8}
                >
                  {sendingComm ? <ActivityIndicator color="#FFFFFF" size="small" /> : (
                    <>
                      <MaterialCommunityIcons name="whatsapp" size={16} color="#FFFFFF" />
                      <Text style={styles.commBtnText}>Reply via WhatsApp</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
              <View style={{ height: 40 }} />
            </ScrollView>
          )}
        </KeyboardAvoidingView>
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
  tabsRow: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: COLORS.border },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: COLORS.accent },
  tabText: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '500' },
  tabTextActive: { color: COLORS.accent, fontWeight: '700' },
  listContent: { padding: 16, paddingBottom: 40 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14, marginBottom: 10, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardLeft: { flex: 1, marginRight: 8 },
  cardSubject: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  cardBy: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  cardDate: { fontSize: 11, color: COLORS.textSecondary, marginTop: 1 },
  cardDesc: { fontSize: 13, color: COLORS.textSecondary, marginTop: 6, lineHeight: 18 },
  statusBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, flexDirection: 'row', alignItems: 'center', gap: 4 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: '700' },
  replyPreview: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: COLORS.border },
  replyPreviewText: { fontSize: 12, color: COLORS.primary, flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 80 },
  emptyText: { color: COLORS.textSecondary, fontSize: 16, marginTop: 12 },
  modalHeader: { backgroundColor: COLORS.primary, paddingTop: 52, paddingBottom: 16, paddingHorizontal: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalHeaderTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
  detailCard: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, marginBottom: 12, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3 },
  detailSubject: { fontSize: 18, fontWeight: 'bold', color: COLORS.textPrimary },
  detailBy: { fontSize: 13, color: COLORS.textSecondary, marginTop: 4 },
  detailDate: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  sectionCard: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, marginBottom: 12, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 2 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary, letterSpacing: 0.8, marginBottom: 10, textTransform: 'uppercase' },
  descriptionText: { fontSize: 15, color: COLORS.textPrimary, lineHeight: 22 },
  statusRow: { flexDirection: 'row', gap: 10 },
  statusChip: { flex: 1, borderWidth: 1.5, borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  statusChipText: { fontSize: 12, fontWeight: '700' },
  replyInput: { backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: COLORS.textPrimary, height: 100, textAlignVertical: 'top' },
  saveBtn: { backgroundColor: COLORS.primary, borderRadius: 8, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 12 },
  saveBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: 'bold' },
  commRow: { flexDirection: 'row', gap: 10 },
  smsBtn: { flex: 1, backgroundColor: '#1E40AF', borderRadius: 8, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  waBtn: { flex: 1, backgroundColor: '#16A34A', borderRadius: 8, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  commBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
});