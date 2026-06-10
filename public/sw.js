const CACHE_NAME = 'teledrive-static-v1';
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/favicon.svg',
  '/vite.svg',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  // Pre-cache key assets and force immediate activation
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  // Clean up old caches and claim clients
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[ServiceWorker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. Media Streaming: Bypass cache and handle progressive loading ranges
  if (url.pathname.startsWith('/stream/')) {
    event.respondWith(handleStreamRequest(event));
    return;
  }

  // Only handle GET requests for standard assets
  if (event.request.method !== 'GET') {
    return;
  }

  // 2. Static Assets Caching (Stale-While-Revalidate)
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch new version in the background to update the cache
        fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse.status === 200 && url.protocol.startsWith('http')) {
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse));
            }
          })
          .catch(() => {/* Ignore background fetch errors */});

        return cachedResponse;
      }

      // Fetch from network and cache for next time
      return fetch(event.request)
        .then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200) {
            return networkResponse;
          }

          if (url.protocol.startsWith('http')) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }

          return networkResponse;
        })
        .catch((err) => {
          // If offline and request is for page navigation, return cached index.html
          if (event.request.mode === 'navigate') {
            return caches.match('/');
          }
          throw err;
        });
    })
  );
});

async function handleStreamRequest(event) {
  const url = new URL(event.request.url);
  const parts = url.pathname.split('/');
  
  // URL structure: /stream/:channelId/:messageId/:fileSize/:mimeTypeMapped/:fileName
  if (parts.length < 6) {
    return new Response('Invalid stream URL', { status: 400 });
  }

  const channelId = parts[2];
  const messageId = parts[3];
  const fileSize = parseInt(parts[4], 10);
  const mimeType = parts[5].replace('~', '/');
  
  const rangeHeader = event.request.headers.get('Range');
  
  if (!rangeHeader) {
    // If there is no range header, return a 206 response containing the first block (e.g. 1MB).
    return serveChunk(event.clientId, channelId, messageId, 0, Math.min(1024 * 1024 - 1, fileSize - 1), fileSize, mimeType);
  }

  // Parse range (e.g. "bytes=0-1048575" or "bytes=0-")
  const rangeParts = rangeHeader.replace(/bytes=/, '').split('-');
  const start = parseInt(rangeParts[0], 10);
  let end = rangeParts[1] ? parseInt(rangeParts[1], 10) : fileSize - 1;

  if (isNaN(start)) {
    return new Response('Invalid Range header', { status: 400 });
  }

  // Cap chunk size to 1MB (1,048,576 bytes) to keep latency and memory usage minimal
  const MAX_CHUNK_SIZE = 1024 * 1024; // 1MB
  if (end - start + 1 > MAX_CHUNK_SIZE) {
    end = start + MAX_CHUNK_SIZE - 1;
  }

  // Ensure end is not out of bounds
  if (end >= fileSize) {
    end = fileSize - 1;
  }

  return serveChunk(event.clientId, channelId, messageId, start, end, fileSize, mimeType);
}

async function serveChunk(clientId, channelId, messageId, start, end, fileSize, mimeType) {
  try {
    const chunk = await fetchRangeFromClient(clientId, channelId, messageId, start, end);
    const contentLength = end - start + 1;

    return new Response(chunk, {
      status: 206,
      statusText: 'Partial Content',
      headers: {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Content-Length': contentLength.toString(),
        'Content-Type': mimeType,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('[sw] serveChunk error:', error);
    return new Response(error.message || 'Stream error', { status: 500 });
  }
}

function fetchRangeFromClient(clientId, channelId, messageId, start, end) {
  return new Promise((resolve, reject) => {
    if (!clientId) {
      reject(new Error('No client ID associated with fetch event'));
      return;
    }

    const channel = new MessageChannel();
    channel.port1.onmessage = (event) => {
      if (event.data.error) {
        reject(new Error(event.data.error));
      } else {
        resolve(event.data.chunk); // chunk is an ArrayBuffer
      }
    };

    self.clients.get(clientId).then((client) => {
      if (!client) {
        // Fallback: match any active page client if the exact one is not available
        self.clients.matchAll().then((clients) => {
          if (clients && clients.length > 0) {
            clients[0].postMessage(
              {
                type: 'FETCH_CHUNK',
                channelId,
                messageId,
                start,
                end,
              },
              [channel.port2]
            );
          } else {
            reject(new Error('No active clients found'));
          }
        });
        return;
      }

      client.postMessage(
        {
          type: 'FETCH_CHUNK',
          channelId,
          messageId,
          start,
          end,
        },
        [channel.port2]
      );
    }).catch(reject);
  });
}
