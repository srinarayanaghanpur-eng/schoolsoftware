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
  export type Persistence = unknown;
  export const browserLocalPersistence: Persistence;
  export const browserSessionPersistence: Persistence;
  export function getAuth(app?: unknown): Auth;
  export function initializeAuth(app: unknown, options?: unknown): Auth;
  export function getReactNativePersistence(storage: unknown): unknown;
  export function setPersistence(auth: Auth, persistence: Persistence): Promise<void>;
  export function signInWithEmailAndPassword(auth: Auth, email: string, password: string): Promise<{ user: User }>;
  export function onAuthStateChanged(auth: Auth, callback: (user: User | null) => void): () => void;
  export function signOut(auth: Auth): Promise<void>;
}

declare module "firebase/firestore" {
  export type Firestore = unknown;
  export type DocumentReference = {
    id: string;
  } & unknown;
  export type CollectionReference = unknown;
  export type Query = unknown;
  export type QueryConstraint = unknown;
  export type DocumentSnapshot<T = unknown> = {
    exists(): boolean;
    data(): T | any;
    id: string;
  };
  export type QuerySnapshot<T = unknown> = {
    docs: Array<{ id: string; data(): any }>;
    empty: boolean;
    size: number;
    forEach(callback: (doc: any) => void): void;
  };
  export type Timestamp = {
    readonly seconds: number;
    readonly nanoseconds: number;
  };
  
  export function getFirestore(app?: unknown): Firestore;
  export function doc(db: Firestore, ...pathSegments: string[]): DocumentReference;
  export function collection(db: Firestore, ...pathSegments: string[]): CollectionReference;
  export function query(collectionRef: CollectionReference, ...queryConstraints: QueryConstraint[]): Query;
  export function where(fieldPath: string, opStr: string, value: unknown): QueryConstraint;
  export function orderBy(fieldPath: string, directionStr?: 'asc' | 'desc'): QueryConstraint;
  export function limit(limit: number): QueryConstraint;
  
  export function getDoc<T = unknown>(reference: DocumentReference): Promise<DocumentSnapshot<T>>;
  export function getDocs<T = unknown>(query: Query): Promise<QuerySnapshot<T>>;
  export function addDoc(collectionRef: CollectionReference, data: Record<string, unknown>): Promise<DocumentReference>;
  export function setDoc(reference: DocumentReference, data: Record<string, unknown>, options?: { merge?: boolean }): Promise<void>;
  export function updateDoc(reference: DocumentReference, data: Record<string, unknown>): Promise<void>;
  export function deleteDoc(reference: DocumentReference): Promise<void>;
  
  export function serverTimestamp(): unknown;
  export const Timestamp: {
    now(): Timestamp;
    fromDate(date: Date): Timestamp;
  };
  
  export function writeBatch(db: Firestore): {
    set(ref: DocumentReference, data: Record<string, unknown>): unknown;
    update(ref: DocumentReference, data: Record<string, unknown>): unknown;
    delete(ref: DocumentReference): unknown;
    commit(): Promise<void>;
  };
}

declare module "firebase/storage" {
  export type FirebaseStorage = unknown;
  export type StorageReference = unknown;
  export type UploadTask = {
    on(
      event: string,
      next?: (snapshot: UploadTaskSnapshot) => void,
      error?: (error: Error) => void,
      complete?: () => void
    ): () => void;
    snapshot: UploadTaskSnapshot;
  };
  export type UploadTaskSnapshot = {
    bytesTransferred: number;
    totalBytes: number;
    ref: StorageReference;
  };
  export type SettableMetadata = Record<string, unknown>;
  export function getStorage(app?: unknown): FirebaseStorage;
  export function ref(storage: FirebaseStorage, path: string): StorageReference;
  export function uploadBytesResumable(ref: StorageReference, data: Blob | Uint8Array | ArrayBuffer, metadata?: SettableMetadata): UploadTask;
  export function getDownloadURL(ref: StorageReference): Promise<string>;
  export function deleteObject(ref: StorageReference): Promise<void>;
}
