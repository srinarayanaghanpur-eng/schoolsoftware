/**
 * Offline Status Indicator
 * Shows user when app is offline and syncing status
 */

'use client';

import { useEffect, useState } from 'react';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { useServiceWorker } from '@/lib/serviceWorkerUtils';

export function OfflineStatusIndicator() {
  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [queuedCount, setQueuedCount] = useState(0);
  const { sync } = useServiceWorker();

  useEffect(() => {
    // Update online status
    setIsOnline(navigator.onLine);

    const handleOnline = () => {
      setIsOnline(true);
      setIsSyncing(true);

      // Trigger sync and hide indicator after completion
      sync('sync-all').finally(() => {
        setTimeout(() => setIsSyncing(false), 2000);
      });
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [sync]);

  // Don't show indicator if online and not syncing
  if (isOnline && !isSyncing) {
    return null;
  }

  if (isSyncing) {
    return (
      <div className="fixed bottom-4 right-4 flex items-center gap-2 rounded-lg bg-blue-500 px-4 py-2 text-white shadow-lg">
        <RefreshCw size={18} className="animate-spin" />
        <span className="text-sm font-medium">Syncing...</span>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 flex items-center gap-2 rounded-lg bg-red-500 px-4 py-2 text-white shadow-lg">
      <WifiOff size={18} />
      <div>
        <p className="text-sm font-medium">Offline Mode</p>
        <p className="text-xs opacity-90">Changes will sync when online</p>
      </div>
    </div>
  );
}

/**
 * Service Worker Initializer
 * Should be placed in root layout
 */
export function ServiceWorkerInit() {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('[SW] Service worker registered');

          // Listen for controller change
          let refreshing = false;
          navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (refreshing) return;
            refreshing = true;
            window.location.reload();
          });
        })
        .catch((error) => {
          console.error('[SW] Service worker registration failed:', error);
        });
    }
  }, []);

  return null;
}
