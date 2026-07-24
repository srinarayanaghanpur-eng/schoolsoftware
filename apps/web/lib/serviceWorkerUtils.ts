/**
 * Service Worker Registration and Management
 * Handles SW lifecycle, offline detection, and background sync triggers
 */

'use client';

import { useEffect, useRef } from 'react';

/**
 * Register service worker
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    console.log('[SW] Service workers not supported');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/'
    });

    console.log('[SW] Registered successfully:', registration);

    // Listen for updates
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (!newWorker) return;

      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          console.log('[SW] Update available - triggering skipWaiting');
          newWorker.postMessage({ type: 'SKIP_WAITING' });
        }
      });
    });

    return registration;
  } catch (error) {
    console.error('[SW] Registration failed:', error);
    return null;
  }
}

/**
 * Trigger background sync
 */
export async function triggerBackgroundSync(tag: string): Promise<void> {
  if (!('serviceWorker' in navigator) || !('SyncManager' in window)) {
    console.log('[SW] Background sync not supported');
    return;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    // @ts-ignore - SyncManager is not in TypeScript yet
    await registration.sync.register(tag);
    console.log('[SW] Background sync registered:', tag);
  } catch (error) {
    console.error('[SW] Failed to register sync:', error);
  }
}

/**
 * Request persistent storage
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (!navigator.storage?.persist) {
    console.log('[SW] Persistent storage not available');
    return false;
  }

  try {
    const persisted = await navigator.storage.persist();
    console.log('[SW] Persistent storage granted:', persisted);
    return persisted;
  } catch (error) {
    console.error('[SW] Failed to request persistent storage:', error);
    return false;
  }
}

/**
 * Hook for offline/online status
 */
export function useOfflineStatus() {
  const [isOnline, setIsOnline] = React.useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => {
      console.log('[SW] Back online');
      setIsOnline(true);

      // Trigger sync when back online
      triggerBackgroundSync('sync-all');
    };

    const handleOffline = () => {
      console.log('[SW] Went offline');
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}

/**
 * React hook to register service worker on mount
 */
export function useServiceWorker() {
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    registerServiceWorker().then((reg) => {
      registrationRef.current = reg;
    });

    return () => {
      // Cleanup
    };
  }, []);

  return {
    registration: registrationRef.current,
    sync: triggerBackgroundSync,
    persist: requestPersistentStorage
  };
}

/**
 * Queue offline request for later sync
 */
export async function queueOfflineRequest(
  method: string,
  url: string,
  body?: any,
  storeName: string = 'offline-queue'
): Promise<void> {
  if (!('indexedDB' in window)) {
    console.error('[SW] IndexedDB not available');
    return;
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open('AttendanceDB', 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;

      // Create store if doesn't exist
      if (!db.objectStoreNames.contains(storeName)) {
        console.warn(`[SW] Store '${storeName}' does not exist`);
        reject(new Error(`Store '${storeName}' not found`));
        return;
      }

      const transaction = db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);

      const record = {
        id: `${method}-${url}-${Date.now()}`,
        method,
        url,
        body,
        timestamp: Date.now(),
        retries: 0
      };

      store.add(record);

      transaction.oncomplete = () => {
        console.log('[SW] Request queued for sync:', record);
        resolve();
      };
      transaction.onerror = () => reject(transaction.error);
    };
  });
}

/**
 * Get queued offline requests
 */
export async function getQueuedRequests(
  storeName: string = 'offline-queue'
): Promise<any[]> {
  if (!('indexedDB' in window)) {
    return [];
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open('AttendanceDB', 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(storeName)) {
        resolve([]);
        return;
      }

      const transaction = db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const getAllRequest = store.getAll();

      getAllRequest.onsuccess = () => {
        resolve(getAllRequest.result || []);
      };
      getAllRequest.onerror = () => reject(getAllRequest.error);
    };
  });
}

// Import React for hooks
import React from 'react';
