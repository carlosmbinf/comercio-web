import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const reactNativeShim = fileURLToPath(new URL('./src/meteor/reactNativeShim.js', import.meta.url));
const netInfoShim = fileURLToPath(new URL('./src/meteor/netInfoShim.js', import.meta.url));
const asyncStorageShim = fileURLToPath(new URL('./src/meteor/asyncStorageShim.js', import.meta.url));
const googlePopupHeaders = {
  'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
};

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: /^react-native\/Libraries\/Renderer\/shims\/ReactNative$/, replacement: reactNativeShim },
      { find: /^react-native$/, replacement: reactNativeShim },
      { find: /^@react-native-community\/netinfo$/, replacement: netInfoShim },
      { find: /^@react-native-async-storage\/async-storage$/, replacement: asyncStorageShim },
    ],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          const path = id.replace(/\\/g, '/');
          if (path.includes('/node_modules/@mui/icons-material/')) return 'mui-icons';
          if (path.includes('/node_modules/@mui/') || path.includes('/node_modules/@emotion/')) return 'mui';
          if (path.includes('/node_modules/@meteorrn/') || path.includes('/node_modules/ejson/')) return 'meteor-ddp';
          if (path.includes('/node_modules/leaflet/') || path.includes('/node_modules/react-leaflet/')) return 'maps';
          if (path.includes('/node_modules/react-dom/') || path.includes('/node_modules/react/')) return 'react';
          return undefined;
        },
      },
    },
  },
  preview: {
    headers: googlePopupHeaders,
  },
  server: {
    host: '0.0.0.0',
    port: 5174,
    strictPort: true,
    allowedHosts: ['odeshop.vidkar.com'],
    headers: googlePopupHeaders,
  },
});
