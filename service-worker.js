/**
 * HabitFlow Pro Service Worker
 * Provides offline caching, cache-first strategy for shell assets,
 * and stale-while-revalidate for CDN dependencies.
 */

const CACHE_NAME = 'habitflow-pro-v1.0.0';

const PRECACHE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './tests.html',
  './assets/icons/favicon.svg',
  './assets/icons/icon-192.svg',
  './assets/icons/icon-512.svg',
  './css/base.css',
  './css/themes.css',
  './css/layout.css',
  './css/components.css',
  './css/pages.css',
  './css/responsive.css',
  './js/app.js',
  './js/router.js',
  './js/state.js',
  './js/storage.js',
  './js/habits.js',
  './js/streaks.js',
  './js/gamification.js',
  './js/dashboard.js',
  './js/calendar.js',
  './js/heatmap.js',
  './js/statistics.js',
  './js/insights.js',
  './js/journal.js',
  './js/goals.js',
  './js/reminders.js',
  './js/shortcuts.js',
  './js/confetti.js',
  './js/ui.js',
  './js/utils.js',
  './data/sample-data.js'
];

// Install: Cache all core assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[SW] Pre-caching partial failure (likely local dev relative paths):', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Activate: Clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Strategy dispatcher
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Stale-While-Revalidate for external CDNs (Google Fonts, Chart.js)
  if (url.origin.includes('googleapis.com') ||
      url.origin.includes('gstatic.com') ||
      url.origin.includes('cdn.jsdelivr.net')) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(request).then((cachedResponse) => {
          const fetchPromise = fetch(request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(request, networkResponse.clone());
            }
            return networkResponse;
          }).catch(() => cachedResponse);
          return cachedResponse || fetchPromise;
        });
      })
    );
    return;
  }

  // Cache-first, fallback to network for local app assets
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, responseToCache);
        });
        return networkResponse;
      }).catch(() => {
        // Fallback for navigation requests
        if (request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});

// Listen for message to skip waiting
self.addEventListener('message', (event) => {
  if (event.data && event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});
