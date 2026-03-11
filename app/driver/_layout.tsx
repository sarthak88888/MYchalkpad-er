import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Tabs, router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getUserSession } from '@/lib/storage';
import { COLORS } from '@/lib/theme';

export default function DriverLayout() {
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    async function checkRole() {
      const session = await getUserSession();
      if (!session.role || session.role !== 'bus_driver') {
        router.replace('/');
      } else {
        setChecking(false);
      }
    }
    checkRole();
  }, []);

  if (checking) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background }}>
        <ActivityIndicator color={COLORS.primary} size="large" />
      </View>
    );
  }

  return (
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
          shadowOpacity: 0.12,
          shadowRadius: 4,
          height: 60,
          paddingBottom: 8,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600', marginTop: 2 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="bus" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="students"
        options={{
          title: 'Students',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="account-group" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}