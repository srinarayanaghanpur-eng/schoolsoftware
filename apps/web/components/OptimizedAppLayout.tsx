/**
 * App Performance Initializer
 * Initialize caching, background sync, and lazy loading on app startup
 */

'use client';

import { useEffect } from 'react';
import { AppShell } from '@/components/AppShell';
import { initializeBackgroundSync, backgroundSync } from '@/lib/backgroundSync';
import { lazyLoad } from '@/lib/lazyLoad';
import { perfMonitor, trackWebVitals } from '@/lib/performanceMonitor';

const DASHBOARD_SYNC_INTERVAL_MS = 5 * 60 * 1000;

interface AppLayoutProps {
  children: React.ReactNode;
}

export function OptimizedAppLayout({ children }: AppLayoutProps) {
  useEffect(() => {
    // Initialize performance monitoring
    perfMonitor.startMeasure('app-initialization');
    trackWebVitals();

    // Initialize background sync (wakes every 5 minutes; each task is rate-limited
    // by its own interval below, so this only checks what is actually due).
    const cleanupSync = initializeBackgroundSync(DASHBOARD_SYNC_INTERVAL_MS);

    // Register background sync tasks
    backgroundSync.registerTask({
      id: 'sync-dashboard',
      name: 'Dashboard sync',
      priority: 'high',
      interval: DASHBOARD_SYNC_INTERVAL_MS,
      fn: async () => {
        try {
          await lazyLoad.loadDashboardStats({ cacheTTL: DASHBOARD_SYNC_INTERVAL_MS });
        } catch (error) {
          console.debug('Dashboard sync in background:', error);
        }
      }
    });

    // Start first sync immediately (non-blocking)
    setTimeout(() => {
      backgroundSync.startSync();
    }, 500);

    perfMonitor.endMeasure('app-initialization');

    return () => {
      cleanupSync();
      perfMonitor.printReport();
    };
  }, []);

  return <AppShell>{children}</AppShell>;
}
