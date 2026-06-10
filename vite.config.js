import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      include: ['buffer', 'process', 'util', 'stream', 'events', 'path', 'crypto'],
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
      overrides: {
        os: path.resolve(__dirname, 'src/shims/os.js'),
      },
    }),
  ],
  resolve: {
    alias: {
      os: path.resolve(__dirname, 'src/shims/os.js'),
    },
  },
  server: {
    port: 5173,
  },
  build: {
    chunkSizeWarningLimit: 1500,
  },
});
