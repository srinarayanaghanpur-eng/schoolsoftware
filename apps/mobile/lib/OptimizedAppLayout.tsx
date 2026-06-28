/**
 * Optimized Root Layout for Mobile App
 * Initialize caching, background sync, and performance monitoring
 */

import React, { useEffect } from 'react';
import { SafeAreaView, StatusBar, Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { mobileBackgroundSync, initializeMobileBackgroundSync } from './backgroundSync';
import { mobileLazyLoad } from './lazyLoad';
import { mobilePerformanceMonitor } from './performanceMonitor';
import { mobileCache } from './cache/mobileCache';

export interface OptimizedMobileLayoutProps {
  children: React.ReactNode;
}

/**
 * Hook to initialize all performance optimizations
 */
export function usePerformanceOptimization() {
  useEffect(() => {
    let cleanup: (() => void) | null = null;

    const initOptimizations = async () => {
      console.log('[MobileOptimization] Initializing...');

      mobilePerformanceMonitor.startMeasure('app-initialization');

      try {
        // Initialize background sync
        cleanup = await initializeMobileBackgroundSync();

        // Register background sync tasks
        mobileBackgroundSync.registerTask({
          id: 'sync-students',
          name: 'Students sync',
          priority: 'high',
          interval: 5 * 60 * 1000, // 5 minutes
          fn: async () => {
            try {
              console.log('[MobileSync] Syncing students...');
              await mobileLazyLoad.loadStudents(undefined, {
                cacheTTL: 5 * 60 * 1000
              });
            } catch (error) {
              console.debug('[MobileSync] Students sync failed:', error);
            }
          }
        });

        mobileBackgroundSync.registerTask({
          id: 'sync-teachers',
          name: 'Teachers sync',
          priority: 'high',
          interval: 5 * 60 * 1000, // 5 minutes
          fn: async () => {
            try {
              console.log('[MobileSync] Syncing teachers...');
              await mobileLazyLoad.loadTeachers({
                cacheTTL: 5 * 60 * 1000
              });
            } catch (error) {
              console.debug('[MobileSync] Teachers sync failed:', error);
            }
          }
        });

        // Request persistent storage
        mobileCache.set('@persistent', true, 24 * 60 * 60 * 1000); // 24 hours

        // Preload critical data
        await mobileLazyLoad.preloadCriticalData();

        mobilePerformanceMonitor.endMeasure('app-initialization');
        mobilePerformanceMonitor.printReport();

        console.log('[MobileOptimization] Ready');
      } catch (error) {
        console.error('[MobileOptimization] Initialization failed:', error);
      }
    };

    initOptimizations();

    return () => {
      if (cleanup) {
        cleanup();
      }
      mobileBackgroundSync.clearTasks();
    };
  }, []);
}

/**
 * Optimized Layout Component
 */
export function OptimizedMobileLayout({ children }: OptimizedMobileLayoutProps) {
  usePerformanceOptimization();
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f5f6fd' }}>
      <StatusBar barStyle="dark-content" backgroundColor="#f5f6fd" />
      <View style={{ flex: 1, paddingTop: Platform.OS === 'android' ? insets.top : 0 }}>
        {children}
      </View>
    </SafeAreaView>
  );
}
