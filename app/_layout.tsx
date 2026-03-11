import { useEffect } from 'react';
import { Stack, router } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider as PaperProvider, MD3LightTheme } from 'react-native-paper';
import { onAuthStateChanged } from '@/lib/firebase';
import { saveUserSession } from '@/lib/storage';
import { loadLanguage } from '@/lib/i18n';
import { registerForPushNotifications } from '@/lib/notifications';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { UserRole } from '@/lib/types';
import { COLORS } from '@/lib/theme';

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
  useEffect(() => {
    loadLanguage();
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(async (user) => {
      if (!user) {
        router.replace('/');
        return;
      }

      try {
        const phone = user.phoneNumber?.replace('+91', '') ?? '';

        const userRef = doc(db, 'users', phone);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
          router.replace('/');
          return;
        }

        const userData = userSnap.data();
        const role = userData.role as UserRole;
        const schoolId = userData.school_id ?? 'school_001';
        const name = userData.name ?? '';

        await saveUserSession(phone, role, schoolId, name);
        registerForPushNotifications(phone);

        switch (role) {
          case 'admin':
            router.replace('/admin');
            break;
          case 'teacher':
            router.replace('/teacher');
            break;
          case 'parent':
            router.replace('/parents'); // ✅ fixed: folder is 'parents' not 'parent'
            break;
          case 'accountant':
            router.replace('/accountant');
            break;
          default:
            router.replace('/');
        }
      } catch (error) {
        console.error('Auth state change error:', error);
        router.replace('/');
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <SafeAreaProvider>
      <PaperProvider theme={paperTheme}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="admin" />
          <Stack.Screen name="teacher" />
          <Stack.Screen name="parents" /> {/* ✅ fixed: was 'parent' */}
          <Stack.Screen name="accountant" />
        </Stack>
      </PaperProvider>
    </SafeAreaProvider>
  );
}