import Constants from 'expo-constants';
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  initializeAuth,
  getReactNativePersistence,
  signOut as firebaseSignOut,
  onAuthStateChanged as firebaseOnAuthStateChanged,
  User,
} from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyBPkCc1b0mDOGM8uoTtjtvItaQdqYLR8Qo",
  authDomain: "mychalkpad-erp.firebaseapp.com",
  projectId: "mychalkpad-erp",
  storageBucket: "mychalkpad-erp.firebasestorage.app",
  messagingSenderId: "573972831065",
  appId: "1:573972831065:web:b50e3339a9e210d4460a48",
  measurementId: "G-D6EBCF1870"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();


//  FIXED AUTH (PERSISTENT LOGIN)
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});


export const db = getFirestore(app);
export const storage = getStorage(app);

export function getCurrentUser(): User | null {
  return auth.currentUser;
}

export async function signOut(): Promise<void> {
  await firebaseSignOut(auth);
}

export function onAuthStateChanged(
  callback: (user: User | null) => void
): () => void {
  return firebaseOnAuthStateChanged(auth, callback);
}

export default app;
