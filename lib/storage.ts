// lib/storage.ts — AsyncStorage helpers for MyChalkPad

import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserRole } from './types';

const KEYS = {
  USER_SESSION: 'user_session',
  SCHOOL_ID: 'school_id',
  LANGUAGE: 'language',
  THEME: 'theme',
  NOTIFICATIONS_ENABLED: 'notifications_enabled',
  LAST_SYNC: 'last_sync',
};

export interface UserSession {
  uid: string;
  email: string | null;
  phone: string | null;
  role: UserRole;
  schoolId: string;
  name?: string;
  photoUrl?: string;
}

// ─── User Session ──────────────────────────────────────────────────────────────

export async function saveUserSession(
  uid: string,
  schoolId: string,
  role: UserRole,
  extra?: Partial<Omit<UserSession, 'uid' | 'schoolId' | 'role'>>
): Promise<void> {
  const session: UserSession = { uid, schoolId, role, email: null, phone: null, ...extra };
  await AsyncStorage.setItem(KEYS.USER_SESSION, JSON.stringify(session));
}

export async function getUserSession(): Promise<UserSession | null> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.USER_SESSION);
    return raw ? (JSON.parse(raw) as UserSession) : null;
  } catch {
    return null;
  }
}

export async function clearUserSession(): Promise<void> {
  await AsyncStorage.multiRemove([KEYS.USER_SESSION, KEYS.SCHOOL_ID]);
}

// ─── School ID ─────────────────────────────────────────────────────────────────

export async function saveSchoolId(schoolId: string): Promise<void> {
  await AsyncStorage.setItem(KEYS.SCHOOL_ID, schoolId);
}

export async function getSchoolId(): Promise<string | null> {
  return AsyncStorage.getItem(KEYS.SCHOOL_ID);
}

// ─── Language ──────────────────────────────────────────────────────────────────

export async function setLanguage(lang: string): Promise<void> {
  await AsyncStorage.setItem(KEYS.LANGUAGE, lang);
}

export async function getLanguage(): Promise<string> {
  return (await AsyncStorage.getItem(KEYS.LANGUAGE)) ?? 'en';
}

// ─── Theme ─────────────────────────────────────────────────────────────────────

export async function setTheme(theme: 'light' | 'dark'): Promise<void> {
  await AsyncStorage.setItem(KEYS.THEME, theme);
}

export async function getTheme(): Promise<'light' | 'dark'> {
  const v = await AsyncStorage.getItem(KEYS.THEME);
  return (v === 'dark' ? 'dark' : 'light');
}

// ─── Notifications ─────────────────────────────────────────────────────────────

export async function setNotificationsEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(KEYS.NOTIFICATIONS_ENABLED, String(enabled));
}

export async function getNotificationsEnabled(): Promise<boolean> {
  const v = await AsyncStorage.getItem(KEYS.NOTIFICATIONS_ENABLED);
  return v !== 'false';
}

// ─── Last Sync ─────────────────────────────────────────────────────────────────

export async function setLastSync(timestamp: number): Promise<void> {
  await AsyncStorage.setItem(KEYS.LAST_SYNC, String(timestamp));
}

export async function getLastSync(): Promise<number | null> {
  const v = await AsyncStorage.getItem(KEYS.LAST_SYNC);
  return v ? Number(v) : null;
}