import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Modal,
  ScrollView,
  Alert,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getUserSession } from '@/lib/storage';
import { COLORS } from '@/lib/theme';
import { Student } from '@/lib/types';

const CLASS_OPTIONS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
const SECTION_OPTIONS = ['A', 'B', 'C', 'D'];

const EMPTY_FORM = {
  name: '',
  class: '',
  section: '',
  roll_number: '',
  parent_phone: '',
  parent_name: '',
  dob: '',
  address: '',
  fees_due: '',
  fees_paid: '',
  admission_date: '',
};

export default function StudentsScreen() {
  const [students, setStudents] = useState<Student[]>([]);
  const [filtered, setFiltered] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [schoolId, setSchoolId] = useState('school_001');
  const [search, setSearch] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [filterSection, setFilterSection] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    initScreen();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [students, search, filterClass, filterSection]);

  async function initScreen() {
    const session = await getUserSession();
    setSchoolId(session.schoolId);
    await fetchStudents(session.schoolId);
  }

  async function fetchStudents(sid: string) {
    try {
      const snap = await getDocs(
        query(collection(db, 'schools', sid, 'students'), orderBy('name'))
      );
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Student));
      setStudents(data);
    } catch (e) {
      console.error('Fetch students error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function applyFilters() {
    let result = [...students];
    if (search.trim()) {
      const s = search.toLowerCase();
      result = result.filter(
        (st) =>
          st.name.toLowerCase().includes(s) ||
          st.roll_number?.toString().includes(s) ||
          st.parent_phone?.includes(s)
      );
    }
    if (filterClass) result = result.filter((st) => st.class === filterClass);
    if (filterSection) result = result.filter((st) => st.section === filterSection);
    setFiltered(result);
  }

  function validateForm(): boolean {
    const errors: Record<string, string> = {};
    if (!form.name.trim()) errors.name = 'Name is required';
    if (!form.class) errors.class = 'Class is required';
    if (!form.section) errors.section = 'Section is required';
    if (!form.roll_number) errors.roll_number = 'Roll number is required';
    if (!form.parent_phone || form.parent_phone.length !== 10)
      errors.parent_phone = 'Valid 10-digit phone required';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSaveStudent() {
    if (!validateForm()) return;
    setSaving(true);
    try {
      const studentData = {
        name: form.name.trim(),
        class: form.class,
        section: form.section,
        roll_number: parseInt(form.roll_number) || 0,
        parent_phone: form.parent_phone.trim(),
        parent_name: form.parent_name.trim(),
        dob: form.dob.trim(),
        address: form.address.trim(),
        fees_due: parseFloat(form.fees_due) || 0,
        fees_paid: parseFloat(form.fees_paid) || 0,
        admission_date: form.admission_date.trim(),
        school_id: schoolId,
      };

      if (isEditing && selectedStudent) {
        await updateDoc(
          doc(db, 'schools', schoolId, 'students', selectedStudent.id),
          studentData
        );
      } else {
        await addDoc(collection(db, 'schools', schoolId, 'students'), studentData);
      }

      setShowAddModal(false);
      setForm(EMPTY_FORM);
      setIsEditing(false);
      setSelectedStudent(null);
      await fetchStudents(schoolId);
    } catch (e) {
      console.error('Save student error:', e);
      Alert.alert('Error', 'Failed to save student. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteStudent(student: Student) {
    Alert.alert(
      'Delete Student',
      `Are you sure you want to delete ${student.name}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(
                doc(db, 'schools', schoolId, 'students', student.id)
              );
              setShowDetailModal(false);
              await fetchStudents(schoolId);
            } catch (e) {
              Alert.alert('Error', 'Failed to delete student.');
            }
          },
        },
      ]
    );
  }

  function openEditModal(student: Student) {
    setForm({
      name: student.name,
      class: student.class,
      section: student.section,
      roll_number: student.roll_number?.toString() ?? '',
      parent_phone: student.parent_phone ?? '',
      parent_name: student.parent_name ?? '',
      dob: student.dob ?? '',
      address: student.address ?? '',
      fees_due: student.fees_due?.toString() ?? '',
      fees_paid: student.fees_paid?.toString() ?? '',
      admission_date: student.admission_date ?? '',
    });
    setIsEditing(true);
    setSelectedStudent(student);
    setShowDetailModal(false);
    setShowAddModal(true);
  }

  function getFeeStatusColor(student: Student) {
    if (student.fees_due <= 0) return COLORS.success;
    const ratio = student.fees_paid / (student.fees_paid + student.fees_due);
    if (ratio >= 0.8) return COLORS.warning;
    return COLORS.error;
  }

  function getFeeStatusLabel(student: Student) {
    if (student.fees_due <= 0) return 'Paid';
    return `₹${student.fees_due} Due`;
  }

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchStudents(schoolId);
  }, [schoolId]);

  function renderStudentCard({ item }: { item: Student }) {
    return (
      <TouchableOpacity
        style={styles.studentCard}
        onPress={() => {
          setSelectedStudent(item);
          setShowDetailModal(true);
        }}
        activeOpacity={0.8}
      >
        <View style={styles.studentCardLeft}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>
              {item.name.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.studentInfo}>
            <Text style={styles.studentName}>{item.name}</Text>
            <Text style={styles.studentMeta}>
              Class {item.class}-{item.section} • Roll {item.roll_number}
            </Text>
            <Text style={styles.studentPhone}>{item.parent_phone}</Text>
          </View>
        </View>
        <View
          style={[
            styles.feesBadge,
            { backgroundColor: getFeeStatusColor(item) + '18' },
          ]}
        >
          <Text
            style={[styles.feesBadgeText, { color: getFeeStatusColor(item) }]}
          >
            {getFeeStatusLabel(item)}
          </Text>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>All Students</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{filtered.length}</Text>
        </View>
      </View>

      {/* Search + Filters */}
      <View style={styles.filterContainer}>
        <View style={styles.searchRow}>
          <MaterialCommunityIcons
            name="magnify"
            size={20}
            color={COLORS.textSecondary}
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name, roll, phone..."
            placeholderTextColor={COLORS.textSecondary}
            value={search}
            onChangeText={setSearch}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')}>
              <MaterialCommunityIcons
                name="close-circle"
                size={18}
                color={COLORS.textSecondary}
              />
            </TouchableOpacity>
          ) : null}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
        >
          <TouchableOpacity
            style={[
              styles.filterChip,
              !filterClass && styles.filterChipActive,
            ]}
            onPress={() => setFilterClass('')}
          >
            <Text
              style={[
                styles.filterChipText,
                !filterClass && styles.filterChipTextActive,
              ]}
            >
              All Classes
            </Text>
          </TouchableOpacity>
          {CLASS_OPTIONS.map((cls) => (
            <TouchableOpacity
              key={cls}
              style={[
                styles.filterChip,
                filterClass === cls && styles.filterChipActive,
              ]}
              onPress={() => setFilterClass(filterClass === cls ? '' : cls)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  filterClass === cls && styles.filterChipTextActive,
                ]}
              >
                Class {cls}
              </Text>
            </TouchableOpacity>
          ))}
          {SECTION_OPTIONS.map((sec) => (
            <TouchableOpacity
              key={sec}
              style={[
                styles.filterChip,
                filterSection === sec && styles.filterChipActive,
              ]}
              onPress={() =>
                setFilterSection(filterSection === sec ? '' : sec)
              }
            >
              <Text
                style={[
                  styles.filterChipText,
                  filterSection === sec && styles.filterChipTextActive,
                ]}
              >
                Sec {sec}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Student List */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={COLORS.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={renderStudentCard}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[COLORS.primary]}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons
                name="account-off"
                size={48}
                color={COLORS.textSecondary}
              />
              <Text style={styles.emptyText}>No students found</Text>
            </View>
          }
        />
      )}

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => {
          setForm(EMPTY_FORM);
          setFormErrors({});
          setIsEditing(false);
          setSelectedStudent(null);
          setShowAddModal(true);
        }}
        activeOpacity={0.85}
      >
        <MaterialCommunityIcons name="plus" size={28} color="#FFFFFF" />
      </TouchableOpacity>

      {/* Add/Edit Student Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        onRequestClose={() => setShowAddModal(false)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalHeader}>
            <Text style={styles.modalHeaderTitle}>
              {isEditing ? 'Edit Student' : 'Add New Student'}
            </Text>
            <TouchableOpacity onPress={() => setShowAddModal(false)}>
              <MaterialCommunityIcons name="close" size={26} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.modalScroll}
            contentContainerStyle={styles.modalScrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* Name */}
            <Text style={styles.fieldLabel}>Full Name *</Text>
            <TextInput
              style={[styles.input, formErrors.name ? styles.inputErr : null]}
              placeholder="Student full name"
              placeholderTextColor={COLORS.textSecondary}
              value={form.name}
              onChangeText={(v) => setForm({ ...form, name: v })}
            />
            {formErrors.name ? (
              <Text style={styles.fieldError}>{formErrors.name}</Text>
            ) : null}

            {/* Class */}
            <Text style={styles.fieldLabel}>Class *</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.optionRow}
            >
              {CLASS_OPTIONS.map((cls) => (
                <TouchableOpacity
                  key={cls}
                  style={[
                    styles.optionChip,
                    form.class === cls && styles.optionChipActive,
                  ]}
                  onPress={() => setForm({ ...form, class: cls })}
                >
                  <Text
                    style={[
                      styles.optionChipText,
                      form.class === cls && styles.optionChipTextActive,
                    ]}
                  >
                    {cls}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            {formErrors.class ? (
              <Text style={styles.fieldError}>{formErrors.class}</Text>
            ) : null}

            {/* Section */}
            <Text style={styles.fieldLabel}>Section *</Text>
            <View style={styles.sectionRow}>
              {SECTION_OPTIONS.map((sec) => (
                <TouchableOpacity
                  key={sec}
                  style={[
                    styles.sectionChip,
                    form.section === sec && styles.optionChipActive,
                  ]}
                  onPress={() => setForm({ ...form, section: sec })}
                >
                  <Text
                    style={[
                      styles.optionChipText,
                      form.section === sec && styles.optionChipTextActive,
                    ]}
                  >
                    {sec}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {formErrors.section ? (
              <Text style={styles.fieldError}>{formErrors.section}</Text>
            ) : null}

            {/* Roll Number */}
            <Text style={styles.fieldLabel}>Roll Number *</Text>
            <TextInput
              style={[
                styles.input,
                formErrors.roll_number ? styles.inputErr : null,
              ]}
              placeholder="Roll number"
              placeholderTextColor={COLORS.textSecondary}
              keyboardType="number-pad"
              value={form.roll_number}
              onChangeText={(v) => setForm({ ...form, roll_number: v })}
            />
            {formErrors.roll_number ? (
              <Text style={styles.fieldError}>{formErrors.roll_number}</Text>
            ) : null}

            {/* Parent Phone */}
            <Text style={styles.fieldLabel}>Parent Phone *</Text>
            <TextInput
              style={[
                styles.input,
                formErrors.parent_phone ? styles.inputErr : null,
              ]}
              placeholder="10-digit phone number"
              placeholderTextColor={COLORS.textSecondary}
              keyboardType="number-pad"
              maxLength={10}
              value={form.parent_phone}
              onChangeText={(v) =>
                setForm({ ...form, parent_phone: v.replace(/\D/g, '') })
              }
            />
            {formErrors.parent_phone ? (
              <Text style={styles.fieldError}>{formErrors.parent_phone}</Text>
            ) : null}

            {/* Parent Name */}
            <Text style={styles.fieldLabel}>Parent Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Parent / guardian name"
              placeholderTextColor={COLORS.textSecondary}
              value={form.parent_name}
              onChangeText={(v) => setForm({ ...form, parent_name: v })}
            />

            {/* DOB */}
            <Text style={styles.fieldLabel}>Date of Birth</Text>
            <TextInput
              style={styles.input}
              placeholder="DD/MM/YYYY"
              placeholderTextColor={COLORS.textSecondary}
              value={form.dob}
              onChangeText={(v) => setForm({ ...form, dob: v })}
            />

            {/* Address */}
            <Text style={styles.fieldLabel}>Address</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Home address"
              placeholderTextColor={COLORS.textSecondary}
              multiline
              numberOfLines={3}
              value={form.address}
              onChangeText={(v) => setForm({ ...form, address: v })}
            />

            {/* Fees Due */}
            <Text style={styles.fieldLabel}>Fees Due (₹)</Text>
            <TextInput
              style={styles.input}
              placeholder="0"
              placeholderTextColor={COLORS.textSecondary}
              keyboardType="numeric"
              value={form.fees_due}
              onChangeText={(v) => setForm({ ...form, fees_due: v })}
            />

            {/* Fees Paid */}
            <Text style={styles.fieldLabel}>Fees Paid (₹)</Text>
            <TextInput
              style={styles.input}
              placeholder="0"
              placeholderTextColor={COLORS.textSecondary}
              keyboardType="numeric"
              value={form.fees_paid}
              onChangeText={(v) => setForm({ ...form, fees_paid: v })}
            />

            {/* Admission Date */}
            <Text style={styles.fieldLabel}>Admission Date</Text>
            <TextInput
              style={styles.input}
              placeholder="DD/MM/YYYY"
              placeholderTextColor={COLORS.textSecondary}
              value={form.admission_date}
              onChangeText={(v) => setForm({ ...form, admission_date: v })}
            />

            {/* Save Button */}
            <TouchableOpacity
              style={[styles.saveButton, saving && { opacity: 0.6 }]}
              onPress={handleSaveStudent}
              disabled={saving}
              activeOpacity={0.8}
            >
              {saving ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.saveButtonText}>
                  {isEditing ? 'Update Student' : 'Add Student'}
                </Text>
              )}
            </TouchableOpacity>

            <View style={{ height: 40 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Student Detail Modal */}
      <Modal
        visible={showDetailModal}
        animationType="slide"
        onRequestClose={() => setShowDetailModal(false)}
      >
        {selectedStudent ? (
          <View style={{ flex: 1, backgroundColor: COLORS.background }}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalHeaderTitle}>Student Profile</Text>
              <TouchableOpacity onPress={() => setShowDetailModal(false)}>
                <MaterialCommunityIcons
                  name="close"
                  size={26}
                  color="#FFFFFF"
                />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ padding: 16 }}>
              {/* Avatar */}
              <View style={styles.detailAvatarContainer}>
                <View style={styles.detailAvatar}>
                  <Text style={styles.detailAvatarText}>
                    {selectedStudent.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.detailName}>{selectedStudent.name}</Text>
                <Text style={styles.detailMeta}>
                  Class {selectedStudent.class}-{selectedStudent.section} • Roll{' '}
                  {selectedStudent.roll_number}
                </Text>
              </View>

              {/* Info Cards */}
              {[
                {
                  label: 'Parent Name',
                  value: selectedStudent.parent_name || 'N/A',
                  icon: 'account',
                },
                {
                  label: 'Parent Phone',
                  value: selectedStudent.parent_phone || 'N/A',
                  icon: 'phone',
                },
                {
                  label: 'Date of Birth',
                  value: selectedStudent.dob || 'N/A',
                  icon: 'cake',
                },
                {
                  label: 'Address',
                  value: selectedStudent.address || 'N/A',
                  icon: 'map-marker',
                },
                {
                  label: 'Admission Date',
                  value: selectedStudent.admission_date || 'N/A',
                  icon: 'calendar',
                },
              ].map((row, i) => (
                <View key={i} style={styles.detailRow}>
                  <MaterialCommunityIcons
                    name={row.icon as any}
                    size={20}
                    color={COLORS.primary}
                    style={{ width: 28 }}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.detailRowLabel}>{row.label}</Text>
                    <Text style={styles.detailRowValue}>{row.value}</Text>
                  </View>
                </View>
              ))}

              {/* Fee Summary */}
              <View style={styles.feeSummaryCard}>
                <Text style={styles.feeSummaryTitle}>Fee Summary</Text>
                <View style={styles.feeSummaryRow}>
                  <View style={styles.feeSummaryItem}>
                    <Text style={styles.feeSummaryAmount}>
                      ₹{selectedStudent.fees_paid ?? 0}
                    </Text>
                    <Text style={styles.feeSummaryLabel}>Paid</Text>
                  </View>
                  <View
                    style={[
                      styles.feeSummaryItem,
                      { borderLeftWidth: 1, borderLeftColor: COLORS.border },
                    ]}
                  >
                    <Text
                      style={[
                        styles.feeSummaryAmount,
                        {
                          color:
                            selectedStudent.fees_due > 0
                              ? COLORS.error
                              : COLORS.success,
                        },
                      ]}
                    >
                      ₹{selectedStudent.fees_due ?? 0}
                    </Text>
                    <Text style={styles.feeSummaryLabel}>Due</Text>
                  </View>
                </View>
              </View>

              {/* Action Buttons */}
              <TouchableOpacity
                style={styles.editButton}
                onPress={() => openEditModal(selectedStudent)}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons
                  name="pencil"
                  size={18}
                  color="#FFFFFF"
                />
                <Text style={styles.editButtonText}>Edit Student</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => handleDeleteStudent(selectedStudent)}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons
                  name="delete"
                  size={18}
                  color="#FFFFFF"
                />
                <Text style={styles.deleteButtonText}>Delete Student</Text>
              </TouchableOpacity>

              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        ) : null}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  header: {
    backgroundColor: COLORS.primary,
    paddingTop: 52,
    paddingBottom: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: 'bold' },
  countBadge: {
    backgroundColor: COLORS.accent,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  countText: { color: '#FFFFFF', fontSize: 13, fontWeight: 'bold' },
  filterContainer: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 10,
    marginBottom: 10,
  },
  searchIcon: { marginRight: 8 },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  filterScroll: { flexDirection: 'row' },
  filterChip: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    backgroundColor: '#FFFFFF',
  },
  filterChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterChipText: { fontSize: 12, color: COLORS.textSecondary },
  filterChipTextActive: { color: '#FFFFFF', fontWeight: '600' },
  listContent: { padding: 16, paddingBottom: 80 },
  studentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
  },
  studentCardLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary + '18',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  studentInfo: { flex: 1 },
  studentName: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  studentMeta: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  studentPhone: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  feesBadge: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginLeft: 8,
  },
  feesBadgeText: { fontSize: 12, fontWeight: '600' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 80,
  },
  emptyText: {
    color: COLORS.textSecondary,
    fontSize: 16,
    marginTop: 12,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.accent,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  modalHeader: {
    backgroundColor: COLORS.primary,
    paddingTop: 52,
    paddingBottom: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalHeaderTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
  modalScroll: { flex: 1, backgroundColor: COLORS.background },
  modalScrollContent: { padding: 16 },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 6,
    marginTop: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  inputErr: { borderColor: COLORS.error },
  textArea: { height: 80, textAlignVertical: 'top' },
  fieldError: { color: COLORS.error, fontSize: 12, marginTop: 4 },
  optionRow: { flexDirection: 'row', marginBottom: 4 },
  optionChip: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    backgroundColor: '#FFFFFF',
  },
  optionChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  optionChipText: { fontSize: 14, color: COLORS.textSecondary },
  optionChipTextActive: { color: '#FFFFFF', fontWeight: '600' },
  sectionRow: { flexDirection: 'row', gap: 10 },
  sectionChip: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
  },
  saveButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 24,
  },
  saveButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
  detailAvatarContainer: { alignItems: 'center', paddingVertical: 20 },
  detailAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  detailAvatarText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  detailName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  detailMeta: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
  },
  detailRowLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailRowValue: {
    fontSize: 15,
    color: COLORS.textPrimary,
    fontWeight: '500',
    marginTop: 2,
  },
  feeSummaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginVertical: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
  },
  feeSummaryTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  feeSummaryRow: { flexDirection: 'row' },
  feeSummaryItem: { flex: 1, alignItems: 'center', paddingVertical: 8 },
  feeSummaryAmount: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  feeSummaryLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  editButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 10,
  },
  editButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: 'bold' },
  deleteButton: {
    backgroundColor: COLORS.error,
    borderRadius: 8,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  deleteButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: 'bold' },
});