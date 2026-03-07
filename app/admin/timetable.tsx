import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Modal, Alert,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getUserSession } from '@/lib/storage';
import { COLORS } from '@/lib/theme';

const CLASS_OPTIONS = ['6','7','8','9','10','11','12'];
const SECTION_OPTIONS = ['A','B','C','D'];
const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat'];
const PERIODS = [1,2,3,4,5,6];
const SUBJECTS = ['English','Hindi','Mathematics','Science','Social Science','Sanskrit','Computer','Physical Education','Library','Sports'];

interface Cell { subject: string; teacher_name: string; }
type Grid = Record<string, Record<number, Cell>>;

const emptyGrid = (): Grid => {
  const g: Grid = {};
  DAYS.forEach(day => { g[day] = {}; PERIODS.forEach(p => { g[day][p] = { subject: '', teacher_name: '' }; }); });
  return g;
};

export default function TimetableScreen() {
  const [schoolId, setSchoolId] = useState('school_001');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [grid, setGrid] = useState<Grid>(emptyGrid());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingCell, setEditingCell] = useState<{ day: string; period: number } | null>(null);
  const [editSubject, setEditSubject] = useState('');
  const [editTeacher, setEditTeacher] = useState('');

  useEffect(() => { initScreen(); }, []);
  useEffect(() => {
    if (selectedClass && selectedSection) loadTimetable();
  }, [selectedClass, selectedSection]);

  async function initScreen() {
    const session = await getUserSession();
    setSchoolId(session.schoolId);
  }

  async function loadTimetable() {
    setLoading(true);
    try {
      const ttId = `${selectedClass}_${selectedSection}`;
      const snap = await getDoc(doc(db, 'schools', schoolId, 'timetables', ttId));
      if (snap.exists()) {
        setGrid(snap.data().grid ?? emptyGrid());
      } else {
        setGrid(emptyGrid());
      }
    } catch (e) {
      console.error('Load timetable error:', e);
      setGrid(emptyGrid());
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!selectedClass || !selectedSection) {
      Alert.alert('Error', 'Please select a class and section.');
      return;
    }
    setSaving(true);
    try {
      const ttId = `${selectedClass}_${selectedSection}`;
      await setDoc(doc(db, 'schools', schoolId, 'timetables', ttId), {
        class: selectedClass,
        section: selectedSection,
        grid,
        academic_year: '2025-2026',
        school_id: schoolId,
        updated_at: new Date().toISOString(),
      });
      Alert.alert('Success', 'Timetable saved successfully.');
    } catch (e) {
      Alert.alert('Error', 'Failed to save timetable.');
    } finally {
      setSaving(false);
    }
  }

  function openCellEditor(day: string, period: number) {
    const cell = grid[day]?.[period] ?? { subject: '', teacher_name: '' };
    setEditSubject(cell.subject);
    setEditTeacher(cell.teacher_name);
    setEditingCell({ day, period });
  }

  function saveCell() {
    if (!editingCell) return;
    const { day, period } = editingCell;
    setGrid(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        [period]: { subject: editSubject.trim(), teacher_name: editTeacher.trim() },
      },
    }));
    setEditingCell(null);
  }

  function getCellColor(cell: Cell): string {
    if (!cell.subject) return '#F8FAFC';
    const colors: Record<string, string> = {
      English: '#DBEAFE', Hindi: '#FEF9C3', Mathematics: '#DCFCE7',
      Science: '#F3E8FF', 'Social Science': '#FFE4E6', Sanskrit: '#FFF7ED',
      Computer: '#E0F2FE', 'Physical Education': '#D1FAE5', Library: '#FDF4FF', Sports: '#F0FDF4',
    };
    return colors[cell.subject] ?? '#F0F9FF';
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Timetable Editor</Text>
      </View>

      <View style={styles.selectorRow}>
        <View style={styles.selectorGroup}>
          <Text style={styles.selectorLabel}>CLASS</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {CLASS_OPTIONS.map(cls => (
              <TouchableOpacity
                key={cls}
                style={[styles.chip, selectedClass === cls && styles.chipActive]}
                onPress={() => setSelectedClass(cls)}
              >
                <Text style={[styles.chipText, selectedClass === cls && styles.chipTextActive]}>{cls}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>

      <View style={styles.selectorRow}>
        <View style={styles.selectorGroup}>
          <Text style={styles.selectorLabel}>SECTION</Text>
          <View style={styles.rowWrap}>
            {SECTION_OPTIONS.map(sec => (
              <TouchableOpacity
                key={sec}
                style={[styles.chip, selectedSection === sec && styles.chipActive]}
                onPress={() => setSelectedSection(sec)}
              >
                <Text style={[styles.chipText, selectedSection === sec && styles.chipTextActive]}>{sec}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      {loading ? (
        <View style={styles.centered}><ActivityIndicator color={COLORS.primary} size="large" /></View>
      ) : !selectedClass || !selectedSection ? (
        <View style={styles.placeholderContainer}>
          <MaterialCommunityIcons name="calendar-month" size={48} color={COLORS.textSecondary} />
          <Text style={styles.placeholderText}>Select Class and Section to view timetable</Text>
        </View>
      ) : (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={true} style={styles.gridScroll}>
            <View>
              {/* Header Row */}
              <View style={styles.gridHeaderRow}>
                <View style={[styles.dayCell, styles.cornerCell]}>
                  <Text style={styles.cornerText}>Day/P</Text>
                </View>
                {PERIODS.map(p => (
                  <View key={p} style={styles.periodHeaderCell}>
                    <Text style={styles.periodHeaderText}>P{p}</Text>
                  </View>
                ))}
              </View>

              {/* Day Rows */}
              {DAYS.map(day => (
                <View key={day} style={styles.gridRow}>
                  <View style={styles.dayCell}>
                    <Text style={styles.dayText}>{day}</Text>
                  </View>
                  {PERIODS.map(p => {
                    const cell = grid[day]?.[p] ?? { subject: '', teacher_name: '' };
                    return (
                      <TouchableOpacity
                        key={p}
                        style={[styles.gridCell, { backgroundColor: getCellColor(cell) }]}
                        onPress={() => openCellEditor(day, p)}
                        activeOpacity={0.7}
                      >
                        {cell.subject ? (
                          <>
                            <Text style={styles.cellSubject} numberOfLines={1}>{cell.subject}</Text>
                            <Text style={styles.cellTeacher} numberOfLines={1}>{cell.teacher_name || '—'}</Text>
                          </>
                        ) : (
                          <MaterialCommunityIcons name="plus" size={16} color={COLORS.textSecondary} />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
            </View>
          </ScrollView>

          <TouchableOpacity
            style={[styles.saveButton, saving && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.8}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <MaterialCommunityIcons name="content-save" size={18} color="#FFFFFF" />
                <Text style={styles.saveButtonText}>Save Timetable</Text>
              </>
            )}
          </TouchableOpacity>
        </>
      )}

      {/* Cell Editor Modal */}
      <Modal visible={editingCell !== null} transparent animationType="fade" onRequestClose={() => setEditingCell(null)}>
        <View style={styles.overlayCenter}>
          <View style={styles.cellEditCard}>
            <Text style={styles.cellEditTitle}>
              Edit {editingCell?.day} — Period {editingCell?.period}
            </Text>

            <Text style={styles.fieldLabel}>Subject</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
              {SUBJECTS.map(sub => (
                <TouchableOpacity
                  key={sub}
                  style={[styles.chip, editSubject === sub && styles.chipActive]}
                  onPress={() => setEditSubject(sub)}
                >
                  <Text style={[styles.chipText, editSubject === sub && styles.chipTextActive]}>{sub}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TextInput
              style={styles.input}
              placeholder="Or type subject name"
              placeholderTextColor={COLORS.textSecondary}
              value={editSubject}
              onChangeText={setEditSubject}
            />

            <Text style={styles.fieldLabel}>Teacher Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Teacher name"
              placeholderTextColor={COLORS.textSecondary}
              value={editTeacher}
              onChangeText={setEditTeacher}
            />

            <View style={styles.cellEditActions}>
              <TouchableOpacity
                style={styles.clearBtn}
                onPress={() => {
                  setEditSubject('');
                  setEditTeacher('');
                }}
              >
                <Text style={styles.clearBtnText}>Clear</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditingCell(null)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.doneBtn} onPress={saveCell}>
                <Text style={styles.doneBtnText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  header: { backgroundColor: COLORS.primary, paddingTop: 52, paddingBottom: 16, paddingHorizontal: 16 },
  headerTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: 'bold' },
  selectorRow: { backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  selectorGroup: {},
  selectorLabel: { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary, letterSpacing: 0.8, marginBottom: 8 },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8, marginRight: 8, backgroundColor: '#FFFFFF' },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: 13, color: COLORS.textSecondary },
  chipTextActive: { color: '#FFFFFF', fontWeight: '600' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  placeholderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  placeholderText: { color: COLORS.textSecondary, fontSize: 15, textAlign: 'center', marginTop: 12 },
  gridScroll: { flex: 1, padding: 8 },
  gridHeaderRow: { flexDirection: 'row' },
  cornerCell: { backgroundColor: COLORS.primary },
  cornerText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  dayCell: { width: 48, height: 64, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.2)' },
  dayText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  periodHeaderCell: { width: 90, height: 36, backgroundColor: COLORS.primary + 'DD', justifyContent: 'center', alignItems: 'center', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.2)' },
  periodHeaderText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },
  gridRow: { flexDirection: 'row' },
  gridCell: { width: 90, height: 64, borderWidth: 0.5, borderColor: COLORS.border, justifyContent: 'center', alignItems: 'center', padding: 4 },
  cellSubject: { fontSize: 11, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'center' },
  cellTeacher: { fontSize: 10, color: COLORS.textSecondary, textAlign: 'center', marginTop: 2 },
  saveButton: {
    backgroundColor: COLORS.primary, margin: 12, borderRadius: 8, paddingVertical: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  saveButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
  overlayCenter: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  cellEditCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20, width: '100%' },
  cellEditTitle: { fontSize: 17, fontWeight: 'bold', color: COLORS.textPrimary, marginBottom: 12 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: COLORS.textPrimary },
  cellEditActions: { flexDirection: 'row', gap: 8, marginTop: 16 },
  clearBtn: { flex: 1, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  clearBtnText: { color: COLORS.textSecondary, fontSize: 14, fontWeight: '600' },
  cancelBtn: { flex: 1, borderWidth: 1, borderColor: COLORS.error, borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  cancelBtnText: { color: COLORS.error, fontSize: 14, fontWeight: '600' },
  doneBtn: { flex: 1, backgroundColor: COLORS.primary, borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  doneBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
});