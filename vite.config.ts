import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Порт локального API-сервера (server/index.js). Единый источник — переменная
// окружения PORT (её же читает server/index.js), безопасное значение по умолчанию — 3000.
const API_PORT = Number(process.env.PORT) || 3000;

export default defineConfig({
  plugins: [react(), {
    name: 'local-mde-diagnostics',
    configureServer(server) {
      // The API sees the proxy's loopback socket: check the original client here too.
      server.middlewares.use((req, res, next) => {
        if (req.url?.split('?')[0].toLowerCase().startsWith('/api/test/') &&
          !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress ?? '')) {
          res.statusCode = 403;
          res.end('Local diagnostics only');
          return;
        }
        next();
      });
    }
  }],
  server: {
    port: 5173,
    strictPort: false,
    open: false,
    // Прокси для локальной разработки: /api/* уходит на локальный сервер.
    // В production (Vercel) этим маршрутом управляют serverless-функции из папки api/.
    proxy: {
      '/api': {
        target: `http://localhost:${API_PORT}`,
        changeOrigin: true,
        secure: false
      }
    }
  },
  preview: {
    port: 4173,
    strictPort: false
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  }
});
