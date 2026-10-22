/**
 * AsyncStorage Cache for React Native
 * Mobile equivalent of IndexedDB caching with TTL support
 *
 * Keys are namespaced per authenticated user (`@attendance_cache:<uid>:…`)
 * so two accounts sharing one device can never read each other's entries.
 * Logging out wipes every namespace (see clearAllNamespaces).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

const BASE_PREFIX = '@attendance_cache:';
const ANON_OWNER = 'anon';
/** Hard cap on entries per namespace; oldest-first eviction keeps storage bounded. */
const MAX_ENTRIES_PER_NAMESPACE = 200;

function devLog(message: string, error?: unknown): void {
  if (__DEV__) {
    console.warn(message, error);
  }
}

export class MobileCache {
  private prefix = `${BASE_PREFIX}${ANON_OWNER}:`;
  private ttl: number; // milliseconds
  /**
   * In-memory index of this namespace's keys. Storage scans (getAllKeys)
   * are expensive on-device, so writes consult this index and only scan
   * when it says the cap may be exceeded.
   */
  private knownKeys = new Set<string>();

  constructor(ttlMinutes: number = 5) {
    this.ttl = ttlMinutes * 60 * 1000;
  }

  /**
   * Scope all subsequent reads/writes to one authenticated user.
   * Also removes legacy un-namespaced entries so pre-upgrade data that
   * could belong to another account never resurfaces.
   * Does ONE storage scan to seed the key index (and evict overflow).
   */
  async setOwner(uid: string | null): Promise<void> {
    try {
      this.prefix = `${BASE_PREFIX}${uid || ANON_OWNER}:`;
      this.knownKeys.clear();
      const allKeys = await AsyncStorage.getAllKeys();
      const legacy = allKeys.filter(
        (key) => key.startsWith(BASE_PREFIX) && key.split(':').length === 2
      );
      if (legacy.length > 0) {
        await AsyncStorage.multiRemove(legacy);
      }
      for (const key of allKeys) {
        if (key.startsWith(this.prefix)) {
          this.knownKeys.add(key.replace(this.prefix, ''));
        }
      }
      if (this.knownKeys.size > MAX_ENTRIES_PER_NAMESPACE) {
        await this.enforceCap();
        await this.resyncKeys();
      }
    } catch (error) {
      devLog('[MobileCache] Failed to set owner:', error);
    }
  }

  /**
   * Set cached value with TTL.
   * @param ttlMinutes TTL in MINUTES (matches the constructor's unit).
   *   Callers previously passed a bare number here that was treated as
   *   milliseconds, which expired every entry instantly.
   */
  async set<T>(key: string, data: T, ttlMinutes?: number): Promise<void> {
    try {
      const expiresAt =
        Date.now() + (ttlMinutes !== undefined ? ttlMinutes * 60 * 1000 : this.ttl);
      const entry: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
        expiresAt
      };

      await AsyncStorage.setItem(
        `${this.prefix}${key}`,
        JSON.stringify(entry)
      );
      // Fast path: re-writing a known key never changes the count, so the
      // expensive cap scan runs only when a NEW key may push us over the cap.
      if (!this.knownKeys.has(key)) {
        this.knownKeys.add(key);
        if (this.knownKeys.size > MAX_ENTRIES_PER_NAMESPACE) {
          await this.enforceCap();
          await this.resyncKeys();
        }
      }
    } catch (error) {
      devLog('[MobileCache] Failed to set:', error);
    }
  }

  /**
   * Get cached value (auto-deletes if expired)
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const cached = await AsyncStorage.getItem(`${this.prefix}${key}`);

      if (!cached) {
        return null;
      }

      const entry: CacheEntry<T> = JSON.parse(cached);

      // Check if expired
      if (Date.now() > entry.expiresAt) {
        await this.delete(key);
        return null;
      }

      return entry.data;
    } catch (error) {
      devLog('[MobileCache] Failed to get:', error);
      return null;
    }
  }

  /**
   * Delete specific cache entry
   */
  async delete(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(`${this.prefix}${key}`);
      this.knownKeys.delete(key);
    } catch (error) {
      devLog('[MobileCache] Failed to delete:', error);
    }
  }

  /**
   * Clear the current user's namespace only.
   */
  async clear(): Promise<void> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const cacheKeys = allKeys.filter((key) => key.startsWith(this.prefix));
      await AsyncStorage.multiRemove(cacheKeys);
      this.knownKeys.clear();
    } catch (error) {
      devLog('[MobileCache] Failed to clear:', error);
    }
  }

  /**
   * Clear EVERY namespace under the base prefix. Call on logout so no
   * account's data survives on the device.
   */
  async clearAllNamespaces(): Promise<void> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const cacheKeys = allKeys.filter((key) => key.startsWith(BASE_PREFIX));
      if (cacheKeys.length > 0) {
        await AsyncStorage.multiRemove(cacheKeys);
      }
      this.knownKeys.clear();
    } catch (error) {
      devLog('[MobileCache] Failed to clear all namespaces:', error);
    }
  }

  /**
   * Get all cache keys
   */
  async getAllKeys(): Promise<string[]> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      return allKeys
        .filter((key) => key.startsWith(this.prefix))
        .map((key) => key.replace(this.prefix, ''));
    } catch (error) {
      devLog('[MobileCache] Failed to get keys:', error);
      return [];
    }
  }

  /**
   * Get cache size
   */
  async getSize(): Promise<number> {
    try {
      const allKeys = await this.getAllKeys();
      let totalSize = 0;

      for (const key of allKeys) {
        const item = await AsyncStorage.getItem(`${this.prefix}${key}`);
        if (item) {
          totalSize += item.length;
        }
      }

      return totalSize;
    } catch (error) {
      devLog('[MobileCache] Failed to get size:', error);
      return 0;
    }
  }

  /**
   * Get cache stats
   */
  async getStats(): Promise<{ itemCount: number; sizeKB: number }> {
    try {
      const keys = await this.getAllKeys();
      const size = await this.getSize();

      return {
        itemCount: keys.length,
        sizeKB: Math.round(size / 1024)
      };
    } catch (error) {
      devLog('[MobileCache] Failed to get stats:', error);
      return { itemCount: 0, sizeKB: 0 };
    }
  }

  /**
   * Rebuild the in-memory key index from storage. Used after evictions.
   */
  private async resyncKeys(): Promise<void> {
    try {
      const keys = await this.getAllKeys();
      this.knownKeys = new Set(keys);
    } catch (error) {
      devLog('[MobileCache] Failed to resync keys:', error);
    }
  }

  /**
   * Drop expired entries, then evict oldest-first if still over the cap.
   * Runs rarely now (see set): only when the key index exceeds the cap.
   */
  private async enforceCap(): Promise<void> {
    const keys = await this.getAllKeys();
    if (keys.length <= MAX_ENTRIES_PER_NAMESPACE) return;

    const stamped: Array<{ key: string; timestamp: number }> = [];
    for (const key of keys) {
      try {
        const raw = await AsyncStorage.getItem(`${this.prefix}${key}`);
        if (!raw) continue;
        const entry = JSON.parse(raw) as Partial<CacheEntry<unknown>>;
        if (typeof entry.expiresAt === 'number' && Date.now() > entry.expiresAt) {
          await AsyncStorage.removeItem(`${this.prefix}${key}`);
          continue;
        }
        stamped.push({ key, timestamp: typeof entry.timestamp === 'number' ? entry.timestamp : 0 });
      } catch {
        await AsyncStorage.removeItem(`${this.prefix}${key}`).catch(() => undefined);
      }
    }

    if (stamped.length <= MAX_ENTRIES_PER_NAMESPACE) return;
    stamped.sort((a, b) => a.timestamp - b.timestamp);
    const overflow = stamped.slice(0, stamped.length - MAX_ENTRIES_PER_NAMESPACE);
    await AsyncStorage.multiRemove(overflow.map((item) => `${this.prefix}${item.key}`)).catch(() => undefined);
  }
}

/**
 * Cache-aside pattern wrapper
 */
export async function getCachedOrFetch<T>(
  cache: MobileCache,
  key: string,
  fetchFn: () => Promise<T>,
  ttl?: number
): Promise<T> {
  // Try to get from cache first (null means miss — falsy values are valid hits)
  const cached = await cache.get<T>(key);
  if (cached !== null) {
    return cached;
  }

  // If not in cache, fetch and store
  const data = await fetchFn();
  await cache.set(key, data, ttl);

  return data;
}

// Export singleton instance
export const mobileCache = new MobileCache(5); // 5 minute default TTL
