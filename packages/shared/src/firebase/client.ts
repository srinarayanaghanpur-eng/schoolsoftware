import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId:
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? process.env.EXPO_PUBLIC_FIREBASE_APP_ID
};

export const isFirebaseConfigured = Object.values(firebaseConfig).every(Boolean);

export const firebaseApp = isFirebaseConfigured ? (getApps().length ? getApps()[0] : initializeApp(firebaseConfig)) : undefined;

function createAuth(): ReturnType<typeof getAuth> {
  if (typeof window === "undefined") return { currentUser: null } as ReturnType<typeof getAuth>;
  if (!firebaseApp) return { currentUser: null } as ReturnType<typeof getAuth>;
  return getAuth(firebaseApp);
}

export const auth = createAuth();

function createDb(): Firestore {
  if (typeof window === "undefined") return {} as Firestore;
  if (!firebaseApp) return {} as Firestore;
  return getFirestore(firebaseApp);
}

function createStorage(): ReturnType<typeof getStorage> {
  if (typeof window === "undefined") return {} as ReturnType<typeof getStorage>;
  if (!firebaseApp) return {} as ReturnType<typeof getStorage>;
  return getStorage(firebaseApp);
}

export const db = createDb();
export const storage = createStorage();
