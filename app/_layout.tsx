import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider as PaperProvider, MD3LightTheme } from 'react-native-paper';
import { loadLanguage } from '@/lib/i18n';
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
