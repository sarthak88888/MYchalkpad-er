import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, ActivityIndicator, RefreshControl, Linking, Alert,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getUserSession } from '@/lib/storage';
import { COLORS } from '@/lib/theme';
import { Student, Staff } from '@/lib/types';

export default function DriverStudentsScreen() {
  const [schoolId, setSchoolId] = useState('school_001');
  const [busRoute, setBusRoute] = useState('');
  const [students, setStudents] = useState<Student[]>([]);
  const [filtered, setFiltered] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchText, setSearchText] = useState('');

  useEffect(() => { initScreen(); }, []);
  useEffect(() => {
    const q = searchText.toLowerCase();
    setFiltered(students.filter(s =>
      s.name.toLowerCase().includes(q) ||
      s.address?.toLowerCase().includes(q) ||
      s.class?.toString().includes(q)
    ));
  }, [searchText, students]);

  async function initScreen() {
    const session = await getUserSession();
    setSchoolId(session.schoolId);
    try {
      const staffSnap = await getDocs(query(
        collection(db, 'schools', session.schoolId, 'staff'),
        where('phone', '==', session.phone)
      ));
      if (!staffSnap.empty) {
        const route = staffSnap.docs[0].data().bus_route ?? '';
        setBusRoute(route);
        await loadStudents(session.schoolId, route);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function loadStudents(sid: string, route: string) {
    if (!route) { setLoading(false); setRefreshing(false); return; }
    try {
      const snap = await getDocs(query(
        collection(db, 'schools', sid, 'students'),
        where('bus_route', '==', route)
      ));
      const studs = snap.docs.map(d => ({ id: d.id, ...d.data() } as Student));
      studs.sort((a, b) => a.name.localeCompare(b.name));
      setStudents(studs);
      setFiltered(studs);
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  }

  function handleCallParent(phone: string, studentName: string) {
    Alert.alert(
      'Call Parent',
      `Call parent of ${studentName}?\n${phone}`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Call', onPress: () => Linking.openURL(`tel:${phone}`) },
      ]
    );
  }

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadStudents(schoolId, busRoute);
  }, [schoolId, busRoute]);

  // Group students by class
  const groupedByClass: Record<string, Student[]> = {};
  filtered.forEach(s => {
    const key = `Class ${s.class}-${s.section}`;
    if (!groupedByClass[key]) groupedByClass[key] = [];
    groupedByClass[key].push(s);
  });

  function renderStudentCard(student: Student) {
    const area = student.address?.split(',').slice(-2).join(',').trim() ?? 'N/A';
    return (
      <View key={student.id} style={styles.card}>
        <View style={styles.cardLeft}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{student.name.charAt(0)}</Text>
          </View>
          <View style={styles.cardInfo}>
            <Text style={styles.cardName}>{student.name}</Text>
            <Text style={styles.cardClass}>
              Class {student.class}-{student.section} • Roll {student.roll_number}
            </Text>
            <Text style={styles.cardAddress} numberOfLines={1}>{area}</Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.callBtn}
          onPress={() => handleCallParent(student.parent_phone, student.name)}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons name="phone" size={18} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Route Students</Text>
        <Text style={styles.headerSub}>
          {busRoute ? `Route: ${busRoute} • ${students.length} students` : 'No route assigned'}
        </Text>
      </View>

      <View style={styles.searchRow}>
        <MaterialCommunityIcons name="magnify" size={20} color={COLORS.textSecondary} style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name, address, class..."
          placeholderTextColor={COLORS.textSecondary}
          value={searchText}
          onChangeText={setSearchText}
        />
        {searchText.length > 0 && (
          <TouchableOpacity onPress={() => setSearchText('')}>
            <MaterialCommunityIcons name="close" size={18} color={COLORS.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.centered}><ActivityIndicator color={COLORS.primary} size="large" /></View>
      ) : !busRoute ? (
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons name="bus-alert" size={48} color={COLORS.textSecondary} />
          <Text style={styles.emptyText}>No bus route assigned to your account</Text>
        </View>
      ) : (
        <FlatList
          data={Object.keys(groupedByClass).sort()}
          keyExtractor={item => item}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
          contentContainerStyle={{ paddingBottom: 40 }}
          renderItem={({ item: classKey }) => (
            <View style={styles.classGroup}>
              <View style={styles.classHeader}>
                <Text style={styles.classHeaderText}>{classKey}</Text>
                <Text style={styles.classHeaderCount}>{groupedByClass[classKey].length} students</Text>
              </View>
              {groupedByClass[classKey].map(s => renderStudentCard(s))}
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="account-off" size={48} color={COLORS.textSecondary} />
              <Text style={styles.emptyText}>No students found on this route</Text>
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
  searchRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  searchInput: { flex: 1, fontSize: 15, color: COLORS.textPrimary },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  emptyText: { color: COLORS.textSecondary, fontSize: 15, marginTop: 12, textAlign: 'center', paddingHorizontal: 24 },
  classGroup: { marginBottom: 4 },
  classHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: COLORS.primary + '10', paddingHorizontal: 16, paddingVertical: 10 },
  classHeaderText: { fontSize: 13, fontWeight: '700', color: COLORS.primary },
  classHeaderCount: { fontSize: 12, color: COLORS.textSecondary },
  card: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  cardLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: COLORS.primary + '15', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarText: { fontSize: 16, fontWeight: 'bold', color: COLORS.primary },
  cardInfo: { flex: 1 },
  cardName: { fontSize: 15, fontWeight: '600', color: COLORS.textPrimary },
  cardClass: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  cardAddress: { fontSize: 12, color: COLORS.textSecondary, marginTop: 1 },
  callBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.success, justifyContent: 'center', alignItems: 'center', marginLeft: 10 },
});