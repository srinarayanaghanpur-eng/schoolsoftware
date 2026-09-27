import { initializeApp, getApps } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore, type Firestore } from "firebase/firestore";
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

// Spark-plan saver: route all client traffic to local emulators when enabled,
// so development/testing burns ZERO production quota. Set in .env.local:
//   NEXT_PUBLIC_USE_FIREBASE_EMULATOR=true
// and run: firebase emulators:start (ports in firebase.json).
// Server routes honor FIRESTORE_EMULATOR_HOST / FIREBASE_AUTH_EMULATOR_HOST
// automatically via the Admin SDK — no code change needed there.
export const useFirebaseEmulator =
  typeof window !== "undefined" &&
  (process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === "true" ||
    process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATOR === "true");

function createAuth(): ReturnType<typeof getAuth> {
  if (typeof window === "undefined") return { currentUser: null } as ReturnType<typeof getAuth>;
  if (!firebaseApp) return { currentUser: null } as ReturnType<typeof getAuth>;
  const a = getAuth(firebaseApp);
  if (useFirebaseEmulator) {
    try {
      connectAuthEmulator(a, "http://localhost:9099", { disableWarnings: true });
    } catch {
      // Already connected (HMR double-init) — safe to ignore.
    }
  }
  return a;
}

export const auth = createAuth();

function createDb(): Firestore {
  if (typeof window === "undefined") return {} as Firestore;
  if (!firebaseApp) return {} as Firestore;
  const d = getFirestore(firebaseApp);
  if (useFirebaseEmulator) {
    try {
      connectFirestoreEmulator(d, "localhost", 8080);
    } catch {
      // Already connected (HMR double-init) — safe to ignore.
    }
  }
  return d;
}

function createStorage(): ReturnType<typeof getStorage> {
  if (typeof window === "undefined") return {} as ReturnType<typeof getStorage>;
  if (!firebaseApp) return {} as ReturnType<typeof getStorage>;
  return getStorage(firebaseApp);
}

export const db = createDb();
export const storage = createStorage();
