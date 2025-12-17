import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  base: '/connect-my-gear/',
  plugins: [react()],
  server: {
    open: true
  }
});
