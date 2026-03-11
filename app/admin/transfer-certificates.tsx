import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, ActivityIndicator, Modal, ScrollView,
  Alert, RefreshControl, KeyboardAvoidingView, Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  collection, getDocs, addDoc, updateDoc, doc,
  query, orderBy, where,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getUserSession } from '@/lib/storage';
import { COLORS } from '@/lib/theme';
import { TransferCertificate, Student } from '@/lib/types';

export default function TransferCertificatesScreen() {
  const [certificates, setCertificates] = useState<TransferCertificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [schoolId, setSchoolId] = useState('school_001');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedTC, setSelectedTC] = useState<TransferCertificate | null>(null);
  const [saving, setSaving] = useState(false);
  const [searching, setSearching] = useState(false);

  const [tcForm, setTcForm] = useState({
    leaving_date: '',
    reason: '',
    conduct: 'Good',
  });

  useEffect(() => { initScreen(); }, []);

  async function initScreen() {
    const session = await getUserSession();
    setSchoolId(session.schoolId);
    await fetchCertificates(session.schoolId);
  }

  async function fetchCertificates(sid: string) {
    try {
      const snap = await getDocs(
        query(collection(db, 'schools', sid, 'transfer_certificates'), orderBy('issued_date', 'desc'))
      );
      setCertificates(snap.docs.map(d => ({ id: d.id, ...d.data() } as TransferCertificate)));
    } catch (e) {
      console.error('Fetch TCs error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function handleSearch(text: string) {
    setSearchQuery(text);
    if (text.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const snap = await getDocs(collection(db, 'schools', schoolId, 'students'));
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() } as Student));
      const q = text.toLowerCase();
      const results = all.filter(
        s => s.name.toLowerCase().includes(q) ||
          s.roll_number?.toString().includes(q) ||
          s.class?.toString().includes(q)
      ).slice(0, 8);
      setSearchResults(results);
    } catch (e) {
      console.error('Search error:', e);
    } finally {
      setSearching(false);
    }
  }

  function selectStudent(student: Student) {
    setSelectedStudent(student);
    setSearchQuery(student.name);
    setSearchResults([]);
    setShowForm(true);
  }

  function generateTCNumber(): string {
    const year = new Date().getFullYear();
    const num = String(certificates.length + 1).padStart(4, '0');
    return `TC-${year}-${num}`;
  }

  async function handleGenerateTC() {
    if (!selectedStudent) return;
    if (!tcForm.leaving_date.trim()) {
      Alert.alert('Error', 'Please enter leaving date.');
      return;
    }
    if (!tcForm.reason.trim()) {
      Alert.alert('Error', 'Please enter reason for leaving.');
      return;
    }
    setSaving(true);
    try {
      const tcNumber = generateTCNumber();
      await addDoc(collection(db, 'schools', schoolId, 'transfer_certificates'), {
        tc_number: tcNumber,
        student_id: selectedStudent.id,
        student_name: selectedStudent.name,
        class: selectedStudent.class,
        section: selectedStudent.section,
        dob: selectedStudent.dob ?? '',
        admission_date: selectedStudent.admission_date ?? '',
        leaving_date: tcForm.leaving_date.trim(),
        reason: tcForm.reason.trim(),
        conduct: tcForm.conduct,
        status: 'issued',
        issued_date: new Date().toISOString().split('T')[0],
        school_id: schoolId,
      });
      setShowForm(false);
      setSelectedStudent(null);
      setSearchQuery('');
      setTcForm({ leaving_date: '', reason: '', conduct: 'Good' });
      await fetchCertificates(schoolId);
      Alert.alert('Success', `Transfer Certificate ${tcNumber} generated successfully.`);
    } catch (e) {
      Alert.alert('Error', 'Failed to generate TC.');
    } finally {
      setSaving(false);
    }
  }

  async function handleMarkCollected(tc: TransferCertificate) {
    try {
      await updateDoc(doc(db, 'schools', schoolId, 'transfer_certificates', tc.id), {
        status: 'collected',
        collected_date: new Date().toISOString().split('T')[0],
      });
      setShowDetailModal(false);
      await fetchCertificates(schoolId);
    } catch (e) {
      Alert.alert('Error', 'Failed to update TC status.');
    }
  }

  const onRefresh = useCallback(() => { setRefreshing(true); fetchCertificates(schoolId); }, [schoolId]);

  function renderTCCard({ item }: { item: TransferCertificate }) {
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => { setSelectedTC(item); setShowDetailModal(true); }}
        activeOpacity={0.8}
      >
        <View style={styles.cardTop}>
          <View style={styles.tcNumberBox}>
            <Text style={styles.tcNumberText}>{item.tc_number}</Text>
          </View>
          <View style={styles.cardInfo}>
            <Text style={styles.cardName}>{item.student_name}</Text>
            <Text style={styles.cardMeta}>Class {item.class}-{item.section}</Text>
            <Text style={styles.cardDate}>Issued: {item.issued_date}</Text>
          </View>
          <View style={[
            styles.statusBadge,
            { backgroundColor: item.status === 'collected' ? COLORS.success + '18' : COLORS.warning + '18' }
          ]}>
            <Text style={[
              styles.statusText,
              { color: item.status === 'collected' ? COLORS.success : COLORS.warning }
            ]}>
              {item.status === 'collected' ? 'Collected' : 'Issued'}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  const CONDUCT_OPTIONS = ['Excellent', 'Good', 'Satisfactory', 'Fair'];

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Transfer Certificates</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{certificates.length}</Text>
        </View>
      </View>

      <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Search Section */}
        <View style={styles.searchSection}>
          <Text style={styles.searchSectionTitle}>Generate New TC</Text>
          <View style={styles.searchRow}>
            <MaterialCommunityIcons name="magnify" size={20} color={COLORS.textSecondary} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search student by name, roll, class..."
              placeholderTextColor={COLORS.textSecondary}
              value={searchQuery}
              onChangeText={handleSearch}
            />
            {searching && <ActivityIndicator size="small" color={COLORS.primary} />}
          </View>

          {/* Search Results Dropdown */}
          {searchResults.length > 0 && (
            <View style={styles.searchDropdown}>
              {searchResults.map(student => (
                <TouchableOpacity
                  key={student.id}
                  style={styles.searchResultItem}
                  onPress={() => selectStudent(student)}
                >
                  <Text style={styles.searchResultName}>{student.name}</Text>
                  <Text style={styles.searchResultMeta}>
                    Class {student.class}-{student.section} • Roll {student.roll_number}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* TC Form */}
          {showForm && selectedStudent && (
            <View style={styles.tcForm}>
              <Text style={styles.tcFormTitle}>TC for: {selectedStudent.name}</Text>
              <Text style={styles.tcFormMeta}>
                Class {selectedStudent.class}-{selectedStudent.section} • Adm: {selectedStudent.admission_date || 'N/A'}
              </Text>

              <Text style={styles.fieldLabel}>Leaving Date *</Text>
              <TextInput
                style={styles.input}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={COLORS.textSecondary}
                value={tcForm.leaving_date}
                onChangeText={v => setTcForm({ ...tcForm, leaving_date: v })}
              />

              <Text style={styles.fieldLabel}>Reason for Leaving *</Text>
              <TextInput
                style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
                placeholder="Reason (transfer, migration, etc.)"
                placeholderTextColor={COLORS.textSecondary}
                multiline
                value={tcForm.reason}
                onChangeText={v => setTcForm({ ...tcForm, reason: v })}
              />

              <Text style={styles.fieldLabel}>Conduct</Text>
              <View style={styles.conductRow}>
                {CONDUCT_OPTIONS.map(c => (
                  <TouchableOpacity
                    key={c}
                    style={[styles.conductChip, tcForm.conduct === c && styles.conductChipActive]}
                    onPress={() => setTcForm({ ...tcForm, conduct: c })}
                  >
                    <Text style={[styles.conductChipText, tcForm.conduct === c && styles.conductChipTextActive]}>
                      {c}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={[styles.generateBtn, saving && { opacity: 0.6 }]}
                onPress={handleGenerateTC}
                disabled={saving}
                activeOpacity={0.8}
              >
                {saving ? <ActivityIndicator color="#FFFFFF" size="small" /> : (
                  <>
                    <MaterialCommunityIcons name="file-certificate" size={18} color="#FFFFFF" />
                    <Text style={styles.generateBtnText}>Generate TC</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cancelFormBtn}
                onPress={() => { setShowForm(false); setSelectedStudent(null); setSearchQuery(''); }}
              >
                <Text style={styles.cancelFormBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Issued TCs List */}
        <Text style={styles.issuedLabel}>ISSUED CERTIFICATES</Text>

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator color={COLORS.primary} size="large" />
          </View>
        ) : certificates.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="file-certificate-outline" size={48} color={COLORS.textSecondary} />
            <Text style={styles.emptyText}>No TCs issued yet</Text>
          </View>
        ) : (
          <FlatList
            data={certificates}
            keyExtractor={item => item.id}
            renderItem={renderTCCard}
            scrollEnabled={false}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
          />
        )}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* TC Detail Modal */}
      <Modal
        visible={showDetailModal}
        animationType="slide"
        onRequestClose={() => setShowDetailModal(false)}
      >
        {selectedTC && (
          <View style={{ flex: 1, backgroundColor: COLORS.background }}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalHeaderTitle}>Transfer Certificate</Text>
              <TouchableOpacity onPress={() => setShowDetailModal(false)}>
                <MaterialCommunityIcons name="close" size={26} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ padding: 16 }}>
              <View style={styles.tcDetailCard}>
                <Text style={styles.tcDetailNumber}>{selectedTC.tc_number}</Text>
                <View style={[
                  styles.tcDetailStatus,
                  { backgroundColor: selectedTC.status === 'collected' ? COLORS.success + '18' : COLORS.warning + '18' }
                ]}>
                  <Text style={[
                    styles.tcDetailStatusText,
                    { color: selectedTC.status === 'collected' ? COLORS.success : COLORS.warning }
                  ]}>
                    {selectedTC.status === 'collected' ? 'Collected' : 'Issued — Not Yet Collected'}
                  </Text>
                </View>
              </View>

              {[
                { label: 'Student Name', value: selectedTC.student_name },
                { label: 'Class & Section', value: `${selectedTC.class}-${selectedTC.section}` },
                { label: 'Date of Birth', value: selectedTC.dob || 'N/A' },
                { label: 'Admission Date', value: selectedTC.admission_date || 'N/A' },
                { label: 'Leaving Date', value: selectedTC.leaving_date },
                { label: 'Reason', value: selectedTC.reason },
                { label: 'Conduct', value: selectedTC.conduct },
                { label: 'Issued Date', value: selectedTC.issued_date },
                ...(selectedTC.collected_date ? [{ label: 'Collected Date', value: selectedTC.collected_date }] : []),
              ].map((row, i) => (
                <View key={i} style={styles.detailRow}>
                  <Text style={styles.detailLabel}>{row.label}</Text>
                  <Text style={styles.detailValue}>{row.value}</Text>
                </View>
              ))}

              {selectedTC.status === 'issued' && (
                <TouchableOpacity
                  style={styles.collectedBtn}
                  onPress={() => handleMarkCollected(selectedTC)}
                  activeOpacity={0.8}
                >
                  <MaterialCommunityIcons name="check-circle" size={18} color="#FFFFFF" />
                  <Text style={styles.collectedBtnText}>Mark as Collected</Text>
                </TouchableOpacity>
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
  scroll: { flex: 1 },
  searchSection: { backgroundColor: '#FFFFFF', padding: 16, marginBottom: 8, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3 },
  searchSectionTitle: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 12 },
  searchRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.background, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 10 },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 15, color: COLORS.textPrimary },
  searchDropdown: { backgroundColor: '#FFFFFF', borderRadius: 8, borderWidth: 1, borderColor: COLORS.border, marginTop: 4, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
  searchResultItem: { paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  searchResultName: { fontSize: 15, fontWeight: '600', color: COLORS.textPrimary },
  searchResultMeta: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  tcForm: { marginTop: 16, backgroundColor: COLORS.background, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: COLORS.border },
  tcFormTitle: { fontSize: 16, fontWeight: '700', color: COLORS.primary },
  tcFormMeta: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2, marginBottom: 4 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 6, marginTop: 14, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: COLORS.textPrimary },
  conductRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  conductChip: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#FFFFFF' },
  conductChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  conductChipText: { fontSize: 13, color: COLORS.textSecondary },
  conductChipTextActive: { color: '#FFFFFF', fontWeight: '600' },
  generateBtn: { backgroundColor: COLORS.primary, borderRadius: 8, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 20 },
  generateBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: 'bold' },
  cancelFormBtn: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingVertical: 12, alignItems: 'center', marginTop: 10 },
  cancelFormBtnText: { color: COLORS.textSecondary, fontSize: 14, fontWeight: '600' },
  issuedLabel: { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary, letterSpacing: 1, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, textTransform: 'uppercase' },
  listContent: { paddingHorizontal: 16, paddingBottom: 20 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14, marginBottom: 10, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tcNumberBox: { backgroundColor: COLORS.primary + '10', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, minWidth: 80, alignItems: 'center' },
  tcNumberText: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
  cardInfo: { flex: 1 },
  cardName: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  cardMeta: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  cardDate: { fontSize: 11, color: COLORS.textSecondary, marginTop: 1 },
  statusBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  statusText: { fontSize: 11, fontWeight: '700' },
  centered: { padding: 40, alignItems: 'center' },
  emptyContainer: { alignItems: 'center', paddingTop: 40 },
  emptyText: { color: COLORS.textSecondary, fontSize: 15, marginTop: 12 },
  modalHeader: { backgroundColor: COLORS.primary, paddingTop: 52, paddingBottom: 16, paddingHorizontal: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalHeaderTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
  tcDetailCard: { backgroundColor: COLORS.primary, borderRadius: 12, padding: 16, marginBottom: 16, alignItems: 'center' },
  tcDetailNumber: { fontSize: 24, fontWeight: 'bold', color: COLORS.accent, letterSpacing: 2 },
  tcDetailStatus: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, marginTop: 8 },
  tcDetailStatusText: { fontSize: 13, fontWeight: '700' },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border, backgroundColor: '#FFFFFF', paddingHorizontal: 16 },
  detailLabel: { fontSize: 13, color: COLORS.textSecondary },
  detailValue: { fontSize: 13, fontWeight: '600', color: COLORS.textPrimary, flex: 1, textAlign: 'right' },
  collectedBtn: { backgroundColor: COLORS.success, borderRadius: 8, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 20 },
  collectedBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: 'bold' },
});