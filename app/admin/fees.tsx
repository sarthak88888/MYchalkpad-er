import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Modal, ScrollView, Alert, RefreshControl,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  collection, getDocs, addDoc, updateDoc, doc,
  query, orderBy,
} from 'firebase/firestore';
import QRCode from 'react-native-qrcode-svg';
import { db } from '@/lib/firebase';
import { getUserSession } from '@/lib/storage';
import { initiatePayment } from '@/lib/razorpay';
import { COLORS } from '@/lib/theme';
import { FeeRecord } from '@/lib/types';

type FeeFilter = 'all' | 'paid' | 'due' | 'overdue';

export default function FeesScreen() {
  const [fees, setFees] = useState<FeeRecord[]>([]);
  const [filtered, setFiltered] = useState<FeeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [schoolId, setSchoolId] = useState('school_001');
  const [activeFilter, setActiveFilter] = useState<FeeFilter>('all');
  const [selectedFee, setSelectedFee] = useState<FeeRecord | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);

  useEffect(() => { initScreen(); }, []);
  useEffect(() => { applyFilter(); }, [fees, activeFilter]);

  async function initScreen() {
    const session = await getUserSession();
    setSchoolId(session.schoolId);
    await fetchFees(session.schoolId);
  }

  async function fetchFees(sid: string) {
    try {
      const snap = await getDocs(
        query(collection(db, 'schools', sid, 'fees'), orderBy('due_date', 'desc'))
      );
      setFees(snap.docs.map(d => ({ id: d.id, ...d.data() } as FeeRecord)));
    } catch (e) {
      console.error('Fetch fees error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function applyFilter() {
    if (activeFilter === 'all') setFiltered(fees);
    else setFiltered(fees.filter(f => f.status === activeFilter));
  }

  function getSummary() {
    const collected = fees.filter(f => f.status === 'paid').reduce((sum, f) => sum + (f.amount_paid ?? 0), 0);
    const pending = fees.filter(f => f.status !== 'paid').reduce((sum, f) => sum + (f.amount ?? 0), 0);
    return { collected, pending };
  }

  async function handleMarkPaid(fee: FeeRecord) {
    Alert.alert('Mark as Paid', `Mark ₹${fee.amount} fee for ${fee.student_name} as paid (Cash)?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Mark Paid',
        onPress: async () => {
          try {
            await updateDoc(doc(db, 'schools', schoolId, 'fees', fee.id), {
              status: 'paid',
              amount_paid: fee.amount,
              payment_method: 'cash',
              paid_date: new Date().toISOString().split('T')[0],
            });
            setShowDetailModal(false);
            await fetchFees(schoolId);
          } catch (e) {
            Alert.alert('Error', 'Failed to update fee status.');
          }
        },
      },
    ]);
  }

  async function handleRazorpay(fee: FeeRecord) {
    setPayingId(fee.id);
    try {
      const result = await initiatePayment(
        fee.amount,
        fee.student_name,
        fee.parent_phone,
        `Fee payment for ${fee.student_name} - ${fee.fee_type}`
      );
      if (result.success) {
        await updateDoc(doc(db, 'schools', schoolId, 'fees', fee.id), {
          status: 'paid',
          amount_paid: fee.amount,
          payment_method: 'razorpay',
          paid_date: new Date().toISOString().split('T')[0],
          transaction_id: result.payment_id,
        });
        setShowDetailModal(false);
        await fetchFees(schoolId);
        Alert.alert('Success', `Payment of ₹${fee.amount} received successfully.`);
      } else {
        Alert.alert('Payment Failed', result.error ?? 'Payment was not completed.');
      }
    } catch (e) {
      Alert.alert('Error', 'Payment process failed.');
    } finally {
      setPayingId(null);
    }
  }

  function getStatusColor(status: string) {
    if (status === 'paid') return COLORS.success;
    if (status === 'overdue') return COLORS.error;
    return COLORS.warning;
  }

  const summary = getSummary();
  const onRefresh = useCallback(() => { setRefreshing(true); fetchFees(schoolId); }, [schoolId]);

  const FILTERS: { key: FeeFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'paid', label: 'Paid' },
    { key: 'due', label: 'Due' },
    { key: 'overdue', label: 'Overdue' },
  ];

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
            <Text style={styles.cardAmount}>₹{item.amount}</Text>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '18' }]}>
              <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
                {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  const upiLink = selectedFee
    ? `upi://pay?pa=school@upi&pn=MyChalkPad&am=${selectedFee.amount}&cu=INR&tn=Fee-${selectedFee.student_name}`
    : '';

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Fee Management</Text>
      </View>

      {/* Summary Banner */}
      <View style={styles.summaryBanner}>
        <View style={styles.summaryItem}>
          <MaterialCommunityIcons name="check-circle" size={20} color={COLORS.success} />
          <Text style={styles.summaryAmount}>₹{summary.collected.toLocaleString()}</Text>
          <Text style={styles.summaryLabel}>Collected</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <MaterialCommunityIcons name="alert-circle" size={20} color={COLORS.error} />
          <Text style={[styles.summaryAmount, { color: COLORS.error }]}>₹{summary.pending.toLocaleString()}</Text>
          <Text style={styles.summaryLabel}>Pending</Text>
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.tabsRow}>
        {FILTERS.map(f => (
          <TouchableOpacity
            key={f.key}
            style={[styles.tab, activeFilter === f.key && styles.tabActive]}
            onPress={() => setActiveFilter(f.key)}
          >
            <Text style={[styles.tabText, activeFilter === f.key && styles.tabTextActive]}>{f.label}</Text>
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

      {/* Fee Detail Modal */}
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
              {/* Info Card */}
              <View style={styles.detailCard}>
                <Text style={styles.detailName}>{selectedFee.student_name}</Text>
                <Text style={styles.detailMeta}>Class {selectedFee.class}-{selectedFee.section}</Text>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(selectedFee.status) + '18', alignSelf: 'flex-start', marginTop: 8 }]}>
                  <Text style={[styles.statusText, { color: getStatusColor(selectedFee.status) }]}>
                    {selectedFee.status.charAt(0).toUpperCase() + selectedFee.status.slice(1)}
                  </Text>
                </View>
              </View>

              {[
                { label: 'Fee Type', value: selectedFee.fee_type },
                { label: 'Amount', value: `₹${selectedFee.amount}` },
                { label: 'Due Date', value: selectedFee.due_date },
                { label: 'Academic Year', value: selectedFee.academic_year },
                { label: 'Parent Phone', value: selectedFee.parent_phone },
                ...(selectedFee.paid_date ? [{ label: 'Paid Date', value: selectedFee.paid_date }] : []),
                ...(selectedFee.payment_method ? [{ label: 'Payment Method', value: selectedFee.payment_method }] : []),
                ...(selectedFee.transaction_id ? [{ label: 'Transaction ID', value: selectedFee.transaction_id }] : []),
              ].map((row, i) => (
                <View key={i} style={styles.infoRow}>
                  <Text style={styles.infoLabel}>{row.label}</Text>
                  <Text style={styles.infoValue}>{row.value}</Text>
                </View>
              ))}

              {selectedFee.status !== 'paid' && (
                <>
                  {/* UPI QR Code */}
                  <TouchableOpacity
                    style={styles.qrButton}
                    onPress={() => setShowQRModal(true)}
                    activeOpacity={0.8}
                  >
                    <MaterialCommunityIcons name="qrcode" size={20} color={COLORS.primary} />
                    <Text style={styles.qrButtonText}>Show UPI QR Code</Text>
                  </TouchableOpacity>

                  {/* Mark as Paid Cash */}
                  <TouchableOpacity
                    style={styles.paidCashBtn}
                    onPress={() => handleMarkPaid(selectedFee)}
                    activeOpacity={0.8}
                  >
                    <MaterialCommunityIcons name="cash" size={20} color="#FFFFFF" />
                    <Text style={styles.actionBtnText}>Mark as Paid (Cash)</Text>
                  </TouchableOpacity>

                  {/* Razorpay */}
                  <TouchableOpacity
                    style={[styles.razorpayBtn, payingId === selectedFee.id && { opacity: 0.6 }]}
                    onPress={() => handleRazorpay(selectedFee)}
                    disabled={payingId === selectedFee.id}
                    activeOpacity={0.8}
                  >
                    {payingId === selectedFee.id ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <>
                        <MaterialCommunityIcons name="credit-card" size={20} color="#FFFFFF" />
                        <Text style={styles.actionBtnText}>Pay Online (Razorpay)</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </>
              )}
              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        )}
      </Modal>

      {/* QR Code Modal */}
      <Modal visible={showQRModal} transparent animationType="fade" onRequestClose={() => setShowQRModal(false)}>
        <View style={styles.overlayCenter}>
          <View style={styles.qrModalCard}>
            <Text style={styles.qrModalTitle}>Scan to Pay via UPI</Text>
            {selectedFee && (
              <>
                <Text style={styles.qrModalAmount}>₹{selectedFee.amount}</Text>
                <Text style={styles.qrModalName}>{selectedFee.student_name}</Text>
                <View style={styles.qrContainer}>
                  <QRCode value={upiLink} size={200} color={COLORS.primary} />
                </View>
              </>
            )}
            <TouchableOpacity style={styles.closeQrBtn} onPress={() => setShowQRModal(false)}>
              <Text style={styles.closeQrText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  header: {
    backgroundColor: COLORS.primary, paddingTop: 52,
    paddingBottom: 16, paddingHorizontal: 16,
  },
  headerTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: 'bold' },
  summaryBanner: {
    backgroundColor: '#FFFFFF', flexDirection: 'row',
    paddingVertical: 16, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  summaryItem: { flex: 1, alignItems: 'center', gap: 4 },
  summaryDivider: { width: 1, backgroundColor: COLORS.border },
  summaryAmount: { fontSize: 22, fontWeight: 'bold', color: COLORS.textPrimary },
  summaryLabel: { fontSize: 12, color: COLORS.textSecondary },
  tabsRow: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: COLORS.border },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: COLORS.accent },
  tabText: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '500' },
  tabTextActive: { color: COLORS.accent, fontWeight: '700' },
  listContent: { padding: 16, paddingBottom: 40 },
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
  cardRight: { alignItems: 'flex-end', gap: 6 },
  cardAmount: { fontSize: 18, fontWeight: 'bold', color: COLORS.textPrimary },
  statusBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { fontSize: 12, fontWeight: '700' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 80 },
  emptyText: { color: COLORS.textSecondary, fontSize: 16, marginTop: 12 },
  modalHeader: {
    backgroundColor: COLORS.primary, paddingTop: 52, paddingBottom: 16,
    paddingHorizontal: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  modalHeaderTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
  detailCard: {
    backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, marginBottom: 12,
    elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 3,
  },
  detailName: { fontSize: 20, fontWeight: 'bold', color: COLORS.textPrimary },
  detailMeta: { fontSize: 14, color: COLORS.textSecondary, marginTop: 4 },
  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border,
    backgroundColor: '#FFFFFF', paddingHorizontal: 16,
  },
  infoLabel: { fontSize: 14, color: COLORS.textSecondary },
  infoValue: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary },
  qrButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, borderWidth: 1.5, borderColor: COLORS.primary,
    borderRadius: 8, paddingVertical: 12, marginTop: 16,
  },
  qrButtonText: { color: COLORS.primary, fontSize: 15, fontWeight: '600' },
  paidCashBtn: {
    backgroundColor: COLORS.success, borderRadius: 8, paddingVertical: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, marginTop: 12,
  },
  razorpayBtn: {
    backgroundColor: COLORS.primary, borderRadius: 8, paddingVertical: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, marginTop: 12,
  },
  actionBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  overlayCenter: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  qrModalCard: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 24,
    alignItems: 'center', width: '100%',
  },
  qrModalTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.textPrimary, marginBottom: 4 },
  qrModalAmount: { fontSize: 32, fontWeight: 'bold', color: COLORS.primary, marginTop: 8 },
  qrModalName: { fontSize: 15, color: COLORS.textSecondary, marginBottom: 16 },
  qrContainer: { padding: 16, backgroundColor: '#FFFFFF', borderRadius: 12, elevation: 2 },
  closeQrBtn: {
    marginTop: 20, backgroundColor: COLORS.primary, borderRadius: 8,
    paddingVertical: 12, paddingHorizontal: 40,
  },
  closeQrText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
});