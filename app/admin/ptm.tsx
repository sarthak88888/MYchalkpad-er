import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, ActivityIndicator, Modal, ScrollView,
  Alert, RefreshControl, KeyboardAvoidingView, Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  collection, getDocs, addDoc, updateDoc, doc,
  query, orderBy,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getUserSession } from '@/lib/storage';
import { sendSMS } from '@/lib/fast2sms';
import { COLORS } from '@/lib/theme';
import { PTMMeeting } from '@/lib/types';

const CLASS_OPTIONS = ['All','6','7','8','9','10','11','12'];
const SECTION_OPTIONS = ['All','A','B','C','D'];

const EMPTY_FORM = {
  title: '',
  class: '',
  section: '',
  date: '',
  time: '',
  venue: '',
  description: '',
};

export default function PTMScreen() {
  const [meetings, setMeetings] = useState<PTMMeeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [schoolId, setSchoolId] = useState('school_001');
  const [showAddModal, setShowAddModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [sendingReminder, setSendingReminder] = useState<string | null>(null);

  useEffect(() => { initScreen(); }, []);

  async function initScreen() {
    const session = await getUserSession();
    setSchoolId(session.schoolId);
    await fetchMeetings(session.schoolId);
  }

  async function fetchMeetings(sid: string) {
    try {
      const snap = await getDocs(
        query(collection(db, 'schools', sid, 'ptm_meetings'), orderBy('date', 'desc'))
      );
      setMeetings(snap.docs.map(d => ({ id: d.id, ...d.data() } as PTMMeeting)));
    } catch (e) {
      console.error('Fetch PTM error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function validate(): boolean {
    const errors: Record<string, string> = {};
    if (!form.title.trim()) errors.title = 'Title is required';
    if (!form.date.trim()) errors.date = 'Date is required';
    if (!form.time.trim()) errors.time = 'Time is required';
    if (!form.venue.trim()) errors.venue = 'Venue is required';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSchedule() {
    if (!validate()) return;
    setSaving(true);
    try {
      await addDoc(collection(db, 'schools', schoolId, 'ptm_meetings'), {
        title: form.title.trim(),
        class: form.class || 'All',
        section: form.section || 'All',
        date: form.date.trim(),
        time: form.time.trim(),
        venue: form.venue.trim(),
        description: form.description.trim(),
        status: 'upcoming',
        sms_sent: false,
        created_by: schoolId,
        school_id: schoolId,
      });
      setShowAddModal(false);
      setForm(EMPTY_FORM);
      await fetchMeetings(schoolId);
    } catch (e) {
      Alert.alert('Error', 'Failed to schedule meeting.');
    } finally {
      setSaving(false);
    }
  }

  async function handleMarkCompleted(meeting: PTMMeeting) {
    try {
      await updateDoc(doc(db, 'schools', schoolId, 'ptm_meetings', meeting.id), {
        status: 'completed',
      });
      await fetchMeetings(schoolId);
    } catch (e) {
      Alert.alert('Error', 'Failed to update meeting status.');
    }
  }

  async function handleSendReminder(meeting: PTMMeeting) {
    setSendingReminder(meeting.id);
    try {
      const studSnap = await getDocs(
        collection(db, 'schools', schoolId, 'students')
      );
      const phones: string[] = [];
      studSnap.forEach(d => {
        const data = d.data();
        if (meeting.class === 'All' || data.class === meeting.class) {
          if (data.parent_phone) phones.push(data.parent_phone);
        }
      });

      if (phones.length === 0) {
        Alert.alert('No Recipients', 'No parent phone numbers found for this class.');
        return;
      }

      const msg = `MyChalkPad: PTM Meeting — "${meeting.title}" on ${meeting.date} at ${meeting.time}, Venue: ${meeting.venue}. Please attend.`;
      const result = await sendSMS(phones, msg);

      if (result.success) {
        await updateDoc(doc(db, 'schools', schoolId, 'ptm_meetings', meeting.id), {
          sms_sent: true,
        });
        Alert.alert('Success', `SMS reminder sent to ${phones.length} parents.`);
        await fetchMeetings(schoolId);
      } else {
        Alert.alert('SMS Failed', result.message);
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to send reminder.');
    } finally {
      setSendingReminder(null);
    }
  }

  function getStatusColor(status: string) {
    if (status === 'completed') return COLORS.success;
    if (status === 'cancelled') return COLORS.error;
    return COLORS.warning;
  }

  const onRefresh = useCallback(() => { setRefreshing(true); fetchMeetings(schoolId); }, [schoolId]);

  const upcoming = meetings.filter(m => m.status === 'upcoming');
  const past = meetings.filter(m => m.status !== 'upcoming');

  function renderMeetingCard(item: PTMMeeting) {
    return (
      <View key={item.id} style={styles.card}>
        <View style={styles.cardTop}>
          <View style={styles.dateBox}>
            <Text style={styles.dateDay}>{item.date?.split('-')[2] ?? '--'}</Text>
            <Text style={styles.dateMonth}>
              {item.date ? new Date(item.date).toLocaleString('default', { month: 'short' }) : '--'}
            </Text>
          </View>
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardMeta}>
              Class {item.class}-{item.section} • {item.time}
            </Text>
            <Text style={styles.cardVenue}>
              <MaterialCommunityIcons name="map-marker" size={12} color={COLORS.textSecondary} /> {item.venue}
            </Text>
            {item.description ? <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text> : null}
          </View>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '18' }]}>
            <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
              {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
            </Text>
          </View>
        </View>

        {item.status === 'upcoming' && (
          <View style={styles.cardActions}>
            <TouchableOpacity
              style={[styles.reminderBtn, sendingReminder === item.id && { opacity: 0.6 }]}
              onPress={() => handleSendReminder(item)}
              disabled={sendingReminder === item.id}
              activeOpacity={0.8}
            >
              {sendingReminder === item.id ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <MaterialCommunityIcons name="message-text" size={14} color="#FFFFFF" />
                  <Text style={styles.actionBtnText}>
                    {item.sms_sent ? 'Resend Reminder' : 'Send SMS Reminder'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.completedBtn}
              onPress={() => handleMarkCompleted(item)}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="check" size={14} color="#FFFFFF" />
              <Text style={styles.actionBtnText}>Mark Done</Text>
            </TouchableOpacity>
          </View>
        )}

        {item.sms_sent && item.status === 'upcoming' && (
          <View style={styles.smsSentTag}>
            <MaterialCommunityIcons name="check-circle" size={12} color={COLORS.success} />
            <Text style={styles.smsSentText}>SMS reminder sent</Text>
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>PTM Meetings</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{upcoming.length} upcoming</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.centered}><ActivityIndicator color={COLORS.primary} size="large" /></View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
        >
          {upcoming.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>UPCOMING MEETINGS</Text>
              {upcoming.map(m => renderMeetingCard(m))}
            </>
          )}

          {past.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>PAST MEETINGS</Text>
              {past.map(m => renderMeetingCard(m))}
            </>
          )}

          {meetings.length === 0 && (
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="account-group" size={48} color={COLORS.textSecondary} />
              <Text style={styles.emptyText}>No PTM meetings scheduled</Text>
            </View>
          )}
          <View style={{ height: 80 }} />
        </ScrollView>
      )}

      <TouchableOpacity
        style={styles.fab}
        onPress={() => { setForm(EMPTY_FORM); setFormErrors({}); setShowAddModal(true); }}
        activeOpacity={0.85}
      >
        <MaterialCommunityIcons name="plus" size={28} color="#FFFFFF" />
      </TouchableOpacity>

      {/* Schedule Meeting Modal */}
      <Modal visible={showAddModal} animationType="slide" onRequestClose={() => setShowAddModal(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalHeaderTitle}>Schedule PTM Meeting</Text>
            <TouchableOpacity onPress={() => setShowAddModal(false)}>
              <MaterialCommunityIcons name="close" size={26} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
          <ScrollView style={{ flex: 1, backgroundColor: COLORS.background }} contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
            <Text style={styles.fieldLabel}>Meeting Title *</Text>
            <TextInput
              style={[styles.input, formErrors.title ? styles.inputErr : null]}
              placeholder="e.g. Parent Teacher Meeting Q2"
              placeholderTextColor={COLORS.textSecondary}
              value={form.title}
              onChangeText={v => setForm({ ...form, title: v })}
            />
            {formErrors.title ? <Text style={styles.fieldError}>{formErrors.title}</Text> : null}

            <Text style={styles.fieldLabel}>For Class</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
              {CLASS_OPTIONS.map(cls => (
                <TouchableOpacity
                  key={cls}
                  style={[styles.chip, form.class === cls && styles.chipActive]}
                  onPress={() => setForm({ ...form, class: cls })}
                >
                  <Text style={[styles.chipText, form.class === cls && styles.chipTextActive]}>{cls}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.fieldLabel}>For Section</Text>
            <View style={styles.rowWrap}>
              {SECTION_OPTIONS.map(sec => (
                <TouchableOpacity
                  key={sec}
                  style={[styles.chip, form.section === sec && styles.chipActive]}
                  onPress={() => setForm({ ...form, section: sec })}
                >
                  <Text style={[styles.chipText, form.section === sec && styles.chipTextActive]}>{sec}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Date *</Text>
            <TextInput
              style={[styles.input, formErrors.date ? styles.inputErr : null]}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={COLORS.textSecondary}
              value={form.date}
              onChangeText={v => setForm({ ...form, date: v })}
            />
            {formErrors.date ? <Text style={styles.fieldError}>{formErrors.date}</Text> : null}

            <Text style={styles.fieldLabel}>Time *</Text>
            <TextInput
              style={[styles.input, formErrors.time ? styles.inputErr : null]}
              placeholder="e.g. 10:00 AM"
              placeholderTextColor={COLORS.textSecondary}
              value={form.time}
              onChangeText={v => setForm({ ...form, time: v })}
            />
            {formErrors.time ? <Text style={styles.fieldError}>{formErrors.time}</Text> : null}

            <Text style={styles.fieldLabel}>Venue *</Text>
            <TextInput
              style={[styles.input, formErrors.venue ? styles.inputErr : null]}
              placeholder="e.g. School Hall, Classroom 6A"
              placeholderTextColor={COLORS.textSecondary}
              value={form.venue}
              onChangeText={v => setForm({ ...form, venue: v })}
            />
            {formErrors.venue ? <Text style={styles.fieldError}>{formErrors.venue}</Text> : null}

            <Text style={styles.fieldLabel}>Description</Text>
            <TextInput
              style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
              placeholder="Additional details (optional)"
              placeholderTextColor={COLORS.textSecondary}
              multiline
              value={form.description}
              onChangeText={v => setForm({ ...form, description: v })}
            />

            <TouchableOpacity
              style={[styles.saveButton, saving && { opacity: 0.6 }]}
              onPress={handleSchedule}
              disabled={saving}
              activeOpacity={0.8}
            >
              {saving ? <ActivityIndicator color="#FFFFFF" size="small" /> : (
                <>
                  <MaterialCommunityIcons name="calendar-plus" size={18} color="#FFFFFF" />
                  <Text style={styles.saveButtonText}>Schedule Meeting</Text>
                </>
              )}
            </TouchableOpacity>
            <View style={{ height: 40 }} />
          </ScrollView>
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
  countText: { color: '#FFFFFF', fontSize: 12, fontWeight: 'bold' },
  scrollContent: { padding: 16 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary, letterSpacing: 1, marginBottom: 10, marginTop: 4, textTransform: 'uppercase' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14, marginBottom: 12, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  dateBox: { backgroundColor: COLORS.primary + '10', borderRadius: 10, width: 48, alignItems: 'center', paddingVertical: 8 },
  dateDay: { fontSize: 20, fontWeight: 'bold', color: COLORS.primary },
  dateMonth: { fontSize: 11, color: COLORS.primary, fontWeight: '600' },
  cardContent: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  cardMeta: { fontSize: 12, color: COLORS.textSecondary, marginTop: 3 },
  cardVenue: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  cardDesc: { fontSize: 13, color: COLORS.textSecondary, marginTop: 4, lineHeight: 18 },
  statusBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  statusText: { fontSize: 11, fontWeight: '700' },
  cardActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  reminderBtn: { flex: 1, backgroundColor: COLORS.primary, borderRadius: 8, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  completedBtn: { flex: 1, backgroundColor: COLORS.success, borderRadius: 8, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  actionBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  smsSentTag: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  smsSentText: { fontSize: 11, color: COLORS.success, fontWeight: '500' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 80 },
  emptyText: { color: COLORS.textSecondary, fontSize: 16, marginTop: 12 },
  fab: { position: 'absolute', bottom: 24, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: COLORS.accent, justifyContent: 'center', alignItems: 'center', elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 6 },
  modalHeader: { backgroundColor: COLORS.primary, paddingTop: 52, paddingBottom: 16, paddingHorizontal: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalHeaderTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 6, marginTop: 14, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: COLORS.textPrimary },
  inputErr: { borderColor: COLORS.error },
  fieldError: { color: COLORS.error, fontSize: 12, marginTop: 4 },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  chip: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8, marginRight: 8, backgroundColor: '#FFFFFF' },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: 13, color: COLORS.textSecondary },
  chipTextActive: { color: '#FFFFFF', fontWeight: '600' },
  saveButton: { backgroundColor: COLORS.primary, borderRadius: 8, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 24 },
  saveButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
});