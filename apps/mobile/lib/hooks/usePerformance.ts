/**
 * React Native Hooks for Performance Optimization
 */

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { mobileCache } from '../cache/mobileCache';
import { mobileLazyLoad } from '../lazyLoad';
import { mobilePerformanceMonitor } from '../performanceMonitor';
import { mobileBackgroundSync } from '../backgroundSync';
import { debounce, throttle } from '../requestOptimization';

/**
 * Hook for lazy loading data with cache
 */
export function useLazyLoad<T>(
  dataType: 'students' | 'teachers' | 'attendance',
  options?: { filters?: any; skipCache?: boolean }
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;

    const loadData = async () => {
      try {
        setLoading(true);
        mobilePerformanceMonitor.startMeasure(`load-${dataType}`);

        let result: T | null = null;

        if (dataType === 'students') {
          result = (await mobileLazyLoad.loadStudents(options?.filters)) as any;
        } else if (dataType === 'teachers') {
          result = (await mobileLazyLoad.loadTeachers()) as any;
        } else if (dataType === 'attendance') {
          result = (await mobileLazyLoad.loadAttendance(options?.filters)) as any;
        }

        mobilePerformanceMonitor.endMeasure(`load-${dataType}`);

        if (isMounted.current) {
          setData(result);
          setError(null);
        }
      } catch (err) {
        if (isMounted.current) {
          setError(err as Error);
        }
      } finally {
        if (isMounted.current) {
          setLoading(false);
        }
      }
    };

    loadData();

    return () => {
      isMounted.current = false;
    };
  }, [dataType, options?.filters]);

  return { data, loading, error };
}

/**
 * Hook for monitoring app state
 */
export function useAppState() {
  const [appState, setAppState] = useState<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', handleAppStateChange);

    function handleAppStateChange(state: AppStateStatus) {
      setAppState(state);

      if (state === 'active') {
        console.log('[AppState] App resumed - starting sync');
        mobileBackgroundSync.startSync();
      }
    }

    return () => {
      subscription.remove();
    };
  }, []);

  return appState;
}

/**
 * Hook for debounced callback
 */
export function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number = 500
) {
  const debouncedRef = useRef<ReturnType<typeof debounce> | null>(null);

  useEffect(() => {
    debouncedRef.current = debounce(callback, delay);
  }, [callback, delay]);

  return debouncedRef.current!;
}

/**
 * Hook for throttled callback
 */
export function useThrottledCallback<T extends (...args: any[]) => any>(
  callback: T,
  limit: number = 1000
) {
  const throttledRef = useRef<ReturnType<typeof throttle> | null>(null);

  useEffect(() => {
    throttledRef.current = throttle(callback, limit);
  }, [callback, limit]);

  return throttledRef.current!;
}

/**
 * Hook for performance monitoring
 */
export function usePerformanceMonitor(componentName: string) {
  useEffect(() => {
    mobilePerformanceMonitor.startMeasure(`component-${componentName}`);

    return () => {
      const duration = mobilePerformanceMonitor.endMeasure(`component-${componentName}`);
      if (duration && duration > 500) {
        console.warn(
          `[Perf] ⚠️ Slow component render: ${componentName} took ${duration.toFixed(2)}ms`
        );
      }
    };
  }, [componentName]);
}

/**
 * Hook for cache management
 */
export function useCache() {
  const [stats, setStats] = useState({ itemCount: 0, sizeKB: 0 });

  const getStats = useCallback(async () => {
    const s = await mobileCache.getStats();
    setStats(s);
  }, []);

  const clearCache = useCallback(async () => {
    await mobileCache.clear();
    setStats({ itemCount: 0, sizeKB: 0 });
  }, []);

  useEffect(() => {
    getStats();
  }, [getStats]);

  return { stats, clearCache, getStats };
}

/**
 * Hook for background sync status
 */
export function useBackgroundSyncStatus() {
  const [syncStatus, setSyncStatus] = useState<string>('idle');

  useEffect(() => {
    const unsubscribe = mobileBackgroundSync.onSync((status) => {
      setSyncStatus(status);
    });

    return unsubscribe;
  }, []);

  return {
    syncStatus,
    isSyncing: mobileBackgroundSync.isSyncing(),
    startSync: () => mobileBackgroundSync.startSync(),
    stopSync: () => mobileBackgroundSync.stopSync()
  };
}

/**
 * Hook for preloading critical data
 */
export function usePreloadCriticalData() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    mobileLazyLoad.preloadCriticalData().finally(() => {
      setLoading(false);
    });
  }, []);

  return { loading };
}

/**
 * Hook for performance health score
 */
export function usePerformanceHealth() {
  const [health, setHealth] = useState(100);

  useEffect(() => {
    const interval = setInterval(() => {
      const score = mobilePerformanceMonitor.getHealthScore();
      setHealth(score);
    }, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, []);

  return health;
}
