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

/**
 * Credenciais do LiveKit vêm do .env.local (nunca vão para o bundle do navegador).
 * O Vite reinicia no mesmo processo quando o .env.local muda, e o loadEnv dá prioridade
 * ao que já está em process.env; por isso removemos o que nós mesmos injetamos antes de
 * reler. Variáveis definidas no terminal continuam valendo.
 */
function loadLiveKitEnv(mode: string) {
  const g = globalThis as { __liveKitInjected?: Set<string> };
  const injected = (g.__liveKitInjected ??= new Set());
  for (const key of injected) delete process.env[key];
  injected.clear();
  for (const [key, value] of Object.entries(loadEnv(mode, process.cwd(), 'LIVEKIT_'))) {
    if (key in process.env) continue;
    process.env[key] = value;
    injected.add(key);
  }
}

export default defineConfig(({ mode }) => {
  loadLiveKitEnv(mode);
  return {
    plugins: [react(), apiDev()],
    server: { port: 5190 },
  };
});
