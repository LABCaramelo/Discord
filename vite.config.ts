import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/** No `npm run dev`, serve a mesma função que a Vercel publica em /api/livekit. */
function apiDev(): Plugin {
  return {
    name: 'api-dev',
    configureServer(server) {
      server.middlewares.use('/api/livekit', async (req, res) => {
        const mod = await server.ssrLoadModule('/api/livekit.ts');
        await mod.default(req, res);
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // Credenciais do LiveKit vêm do .env.local (nunca vão para o bundle do navegador).
  Object.assign(process.env, loadEnv(mode, process.cwd(), 'LIVEKIT_'));
  return {
    plugins: [react(), apiDev()],
    server: { port: 5190 },
  };
});
