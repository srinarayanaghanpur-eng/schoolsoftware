declare module "firebase/app" {
  export type FirebaseApp = import("@firebase/app").FirebaseApp;
  export function initializeApp(config: Record<string, unknown>): FirebaseApp;
  export function getApps(): FirebaseApp[];
}

declare module "firebase/auth" {
  export type Auth = import("@firebase/auth").Auth;
  export type User = import("@firebase/auth").User;
  export function getAuth(app?: import("@firebase/app").FirebaseApp): Auth;
  export function initializeAuth(app: unknown, options?: unknown): Auth;
  export function getReactNativePersistence(storage: unknown): unknown;
  export function signInWithEmailAndPassword(auth: Auth, email: string, password: string): Promise<{ user: User }>;
  export function onAuthStateChanged(auth: Auth, callback: (user: User | null) => void): () => void;
  export function signOut(auth: Auth): Promise<void>;
}

declare module "firebase/firestore" {
  export type Firestore = import("@firebase/firestore").Firestore;
  export type DocumentData = import("@firebase/firestore").DocumentData;
  export type DocumentReference<T = DocumentData> = import("@firebase/firestore").DocumentReference<T>;
  export type DocumentSnapshot<T = DocumentData> = import("@firebase/firestore").DocumentSnapshot<T>;
  export type QueryConstraint = import("@firebase/firestore").QueryConstraint;
  export type QueryDocumentSnapshot<T = DocumentData> = import("@firebase/firestore").QueryDocumentSnapshot<T>;
  export type QuerySnapshot<T = DocumentData> = import("@firebase/firestore").QuerySnapshot<T>;
  export type Unsubscribe = import("@firebase/firestore").Unsubscribe;
  export const Timestamp: typeof import("@firebase/firestore").Timestamp;
  export function getFirestore(app?: import("@firebase/app").FirebaseApp): Firestore;
  export function collection(firestore: Firestore, path: string, ...pathSegments: string[]): import("@firebase/firestore").CollectionReference<DocumentData>;
  export function doc(db: Firestore, ...pathSegments: string[]): DocumentReference<DocumentData>;
  export function addDoc(reference: import("@firebase/firestore").CollectionReference<DocumentData>, data: Record<string, unknown>): Promise<DocumentReference<DocumentData>>;
  export function getDoc<T = DocumentData>(reference: DocumentReference<T>): Promise<DocumentSnapshot<T>>;
  export function getDocs<T = DocumentData>(query: import("@firebase/firestore").Query<T>): Promise<QuerySnapshot<T>>;
  export function limit(limit: number): QueryConstraint;
  export function onSnapshot<T = DocumentData>(
    reference: DocumentReference<T>,
    onNext: (snapshot: DocumentSnapshot<T>) => void,
    onError?: (error: Error) => void
  ): Unsubscribe;
  export function onSnapshot<T = DocumentData>(
    query: import("@firebase/firestore").Query<T>,
    onNext: (snapshot: QuerySnapshot<T>) => void,
    onError?: (error: Error) => void
  ): Unsubscribe;
  export function orderBy(fieldPath: string, directionStr?: "asc" | "desc"): QueryConstraint;
  export function query<T = DocumentData>(
    query: import("@firebase/firestore").Query<T>,
    ...queryConstraints: QueryConstraint[]
  ): import("@firebase/firestore").Query<T>;
  export function query<T = DocumentData>(
    collection: import("@firebase/firestore").CollectionReference<T>,
    ...queryConstraints: QueryConstraint[]
  ): import("@firebase/firestore").Query<T>;
  export function setDoc(reference: DocumentReference, data: Record<string, unknown>, options?: { merge?: boolean }): Promise<void>;
  export function where(fieldPath: string, opStr: import("@firebase/firestore").WhereFilterOp, value: unknown): QueryConstraint;
}

declare module "firebase/storage" {
  export type FirebaseStorage = unknown;
  export function getStorage(app?: unknown): FirebaseStorage;
}
