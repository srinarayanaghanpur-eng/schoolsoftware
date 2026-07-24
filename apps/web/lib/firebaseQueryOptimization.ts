/**
 * Firebase Query Optimization Utilities
 * Reduces unnecessary queries and implements smart caching
 */

import {
  collection,
  query,
  where,
  limit,
  getDocs,
  QueryConstraint,
  Timestamp
} from 'firebase/firestore';
import { db } from '@sri-narayana/shared/firebase/client';

/**
 * Cached query results with automatic invalidation
 */
class QueryCache {
  private cache: Map<string, { data: any; timestamp: number; ttl: number }> = new Map();

  private getCacheKey(...parts: any[]): string {
    return JSON.stringify(parts);
  }

  async getCachedQuery<T>(
    cacheKey: string,
    queryFn: () => Promise<T[]>,
    ttl: number = 5 * 60 * 1000 // 5 minutes
  ): Promise<T[]> {
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      return cached.data;
    }

    const result = await queryFn();
    this.cache.set(cacheKey, { data: result, timestamp: Date.now(), ttl });
    return result;
  }

  invalidate(cacheKey?: string): void {
    if (cacheKey) {
      this.cache.delete(cacheKey);
    } else {
      this.cache.clear();
    }
  }
}

export const queryCache = new QueryCache();

/**
 * Optimized student query
 */
export async function getStudentsOptimized(
  filters?: { class?: string; limit?: number },
  useCache: boolean = true
): Promise<any[]> {
  const cacheKey = `students-${filters?.class || 'all'}-${filters?.limit || 50}`;

  const queryFn = async () => {
    const constraints: QueryConstraint[] = [];

    if (filters?.class) {
      constraints.push(where('class', '==', filters.class));
    }

    constraints.push(limit(filters?.limit || 50));

    const q = query(collection(db, 'students'), ...constraints);
    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data()
    }));
  };

  if (useCache) {
    return queryCache.getCachedQuery(cacheKey, queryFn);
  }

  return queryFn();
}

/**
 * Optimized teacher query
 */
export async function getTeachersOptimized(
  filters?: { limit?: number },
  useCache: boolean = true
): Promise<any[]> {
  const cacheKey = `teachers-${filters?.limit || 50}`;

  const queryFn = async () => {
    const q = query(collection(db, 'teachers'), limit(filters?.limit || 50));
    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data()
    }));
  };

  if (useCache) {
    return queryCache.getCachedQuery(cacheKey, queryFn);
  }

  return queryFn();
}

/**
 * Optimized payments query
 */
export async function getPaymentsOptimized(
  filters?: { studentId?: string; limit?: number },
  useCache: boolean = true
): Promise<any[]> {
  const cacheKey = `payments-${filters?.studentId || 'all'}-${filters?.limit || 100}`;

  const queryFn = async () => {
    const constraints: QueryConstraint[] = [];

    if (filters?.studentId) {
      constraints.push(where('studentId', '==', filters.studentId));
    }

    constraints.push(limit(filters?.limit || 100));

    const q = query(collection(db, 'payments'), ...constraints);
    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data()
    }));
  };

  if (useCache) {
    return queryCache.getCachedQuery(cacheKey, queryFn);
  }

  return queryFn();
}

/**
 * Optimized attendance query
 */
export async function getAttendanceOptimized(
  filters?: { class?: string; date?: Date; limit?: number },
  useCache: boolean = true
): Promise<any[]> {
  const dateStr = filters?.date ? filters.date.toISOString().split('T')[0] : 'today';
  const cacheKey = `attendance-${filters?.class || 'all'}-${dateStr}-${filters?.limit || 100}`;

  const queryFn = async () => {
    const constraints: QueryConstraint[] = [];

    if (filters?.class) {
      constraints.push(where('class', '==', filters.class));
    }

    if (filters?.date) {
      const dayStart = new Date(filters.date);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(filters.date);
      dayEnd.setHours(23, 59, 59, 999);

      constraints.push(where('date', '>=', Timestamp.fromDate(dayStart)));
      constraints.push(where('date', '<=', Timestamp.fromDate(dayEnd)));
    }

    constraints.push(limit(filters?.limit || 100));

    const q = query(collection(db, 'attendance'), ...constraints);
    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data()
    }));
  };

  if (useCache) {
    return queryCache.getCachedQuery(cacheKey, queryFn);
  }

  return queryFn();
}

/**
 * Batch get multiple documents
 */
export async function getBatchOptimized<T>(
  collection_name: string,
  ids: string[],
  useCache: boolean = true
): Promise<T[]> {
  const cacheKey = `batch-${collection_name}-${ids.join(',')}`;

  const queryFn = async () => {
    if (ids.length === 0) return [];

    // Firebase has a limit of 10 conditions per query
    const batchSize = 10;
    const batches: T[] = [];

    for (let i = 0; i < ids.length; i += batchSize) {
      const batchIds = ids.slice(i, i + batchSize);
      const q = query(
        collection(db, collection_name),
        where('__name__', 'in', batchIds)
      );

      const snapshot = await getDocs(q);
      batches.push(
        ...snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data()
        }))
      );
    }

    return batches as T[];
  };

  if (useCache) {
    return queryCache.getCachedQuery(cacheKey, queryFn);
  }

  return queryFn();
}

/**
 * Count documents efficiently
 */
export async function countDocumentsOptimized(
  collection_name: string,
  filters?: Record<string, any>
): Promise<number> {
  const constraints: QueryConstraint[] = [];

  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      constraints.push(where(key, '==', value));
    });
  }

  const q = query(collection(db, collection_name), ...constraints);
  const snapshot = await getDocs(q);

  return snapshot.size;
}
