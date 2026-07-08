import { initializeApp, getApps } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { getStorage, connectStorageEmulator } from "firebase/storage";
import { TEST_CONFIG } from "./test-config";

const firebaseConfig = {
  apiKey: "test-api-key",
  authDomain: "test-project.firebaseapp.com",
  projectId: "teacher-nara",
  storageBucket: "test-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "test-app-id",
};

export function getEmulatorApp() {
  const appName = "emulator-test";
  const existing = getApps().find((a) => a.name === appName);
  if (existing) return existing;

  const app = initializeApp(firebaseConfig, appName);

  const auth = getAuth(app);
  connectAuthEmulator(auth, `http://${TEST_CONFIG.emulatorHost}:${TEST_CONFIG.emulatorAuthPort}`, { disableWarnings: true });

  const db = getFirestore(app);
  connectFirestoreEmulator(db, TEST_CONFIG.emulatorHost, TEST_CONFIG.emulatorFirestorePort);

  return app;
}

export function getEmulatorAuth() {
  const app = getEmulatorApp();
  return getAuth(app);
}

export function getEmulatorDb() {
  const app = getEmulatorApp();
  return getFirestore(app);
}
