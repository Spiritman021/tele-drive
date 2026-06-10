import { Buffer } from 'buffer';
window.Buffer = Buffer;

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import telegramService from './services/telegram';

// Register Service Worker for media streaming
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('[ServiceWorker] Registered with scope:', registration.scope);
      })
      .catch((error) => {
        console.error('[ServiceWorker] Registration failed:', error);
      });
  });

  // Listen to range chunk fetch requests from the Service Worker
  navigator.serviceWorker.addEventListener('message', async (event) => {
    const { data, ports } = event;
    if (data && data.type === 'FETCH_CHUNK') {
      const port = ports[0];
      if (!port) return;

      try {
        const { channelId, messageId, start, end } = data;
        const chunk = await telegramService.downloadRange(channelId, messageId, start, end);
        port.postMessage({ chunk }, [chunk]); // Transfer ArrayBuffer
      } catch (error) {
        console.error('[Main] FETCH_CHUNK failed:', error);
        port.postMessage({ error: error.message || 'Failed to fetch chunk' });
      }
    }
  });
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
