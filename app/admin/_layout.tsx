import { useEffect, useState } from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { Tabs, router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getUserSession } from '@/lib/storage';
import { COLORS } from '@/lib/theme';
import NetInfo from '@react-native-community/netinfo';
import * as Notifications from 'expo-notifications';

export default function AdminLayout() {
  const [checking, setChecking] = useState(true);
  const [isConnected, setIsConnected] = useState(true);

  useEffect(() => {
    getUserSession().then((session) => {
      if (
        session.role !== 'super_admin' &&
        session.role !== 'principal'
      ) {
        router.replace('/');
      } else {
        setChecking(false);
      }
    });

    // ✅ NEW — Offline connection checker
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsConnected(!!state.isConnected);
    });

    // ✅ NEW — Notification permission for Android 13+
    async function requestNotificationPermission() {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        console.log('Notification permission not granted');
      }
    }
    requestNotificationPermission();

    return () => unsubscribe();
  }, []);

  if (checking) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: COLORS.background,
        }}
      >
        <ActivityIndicator color={COLORS.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>

      {/* ✅ NEW — Offline Banner */}
      {!isConnected && (
        <View style={styles.offlineBanner}>
          <MaterialCommunityIcons name="wifi-off" size={16} color="#FFFFFF" />
          <Text style={styles.offlineText}>No Internet Connection</Text>
        </View>
      )}

      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: COLORS.accent,
          tabBarInactiveTintColor: '#64748B',
          tabBarStyle: {
            backgroundColor: COLORS.primary,
            borderTopWidth: 0,
            elevation: 8,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.15,
            shadowRadius: 4,
            height: 60,
            paddingBottom: 8,
            paddingTop: 4,
          },
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '600',
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Dashboard',
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons
                name="view-dashboard"
                color={color}
                size={size}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="students"
          options={{
            title: 'Students',
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons
                name="account-group"
                color={color}
                size={size}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="reports"
          options={{
            title: 'Reports',
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons
                name="chart-bar"
                color={color}
                size={size}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: 'Settings',
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons name="cog" color={color} size={size} />
            ),
          }}
        />
      </Tabs>
    </View>
  );
}

// ✅ NEW STYLES — only for offline banner
const styles = StyleSheet.create({
  offlineBanner: {
    backgroundColor: '#EF4444',
    paddingVertical: 6,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  offlineText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
});
