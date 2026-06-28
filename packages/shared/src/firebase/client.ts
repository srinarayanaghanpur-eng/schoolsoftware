import { initializeApp, getApps } from "firebase/app";
import { getAuth, initializeAuth, browserSessionPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Security: use session persistence. The login survives page reloads while the
// browser is open, but closing the browser (or opening a new browser/incognito
// window) requires a fresh login — it is never saved permanently.
function createAuth(app: ReturnType<typeof initializeApp>) {
  try {
    return initializeAuth(app, { persistence: browserSessionPersistence });
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
