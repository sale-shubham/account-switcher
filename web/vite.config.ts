import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The PowerShell server (lib/ui-server.ps1) owns the API. In development Vite forwards /api to it;
// changeOrigin makes the Host header localhost:47821, the only host its HttpListener accepts.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: { '/api': { target: 'http://localhost:47821', changeOrigin: true } },
  },
});
