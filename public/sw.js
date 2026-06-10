const SW_VERSION = 'v1';

self.addEventListener('install', (event) => {
  // Activate immediately
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Check if this is a stream request
  if (url.pathname.startsWith('/stream/')) {
    event.respondWith(handleStreamRequest(event));
  }
});

async function handleStreamRequest(event) {
  const url = new URL(event.request.url);
  const parts = url.pathname.split('/');
  
  // URL structure: /stream/:channelId/:messageId/:fileSize/:mimeTypeMapped/:fileName
  // parts[0] = ""
  // parts[1] = "stream"
  // parts[2] = channelId
  // parts[3] = messageId
  // parts[4] = fileSize
  // parts[5] = mimeTypeMapped
  // parts[6] = fileName

  if (parts.length < 6) {
    return new Response('Invalid stream URL', { status: 400 });
  }

  const channelId = parts[2];
  const messageId = parts[3];
  const fileSize = parseInt(parts[4], 10);
  const mimeType = parts[5].replace('~', '/');
  
  const rangeHeader = event.request.headers.get('Range');
  
  if (!rangeHeader) {
    // If there is no range header, the browser wants the entire file or just wants to check headers.
    // For media elements, we should return a 206 response containing the first block (e.g. 1MB).
    // This allows the browser to realize it's seekable and issue subsequent range requests.
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
