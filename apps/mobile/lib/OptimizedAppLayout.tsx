/**
 * Optimized Root Layout for Mobile App
 * Initialize caching, background sync, and performance monitoring
 */

import React, { useEffect } from 'react';
import { SafeAreaView, StatusBar, Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { mobileBackgroundSync, initializeMobileBackgroundSync } from './backgroundSync';
import { mobilePerformanceMonitor } from './performanceMonitor';

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
      mobilePerformanceMonitor.startMeasure('app-initialization');

      try {
        cleanup = await initializeMobileBackgroundSync();
        mobilePerformanceMonitor.endMeasure('app-initialization');
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
