/**
 * Firebase Query Optimization for React Native
 * Query caching and optimization
 */

import {
  collection,
  query,
  where,
  limit,
  getDocs,
  QueryConstraint,
  Timestamp
} from '@firebase/firestore';
import { db } from './firebase';

/**
 * Simple in-memory query cache for mobile
 */
class MobileQueryCache {
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
      console.log('[QueryCache] Cache hit:', cacheKey);
      return cached.data;
    }

    console.log('[QueryCache] Cache miss:', cacheKey);
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

  getSize(): number {
    return this.cache.size;
  }
}

export const mobileQueryCache = new MobileQueryCache();

/**
 * Optimized student query
 */
export async function getStudentsOptimized(
  filters?: { class?: string; limit?: number },
  useCache: boolean = true
): Promise<any[]> {
  const cacheKey = `students-${filters?.class || 'all'}-${filters?.limit || 30}`;

  const queryFn = async () => {
    const constraints: QueryConstraint[] = [];

    if (filters?.class) {
      constraints.push(where('class', '==', filters.class));
    }

    constraints.push(limit(filters?.limit || 30));

    const q = query(collection(db, 'students'), ...constraints);
    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data()
    }));
  };

  if (useCache) {
    return mobileQueryCache.getCachedQuery(cacheKey, queryFn);
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
  const cacheKey = `teachers-${filters?.limit || 30}`;

  const queryFn = async () => {
    const q = query(collection(db, 'teachers'), limit(filters?.limit || 30));
    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data()
    }));
  };

  if (useCache) {
    return mobileQueryCache.getCachedQuery(cacheKey, queryFn);
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
  const cacheKey = `attendance-${filters?.class || 'all'}-${dateStr}-${filters?.limit || 30}`;

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

    constraints.push(limit(filters?.limit || 30));

    const q = query(collection(db, 'attendance'), ...constraints);
    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data()
    }));
  };

  if (useCache) {
    return mobileQueryCache.getCachedQuery(cacheKey, queryFn);
  }

  return queryFn();
}

/**
 * Optimized payment query
 */
export async function getPaymentsOptimized(
  filters?: { studentId?: string; limit?: number },
  useCache: boolean = true
): Promise<any[]> {
  const cacheKey = `payments-${filters?.studentId || 'all'}-${filters?.limit || 50}`;

  const queryFn = async () => {
    const constraints: QueryConstraint[] = [];

    if (filters?.studentId) {
      constraints.push(where('studentId', '==', filters.studentId));
    }

    constraints.push(limit(filters?.limit || 50));

    const q = query(collection(db, 'payments'), ...constraints);
    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data()
    }));
  };

  if (useCache) {
    return mobileQueryCache.getCachedQuery(cacheKey, queryFn);
  }

  return queryFn();
}

/**
 * Get single document
 */
export async function getSingleDocument(
  collectionName: string,
  documentId: string,
  useCache: boolean = true
): Promise<any | null> {
  const cacheKey = `doc-${collectionName}-${documentId}`;

  const queryFn = async () => {
    const q = query(collection(db, collectionName), where('__name__', '==', documentId));
    const snapshot = await getDocs(q);

    return snapshot.empty ? null : { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
  };

  if (useCache) {
    const result = await mobileQueryCache.getCachedQuery(
      cacheKey,
      async () => {
        const doc = await queryFn();
        return doc ? [doc] : [];
      }
    );
    return result[0] || null;
  }

  return queryFn();
}

/**
 * Count documents efficiently
 */
export async function countDocumentsOptimized(
  collectionName: string,
  filters?: Record<string, any>
): Promise<number> {
  const constraints: QueryConstraint[] = [];

  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      constraints.push(where(key, '==', value));
    });
  }

  const q = query(collection(db, collectionName), ...constraints);
  const snapshot = await getDocs(q);

  return snapshot.size;
}
