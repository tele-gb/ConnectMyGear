import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
const repoBase = process.env.NODE_ENV === 'production' ? '/ConnectMyGear/' : '/';

export default defineConfig({
  base: repoBase,
  plugins: [react()],
  server: {
    open: true
  }
});
