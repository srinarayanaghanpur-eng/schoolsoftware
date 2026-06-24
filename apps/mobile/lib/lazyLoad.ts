/**
 * Lazy Loading Manager for React Native
 * Handles incremental data loading with caching
 */

import { mobileCache } from './cache/mobileCache';
import { mobileBackgroundSync } from './backgroundSync';
import {
  getStudentsOptimized,
  getTeachersOptimized,
  getAttendanceOptimized
} from './firebaseQueryOptimization';

export interface LazyLoadConfig {
  initialLimit?: number;
  batchSize?: number;
  enableCache?: boolean;
  cacheTTL?: number;
}

const DEFAULT_CONFIG: LazyLoadConfig = {
  initialLimit: 30, // Mobile: smaller initial batch
  batchSize: 50,
  enableCache: true,
  cacheTTL: 5 * 60 * 1000 // 5 minutes
};

class MobileLazyLoadManager {
  private config: LazyLoadConfig = DEFAULT_CONFIG;

  /**
   * Load students with lazy loading
   */
  async loadStudents(filters?: any, config?: LazyLoadConfig) {
    const mergedConfig = { ...DEFAULT_CONFIG, ...config };

    const cacheKey = `students-${filters?.class || 'all'}-${mergedConfig.initialLimit}`;

    if (mergedConfig.enableCache) {
      const cached = await mobileCache.get<any[]>(cacheKey);
      if (cached) {
        console.log('[MobileLazyLoad] Students from cache');
        return cached;
      }
    }

    try {
      // Load initial batch
      const initial = await getStudentsOptimized(
        { ...filters, limit: mergedConfig.initialLimit },
        false
      );

      if (mergedConfig.enableCache) {
        await mobileCache.set(cacheKey, initial, mergedConfig.cacheTTL);
      }

      // Queue full load in background
      this.queueFullLoad('students', filters, mergedConfig);

      return initial;
    } catch (error) {
      console.error('[MobileLazyLoad] Failed to load students:', error);
      throw error;
    }
  }

  /**
   * Load teachers with lazy loading
   */
  async loadTeachers(config?: LazyLoadConfig) {
    const mergedConfig = { ...DEFAULT_CONFIG, ...config };
    const cacheKey = `teachers-${mergedConfig.initialLimit}`;

    if (mergedConfig.enableCache) {
      const cached = await mobileCache.get<any[]>(cacheKey);
      if (cached) {
        console.log('[MobileLazyLoad] Teachers from cache');
        return cached;
      }
    }

    try {
      // Load initial batch
      const initial = await getTeachersOptimized(
        { limit: mergedConfig.initialLimit },
        false
      );

      if (mergedConfig.enableCache) {
        await mobileCache.set(cacheKey, initial, mergedConfig.cacheTTL);
      }

      // Queue full load
      this.queueFullLoad('teachers', undefined, mergedConfig);

      return initial;
    } catch (error) {
      console.error('[MobileLazyLoad] Failed to load teachers:', error);
      throw error;
    }
  }

  /**
   * Load attendance with lazy loading
   */
  async loadAttendance(filters?: any, config?: LazyLoadConfig) {
    const mergedConfig = { ...DEFAULT_CONFIG, ...config };
    const dateStr = filters?.date ? filters.date.toISOString().split('T')[0] : 'today';
    const cacheKey = `attendance-${filters?.class || 'all'}-${dateStr}-${mergedConfig.initialLimit}`;

    if (mergedConfig.enableCache) {
      const cached = await mobileCache.get<any[]>(cacheKey);
      if (cached) {
        console.log('[MobileLazyLoad] Attendance from cache');
        return cached;
      }
    }

    try {
      const initial = await getAttendanceOptimized(
        { ...filters, limit: mergedConfig.initialLimit },
        false
      );

      if (mergedConfig.enableCache) {
        await mobileCache.set(cacheKey, initial, mergedConfig.cacheTTL);
      }

      // Queue full load
      this.queueFullLoad('attendance', filters, mergedConfig);

      return initial;
    } catch (error) {
      console.error('[MobileLazyLoad] Failed to load attendance:', error);
      throw error;
    }
  }

  /**
   * Queue full data load in background
   */
  private queueFullLoad(
    type: 'students' | 'teachers' | 'attendance',
    filters?: any,
    config?: LazyLoadConfig
  ): void {
    const mergedConfig = { ...DEFAULT_CONFIG, ...config };

    mobileBackgroundSync.registerTask({
      id: `full-load-${type}`,
      name: `Full load: ${type}`,
      priority: 'low',
      interval: 10 * 60 * 1000, // 10 minutes
      fn: async () => {
        try {
          console.log(`[MobileLazyLoad] Background: Loading all ${type}`);

          if (type === 'students') {
            await getStudentsOptimized(
              { ...filters, limit: mergedConfig.batchSize },
              false
            );
          } else if (type === 'teachers') {
            await getTeachersOptimized({ limit: mergedConfig.batchSize }, false);
          } else if (type === 'attendance') {
            await getAttendanceOptimized(
              { ...filters, limit: mergedConfig.batchSize },
              false
            );
          }
        } catch (error) {
          console.error(`[MobileLazyLoad] Full load failed for ${type}:`, error);
        }
      }
    });
  }

  /**
   * Clear all cache
   */
  async clearCache(): Promise<void> {
    await mobileCache.clear();
    console.log('[MobileLazyLoad] Cache cleared');
  }

  /**
   * Preload critical data
   */
  async preloadCriticalData(): Promise<void> {
    try {
      console.log('[MobileLazyLoad] Preloading critical data...');

      await Promise.all([
        this.loadStudents(undefined, { cacheTTL: 10 * 60 * 1000 }),
        this.loadTeachers({ cacheTTL: 10 * 60 * 1000 })
      ]);

      console.log('[MobileLazyLoad] Critical data preloaded');
    } catch (error) {
      console.error('[MobileLazyLoad] Preload failed:', error);
    }
  }

  /**
   * Get cache stats
   */
  async getCacheStats() {
    return mobileCache.getStats();
  }
}

// Export singleton
export const mobileLazyLoad = new MobileLazyLoadManager();
