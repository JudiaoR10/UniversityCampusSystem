import { fileURLToPath, URL } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, repositoryRoot, '');
  const apiTarget = env.VITE_API_PROXY_TARGET || 'http://localhost:4100';

  return {
    envDir: repositoryRoot,
    plugins: [react()],
    server: {
      port: 5173,
      host: true,
      proxy: {
        '/api': { target: apiTarget, changeOrigin: true },
        '/health': { target: apiTarget, changeOrigin: true },
      },
    },
  };
});
