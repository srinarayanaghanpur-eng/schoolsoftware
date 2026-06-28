/**
 * IndexedDB Cache Layer for offline-first performance
 * Caches Firebase data locally to eliminate network latency
 */

const DB_NAME = 'attendance-cache';
const DB_VERSION = 1;

interface CacheEntry<T> {
  key: string;
  data: T;
  timestamp: number;
  ttl?: number; // time-to-live in milliseconds
}

class IndexedDBCache {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void>;

  constructor() {
    this.initPromise = this.initDB();
  }

  private initDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        if (!db.objectStoreNames.contains('students')) {
          db.createObjectStore('students', { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains('teachers')) {
          db.createObjectStore('teachers', { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains('payments')) {
          db.createObjectStore('payments', { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains('attendance')) {
          db.createObjectStore('attendance', { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains('dashboard')) {
          db.createObjectStore('dashboard', { keyPath: 'key' });
        }
      };
    });
  }

  async set<T>(storeName: string, key: string, data: T, ttl?: number): Promise<void> {
    await this.initPromise;

    if (!this.db) return;

    const entry: CacheEntry<T> = {
      key,
      data,
      timestamp: Date.now(),
      ttl
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(entry);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async get<T>(storeName: string, key: string): Promise<T | null> {
    await this.initPromise;

    if (!this.db) return null;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const entry = request.result as CacheEntry<T> | undefined;

        if (!entry) {
          resolve(null);
          return;
        }

        // Check if expired
        if (entry.ttl && Date.now() - entry.timestamp > entry.ttl) {
          this.delete(storeName, key).catch(() => {}); // clean up expired entry
          resolve(null);
          return;
        }

        resolve(entry.data);
      };
    });
  }

  async delete(storeName: string, key: string): Promise<void> {
    await this.initPromise;

    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async clear(storeName: string): Promise<void> {
    await this.initPromise;

    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.clear();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async getAllKeys(storeName: string): Promise<string[]> {
    await this.initPromise;

    if (!this.db) return [];

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAllKeys();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result as string[]);
    });
  }
}

export const cache = new IndexedDBCache();

/**
 * Cache wrapper for Firebase operations
 */
export async function getCachedOrFetch<T>(
  storeName: string,
  key: string,
  fetchFn: () => Promise<T>,
  ttl: number = 5 * 60 * 1000 // 5 minutes default
): Promise<T> {
  // Try to get from cache first
  const cached = await cache.get<T>(storeName, key);
  if (cached) {
    return cached;
  }

  // Fetch from Firebase
  const data = await fetchFn();

  // Store in cache
  await cache.set(storeName, key, data, ttl);

  return data;
}
