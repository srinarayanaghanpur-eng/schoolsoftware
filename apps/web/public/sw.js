/**
 * Service Worker for Offline Support & Background Sync
 * Handles caching strategies, offline fallback, and background task queuing
 */

const CACHE_VERSION = 'v3';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const DYNAMIC_CACHE = `${CACHE_VERSION}-dynamic`;
const API_CACHE = `${CACHE_VERSION}-api`;

// Static assets to cache immediately
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/globals.css',
  '/sri-narayana-high-school-logo.jpg'
];

/**
 * Install event - cache static assets
 */
self.addEventListener('install', (event) => {
  console.log('[ServiceWorker] Installing...');

  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => {
        console.log('[ServiceWorker] Caching static assets');
        return cache.addAll(STATIC_ASSETS).catch((error) => {
          console.warn('[ServiceWorker] Failed to cache some assets:', error);
        });
      })
      .then(() => self.skipWaiting())
  );
});

/**
 * Activate event - clean up old caches
 */
self.addEventListener('activate', (event) => {
  console.log('[ServiceWorker] Activating...');

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE && cacheName !== API_CACHE) {
            console.log('[ServiceWorker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );

  self.clients.claim();
});

/**
 * Fetch event - implement caching strategies
 */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip cross-origin requests
  if (url.origin !== location.origin) {
    return;
  }

  // NEVER cache POST/PUT/DELETE/PATCH — Cache API only supports GET
  // Pass them straight through without SW interference
  if (request.method !== 'GET') {
    return;
  }

  // Skip RSC (React Server Components) internal payloads — these must
  // always go to the server fresh or they break the webpack runtime.
  if (url.searchParams.has('__rsc') || url.searchParams.has('__nextDataRequest')) {
    return;
  }

  // Skip Next.js internal routes (_next/image, _next/data, etc.)
  if (url.pathname.startsWith('/_next/')) {
    // Only cache static chunks from _next/static; everything else passes through
    if (url.pathname.startsWith('/_next/static/')) {
      event.respondWith(cacheFirstStrategy(request));
    }
    return;
  }

  // API requests - network-first with cache fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirstStrategy(request, API_CACHE));
    return;
  }

  // Build chunks (JS/CSS) - ALWAYS network-first. These change on every deploy,
  // and serving a stale chunk from cache breaks the webpack runtime
  // ("a[t] is not a function"). Cache is only used as an offline fallback.
  if (url.pathname.endsWith('.js') || url.pathname.endsWith('.css') || url.pathname.endsWith('.mjs')) {
    event.respondWith(networkFirstStrategy(request, DYNAMIC_CACHE));
    return;
  }

  // Images/fonts - cache-first (these are safe to cache; names are stable or hashed)
  if (
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.jpeg') ||
    url.pathname.endsWith('.gif') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.webp') ||
    url.pathname.endsWith('.woff') ||
    url.pathname.endsWith('.woff2') ||
    url.pathname.endsWith('.ico')
  ) {
    event.respondWith(cacheFirstStrategy(request));
    return;
  }

  // HTML / page navigations - network-first
  if (request.mode === 'navigate' || url.pathname === '/' || url.pathname.endsWith('.html')) {
    event.respondWith(networkFirstStrategy(request, DYNAMIC_CACHE));
    return;
  }

  // Default: network-first for everything else
  event.respondWith(networkFirstStrategy(request, DYNAMIC_CACHE));
});

/**
 * Cache-first strategy: Try cache first, fallback to network
 */
async function cacheFirstStrategy(request) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);

    if (response.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, response.clone());
    }

    return response;
  } catch (error) {
    console.error('[ServiceWorker] Fetch failed:', error);
    return new Response('Offline - Resource not available', { status: 503 });
  }
}

/**
 * Network-first strategy: Try network first, fallback to cache
 */
async function networkFirstStrategy(request, cacheName = DYNAMIC_CACHE) {
  try {
    const response = await fetch(request);

    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }

    return response;
  } catch (error) {
    console.error('[ServiceWorker] Network failed:', error);

    // Try cache fallback
    const cached = await caches.match(request);
    if (cached) {
      console.log('[ServiceWorker] Using cached response');
      return cached;
    }

    // Offline response
    const accept = (request.headers.get('accept') || '');
    if (accept.includes('application/json')) {
      return new Response(
        JSON.stringify({
          error: 'Offline',
          message: 'Network request failed. Please check your connection.',
          offline: true
        }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response('Offline - Unable to load resource', { status: 503 });
  }
}

/**
 * Background sync event - sync queued requests when back online
 */
self.addEventListener('sync', (event) => {
  console.log('[ServiceWorker] Background sync triggered:', event.tag);

  if (event.tag === 'sync-attendance') {
    event.waitUntil(syncAttendanceData());
  } else if (event.tag === 'sync-payments') {
    event.waitUntil(syncPaymentData());
  } else if (event.tag === 'sync-all') {
    event.waitUntil(syncAllData());
  }
});

/**
 * Sync attendance data
 */
async function syncAttendanceData() {
  try {
    console.log('[ServiceWorker] Syncing attendance data...');
    
    const db = await openAttendanceDB();
    const queue = await getQueuedRecords(db, 'attendance-queue');

    for (const record of queue) {
      try {
        const response = await fetch('/api/admin/attendance/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(record)
        });

        if (response.ok) {
          await removeQueuedRecord(db, 'attendance-queue', record.id);
        }
      } catch (error) {
        console.error('[ServiceWorker] Failed to sync record:', error);
      }
    }

    console.log('[ServiceWorker] Attendance sync complete');
  } catch (error) {
    console.error('[ServiceWorker] Attendance sync failed:', error);
    throw error;
  }
}

/**
 * Sync payment data
 */
async function syncPaymentData() {
  // DISABLED (2026-07-06): offline payment sync must not run until the
  // server endpoint exists AND every queued record carries an idempotencyKey
  // (see payment_idempotency handling in /api/admin/payments POST).
  // Replaying payments without idempotency can create duplicate receipts.
  // The target endpoint /api/admin/payments/batch does not exist today and
  // nothing writes to 'payments-queue', so this is a safety no-op.
  console.log('[ServiceWorker] Payment sync disabled (idempotent batch endpoint not yet available)');
}

/**
 * Sync all queued data
 */
async function syncAllData() {
  try {
    await syncAttendanceData();
    await syncPaymentData();
    console.log('[ServiceWorker] All data synced');
  } catch (error) {
    console.error('[ServiceWorker] Complete sync failed:', error);
    throw error;
  }
}

/**
 * Open attendance database
 */
function openAttendanceDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('AttendanceDB', 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

/**
 * Get queued records from IndexedDB
 */
function getQueuedRecords(db, storeName) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || []);
  });
}

/**
 * Remove queued record after successful sync
 */
function removeQueuedRecord(db, storeName, recordId) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    store.delete(recordId);

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

/**
 * Push notification event
 */
self.addEventListener('push', (event) => {
  console.log('[ServiceWorker] Push notification received');

  if (!event.data) return;

  const data = event.data.json();

  const options = {
    body: data.body || 'New notification',
    icon: '/sri-narayana-high-school-logo.jpg',
    badge: '/sri-narayana-high-school-logo.jpg',
    tag: data.tag || 'notification',
    requireInteraction: data.requireInteraction || false,
    data: data.data || {}
  };

  event.waitUntil(self.registration.showNotification(data.title || 'Notification', options));
});

/**
 * Notification click event
 */
self.addEventListener('notificationclick', (event) => {
  console.log('[ServiceWorker] Notification clicked');

  event.notification.close();

  const urlToOpen = event.notification.data.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }

      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

console.log('[ServiceWorker] Loaded');
