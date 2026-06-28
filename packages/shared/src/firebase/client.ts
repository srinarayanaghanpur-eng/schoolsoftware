import { initializeApp, getApps } from "firebase/app";
import { getAuth, initializeAuth, inMemoryPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Security: keep the auth session in memory only. Nothing is written to the
// browser (no IndexedDB/localStorage), so a full page reload or opening an
// admin URL directly always requires a fresh login.
function createAuth(app: ReturnType<typeof initializeApp>) {
  try {
    return initializeAuth(app, { persistence: inMemoryPersistence });
  } catch {
    // initializeAuth throws if auth was already initialized (e.g. HMR/double
    // import). Fall back to the existing instance in that case.
    return getAuth(app);
  }
}

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
export const auth = firebaseApp ? createAuth(firebaseApp) : ({ currentUser: null } as ReturnType<typeof getAuth>);
export const db = firebaseApp ? getFirestore(firebaseApp) : ({} as ReturnType<typeof getFirestore>);
export const storage = firebaseApp ? getStorage(firebaseApp) : ({} as ReturnType<typeof getStorage>);
