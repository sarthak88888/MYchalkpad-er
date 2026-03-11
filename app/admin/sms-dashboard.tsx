import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, FlatList, RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { collection, getDocs, query, orderBy, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getUserSession } from '@/lib/storage';
import { COLORS } from '@/lib/theme';
import { SMSLog } from '@/lib/types';

interface LanguageBreakdown {
  en: number; hi: number; pa: number; kangri: number; haryanvi: number;
}

export default function SMSDashboardScreen() {
  const [logs, setLogs] = useState<SMSLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [schoolId, setSchoolId] = useState('school_001');
  const [stats, setStats] = useState({ total: 0, thisMonth: 0, delivered: 0, failed: 0 });
  const [langBreakdown, setLangBreakdown] = useState<LanguageBreakdown>({ en: 0, hi: 0, pa: 0, kangri: 0, haryanvi: 0 });
  const [channelBreakdown, setChannelBreakdown] = useState({ sms: 0, whatsapp: 0, both: 0 });

  useEffect(() => { initScreen(); }, []);

  async function initScreen() {
    const session = await getUserSession();
    setSchoolId(session.schoolId);
    await fetchLogs(session.schoolId);
  }

  async function fetchLogs(sid: string) {
    try {
      const snap = await getDocs(
        query(collection(db, 'schools', sid, 'sms_logs'), orderBy('sent_at', 'desc'))
      );
      const allLogs = snap.docs.map(d => ({ id: d.id, ...d.data() } as SMSLog));
      setLogs(allLogs);

      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const monthLogs = allLogs.filter(l => l.sent_at >= monthStart);

      setStats({
        total: allLogs.length,
        thisMonth: monthLogs.length,
        delivered: allLogs.filter(l => l.status === 'sent').length,
        failed: allLogs.filter(l => l.status === 'failed').length,
      });

      const lb: LanguageBreakdown = { en: 0, hi: 0, pa: 0, kangri: 0, haryanvi: 0 };
      allLogs.forEach(l => { if (l.language in lb) lb[l.language as keyof LanguageBreakdown]++; });
      setLangBreakdown(lb);

      const cb = { sms: 0, whatsapp: 0, both: 0 };
      allLogs.forEach(l => { if (l.channel in cb) cb[l.channel as keyof typeof cb]++; });
      setChannelBreakdown(cb);
    } catch (e) {
      console.error('Fetch SMS logs error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  const onRefresh = useCallback(() => { setRefreshing(true); fetchLogs(schoolId); }, [schoolId]);

  const deliveryRate = stats.total > 0 ? Math.round((stats.delivered / stats.total) * 100) : 0;
  const totalChannel = channelBreakdown.sms + channelBreakdown.whatsapp + channelBreakdown.both;

  const LANG_LABELS: Record<string, string> = { en: 'English', hi: 'Hindi', pa: 'Punjabi', kangri: 'Kangri', haryanvi: 'Haryanvi' };
  const LANG_COLORS: Record<string, string> = { en: '#3B82F6', hi: '#F59E0B', pa: '#10B981', kangri: '#8B5CF6', haryanvi: '#EF4444' };

  function renderLogItem({ item }: { item: SMSLog }) {
    return (
      <View style={styles.logCard}>
        <View style={styles.logLeft}>
          <MaterialCommunityIcons
            name={item.channel === 'whatsapp' ? 'whatsapp' : 'message-text'}
            size={18}
            color={item.channel === 'whatsapp' ? '#16A34A' : COLORS.primary}
          />
          <View style={styles.logInfo}>
            <Text style={styles.logRecipient}>{item.recipient_name} ({item.recipient_phone})</Text>
            <Text style={styles.logMessage} numberOfLines={1}>{item.message}</Text>
            <Text style={styles.logDate}>{item.sent_at?.split('T')[0]} • {LANG_LABELS[item.language] ?? item.language}</Text>
          </View>
        </View>
        <View style={[
          styles.logStatus,
          { backgroundColor: item.status === 'sent' ? COLORS.success + '18' : COLORS.error + '18' }
        ]}>
          <Text style={[styles.logStatusText, { color: item.status === 'sent' ? COLORS.success : COLORS.error }]}>
            {item.status === 'sent' ? 'Sent' : 'Failed'}
          </Text>
        </View>
      </View>
    );
  }

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator color={COLORS.primary} size="large" /></View>;
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>SMS Dashboard</Text>
      </View>

      <FlatList
        data={logs.slice(0, 50)}
        keyExtractor={item => item.id}
        renderItem={renderLogItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
        ListHeaderComponent={
          <View style={styles.headerContent}>
            {/* Stats Row */}
            <View style={styles.statsGrid}>
              {[
                { label: 'Total Sent', value: stats.total, color: COLORS.primary, icon: 'message-text' },
                { label: 'This Month', value: stats.thisMonth, color: '#3B82F6', icon: 'calendar-month' },
                { label: 'Delivered', value: stats.delivered, color: COLORS.success, icon: 'check-circle' },
                { label: 'Failed', value: stats.failed, color: COLORS.error, icon: 'close-circle' },
              ].map((s, i) => (
                <View key={i} style={styles.statCard}>
                  <MaterialCommunityIcons name={s.icon as any} size={22} color={s.color} />
                  <Text style={[styles.statVal, { color: s.color }]}>{s.value}</Text>
                  <Text style={styles.statLbl}>{s.label}</Text>
                </View>
              ))}
            </View>

            {/* Delivery Rate */}
            <View style={styles.rateCard}>
              <View style={styles.rateTop}>
                <Text style={styles.rateLabel}>Delivery Rate</Text>
                <Text style={styles.rateVal}>{deliveryRate}%</Text>
              </View>
              <View style={styles.rateBar}>
                <View style={[styles.rateBarFill, { width: `${deliveryRate}%`, backgroundColor: deliveryRate >= 90 ? COLORS.success : deliveryRate >= 70 ? COLORS.warning : COLORS.error }]} />
              </View>
            </View>

            {/* Language Breakdown */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionLabel}>LANGUAGE BREAKDOWN</Text>
              {Object.entries(langBreakdown).map(([lang, count]) => {
                const total = stats.total || 1;
                const pct = Math.round((count / total) * 100);
                return (
                  <View key={lang} style={styles.langRow}>
                    <Text style={styles.langName}>{LANG_LABELS[lang]}</Text>
                    <View style={styles.langBarContainer}>
                      <View style={[styles.langBarFill, { width: `${pct}%`, backgroundColor: LANG_COLORS[lang] }]} />
                    </View>
                    <Text style={styles.langCount}>{count}</Text>
                  </View>
                );
              })}
            </View>

            {/* Channel Breakdown */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionLabel}>CHANNEL BREAKDOWN</Text>
              <View style={styles.channelRow}>
                {[
                  { label: 'SMS', value: channelBreakdown.sms, color: COLORS.primary, icon: 'message-text' },
                  { label: 'WhatsApp', value: channelBreakdown.whatsapp, color: '#16A34A', icon: 'whatsapp' },
                  { label: 'Both', value: channelBreakdown.both, color: COLORS.accent, icon: 'message-fast' },
                ].map((c, i) => (
                  <View key={i} style={[styles.channelCard, { borderColor: c.color + '40' }]}>
                    <MaterialCommunityIcons name={c.icon as any} size={24} color={c.color} />
                    <Text style={[styles.channelVal, { color: c.color }]}>{c.value}</Text>
                    <Text style={styles.channelLbl}>{c.label}</Text>
                    <Text style={styles.channelPct}>
                      {totalChannel > 0 ? Math.round((c.value / totalChannel) * 100) : 0}%
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Send Bulk SMS Button */}
            <TouchableOpacity
              style={styles.bulkSmsBtn}
              onPress={() => router.push('/admin/bulk-sms')}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="message-fast" size={20} color="#FFFFFF" />
              <Text style={styles.bulkSmsBtnText}>Send Bulk SMS / WhatsApp</Text>
            </TouchableOpacity>

            <Text style={styles.recentLabel}>RECENT MESSAGES</Text>
          </View>
        }
        contentContainerStyle={{ paddingBottom: 40 }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="message-off" size={40} color={COLORS.textSecondary} />
            <Text style={styles.emptyText}>No messages sent yet</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  header: { backgroundColor: COLORS.primary, paddingTop: 52, paddingBottom: 16, paddingHorizontal: 16 },
  headerTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: 'bold' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerContent: { padding: 16 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  statCard: { width: '47%', backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14, alignItems: 'center', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3 },
  statVal: { fontSize: 22, fontWeight: 'bold', marginTop: 6 },
  statLbl: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  rateCard: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, marginBottom: 12, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3 },
  rateTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  rateLabel: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary },
  rateVal: { fontSize: 22, fontWeight: 'bold', color: COLORS.primary },
  rateBar: { height: 10, backgroundColor: COLORS.border, borderRadius: 5, overflow: 'hidden' },
  rateBarFill: { height: '100%', borderRadius: 5 },
  sectionCard: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, marginBottom: 12, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary, letterSpacing: 0.8, marginBottom: 12, textTransform: 'uppercase' },
  langRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  langName: { width: 70, fontSize: 13, color: COLORS.textSecondary },
  langBarContainer: { flex: 1, height: 8, backgroundColor: COLORS.border, borderRadius: 4, overflow: 'hidden', marginHorizontal: 10 },
  langBarFill: { height: '100%', borderRadius: 4 },
  langCount: { width: 30, fontSize: 13, fontWeight: '600', color: COLORS.textPrimary, textAlign: 'right' },
  channelRow: { flexDirection: 'row', gap: 10 },
  channelCard: { flex: 1, borderWidth: 1.5, borderRadius: 10, padding: 12, alignItems: 'center', gap: 4 },
  channelVal: { fontSize: 20, fontWeight: 'bold' },
  channelLbl: { fontSize: 12, color: COLORS.textSecondary },
  channelPct: { fontSize: 11, color: COLORS.textSecondary },
  bulkSmsBtn: { backgroundColor: COLORS.accent, borderRadius: 8, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 20 },
  bulkSmsBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: 'bold' },
  recentLabel: { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary, letterSpacing: 1, marginBottom: 10, textTransform: 'uppercase' },
  logCard: { backgroundColor: '#FFFFFF', borderRadius: 10, padding: 12, marginHorizontal: 16, marginBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 2 },
  logLeft: { flexDirection: 'row', alignItems: 'flex-start', flex: 1, gap: 10 },
  logInfo: { flex: 1 },
  logRecipient: { fontSize: 13, fontWeight: '600', color: COLORS.textPrimary },
  logMessage: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  logDate: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  logStatus: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  logStatusText: { fontSize: 11, fontWeight: '700' },
  emptyContainer: { alignItems: 'center', paddingTop: 40 },
  emptyText: { color: COLORS.textSecondary, fontSize: 15, marginTop: 8 },
});