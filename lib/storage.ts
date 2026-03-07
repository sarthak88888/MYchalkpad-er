import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserRole } from './types';

const KEYS = {
  PHONE: 'user_phone',
  ROLE: 'user_role',
  SCHOOL_ID: 'user_school_id',
  NAME: 'user_name',
  BIOMETRIC_ENABLED: 'biometric_enabled',
};

export interface UserSession {
  phone: string;
  role: UserRole | null;
  schoolId: string;
  name: string;
}

export async function saveUserSession(
  phone: string,
  role: UserRole,
  schoolId: string,
  name: string
): Promise<void> {
  await AsyncStorage.multiSet([
    [KEYS.PHONE, phone],
    [KEYS.ROLE, role],
    [KEYS.SCHOOL_ID, schoolId],
    [KEYS.NAME, name],
  ]);
}

export async function getUserSession(): Promise<UserSession> {
  const results = await AsyncStorage.multiGet([
    KEYS.PHONE,
    KEYS.ROLE,
    KEYS.SCHOOL_ID,
    KEYS.NAME,
  ]);

  const phone = results[0][1] ?? '';
  const role = (results[1][1] as UserRole) ?? null;
  const schoolId = results[2][1] ?? 'school_001';
  const name = results[3][1] ?? '';

  return { phone, role, schoolId, name };
}

export async function clearUserSession(): Promise<void> {
  await AsyncStorage.multiRemove([
    KEYS.PHONE,
    KEYS.ROLE,
    KEYS.SCHOOL_ID,
    KEYS.NAME,
  ]);
}

export async function setBiometricEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(KEYS.BIOMETRIC_ENABLED, enabled ? 'true' : 'false');
}

export async function getBiometricEnabled(): Promise<boolean> {
  const value = await AsyncStorage.getItem(KEYS.BIOMETRIC_ENABLED);
  return value === 'true';
}

export async function setLanguagePreference(lang: 'en' | 'hi'): Promise<void> {
  await AsyncStorage.setItem('language_preference', lang);
}

export async function getLanguagePreference(): Promise<'en' | 'hi'> {
  const value = await AsyncStorage.getItem('language_preference');
  return (value as 'en' | 'hi') ?? 'en';
}