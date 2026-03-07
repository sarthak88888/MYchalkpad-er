import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';

let sentryInitialized = false;

export function initSentry(): void {
  const dsn: string = Constants.expoConfig?.extra?.sentryDsn ?? '';

  if (!dsn || dsn === 'REPLACE_WITH_YOUR_SENTRY_DSN') {
    console.log('Sentry DSN not configured — skipping crash monitoring init');
    return;
  }

  if (sentryInitialized) {
    return;
  }

  Sentry.init({
    dsn,
    enableAutoSessionTracking: true,
    sessionTrackingIntervalMillis: 10000,
    tracesSampleRate: 0.2,
    debug: false,
  });

  sentryInitialized = true;
  console.log('Sentry initialized');
}

export function captureError(error: Error, context?: Record<string, any>): void {
  if (!sentryInitialized) return;
  Sentry.captureException(error, { extra: context });
}

export function setUserContext(phone: string, role: string): void {
  if (!sentryInitialized) return;
  Sentry.setUser({ id: phone, role });
}

export function clearUserContext(): void {
  if (!sentryInitialized) return;
  Sentry.setUser(null);
}