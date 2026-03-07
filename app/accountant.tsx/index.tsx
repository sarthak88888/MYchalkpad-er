import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getUserSession, clearUserSession } from '@/lib/storage';
import { signOut } from '@/lib/firebase';
import { COLORS } from '@/lib/theme';
import { FeeRecord } from '@/lib/types';

interface MonthStat { label: string; collected: number; pending: number; }

export default function AccountantDashboard() {
  const [schoolId, setSchoolId] = useState('school_001');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [totalCollected, setTotalCollected] = useState(0);
  const [totalPending, setTotalPending] = useState(0);
  const [totalFees, setTotalFees] = useState(0);
  const [recentFees, setRecentFees] = useState<FeeRecord[]>([]);
  const [overdueCount, setOverdueCount] = useState(0);
  const [monthStats, setMonthStats] = useState<MonthStat[]>([]);
  const [accountantName, setAccountantName] = useState('Accountant');

  useEffect(() => { initScreen(); }, []);

  async function initScreen() {
    const session = await getUserSession();
    setSchoolId(session.schoolId);
    setAccountantName(session.name ?? 'Accountant');
    await loadData(session.schoolId);
  }

  async function loadData(sid: string) {
    try {
      const snap = await getDocs(collection(db, 'schools', sid, 'fees'));
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() } as FeeRecord));

      const collected = all.filter(f => f.status === 'paid').reduce((s, f) => s + (f.amount_paid ?? f.amount), 0);
      const pending = all.filter(f => f.status !== 'paid').reduce((s, f) => s + f.amount, 0);
      const overdue = all.filter(f => f.status === 'overdue').length;

      setTotalCollected(collected);
      setTotalPending(pending);
      setTotalFees(all.length);
      setOverdueCount(overdue);

      // Recent 5 paid fees
      const recent = all
        .filter(f => f.status === 'paid' && f.paid_date)
        .sort((a, b) => new Date(b.paid_date!).getTime() - new Date(a.paid_date!).getTime())
        .slice(0, 5);
      setRecentFees(recent);

      // 6-month stats
      const now = new Date();
      const stats: MonthStat[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const monthLabel = d.toLocaleString('default', { month: 'short' });
        const monthPaid = all
          .filter(f => f.status === 'paid' && f.paid_date?.startsWith(month))
          .reduce((s, f) => s + (f.amount_paid ?? f.amount), 0);
        const monthPending = all
          .filter(f => f.status !== 'paid' && f.due_date?.startsWith(month))
          .reduce((s, f) => s + f.amount, 0);
        stats.push({ label: monthLabel, collected: monthPaid, pending: monthPending });
      }
      setMonthStats(stats);
    } catch (e) {
      console.error('Load accountant data error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  const onRefresh = useCallback(() => { setRefreshing(true); loadData(schoolId); }, [schoolId]);

  async function handleLogout() {
    Alert.alert('Logout', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout', style: 'destructive',
        onPress: async () => { await signOut(); await clearUserSession(); router.replace('/'); },
      },
    ]);
  }

  const collectionRate = (totalCollected + totalPending) > 0
    ? Math.round((totalCollected / (totalCollected + totalPending)) * 100)
    : 0;

  const maxMonthVal = Math.max(...monthStats.map(m => m.collected + m.pending), 1);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.greeting}>Finance Dashboard</Text>
            <Text style={styles.accountantName}>{accountantName}</Text>
          </View>
          <TouchableOpacity onPress={handleLogout} style={{ padding: 4 }}>
            <MaterialCommunityIcons name="logout" size={22} color="rgba(255,255,255,0.8)" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.centered}><ActivityIndicator color={COLORS.primary} size="large" /></View>
        ) : (
          <>
            {/* Collection Rate Card */}
            <View style={styles.rateCard}>
              <View>
                <Text style={styles.rateLabel}>Collection Rate</Text>
                <Text style={styles.rateValue}>{collectionRate}%</Text>
                <Text style={styles.rateSub}>{totalFees} fee records total</Text>
              </View>
              <View style={styles.rateRight}>
                <View style={[styles.rateCircle, { borderColor: collectionRate >= 80 ? COLORS.success : collectionRate >= 60 ? COLORS.warning : COLORS.error }]}>
                  <Text style={[styles.rateCircleText, { color: collectionRate >= 80 ? COLORS.success : collectionRate >= 60 ? COLORS.warning : COLORS.error }]}>
                    {collectionRate}%
                  </Text>
                </View>
              </View>
            </View>

            {/* Summary Cards */}
            <View style={styles.summaryRow}>
              <View style={[styles.summaryCard, { borderTopColor: COLORS.success }]}>
                <MaterialCommunityIcons name="check-circle" size={20} color={COLORS.success} />
                <Text style={[styles.summaryAmt, { color: COLORS.success }]}>₹{totalCollected.toLocaleString()}</Text>
                <Text style={styles.summaryLabel}>Collected</Text>
              </View>
              <View style={[styles.summaryCard, { borderTopColor: COLORS.error }]}>
                <MaterialCommunityIcons name="alert-circle" size={20} color={COLORS.error} />
                <Text style={[styles.summaryAmt, { color: COLORS.error }]}>₹{totalPending.toLocaleString()}</Text>
                <Text style={styles.summaryLabel}>Pending</Text>
              </View>
              <View style={[styles.summaryCard, { borderTopColor: COLORS.warning }]}>
                <MaterialCommunityIcons name="clock-alert" size={20} color={COLORS.warning} />
                <Text style={[styles.summaryAmt, { color: COLORS.warning }]}>{overdueCount}</Text>
                <Text style={styles.summaryLabel}>Overdue</Text>
              </View>
            </View>

            {/* 6-Month Bar Chart */}
            <View style={styles.chartCard}>
              <Text style={styles.chartTitle}>Fee Collection — Last 6 Months</Text>
              <View style={styles.barChart}>
                {monthStats.map((m, i) => {
                  const collectedH = m.collected === 0 ? 0 : Math.max(4, (m.collected / maxMonthVal) * 90);
                  const pendingH = m.pending === 0 ? 0 : Math.max(4, (m.pending / maxMonthVal) * 90);
                  return (
                    <View key={i} style={styles.barGroup}>
                      <View style={styles.barPair}>
                        <View style={[styles.bar, { height: collectedH, backgroundColor: COLORS.success }]} />
                        <View style={[styles.bar, { height: pendingH, backgroundColor: COLORS.error + 'AA' }]} />
                      </View>
                      <Text style={styles.barLabel}>{m.label}</Text>
                    </View>
                  );
                })}
              </View>
              <View style={styles.chartLegend}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: COLORS.success }]} />
                  <Text style={styles.legendLabel}>Collected</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: COLORS.error + 'AA' }]} />
                  <Text style={styles.legendLabel}>Pending</Text>
                </View>
              </View>
            </View>

            {/* Quick Actions */}
            <Text style={styles.sectionLabel}>QUICK ACTIONS</Text>
            <View style={styles.actionsRow}>
              {[
                { title: 'Manage Fees', icon: 'cash-multiple', color: '#3B82F6', route: '/accountant/fees' },
                { title: 'Reports', icon: 'chart-bar', color: '#8B5CF6', route: '/accountant/reports' },
                { title: 'Fee Defaulters', icon: 'account-alert', color: COLORS.error, route: '/admin/fee-defaulters' },
                { title: 'Export Data', icon: 'file-export', color: '#10B981', route: '/accountant/reports' },
              ].map((a, i) => (
                <TouchableOpacity key={i} style={styles.actionCard} onPress={() => router.push(a.route as any)} activeOpacity={0.8}>
                  <View style={[styles.actionIcon, { backgroundColor: a.color + '15' }]}>
                    <MaterialCommunityIcons name={a.icon as any} size={24} color={a.color} />
                  </View>
                  <Text style={styles.actionTitle}>{a.title}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Recent Payments */}
            {recentFees.length > 0 && (
              <>
                <Text style={styles.sectionLabel}>RECENT PAYMENTS</Text>
                <View style={styles.recentCard}>
                  {recentFees.map((fee, i) => (
                    <View key={fee.id} style={[styles.recentRow, i < recentFees.length - 1 && styles.recentRowBorder]}>
                      <View style={styles.recentLeft}>
                        <Text style={styles.recentName}>{fee.student_name}</Text>
                        <Text style={styles.recentType}>{fee.fee_type} • {fee.paid_date}</Text>
                      </View>
                      <View style={styles.recentRight}>
                        <Text style={styles.recentAmt}>+₹{fee.amount_paid ?? fee.amount}</Text>
                        <Text style={styles.recentMethod}>{fee.payment_method ?? 'cash'}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </>
            )}

            <View style={{ height: 20 }} />
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  header: { backgroundColor: COLORS.primary, paddingTop: 52, paddingBottom: 20, paddingHorizontal: 16 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  greeting: { color: 'rgba(255,255,255,0.7)', fontSize: 14 },
  accountantName: { color: '#FFFFFF', fontSize: 22, fontWeight: 'bold', marginTop: 2 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  rateCard: { backgroundColor: COLORS.primary, borderRadius: 16, padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  rateLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '600' },
  rateValue: { color: COLORS.accent, fontSize: 44, fontWeight: 'bold', marginTop: 4 },
  rateSub: { color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 4 },
  rateRight: {},
  rateCircle: { width: 84, height: 84, borderRadius: 42, borderWidth: 4, justifyContent: 'center', alignItems: 'center' },
  rateCircleText: { fontSize: 18, fontWeight: 'bold' },
  summaryRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  summaryCard: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 12, padding: 12, alignItems: 'center', borderTopWidth: 3, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3 },
  summaryAmt: { fontSize: 16, fontWeight: 'bold', marginTop: 6 },
  summaryLabel: { fontSize: 11, color: COLORS.textSecondary, marginTop: 3 },
  chartCard: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, marginBottom: 12, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3 },
  chartTitle: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 16 },
  barChart: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around', height: 110 },
  barGroup: { alignItems: 'center', flex: 1 },
  barPair: { flexDirection: 'row', gap: 3, alignItems: 'flex-end', height: 90 },
  bar: { width: 12, borderRadius: 4 },
  barLabel: { fontSize: 10, color: COLORS.textSecondary, marginTop: 6 },
  chartLegend: { flexDirection: 'row', justifyContent: 'center', gap: 20, marginTop: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { fontSize: 12, color: COLORS.textSecondary },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary, letterSpacing: 1, marginBottom: 10, textTransform: 'uppercase' },
  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  actionCard: { width: '47%', backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14, alignItems: 'center', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3 },
  actionIcon: { width: 50, height: 50, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  actionTitle: { fontSize: 13, fontWeight: '600', color: COLORS.textPrimary, textAlign: 'center' },
  recentCard: { backgroundColor: '#FFFFFF', borderRadius: 12, overflow: 'hidden', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3, marginBottom: 12 },
  recentRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12 },
  recentRowBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  recentLeft: {},
  recentName: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary },
  recentType: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  recentRight: { alignItems: 'flex-end' },
  recentAmt: { fontSize: 16, fontWeight: 'bold', color: COLORS.success },
  recentMethod: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2, textTransform: 'capitalize' },
});