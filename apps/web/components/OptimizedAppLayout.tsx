/**
 * App Performance Initializer
 * Initialize caching, background sync, and lazy loading on app startup
 */

'use client';

import { useEffect } from 'react';
import { AppShell } from '@/components/AppShell';
import { perfMonitor, trackWebVitals } from '@/lib/performanceMonitor';

interface AppLayoutProps {
  children: React.ReactNode;
}

export function OptimizedAppLayout({ children }: AppLayoutProps) {
  useEffect(() => {
    // Local-only performance monitoring — no Firestore reads.
    perfMonitor.startMeasure('app-initialization');
    trackWebVitals();
    perfMonitor.endMeasure('app-initialization');

    // NOTE: Timer-based background sync was removed. It re-read collections /
    // dashboard stats on an interval for every open tab, silently burning
    // Firestore free-tier read quota until it hit RESOURCE_EXHAUSTED (all data
    // showing 0). Each page now loads its own data on mount and refreshes via
    // useRefreshOnFocus (throttled) — the correct, read-efficient pattern.

    return () => {
      perfMonitor.printReport();
    };
  }, []);

  return <AppShell>{children}</AppShell>;
}
