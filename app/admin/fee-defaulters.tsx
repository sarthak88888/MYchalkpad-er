import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Alert, RefreshControl, ScrollView,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getUserSession } from '@/lib/storage';
import { sendSMS } from '@/lib/fast2sms';
import { sendWhatsApp } from '@/lib/whatsapp';
import { COLORS } from '@/lib/theme';
import { FeeRecord } from '@/lib/types';

type DaysFilter = 'all' | '30' | '60' | '90';

export default function FeeDefaultersScreen() {
  const [defaulters, setDefaulters] = useState<FeeRecord[]>([]);
  const [filtered, setFiltered] = useState<FeeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [schoolId, setSchoolId] = useState('school_001');
  const [daysFilter, setDaysFilter] = useState<DaysFilter>('all');
  const [sending, setSending] = useState<string | null>(null);
  const [sendingAll, setSendingAll] = useState(false);

  useEffect(() => { initScreen(); }, []);
  useEffect(() => { applyFilter(); }, [defaulters, daysFilter]);

  async function initScreen() {
    const session = await getUserSession();
    setSchoolId(session.schoolId);
    await fetchDefaulters(session.schoolId);
  }

  async function fetchDefaulters(sid: string) {
    try {
      const snap = await getDocs(
        query(
          collection(db, 'schools', sid, 'fees'),
          where('status', 'in', ['due', 'overdue'])
        )
      );
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() } as FeeRecord));
      all.sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0));
      setDefaulters(all);
    } catch (e) {
      console.error('Fetch defaulters error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function getDaysOverdue(dueDate: string): number {
    const due = new Date(dueDate);
    const now = new Date();
    const diff = Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(0, diff);
  }

  function applyFilter() {
    if (daysFilter === 'all') {
      setFiltered(defaulters);
    } else {
      const minDays = parseInt(daysFilter);
      setFiltered(defaulters.filter(f => getDaysOverdue(f.due_date) >= minDays));
    }
  }

  function getTotalPending() {
    return filtered.reduce((sum, f) => sum + (f.amount ?? 0), 0);
  }

  async function handleSendSMSOne(fee: FeeRecord) {
    setSending(fee.id);
    try {
      const days = getDaysOverdue(fee.due_date);
      const msg = `MyChalkPad: Dear Parent, fee of ₹${fee.amount} for ${fee.student_name} (Class ${fee.class}) is overdue by ${days} days. Please pay immediately. Contact school for help.`;
      const result = await sendSMS([fee.parent_phone], msg);
      Alert.alert(result.success ? 'SMS Sent' : 'SMS Failed', result.success ? `Reminder sent to ${fee.parent_phone}` : result.message);
    } catch (e) {
      Alert.alert('Error', 'Failed to send SMS.');
    } finally {
      setSending(null);
    }
  }

  async function handleSendWhatsAppOne(fee: FeeRecord) {
    setSending(fee.id + '_wa');
    try {
      const days = getDaysOverdue(fee.due_date);
      const msg = `*MyChalkPad Fee Reminder*\n\nDear Parent,\n\nFee of ₹${fee.amount} for *${fee.student_name}* (Class ${fee.class}) is overdue by *${days} days*.\n\nPlease pay immediately to avoid inconvenience.\n\nContact school for payment options.`;
      const result = await sendWhatsApp(fee.parent_phone, msg);
      Alert.alert(result.success ? 'WhatsApp Sent' : 'WhatsApp Failed', result.success ? 'Reminder sent via WhatsApp' : result.message);
    } catch (e) {
      Alert.alert('Error', 'Failed to send WhatsApp.');
    } finally {
      setSending(null);
    }
  }

  async function handleSendToAll() {
    if (filtered.length === 0) {
      Alert.alert('No Defaulters', 'No defaulters to send reminders to.');
      return;
    }
    Alert.alert(
      'Send to All',
      `Send SMS reminders to ${filtered.length} defaulters?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send All',
          onPress: async () => {
            setSendingAll(true);
            try {
              const phones = filtered.map(f => f.parent_phone).filter(Boolean);
              const msg = `MyChalkPad: Dear Parent, your child has pending school fees. Please pay immediately to avoid inconvenience. Contact school for details.`;
              const result = await sendSMS(phones, msg);
              Alert.alert('Done', `SMS sent to ${result.sent} parents. ${result.failed > 0 ? `${result.failed} failed.` : ''}`);
            } catch (e) {
              Alert.alert('Error', 'Failed to send bulk SMS.');
            } finally {
              setSendingAll(false);
            }
          },
        },
      ]
    );
  }

  const onRefresh = useCallback(() => { setRefreshing(true); fetchDefaulters(schoolId); }, [schoolId]);

  const FILTERS: { key: DaysFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: '30', label: '>30 Days' },
    { key: '60', label: '>60 Days' },
    { key: '90', label: '>90 Days' },
  ];

  function renderCard({ item }: { item: FeeRecord }) {
    const days = getDaysOverdue(item.due_date);
    const overdueSeverity = days >= 90 ? COLORS.error : days >= 60 ? '#F97316' : days >= 30 ? '#F59E0B' : COLORS.textSecondary;
    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <View style={styles.cardLeft}>
            <Text style={styles.cardName}>{item.student_name}</Text>
            <Text style={styles.cardMeta}>Class {item.class}-{item.section} • {item.parent_phone}</Text>
            <Text style={styles.cardFeeType}>{item.fee_type}</Text>
            {days > 0 && (
              <Text style={[styles.cardOverdue, { color: overdueSeverity }]}>
                {days} days overdue
              </Text>
            )}
          </View>
          <View style={styles.cardRight}>
            <Text style={styles.cardAmount}>₹{item.amount}</Text>
            <Text style={styles.cardDue}>Due: {item.due_date}</Text>
          </View>
        </View>
        <View style={styles.cardActions}>
          <TouchableOpacity
            style={[styles.smsBtn, sending === item.id && { opacity: 0.6 }]}
            onPress={() => handleSendSMSOne(item)}
            disabled={sending === item.id}
            activeOpacity={0.8}
          >
            {sending === item.id ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <MaterialCommunityIcons name="message-text" size={14} color="#FFFFFF" />
                <Text style={styles.actionBtnText}>SMS</Text>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.waBtn, sending === item.id + '_wa' && { opacity: 0.6 }]}
            onPress={() => handleSendWhatsAppOne(item)}
            disabled={sending === item.id + '_wa'}
            activeOpacity={0.8}
          >
            {sending === item.id + '_wa' ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <MaterialCommunityIcons name="whatsapp" size={14} color="#FFFFFF" />
                <Text style={styles.actionBtnText}>WhatsApp</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Fee Defaulters</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{filtered.length}</Text>
        </View>
      </View>

      {/* Pending Banner */}
      <View style={styles.pendingBanner}>
        <MaterialCommunityIcons name="alert-circle" size={20} color="#FFFFFF" />
        <Text style={styles.pendingAmount}>Total Pending: ₹{getTotalPending().toLocaleString()}</Text>
      </View>

      {/* Filters */}
      <View style={styles.filterRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8, alignItems: 'center' }}>
          {FILTERS.map(f => (
            <TouchableOpacity
              key={f.key}
              style={[styles.filterChip, daysFilter === f.key && styles.filterChipActive]}
              onPress={() => setDaysFilter(f.key)}
            >
              <Text style={[styles.filterChipText, daysFilter === f.key && styles.filterChipTextActive]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
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
              <MaterialCommunityIcons name="check-circle" size={48} color={COLORS.success} />
              <Text style={styles.emptyText}>No defaulters found</Text>
            </View>
          }
        />
      )}

      {/* Send to All Button */}
      {filtered.length > 0 && (
        <TouchableOpacity
          style={[styles.sendAllBtn, sendingAll && { opacity: 0.6 }]}
          onPress={handleSendToAll}
          disabled={sendingAll}
          activeOpacity={0.8}
        >
          {sendingAll ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <>
              <MaterialCommunityIcons name="message-fast" size={18} color="#FFFFFF" />
              <Text style={styles.sendAllText}>Send SMS to All {filtered.length} Defaulters</Text>
            </>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  header: { backgroundColor: COLORS.primary, paddingTop: 52, paddingBottom: 16, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: 'bold' },
  countBadge: { backgroundColor: COLORS.accent, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  countText: { color: '#FFFFFF', fontSize: 13, fontWeight: 'bold' },
  pendingBanner: { backgroundColor: COLORS.error, paddingVertical: 12, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 8 },
  pendingAmount: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
  filterRow: { backgroundColor: '#FFFFFF', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  filterChip: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, backgroundColor: '#FFFFFF' },
  filterChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterChipText: { fontSize: 13, color: COLORS.textSecondary },
  filterChipTextActive: { color: '#FFFFFF', fontWeight: '600' },
  listContent: { padding: 16, paddingBottom: 100 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14, marginBottom: 10, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  cardLeft: { flex: 1 },
  cardName: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  cardMeta: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  cardFeeType: { fontSize: 12, color: COLORS.textSecondary, marginTop: 1 },
  cardOverdue: { fontSize: 12, fontWeight: '600', marginTop: 4 },
  cardRight: { alignItems: 'flex-end' },
  cardAmount: { fontSize: 20, fontWeight: 'bold', color: COLORS.error },
  cardDue: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  cardActions: { flexDirection: 'row', gap: 10 },
  smsBtn: { flex: 1, backgroundColor: COLORS.primary, borderRadius: 8, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  waBtn: { flex: 1, backgroundColor: '#16A34A', borderRadius: 8, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  actionBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 80 },
  emptyText: { color: COLORS.textSecondary, fontSize: 16, marginTop: 12 },
  sendAllBtn: { backgroundColor: COLORS.error, margin: 16, borderRadius: 8, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  sendAllText: { color: '#FFFFFF', fontSize: 15, fontWeight: 'bold' },
});