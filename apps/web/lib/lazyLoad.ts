/**
 * Lazy Loading Service
 * Loads only essential data for initial render, defers heavy operations to background
 */

import { backgroundSync } from './backgroundSync';
import { cache, getCachedOrFetch } from './cache/indexedDBCache';
import { getDocs, collection, query, limit, where } from 'firebase/firestore';
import { db, auth } from '@sri-narayana/shared/firebase/client';

interface LazyLoadConfig {
  initialLimit?: number;
  batchSize?: number;
  enableCache?: boolean;
  cacheTTL?: number;
}

class LazyLoadManager {
  private defaultConfig: LazyLoadConfig = {
    initialLimit: 50,
    batchSize: 100,
    enableCache: true,
    cacheTTL: 5 * 60 * 1000 // 5 minutes
  };

  /**
   * Load students with lazy loading
   * Returns only first batch immediately
   */
  async loadStudents(filters?: any, config?: LazyLoadConfig): Promise<any[]> {
    const cfg = { ...this.defaultConfig, ...config };

    const cacheKey = `students-initial-${JSON.stringify(filters || {})}`;

    return getCachedOrFetch('students', cacheKey, async () => {
      let q: any = collection(db, 'students');
      const constraints: any[] = [];

      if (filters?.class) {
        constraints.push(where('class', '==', filters.class));
      }

      if (constraints.length > 0) {
        q = query(q, ...constraints, limit(cfg.initialLimit!));
      } else {
        q = query(q, limit(cfg.initialLimit!));
      }

      const snapshot = await getDocs(q);
      const students = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      }));

      // Queue full load in background
      this.queueFullLoad('students', filters, cfg);

      return students;
    }, cfg.cacheTTL);
  }

  /**
   * Load teachers with lazy loading
   */
  async loadTeachers(config?: LazyLoadConfig): Promise<any[]> {
    const cfg = { ...this.defaultConfig, ...config };
    const cacheKey = 'teachers-initial';

    return getCachedOrFetch('teachers', cacheKey, async () => {
      const q = query(collection(db, 'teachers'), limit(cfg.initialLimit!));
      const snapshot = await getDocs(q);
      const teachers = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      }));

      // Queue full load in background
      this.queueFullLoad('teachers', undefined, cfg);

      return teachers;
    }, cfg.cacheTTL);
  }

  /**
   * Load dashboard stats (critical for initial render)
   */
  async loadDashboardStats(config?: LazyLoadConfig): Promise<any> {
    const cacheKey = 'dashboard-stats';

    return getCachedOrFetch('dashboard', cacheKey, async () => {
      const token = await auth.currentUser?.getIdToken();
      const response = await fetch('/api/admin/reports/dashboard-stats', {
        headers: token ? { authorization: `Bearer ${token}` } : {},
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });

      if (!response.ok) {
        throw new Error('Failed to fetch dashboard stats');
      }

      const data = await response.json();
      return data.data;
    }, config?.cacheTTL || this.defaultConfig.cacheTTL);
  }

  /**
   * Queue a full data load in background (non-blocking)
   */
  private queueFullLoad(
    dataType: string,
    filters: any,
    config: LazyLoadConfig
  ): void {
    const taskId = `full-load-${dataType}`;

    backgroundSync.registerTask({
      id: taskId,
      name: `Load all ${dataType}`,
      priority: 'low',
      interval: 30 * 60 * 1000, // 30 minutes
      fn: async () => {
        try {
          if (dataType === 'students') {
            let q: any = collection(db, 'students');

            if (filters?.class) {
              q = query(q, where('class', '==', filters.class));
            }

            const snapshot = await getDocs(q);
            const allStudents = snapshot.docs.map((doc) => ({
              id: doc.id,
              ...doc.data()
            }));

            await cache.set('students', `${dataType}-all`, allStudents);
          } else if (dataType === 'teachers') {
            const q = query(collection(db, 'teachers'));
            const snapshot = await getDocs(q);
            const allTeachers = snapshot.docs.map((doc) => ({
              id: doc.id,
              ...doc.data()
            }));

            await cache.set('teachers', `${dataType}-all`, allTeachers);
          }
        } catch (error) {
          console.error(`Failed to load all ${dataType}:`, error);
        }
      }
    });
  }

  /**
   * Clear all caches
   */
  async clearCache(): Promise<void> {
    await cache.clear('students');
    await cache.clear('teachers');
    await cache.clear('payments');
    await cache.clear('attendance');
    await cache.clear('dashboard');
  }

  /**
   * Preload critical data
   */
  async preloadCriticalData(): Promise<void> {
    try {
      await Promise.all([
        this.loadDashboardStats(),
        this.loadStudents()
      ]);
    } catch (error) {
      console.error('Failed to preload critical data:', error);
    }
  }
}

export const lazyLoad = new LazyLoadManager();
