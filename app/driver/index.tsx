import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert, Linking,
} from 'react-native';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getUserSession, clearUserSession } from '@/lib/storage';
import { signOut } from '@/lib/firebase';
import { COLORS } from '@/lib/theme';
import { Staff, Student } from '@/lib/types';

interface RouteStop {
  name: string;
  time: string;
  student_count: number;
}

export default function DriverDashboard() {
  const [schoolId, setSchoolId] = useState('school_001');
  const [driver, setDriver] = useState<Staff | null>(null);
  const [phone, setPhone] = useState('');
  const [totalStudents, setTotalStudents] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [routeStops, setRouteStops] = useState<RouteStop[]>([]);
  const [busStudents, setBusStudents] = useState<Student[]>([]);
  const [tripStatus, setTripStatus] = useState<'idle' | 'morning' | 'afternoon'>('idle');

  useEffect(() => { initScreen(); }, []);

  async function initScreen() {
    const session = await getUserSession();
    setSchoolId(session.schoolId);
    setPhone(session.phone);
    try {
      const staffSnap = await getDocs(query(
        collection(db, 'schools', session.schoolId, 'staff'),
        where('phone', '==', session.phone)
      ));
      if (!staffSnap.empty) {
        const d = { id: staffSnap.docs[0].id, ...staffSnap.docs[0].data() } as Staff;
        setDriver(d);
        await loadBusStudents(session.schoolId, d.bus_route ?? '');
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  }

  async function loadBusStudents(sid: string, route: string) {
    if (!route) return;
    try {
      const snap = await getDocs(query(
        collection(db, 'schools', sid, 'students'),
        where('bus_route', '==', route)
      ));
      const students = snap.docs.map(d => ({ id: d.id, ...d.data() } as Student));
      setBusStudents(students);
      setTotalStudents(students.length);

      // Build mock stop data from students' addresses grouped by area
      const stopMap: Record<string, number> = {};
      students.forEach(s => {
        const area = (s.address?.split(',')[1] ?? 'Main Stop').trim();
        stopMap[area] = (stopMap[area] ?? 0) + 1;
      });
      const stops: RouteStop[] = Object.entries(stopMap).map(([name, count], i) => ({
        name,
        student_count: count,
        time: `${7 + Math.floor(i * 0.5)}:${i % 2 === 0 ? '00' : '30'} AM`,
      }));
      setRouteStops(stops.slice(0, 6));
    } catch (e) { console.error(e); }
  }

  async function handleLogout() {
    Alert.alert('Logout', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout', style: 'destructive',
        onPress: async () => { await signOut(); await clearUserSession(); router.replace('/'); },
      },
    ]);
  }

  function handleCallSchool() {
    Linking.openURL('tel:+911234567890');
  }

  function handleEmergency() {
    Alert.alert(
      '🚨 Emergency Alert',
      'This will call 112 (Emergency Services). Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Call 112', style: 'destructive', onPress: () => Linking.openURL('tel:112') },
      ]
    );
  }

  const onRefresh = useCallback(() => { setRefreshing(true); initScreen(); }, []);

  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
  const now = new Date();
  const hour = now.getHours();
  const isMorning = hour >= 6 && hour < 12;
  const isAfternoon = hour >= 12 && hour < 18;

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.greeting}>
              {isMorning ? 'Good Morning!' : isAfternoon ? 'Good Afternoon!' : 'Good Evening!'}
            </Text>
            <Text style={styles.driverName}>{driver?.name ?? 'Driver'}</Text>
          </View>
          <TouchableOpacity style={styles.emergencyBtn} onPress={handleEmergency} activeOpacity={0.85}>
            <MaterialCommunityIcons name="alarm-light" size={20} color="#FFFFFF" />
            <Text style={styles.emergencyText}>SOS</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.dateText}>{today}</Text>
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
            {/* Bus Info Card */}
            <View style={styles.busCard}>
              <View style={styles.busIcon}>
                <MaterialCommunityIcons name="bus" size={32} color={COLORS.accent} />
              </View>
              <View style={styles.busInfo}>
                <Text style={styles.busRoute}>Route: {driver?.bus_route ?? 'Not Assigned'}</Text>
                <Text style={styles.busStat}>{totalStudents} students on this route</Text>
                {driver?.bus_number && (
                  <Text style={styles.busNumber}>Bus No: {driver.bus_number}</Text>
                )}
              </View>
            </View>

            {/* Trip Status */}
            <View style={styles.tripCard}>
              <Text style={styles.tripLabel}>TODAY'S TRIPS</Text>
              <View style={styles.tripRow}>
                <View style={[styles.tripItem, isMorning && styles.tripItemActive]}>
                  <MaterialCommunityIcons
                    name="weather-sunny"
                    size={22}
                    color={isMorning ? '#FFFFFF' : COLORS.textSecondary}
                  />
                  <Text style={[styles.tripTime, isMorning && { color: '#FFFFFF' }]}>Morning</Text>
                  <Text style={[styles.tripTimeVal, isMorning && { color: '#FFFFFF' }]}>7:00 AM</Text>
                </View>
                <MaterialCommunityIcons name="arrow-right" size={20} color={COLORS.border} />
                <View style={[styles.tripItem, isAfternoon && styles.tripItemActive]}>
                  <MaterialCommunityIcons
                    name="weather-sunset"
                    size={22}
                    color={isAfternoon ? '#FFFFFF' : COLORS.textSecondary}
                  />
                  <Text style={[styles.tripTime, isAfternoon && { color: '#FFFFFF' }]}>Afternoon</Text>
                  <Text style={[styles.tripTimeVal, isAfternoon && { color: '#FFFFFF' }]}>1:30 PM</Text>
                </View>
              </View>
            </View>

            {/* Stats Row */}
            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={styles.statVal}>{totalStudents}</Text>
                <Text style={styles.statLabel}>Students</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statVal}>{routeStops.length}</Text>
                <Text style={styles.statLabel}>Stops</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={[styles.statVal, { color: isMorning || isAfternoon ? COLORS.success : COLORS.warning }]}>
                  {isMorning ? 'Morning' : isAfternoon ? 'Afternoon' : 'Off Duty'}
                </Text>
                <Text style={styles.statLabel}>Status</Text>
              </View>
            </View>

            {/* Route Stops */}
            {routeStops.length > 0 && (
              <>
                <Text style={styles.sectionLabel}>TODAY'S ROUTE STOPS</Text>
                <View style={styles.stopsCard}>
                  {routeStops.map((stop, i) => (
                    <View key={i} style={[styles.stopRow, i < routeStops.length - 1 && styles.stopRowBorder]}>
                      <View style={styles.stopLeft}>
                        <View style={[
                          styles.stopDot,
                          { backgroundColor: i === 0 ? COLORS.success : i === routeStops.length - 1 ? COLORS.error : COLORS.primary }
                        ]} />
                        {i < routeStops.length - 1 && <View style={styles.stopLine} />}
                      </View>
                      <View style={styles.stopInfo}>
                        <Text style={styles.stopName}>{stop.name}</Text>
                        <Text style={styles.stopStudents}>{stop.student_count} students</Text>
                      </View>
                      <Text style={styles.stopTime}>{stop.time}</Text>
                    </View>
                  ))}
                </View>
              </>
            )}

            {!driver?.bus_route && (
              <View style={styles.warningCard}>
                <MaterialCommunityIcons name="alert-circle" size={24} color={COLORS.warning} />
                <Text style={styles.warningText}>
                  No bus route assigned. Contact the school administrator.
                </Text>
              </View>
            )}

            {/* Action Buttons */}
            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/driver/students')} activeOpacity={0.8}>
                <MaterialCommunityIcons name="account-group" size={22} color={COLORS.primary} />
                <Text style={styles.actionBtnText}>View Students</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, styles.actionBtnCall]} onPress={handleCallSchool} activeOpacity={0.8}>
                <MaterialCommunityIcons name="phone" size={22} color="#FFFFFF" />
                <Text style={[styles.actionBtnText, { color: '#FFFFFF' }]}>Call School</Text>
              </TouchableOpacity>
            </View>

            {/* Logout */}
            <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
              <MaterialCommunityIcons name="logout" size={18} color={COLORS.error} />
              <Text style={styles.logoutText}>Logout</Text>
            </TouchableOpacity>

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
  driverName: { color: '#FFFFFF', fontSize: 22, fontWeight: 'bold', marginTop: 2 },
  emergencyBtn: { backgroundColor: COLORS.error, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 6 },
  emergencyText: { color: '#FFFFFF', fontSize: 13, fontWeight: 'bold' },
  dateText: { color: 'rgba(255,255,255,0.6)', fontSize: 13, marginTop: 8 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  busCard: { backgroundColor: COLORS.primary, borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 12 },
  busIcon: { width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  busInfo: {},
  busRoute: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
  busStat: { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 3 },
  busNumber: { color: COLORS.accent, fontSize: 13, fontWeight: '600', marginTop: 3 },
  tripCard: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, marginBottom: 12, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3 },
  tripLabel: { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary, letterSpacing: 1, marginBottom: 12, textTransform: 'uppercase' },
  tripRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  tripItem: { alignItems: 'center', padding: 12, borderRadius: 12, minWidth: 100, backgroundColor: COLORS.background },
  tripItemActive: { backgroundColor: COLORS.primary },
  tripTime: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, marginTop: 4 },
  tripTimeVal: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  statBox: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14, alignItems: 'center', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3 },
  statVal: { fontSize: 18, fontWeight: 'bold', color: COLORS.textPrimary },
  statLabel: { fontSize: 11, color: COLORS.textSecondary, marginTop: 4 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary, letterSpacing: 1, marginBottom: 10, textTransform: 'uppercase' },
  stopsCard: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, marginBottom: 16, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3 },
  stopRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 8, gap: 12 },
  stopRowBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  stopLeft: { width: 20, alignItems: 'center' },
  stopDot: { width: 12, height: 12, borderRadius: 6, marginTop: 4 },
  stopLine: { width: 2, flex: 1, backgroundColor: COLORS.border, marginTop: 4, marginBottom: -8, minHeight: 20 },
  stopInfo: { flex: 1 },
  stopName: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary },
  stopStudents: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  stopTime: { fontSize: 13, fontWeight: '600', color: COLORS.primary },
  warningCard: { backgroundColor: '#FFF7ED', borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 16, borderWidth: 1, borderColor: COLORS.warning + '40' },
  warningText: { flex: 1, fontSize: 14, color: COLORS.textSecondary, lineHeight: 20 },
  actionRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  actionBtn: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 10, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: COLORS.border },
  actionBtnCall: { backgroundColor: COLORS.success, borderColor: COLORS.success },
  actionBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.primary },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderColor: COLORS.error, borderRadius: 8, paddingVertical: 14 },
  logoutText: { color: COLORS.error, fontSize: 15, fontWeight: '700' },
});