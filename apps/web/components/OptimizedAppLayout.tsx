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

interface AppLayoutProps {
  children: React.ReactNode;
}

export function OptimizedAppLayout({ children }: AppLayoutProps) {
  useEffect(() => {
    // Initialize performance monitoring
    perfMonitor.startMeasure('app-initialization');
    trackWebVitals();

    // Initialize background sync (wakes every 60s; each task is rate-limited
    // by its own interval below, so this only checks what is actually due).
    const cleanupSync = initializeBackgroundSync(60000);

    // Register background sync tasks
    backgroundSync.registerTask({
      id: 'sync-dashboard',
      name: 'Dashboard sync',
      priority: 'high',
      interval: 60000, // 1 minute
      fn: async () => {
        try {
          await lazyLoad.loadDashboardStats({ cacheTTL: 60000 });
        } catch (error) {
          console.debug('Dashboard sync in background:', error);
        }
      }
    });

    backgroundSync.registerTask({
      id: 'sync-students',
      name: 'Students sync',
      priority: 'normal',
      interval: 5 * 60 * 1000, // 5 minutes
      fn: async () => {
        try {
          await lazyLoad.loadStudents(undefined, { cacheTTL: 5 * 60 * 1000 });
        } catch (error) {
          console.debug('Students sync in background:', error);
        }
      }
    });

    backgroundSync.registerTask({
      id: 'sync-teachers',
      name: 'Teachers sync',
      priority: 'normal',
      interval: 5 * 60 * 1000, // 5 minutes
      fn: async () => {
        try {
          await lazyLoad.loadTeachers({ cacheTTL: 5 * 60 * 1000 });
        } catch (error) {
          console.debug('Teachers sync in background:', error);
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
