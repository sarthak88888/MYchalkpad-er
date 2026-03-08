import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getUserSession } from '@/lib/storage';
import { COLORS } from '@/lib/theme';

interface ChecklistItem {
  id: string;
  title: string;
  description: string;
  icon: string;
  is_ready: boolean;
}

const DEFAULT_ITEMS: ChecklistItem[] = [
  { id: '1', title: 'UDISE Records Updated', description: 'All student enrollment data submitted to UDISE portal', icon: 'database-check', is_ready: false },
  { id: '2', title: 'Fee Records Complete', description: 'All fee collection records are updated and reconciled', icon: 'cash-check', is_ready: false },
  { id: '3', title: 'Attendance Registers', description: 'Physical attendance registers maintained and signed daily', icon: 'clipboard-check', is_ready: false },
  { id: '4', title: 'Staff Records Updated', description: 'All staff service books, qualifications and joining dates recorded', icon: 'badge-account', is_ready: false },
  { id: '5', title: 'Building Safety Certificate', description: 'Valid building safety and fire NOC certificates available', icon: 'shield-check', is_ready: false },
  { id: '6', title: 'Academic Calendar', description: 'Annual academic calendar displayed and followed', icon: 'calendar-check', is_ready: false },
  { id: '7', title: 'Mid-Day Meal Records', description: 'MDM attendance and menu records maintained', icon: 'food-apple', is_ready: false },
  { id: '8', title: 'Library Records', description: 'Library book inventory and issue records up to date', icon: 'bookshelf', is_ready: false },
  { id: '9', title: 'Lab Equipment Inventory', description: 'Science lab and computer lab equipment inventory completed', icon: 'flask', is_ready: false },
  { id: '10', title: 'Student Health Records', description: 'Annual health checkup records for all students available', icon: 'heart-pulse', is_ready: false },
];

export default function InspectionPrepScreen() {
  const [schoolId, setSchoolId] = useState('school_001');
  const [items, setItems] = useState<ChecklistItem[]>(DEFAULT_ITEMS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { initScreen(); }, []);

  async function initScreen() {
    const session = await getUserSession();
    if (!session) return;
    setSchoolId(session.schoolId);
    await loadChecklist(session.schoolId);
  }

  async function loadChecklist(sid: string) {
    try {
      const snap = await getDoc(doc(db, 'schools', sid, 'inspection', 'checklist'));
      if (snap.exists()) {
        const data = snap.data();
        if (data.items && Array.isArray(data.items)) {
          const merged = DEFAULT_ITEMS.map(defaultItem => {
            const saved = data.items.find((i: any) => i.id === defaultItem.id);
            return saved ? { ...defaultItem, is_ready: saved.is_ready } : defaultItem;
          });
          setItems(merged);
        }
      }
    } catch (e) {
      console.error('Load checklist error:', e);
    } finally {
      setLoading(false);
    }
  }

  async function toggleItem(itemId: string) {
    const updated = items.map(item =>
      item.id === itemId ? { ...item, is_ready: !item.is_ready } : item
    );
    setItems(updated);
    setSaving(true);
    try {
      await setDoc(
        doc(db, 'schools', schoolId, 'inspection', 'checklist'),
        {
          items: updated.map(i => ({ id: i.id, is_ready: i.is_ready })),
          updated_at: new Date().toISOString(),
          school_id: schoolId,
        },
        { merge: true }
      );
    } catch (e) {
      console.error('Save checklist error:', e);
      setItems(items);
      Alert.alert('Error', 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  function handleExport() {
    const readyCount = items.filter(i => i.is_ready).length;
    const notReady = items.filter(i => !i.is_ready).map(i => `• ${i.title}`).join('\n');
    Alert.alert(
      'Inspection Checklist',
      `Readiness: ${readyCount}/${items.length} (${Math.round((readyCount / items.length) * 100)}%)\n\n${notReady ? `Not Ready:\n${notReady}` : 'All items ready! ✅'}`,
      [{ text: 'OK' }]
    );
  }

  const readyCount = items.filter(i => i.is_ready).length;
  const readinessPercent = Math.round((readyCount / items.length) * 100);
  const progressColor = readinessPercent >= 80 ? COLORS.success : readinessPercent >= 50 ? COLORS.warning : COLORS.error;

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator color={COLORS.primary} size="large" /></View>;
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.headerTitle}>Inspection Prep</Text>
          {saving && <ActivityIndicator color="rgba(255,255,255,0.7)" size="small" />}
        </View>
        <Text style={styles.headerSubtitle}>Tap each item to mark ready/not ready</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Readiness Card */}
        <View style={styles.readinessCard}>
          <View style={styles.readinessTop}>
            <View>
              <Text style={styles.readinessLabel}>Overall Readiness</Text>
              <Text style={[styles.readinessPercent, { color: progressColor }]}>
                {readinessPercent}%
              </Text>
              <Text style={styles.readinessSubtext}>{readyCount} of {items.length} items ready</Text>
            </View>
            <View style={[styles.readinessCircle, { borderColor: progressColor }]}>
              <Text style={[styles.readinessCircleText, { color: progressColor }]}>{readinessPercent}%</Text>
            </View>
          </View>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${readinessPercent}%`, backgroundColor: progressColor }]} />
          </View>
        </View>

        {/* Checklist Items */}
        <Text style={styles.sectionLabel}>INSPECTION CHECKLIST</Text>

        {items.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={[styles.checkItem, item.is_ready && styles.checkItemReady]}
            onPress={() => toggleItem(item.id)}
            activeOpacity={0.75}
          >
            <View style={[
              styles.checkIcon,
              { backgroundColor: item.is_ready ? COLORS.success + '18' : COLORS.error + '18' }
            ]}>
              <MaterialCommunityIcons
                name={item.is_ready ? 'check-circle' : 'close-circle'}
                size={28}
                color={item.is_ready ? COLORS.success : COLORS.error}
              />
            </View>
            <View style={styles.checkContent}>
              <Text style={[styles.checkTitle, item.is_ready && styles.checkTitleReady]}>
                {item.title}
              </Text>
              <Text style={styles.checkDesc}>{item.description}</Text>
            </View>
            <MaterialCommunityIcons
              name={item.icon as any}
              size={22}
              color={item.is_ready ? COLORS.success : COLORS.textSecondary}
            />
          </TouchableOpacity>
        ))}

        {/* Export Button */}
        <TouchableOpacity
          style={styles.exportBtn}
          onPress={handleExport}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons name="file-export" size={18} color="#FFFFFF" />
          <Text style={styles.exportBtnText}>Export Checklist Report</Text>
        </TouchableOpacity>

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  header: { backgroundColor: COLORS.primary, paddingTop: 52, paddingBottom: 20, paddingHorizontal: 16 },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: 'bold' },
  headerSubtitle: { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 4 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: 16 },
  readinessCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20, marginBottom: 16, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4 },
  readinessTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  readinessLabel: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  readinessPercent: { fontSize: 44, fontWeight: 'bold', marginTop: 4 },
  readinessSubtext: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  readinessCircle: { width: 80, height: 80, borderRadius: 40, borderWidth: 4, justifyContent: 'center', alignItems: 'center' },
  readinessCircleText: { fontSize: 16, fontWeight: 'bold' },
  progressBar: { height: 8, backgroundColor: COLORS.border, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary, letterSpacing: 1, marginBottom: 10, textTransform: 'uppercase' },
  checkItem: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 12, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 2, borderLeftWidth: 4, borderLeftColor: COLORS.error },
  checkItemReady: { borderLeftColor: COLORS.success },
  checkIcon: { width: 48, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  checkContent: { flex: 1 },
  checkTitle: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary },
  checkTitleReady: { color: COLORS.success },
  checkDesc: { fontSize: 12, color: COLORS.textSecondary, marginTop: 3, lineHeight: 16 },
  exportBtn: { backgroundColor: COLORS.primary, borderRadius: 8, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 8 },
  exportBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: 'bold' },
});