import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, ActivityIndicator, Modal, ScrollView,
  Alert, RefreshControl, KeyboardAvoidingView, Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getUserSession } from '@/lib/storage';
import { COLORS } from '@/lib/theme';
import { Staff, StaffRole } from '@/lib/types';

const ROLES: StaffRole[] = ['Principal','Vice Principal','Class Teacher','Subject Teacher','Accountant','Clerk','Peon','Bus Driver'];
const SUBJECTS = ['English','Hindi','Mathematics','Science','Social Science','Sanskrit','Computer','Physical Education'];
const ROLE_COLORS: Record<string, string> = {
  'Principal': '#7C3AED', 'Vice Principal': '#6366F1', 'Class Teacher': '#0EA5E9',
  'Subject Teacher': '#10B981', 'Accountant': '#F59E0B', 'Clerk': '#64748B',
  'Peon': '#94A3B8', 'Bus Driver': '#F97316',
};
const EMPTY_FORM = { name: '', role: '' as StaffRole | '', subject: '', phone: '', email: '', salary: '', joining_date: '', address: '', assigned_class: '', assigned_section: '' };

export default function StaffScreen() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [schoolId, setSchoolId] = useState('school_001');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selected, setSelected] = useState<Staff | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => { initScreen(); }, []);

  async function initScreen() {
    const session = await getUserSession();
    setSchoolId(session.schoolId);
    await fetchStaff(session.schoolId);
  }

  async function fetchStaff(sid: string) {
    try {
      const snap = await getDocs(query(collection(db, 'schools', sid, 'staff'), orderBy('name')));
      setStaff(snap.docs.map(d => ({ id: d.id, ...d.data() } as Staff)));
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  }

  function getTotalSalary() { return staff.reduce((sum, s) => sum + (s.salary ?? 0), 0); }

  function validate(): boolean {
    const errors: Record<string, string> = {};
    if (!form.name.trim()) errors.name = 'Name is required';
    if (!form.role) errors.role = 'Role is required';
    if (!form.phone || form.phone.length !== 10) errors.phone = 'Valid 10-digit phone required';
    if (!form.salary) errors.salary = 'Salary is required';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(), role: form.role as StaffRole,
        subject: form.subject.trim(), phone: form.phone.trim(),
        email: form.email.trim(), salary: parseFloat(form.salary) || 0,
        joining_date: form.joining_date.trim(), address: form.address.trim(),
        assigned_class: form.assigned_class.trim(), assigned_section: form.assigned_section.trim(),
        school_id: schoolId,
      };
      if (isEditing && selected) {
        await updateDoc(doc(db, 'schools', schoolId, 'staff', selected.id), payload);
      } else {
        await addDoc(collection(db, 'schools', schoolId, 'staff'), payload);
      }
      setShowAddModal(false);
      setForm(EMPTY_FORM);
      setIsEditing(false);
      await fetchStaff(schoolId);
    } catch (e) { Alert.alert('Error', 'Failed to save staff member.'); }
    finally { setSaving(false); }
  }

  async function handleDelete(s: Staff) {
    Alert.alert('Delete Staff', `Delete ${s.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await deleteDoc(doc(db, 'schools', schoolId, 'staff', s.id));
          setShowDetailModal(false);
          await fetchStaff(schoolId);
        } catch (e) { Alert.alert('Error', 'Failed to delete.'); }
      }},
    ]);
  }

  function openEdit(s: Staff) {
    setForm({ name: s.name, role: s.role, subject: s.subject ?? '', phone: s.phone, email: s.email ?? '', salary: s.salary.toString(), joining_date: s.joining_date ?? '', address: s.address ?? '', assigned_class: s.assigned_class ?? '', assigned_section: s.assigned_section ?? '' });
    setIsEditing(true); setSelected(s); setShowDetailModal(false); setShowAddModal(true);
  }

  const onRefresh = useCallback(() => { setRefreshing(true); fetchStaff(schoolId); }, [schoolId]);

  function renderCard({ item }: { item: Staff }) {
    return (
      <TouchableOpacity style={styles.card} onPress={() => { setSelected(item); setShowDetailModal(true); }} activeOpacity={0.8}>
        <View style={styles.cardLeft}>
          <View style={[styles.avatar, { backgroundColor: (ROLE_COLORS[item.role] ?? COLORS.primary) + '20' }]}>
            <Text style={[styles.avatarText, { color: ROLE_COLORS[item.role] ?? COLORS.primary }]}>{item.name.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={styles.info}>
            <Text style={styles.name}>{item.name}</Text>
            <View style={[styles.roleBadge, { backgroundColor: (ROLE_COLORS[item.role] ?? COLORS.primary) + '18' }]}>
              <Text style={[styles.roleText, { color: ROLE_COLORS[item.role] ?? COLORS.primary }]}>{item.role}</Text>
            </View>
            {item.subject ? <Text style={styles.meta}>{item.subject}</Text> : null}
            <Text style={styles.meta}>{item.phone}</Text>
          </View>
        </View>
        <Text style={styles.salary}>₹{item.salary?.toLocaleString()}</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Staff Management</Text>
        <Text style={styles.headerCount}>{staff.length} members</Text>
      </View>

      {/* Total Salary Banner */}
      <View style={styles.salaryBanner}>
        <MaterialCommunityIcons name="cash-multiple" size={20} color="#FFFFFF" />
        <Text style={styles.salaryBannerText}>Total Monthly Salary: ₹{getTotalSalary().toLocaleString()}</Text>
      </View>

      {loading ? (
        <View style={styles.centered}><ActivityIndicator color={COLORS.primary} size="large" /></View>
      ) : (
        <FlatList
          data={staff}
          keyExtractor={item => item.id}
          renderItem={renderCard}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="badge-account" size={48} color={COLORS.textSecondary} />
              <Text style={styles.emptyText}>No staff members found</Text>
            </View>
          }
        />
      )}

      <TouchableOpacity style={styles.fab} onPress={() => { setForm(EMPTY_FORM); setFormErrors({}); setIsEditing(false); setSelected(null); setShowAddModal(true); }} activeOpacity={0.85}>
        <MaterialCommunityIcons name="plus" size={28} color="#FFFFFF" />
      </TouchableOpacity>

      {/* Add/Edit Modal */}
      <Modal visible={showAddModal} animationType="slide" onRequestClose={() => setShowAddModal(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalHeaderTitle}>{isEditing ? 'Edit Staff' : 'Add Staff Member'}</Text>
            <TouchableOpacity onPress={() => setShowAddModal(false)}>
              <MaterialCommunityIcons name="close" size={26} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
          <ScrollView style={{ flex: 1, backgroundColor: COLORS.background }} contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
            <Text style={styles.fieldLabel}>Full Name *</Text>
            <TextInput style={[styles.input, formErrors.name ? styles.inputErr : null]} placeholder="Staff member name" placeholderTextColor={COLORS.textSecondary} value={form.name} onChangeText={v => setForm({ ...form, name: v })} />
            {formErrors.name ? <Text style={styles.fieldError}>{formErrors.name}</Text> : null}

            <Text style={styles.fieldLabel}>Role *</Text>
            <View style={styles.roleGrid}>
              {ROLES.map(role => (
                <TouchableOpacity key={role} style={[styles.roleChip, form.role === role && styles.roleChipActive]} onPress={() => setForm({ ...form, role })}>
                  <Text style={[styles.roleChipText, form.role === role && styles.roleChipTextActive]}>{role}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {formErrors.role ? <Text style={styles.fieldError}>{formErrors.role}</Text> : null}

            <Text style={styles.fieldLabel}>Subject</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
              {SUBJECTS.map(sub => (
                <TouchableOpacity key={sub} style={[styles.chip, form.subject === sub && styles.chipActive]} onPress={() => setForm({ ...form, subject: sub })}>
                  <Text style={[styles.chipText, form.subject === sub && styles.chipTextActive]}>{sub}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.fieldLabel}>Phone *</Text>
            <TextInput style={[styles.input, formErrors.phone ? styles.inputErr : null]} placeholder="10-digit phone" placeholderTextColor={COLORS.textSecondary} keyboardType="number-pad" maxLength={10} value={form.phone} onChangeText={v => setForm({ ...form, phone: v.replace(/\D/g, '') })} />
            {formErrors.phone ? <Text style={styles.fieldError}>{formErrors.phone}</Text> : null}

            <Text style={styles.fieldLabel}>Monthly Salary (₹) *</Text>
            <TextInput style={[styles.input, formErrors.salary ? styles.inputErr : null]} placeholder="Monthly salary amount" placeholderTextColor={COLORS.textSecondary} keyboardType="numeric" value={form.salary} onChangeText={v => setForm({ ...form, salary: v })} />
            {formErrors.salary ? <Text style={styles.fieldError}>{formErrors.salary}</Text> : null}

            <Text style={styles.fieldLabel}>Email</Text>
            <TextInput style={styles.input} placeholder="Email address (optional)" placeholderTextColor={COLORS.textSecondary} keyboardType="email-address" autoCapitalize="none" value={form.email} onChangeText={v => setForm({ ...form, email: v })} />

            <Text style={styles.fieldLabel}>Joining Date</Text>
            <TextInput style={styles.input} placeholder="DD/MM/YYYY" placeholderTextColor={COLORS.textSecondary} value={form.joining_date} onChangeText={v => setForm({ ...form, joining_date: v })} />

            <Text style={styles.fieldLabel}>Address</Text>
            <TextInput style={[styles.input, { height: 80, textAlignVertical: 'top' }]} placeholder="Home address" placeholderTextColor={COLORS.textSecondary} multiline value={form.address} onChangeText={v => setForm({ ...form, address: v })} />

            <TouchableOpacity style={[styles.saveButton, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving} activeOpacity={0.8}>
              {saving ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.saveButtonText}>{isEditing ? 'Update Staff' : 'Add Staff Member'}</Text>}
            </TouchableOpacity>
            <View style={{ height: 40 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Detail Modal */}
      <Modal visible={showDetailModal} animationType="slide" onRequestClose={() => setShowDetailModal(false)}>
        {selected && (
          <View style={{ flex: 1, backgroundColor: COLORS.background }}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalHeaderTitle}>Staff Profile</Text>
              <TouchableOpacity onPress={() => setShowDetailModal(false)}>
                <MaterialCommunityIcons name="close" size={26} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ padding: 16 }}>
              <View style={styles.detailAvatarContainer}>
                <View style={[styles.detailAvatar, { backgroundColor: (ROLE_COLORS[selected.role] ?? COLORS.primary) + '20' }]}>
                  <Text style={[styles.detailAvatarText, { color: ROLE_COLORS[selected.role] ?? COLORS.primary }]}>{selected.name.charAt(0).toUpperCase()}</Text>
                </View>
                <Text style={styles.detailName}>{selected.name}</Text>
                <View style={[styles.roleBadge, { backgroundColor: (ROLE_COLORS[selected.role] ?? COLORS.primary) + '20', marginTop: 6 }]}>
                  <Text style={[styles.roleText, { color: ROLE_COLORS[selected.role] ?? COLORS.primary }]}>{selected.role}</Text>
                </View>
              </View>

              {[
                { label: 'Phone', value: selected.phone, icon: 'phone' },
                { label: 'Email', value: selected.email || 'N/A', icon: 'email' },
                { label: 'Subject', value: selected.subject || 'N/A', icon: 'book' },
                { label: 'Monthly Salary', value: `₹${selected.salary?.toLocaleString()}`, icon: 'cash' },
                { label: 'Joining Date', value: selected.joining_date || 'N/A', icon: 'calendar' },
                { label: 'Address', value: selected.address || 'N/A', icon: 'map-marker' },
              ].map((row, i) => (
                <View key={i} style={styles.detailRow}>
                  <MaterialCommunityIcons name={row.icon as any} size={20} color={COLORS.primary} style={{ width: 28 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.detailRowLabel}>{row.label}</Text>
                    <Text style={styles.detailRowValue}>{row.value}</Text>
                  </View>
                </View>
              ))}

              <TouchableOpacity style={styles.editButton} onPress={() => openEdit(selected)} activeOpacity={0.8}>
                <MaterialCommunityIcons name="pencil" size={18} color="#FFFFFF" />
                <Text style={styles.editButtonText}>Edit Staff Member</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.deleteButton} onPress={() => handleDelete(selected)} activeOpacity={0.8}>
                <MaterialCommunityIcons name="delete" size={18} color="#FFFFFF" />
                <Text style={styles.deleteButtonText}>Delete Staff Member</Text>
              </TouchableOpacity>
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
  headerCount: { color: 'rgba(255,255,255,0.7)', fontSize: 13 },
  salaryBanner: { backgroundColor: COLORS.accent, paddingVertical: 12, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 8 },
  salaryBannerText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  listContent: { padding: 16, paddingBottom: 80 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3 },
  cardLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  avatar: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarText: { fontSize: 20, fontWeight: 'bold' },
  info: { flex: 1 },
  name: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  roleBadge: { alignSelf: 'flex-start', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, marginTop: 4 },
  roleText: { fontSize: 11, fontWeight: '700' },
  meta: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  salary: { fontSize: 15, fontWeight: '700', color: COLORS.success },
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
  roleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  roleChip: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#FFFFFF' },
  roleChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  roleChipText: { fontSize: 13, color: COLORS.textSecondary },
  roleChipTextActive: { color: '#FFFFFF', fontWeight: '600' },
  chip: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, marginRight: 8, backgroundColor: '#FFFFFF' },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: 12, color: COLORS.textSecondary },
  chipTextActive: { color: '#FFFFFF', fontWeight: '600' },
  saveButton: { backgroundColor: COLORS.primary, borderRadius: 8, paddingVertical: 14, alignItems: 'center', marginTop: 24 },
  saveButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
  detailAvatarContainer: { alignItems: 'center', paddingVertical: 20 },
  detailAvatar: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  detailAvatarText: { fontSize: 32, fontWeight: 'bold' },
  detailName: { fontSize: 22, fontWeight: 'bold', color: COLORS.textPrimary },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#FFFFFF', borderRadius: 10, padding: 14, marginBottom: 8, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 2 },
  detailRowLabel: { fontSize: 11, color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  detailRowValue: { fontSize: 15, color: COLORS.textPrimary, fontWeight: '500', marginTop: 2 },
  editButton: { backgroundColor: COLORS.primary, borderRadius: 8, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 10 },
  editButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: 'bold' },
  deleteButton: { backgroundColor: COLORS.error, borderRadius: 8, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  deleteButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: 'bold' },
});
