import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Alert, RefreshControl, ScrollView,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { collection, getDocs, query, where, updateDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getUserSession } from '@/lib/storage';
import { initiatePayment } from '@/lib/razorpay';
import { COLORS } from '@/lib/theme';
import { Student, FeeRecord } from '@/lib/types';

export default function ParentFeesScreen() {
  const [schoolId, setSchoolId] = useState('school_001');
  const [children, setChildren] = useState<Student[]>([]);
  const [selectedChild, setSelectedChild] = useState<Student | null>(null);
  const [fees, setFees] = useState<FeeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'due' | 'paid'>('all');
  const [parentPhone, setParentPhone] = useState('');

  useEffect(() => { initScreen(); }, []);
  useEffect(() => { if (selectedChild) loadFees(selectedChild.id); }, [selectedChild]);

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
      if (kids.length > 0) setSelectedChild(kids[0]);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function loadFees(studentId: string) {
    setLoading(true);
    try {
      const snap = await getDocs(query(
        collection(db, 'schools', schoolId, 'fees'),
        where('student_id', '==', studentId)
      ));
      const feeList = snap.docs.map(d => ({ id: d.id, ...d.data() } as FeeRecord));
      feeList.sort((a, b) => {
        if (a.status !== 'paid' && b.status === 'paid') return -1;
        if (a.status === 'paid' && b.status !== 'paid') return 1;
        return new Date(b.due_date).getTime() - new Date(a.due_date).getTime();
      });
      setFees(feeList);
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  }

  async function handlePay(fee: FeeRecord) {
    if (!selectedChild) return;
    setPayingId(fee.id);
    try {
      const result = await initiatePayment(
        fee.amount,
        selectedChild.name,
        parentPhone,
        `${fee.fee_type} fee — ${selectedChild.name}`
      );
      if (result.success) {
        await updateDoc(doc(db, 'schools', schoolId, 'fees', fee.id), {
          status: 'paid',
          amount_paid: fee.amount,
          payment_method: 'razorpay',
          paid_date: new Date().toISOString().split('T')[0],
          transaction_id: result.payment_id,
        });
        await loadFees(selectedChild.id);
        Alert.alert('Payment Successful!', `₹${fee.amount} paid for ${fee.fee_type}.`);
      } else {
        Alert.alert('Payment Failed', result.error ?? 'Please try again.');
      }
    } catch (e) {
      Alert.alert('Error', 'Payment failed. Please try again.');
    } finally {
      setPayingId(null);
    }
  }

  function getSummary() {
    const paid = fees.filter(f => f.status === 'paid').reduce((s, f) => s + (f.amount_paid ?? f.amount), 0);
    const due = fees.filter(f => f.status !== 'paid').reduce((s, f) => s + f.amount, 0);
    return { paid, due };
  }

  function getFiltered() {
    if (activeTab === 'due') return fees.filter(f => f.status !== 'paid');
    if (activeTab === 'paid') return fees.filter(f => f.status === 'paid');
    return fees;
  }

  function getStatusColor(status: string) {
    if (status === 'paid') return COLORS.success;
    if (status === 'overdue') return COLORS.error;
    return COLORS.warning;
  }

  const summary = getSummary();
  const filtered = getFiltered();
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    if (selectedChild) loadFees(selectedChild.id);
  }, [selectedChild]);

  function renderFeeCard({ item }: { item: FeeRecord }) {
    const isPaid = item.status === 'paid';
    return (
      <View style={styles.feeCard}>
        <View style={styles.feeCardTop}>
          <View style={styles.feeLeft}>
            <Text style={styles.feeType}>{item.fee_type}</Text>
            <Text style={styles.feeDate}>Due: {item.due_date}</Text>
            {item.paid_date && <Text style={styles.feePaidDate}>Paid: {item.paid_date}</Text>}
            {item.payment_method && (
              <Text style={styles.feeMethod}>via {item.payment_method}</Text>
            )}
          </View>
          <View style={styles.feeRight}>
            <Text style={[styles.feeAmount, { color: isPaid ? COLORS.success : COLORS.error }]}>
              ₹{item.amount}
            </Text>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '18' }]}>
              <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
                {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
              </Text>
            </View>
          </View>
        </View>

        {!isPaid && (
          <TouchableOpacity
            style={[styles.payBtn, payingId === item.id && { opacity: 0.6 }]}
            onPress={() => handlePay(item)}
            disabled={payingId === item.id}
            activeOpacity={0.8}
          >
            {payingId === item.id ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <MaterialCommunityIcons name="credit-card" size={16} color="#FFFFFF" />
                <Text style={styles.payBtnText}>Pay ₹{item.amount} Online</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {isPaid && item.transaction_id && (
          <Text style={styles.transactionId}>TXN: {item.transaction_id}</Text>
        )}
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Fee Payments</Text>
        {selectedChild && (
          <Text style={styles.headerSub}>{selectedChild.name}</Text>
        )}
      </View>

      {children.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.childSelector} contentContainerStyle={{ paddingHorizontal: 16, gap: 8, alignItems: 'center', paddingVertical: 8 }}>
          {children.map(c => (
            <TouchableOpacity key={c.id} style={[styles.chip, selectedChild?.id === c.id && styles.chipActive]} onPress={() => setSelectedChild(c)}>
              <Text style={[styles.chipText, selectedChild?.id === c.id && styles.chipTextActive]}>{c.name.split(' ')[0]}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {loading ? (
        <View style={styles.centered}><ActivityIndicator color={COLORS.primary} size="large" /></View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          renderItem={renderFeeCard}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
          ListHeaderComponent={
            <View>
              {/* Summary */}
              <View style={styles.summaryRow}>
                <View style={[styles.summaryBox, { borderColor: COLORS.success + '40' }]}>
                  <MaterialCommunityIcons name="check-circle" size={22} color={COLORS.success} />
                  <Text style={[styles.summaryAmt, { color: COLORS.success }]}>₹{summary.paid}</Text>
                  <Text style={styles.summaryLabel}>Paid</Text>
                </View>
                <View style={[styles.summaryBox, { borderColor: COLORS.error + '40' }]}>
                  <MaterialCommunityIcons name="alert-circle" size={22} color={COLORS.error} />
                  <Text style={[styles.summaryAmt, { color: COLORS.error }]}>₹{summary.due}</Text>
                  <Text style={styles.summaryLabel}>Pending</Text>
                </View>
              </View>

              {/* Tabs */}
              <View style={styles.tabs}>
                {(['all', 'due', 'paid'] as const).map(tab => (
                  <TouchableOpacity
                    key={tab}
                    style={[styles.tabBtn, activeTab === tab && styles.tabBtnActive]}
                    onPress={() => setActiveTab(tab)}
                  >
                    <Text style={[styles.tabBtnText, activeTab === tab && styles.tabBtnTextActive]}>
                      {tab === 'all' ? 'All' : tab === 'due' ? 'Pending' : 'Paid'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="cash-off" size={48} color={COLORS.textSecondary} />
              <Text style={styles.emptyText}>No fee records found</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  header: { backgroundColor: COLORS.primary, paddingTop: 52, paddingBottom: 16, paddingHorizontal: 16 },
  headerTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: 'bold' },
  headerSub: { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 4 },
  childSelector: { backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: COLORS.border },
  chip: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  chipTextActive: { color: '#FFFFFF' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  summaryRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  summaryBox: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 1.5, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3 },
  summaryAmt: { fontSize: 22, fontWeight: 'bold', marginTop: 6 },
  summaryLabel: { fontSize: 12, color: COLORS.textSecondary, marginTop: 3 },
  tabs: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderRadius: 10, padding: 4, marginBottom: 12, elevation: 1 },
  tabBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  tabBtnActive: { backgroundColor: COLORS.primary },
  tabBtnText: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  tabBtnTextActive: { color: '#FFFFFF' },
  feeCard: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14, marginBottom: 10, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3 },
  feeCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  feeLeft: { flex: 1 },
  feeType: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  feeDate: { fontSize: 12, color: COLORS.textSecondary, marginTop: 3 },
  feePaidDate: { fontSize: 12, color: COLORS.success, marginTop: 2 },
  feeMethod: { fontSize: 11, color: COLORS.textSecondary, marginTop: 1 },
  feeRight: { alignItems: 'flex-end', gap: 6 },
  feeAmount: { fontSize: 22, fontWeight: 'bold' },
  statusBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontSize: 11, fontWeight: '700' },
  payBtn: { backgroundColor: COLORS.primary, borderRadius: 8, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 10 },
  payBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  transactionId: { fontSize: 11, color: COLORS.textSecondary, marginTop: 8 },
  emptyContainer: { alignItems: 'center', paddingTop: 60 },
  emptyText: { color: COLORS.textSecondary, fontSize: 15, marginTop: 12 },
});