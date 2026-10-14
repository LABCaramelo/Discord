import type { IncomingMessage, ServerResponse } from 'node:http';
import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';

/**
 * Função serverless da Vercel (e middleware do `npm run dev`, ver vite.config.ts).
 *   GET  /api/livekit?action=rooms  → quem está em cada canal de voz
 *   POST /api/livekit?action=token  → token para entrar num canal de voz
 *
 * Fica num arquivo só, sem imports relativos, para a Vercel empacotar sem surpresas com ESM.
 */

/** Prefixo das salas deste app, para não misturar com outros projetos na mesma conta LiveKit. */
const ROOM_PREFIX = 'discord-clone_';
const CHANNEL_ID = /^[a-z0-9-]{1,64}$/;
const IDENTITY = /^[A-Za-z0-9-]{8,64}$/;

type Req = IncomingMessage & { body?: unknown };

function config() {
  const { LIVEKIT_URL: url, LIVEKIT_API_KEY: apiKey, LIVEKIT_API_SECRET: apiSecret } = process.env;
  return url && apiKey && apiSecret ? { url, apiKey, apiSecret } : null;
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

async function readJson(req: Req): Promise<Record<string, unknown>> {
  // A Vercel já entrega o corpo pronto em req.body; no Vite lemos o stream.
  if (req.body && typeof req.body === 'object') return req.body as Record<string, unknown>;
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

export default async function handler(req: Req, res: ServerResponse) {
  const cfg = config();
  if (!cfg) return send(res, 503, { error: 'not_configured' });

  const action = new URL(req.url ?? '/', 'http://localhost').searchParams.get('action');

  try {
    if (action === 'rooms' && req.method === 'GET') {
      const svc = new RoomServiceClient(cfg.url.replace(/^ws/, 'http'), cfg.apiKey, cfg.apiSecret);
      const rooms = (await svc.listRooms()).filter((r) => r.name.startsWith(ROOM_PREFIX) && r.numParticipants > 0);
      const entries = await Promise.all(
        rooms.map(async (r) => {
          const people = await svc.listParticipants(r.name);
          return [
            r.name.slice(ROOM_PREFIX.length),
            people.map((p) => ({ identity: p.identity, name: p.name || p.identity })),
          ] as const;
        }),
      );
      return send(res, 200, { occupancy: Object.fromEntries(entries) });
    }

    if (action === 'token' && req.method === 'POST') {
      const body = await readJson(req);
      const channelId = String(body.channelId ?? '');
      const identity = String(body.identity ?? '');
      const name = String(body.name ?? '').trim().slice(0, 32);
      if (!CHANNEL_ID.test(channelId) || !IDENTITY.test(identity) || !name) {
        return send(res, 400, { error: 'invalid_request' });
      }
      const token = new AccessToken(cfg.apiKey, cfg.apiSecret, { identity, name, ttl: '6h' });
      token.addGrant({
        room: ROOM_PREFIX + channelId,
        roomJoin: true,
        canPublish: true,
        canSubscribe: true,
        canPublishData: true,
      });
      return send(res, 200, { token: await token.toJwt(), url: cfg.url });
    }

    return send(res, 404, { error: 'not_found' });
  } catch (err) {
    console.error('[api/livekit]', err);
    return send(res, 502, { error: 'livekit_error' });
  }
}
