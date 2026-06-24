declare module "firebase/app" {
  export type FirebaseApp = unknown;
  export function initializeApp(config: Record<string, unknown>): FirebaseApp;
  export function getApps(): FirebaseApp[];
}

declare module "firebase/auth" {
  export type User = {
    uid: string;
    email?: string | null;
    displayName?: string | null;
    getIdToken(): Promise<string>;
    getIdTokenResult(): Promise<{ claims: Record<string, unknown> }>;
  };
  export type Auth = {
    currentUser: User | null;
  };
  export function getAuth(app?: unknown): Auth;
  export function initializeAuth(app: unknown, options?: unknown): Auth;
  export function getReactNativePersistence(storage: unknown): unknown;
  export function signInWithEmailAndPassword(auth: Auth, email: string, password: string): Promise<{ user: User }>;
  export function onAuthStateChanged(auth: Auth, callback: (user: User | null) => void): () => void;
  export function signOut(auth: Auth): Promise<void>;
}

declare module "firebase/firestore" {
  export type Firestore = unknown;
  export type DocumentReference = unknown;
  export type DocumentSnapshot<T = unknown> = {
    exists(): boolean;
    data(): T;
  };
  export function getFirestore(app?: unknown): Firestore;
  export function doc(db: Firestore, ...pathSegments: string[]): DocumentReference;
  export function getDoc<T = unknown>(reference: DocumentReference): Promise<DocumentSnapshot<T>>;
  export function setDoc(reference: DocumentReference, data: Record<string, unknown>, options?: { merge?: boolean }): Promise<void>;
}

declare module "firebase/storage" {
  export type FirebaseStorage = unknown;
  export function getStorage(app?: unknown): FirebaseStorage;
}
