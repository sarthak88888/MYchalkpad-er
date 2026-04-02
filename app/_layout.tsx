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

    //  Safety fallback (prevents infinite white screen)
    const timeout = setTimeout(() => {
      console.log("⏱ Fallback triggered → going to login");
      setLoading(false);
      router.replace('/');
    }, 3000);

    const unsubscribe = onAuthStateChanged(async (user) => {
      clearTimeout(timeout);

      console.log(" Auth state:", user);

      try {
        if (user) {
          const session = await getUserSession();

          if (session?.role) {
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

            const route = routes[session.role] || '/admin';
            console.log(" Redirecting to:", route);

            router.replace(route);
          } else {
            console.log(" No session role → going login");
            router.replace('/');
          }
        } else {
          console.log(" No user → going login");
          router.replace('/');
        }
      } catch (err) {
        console.log(" Error in auth flow:", err);
        router.replace('/');
      } finally {
        setLoading(false);
      }
    });

    return () => {
      clearTimeout(timeout);
      unsubscribe();
    };
  }, []);

  //  Loading screen (prevents blank UI)
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
