/**
 * AsyncStorage Cache for React Native
 * Mobile equivalent of IndexedDB caching with TTL support
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

export class MobileCache {
  private prefix = '@attendance_cache:';
  private ttl: number; // milliseconds

  constructor(ttlMinutes: number = 5) {
    this.ttl = ttlMinutes * 60 * 1000;
  }

  /**
   * Set cached value with TTL
   */
  async set<T>(key: string, data: T, ttl?: number): Promise<void> {
    try {
      const expiresAt = Date.now() + (ttl || this.ttl);
      const entry: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
        expiresAt
      };

      await AsyncStorage.setItem(
        `${this.prefix}${key}`,
        JSON.stringify(entry)
      );
    } catch (error) {
      console.error('[MobileCache] Failed to set:', error);
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
      console.error('[MobileCache] Failed to get:', error);
      return null;
    }
  }

  /**
   * Delete specific cache entry
   */
  async delete(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(`${this.prefix}${key}`);
    } catch (error) {
      console.error('[MobileCache] Failed to delete:', error);
    }
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<void> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const cacheKeys = allKeys.filter((key) => key.startsWith(this.prefix));
      await AsyncStorage.multiRemove(cacheKeys);
    } catch (error) {
      console.error('[MobileCache] Failed to clear:', error);
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
      console.error('[MobileCache] Failed to get keys:', error);
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
      console.error('[MobileCache] Failed to get size:', error);
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
      console.error('[MobileCache] Failed to get stats:', error);
      return { itemCount: 0, sizeKB: 0 };
    }
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
  // Try to get from cache first
  const cached = await cache.get<T>(key);
  if (cached) {
    return cached;
  }

  // If not in cache, fetch and store
  const data = await fetchFn();
  await cache.set(key, data, ttl);

  return data;
}

// Export singleton instance
export const mobileCache = new MobileCache(5); // 5 minute default TTL
