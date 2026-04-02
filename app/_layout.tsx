import { useEffect, useState } from 'react';
import { Stack, router } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider as PaperProvider, MD3LightTheme } from 'react-native-paper';
import { ActivityIndicator, View } from 'react-native';

import { loadLanguage } from '@/lib/i18n';
import { COLORS } from '@/lib/theme';
import { onAuthStateChanged } from '@/lib/firebase';
import { getUserSession } from '@/lib/storage';

const paperTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: COLORS.primary,
    accent: COLORS.accent,
    background: COLORS.background,
  },
};

export default function RootLayout() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLanguage();

    const unsubscribe = onAuthStateChanged(async (user) => {
      if (user) {
        // ✅ user logged in → get role
        const session = await getUserSession();

        if (session?.role) {
          // route based on role
          const routes: Record<string, string> = {
            admin: '/admin',
            super_admin: '/admin',
            principal: '/admin',
            teacher: '/teacher',
            class_teacher: '/teacher',
            parent: '/parents',
            accountant: '/accountant',
            driver: '/driver',
            bus_driver: '/driver',
          };

          router.replace(routes[session.role] || '/admin');
        } else {
          router.replace('/');
        }
      } else {
        // ❌ not logged in
        router.replace('/');
      }

      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // ✅ prevent flicker / wrong redirect
  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <PaperProvider theme={paperTheme}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="phone-auth" />
          <Stack.Screen name="school-setup" />
          <Stack.Screen name="admin" />
          <Stack.Screen name="teacher" />
          <Stack.Screen name="parents" />
          <Stack.Screen name="accountant" />
          <Stack.Screen name="driver" />
        </Stack>
      </PaperProvider>
    </SafeAreaProvider>
  );
}
