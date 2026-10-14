import { useCallback, useEffect, useRef, useState } from 'react';
import { Room, RoomEvent, Track, type Participant } from 'livekit-client';
import { ME, users } from './data';
import type { Profile, VoiceConnection } from './store';
import type { Message, User } from './types';

/* ---------------------------------------------------------------- tipos */

export interface VoiceMember {
  identity: string;
  name: string;
  isLocal: boolean;
  speaking: boolean;
  micMuted: boolean;
  camera: Track | null;
  screen: Track | null;
}

export type VoiceStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'error';

export interface VoiceSession {
  status: VoiceStatus;
  /** Falha de conexão (a sala não funciona). */
  error: string | null;
  /** Problema com um dispositivo ou com um envio; a conexão continua. */
  deviceError: string | null;
  members: VoiceMember[];
  cameraOn: boolean;
  screenOn: boolean;
  /** O navegador bloqueou a reprodução de áudio até um clique. */
  audioBlocked: boolean;
  toggleCamera: () => void;
  toggleScreen: () => void;
  startAudio: () => void;
  retry: () => void;
  /** Envia uma mensagem no chat de texto da sala. */
  sendChat: (content: string) => void;
  /** Apaga uma mensagem sua do chat da sala, para todos. */
  deleteChat: (messageId: string) => void;
}

/**
 * Liga o chat da sala às mensagens guardadas no app: o histórico do canal atual,
 * para repassar a quem entrar depois, e onde gravar o que chega.
 */
export interface VoiceChatStore {
  history: Message[];
  receive: (channelId: string, messages: Message[]) => void;
  remove: (channelId: string, messageId: string) => void;
}

/** Quem está em cada canal de voz (chave: id do canal), segundo o servidor. */
export type Occupancy = Record<string, { identity: string; name: string }[]>;

/* ---------------------------------------------------------------- utilidades */

const PALETTE = ['#5865f2', '#eb459e', '#f0b232', '#23a55a', '#00a8fc', '#f23f43', '#9b59b6', '#e67e22'];

/** Cor estável por pessoa, igual em todos os navegadores. */
export function colorFor(identity: string) {
  let h = 0;
  for (const c of identity) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

export function memberUser(m: { identity: string; name: string }): User {
  return { id: m.identity, name: m.name, color: colorFor(m.identity), status: 'online' };
}

/** Sons curtos de entrar/sair, sintetizados para não depender de arquivos de áudio. */
export function playVoiceSound(kind: 'join' | 'leave') {
  try {
    const ctx = new AudioContext();
    const notes = kind === 'join' ? [523.25, 783.99] : [783.99, 523.25];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = ctx.currentTime + i * 0.09;
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.15, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.16);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.18);
    });
    setTimeout(() => void ctx.close(), 600);
  } catch {
    // sem Web Audio: segue sem som
  }
}

function errorMessage(status: number, code?: string) {
  if (status === 503 || code === 'not_configured') {
    return 'Servidor de voz não configurado: defina LIVEKIT_URL, LIVEKIT_API_KEY e LIVEKIT_API_SECRET.';
  }
  return `Não foi possível entrar na sala (erro ${status}).`;
}

function publishedTrack(p: Participant, source: Track.Source) {
  const pub = p.getTrackPublication(source);
  return pub && !pub.isMuted && pub.track ? pub.track : null;
}

function snapshot(room: Room): VoiceMember[] {
  const all: Participant[] = [room.localParticipant, ...room.remoteParticipants.values()];
  return all.map((p) => ({
    identity: p.identity,
    name: p.name || p.identity,
    isLocal: p === room.localParticipant,
    speaking: p.isSpeaking,
    micMuted: !p.isMicrophoneEnabled,
    camera: publishedTrack(p, Track.Source.Camera),
    screen: publishedTrack(p, Track.Source.ScreenShare),
  }));
}

/* ---------------------------------------------------------------- chat da sala */

/*
 * O chat das salas de voz não tem servidor próprio: as mensagens vão pela sala do LiveKit
 * para quem está nela. Quem entra pede o histórico, e uma só pessoa da sala responde.
 * Localmente suas mensagens usam o autor ME, como nos canais de texto; na rede, o seu id.
 */
const CHAT_TOPIC = 'chat';
const CHAT_HISTORY_LIMIT = 100;
const CHAT_MAX_LENGTH = 4000;

type ChatPacket =
  | { type: 'message'; message: Message }
  | { type: 'delete'; id: string }
  | { type: 'history-request' }
  | { type: 'history'; messages: Message[] };

function sendChatPacket(room: Room, packet: ChatPacket, to?: string[]) {
  return room.localParticipant.sendText(JSON.stringify(packet), { topic: CHAT_TOPIC, destinationIdentities: to });
}

/** Valida uma mensagem vinda de outra pessoa. */
function parseChatMessage(raw: unknown, profileId: string): Message | null {
  if (!raw || typeof raw !== 'object') return null;
  const { id, authorId, authorName, content, timestamp } = raw as Record<string, unknown>;
  if (typeof id !== 'string' || typeof authorId !== 'string' || typeof content !== 'string') return null;
  if (typeof timestamp !== 'number') return null;
  // Ninguém se passa por alguém do diretório local nem por você. Suas mensagens já estão
  // guardadas aqui, e as que você apagou não voltam pelo histórico de outra pessoa.
  if (authorId in users || authorId === profileId) return null;
  return {
    id: id.slice(0, 64),
    authorId,
    authorName: typeof authorName === 'string' ? authorName.slice(0, 32) : undefined,
    content: content.slice(0, CHAT_MAX_LENGTH),
    // Um relógio adiantado não joga a mensagem para o fim da conversa.
    timestamp: Math.min(timestamp, Date.now()),
  };
}

function toWire(m: Message, profile: Profile): Message {
  return m.authorId === ME ? { ...m, authorId: profile.id, authorName: profile.name } : m;
}

/* ---------------------------------------------------------------- sessão */

/**
 * Conecta na sala LiveKit do canal de voz atual e mantém o estado da chamada.
 * Trocar de canal desconecta da sala antiga e entra na nova.
 */
export function useVoiceSession(
  voice: VoiceConnection | null,
  profile: Profile,
  muted: boolean,
  deafened: boolean,
  chat: VoiceChatStore,
): VoiceSession {
  const [status, setStatus] = useState<VoiceStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const [members, setMembers] = useState<VoiceMember[]>([]);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const roomRef = useRef<Room | null>(null);
  const deafenedRef = useRef(deafened);
  deafenedRef.current = deafened;
  const profileRef = useRef(profile);
  profileRef.current = profile;
  const chatRef = useRef(chat);
  chatRef.current = chat;

  const channelId = voice?.channelId ?? null;

  useEffect(() => {
    if (!channelId) {
      setStatus('idle');
      setError(null);
      setDeviceError(null);
      setMembers([]);
      return;
    }

    let cancelled = false;
    const room = new Room({
      adaptiveStream: true,
      dynacast: true,
      audioCaptureDefaults: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    roomRef.current = room;
    setStatus('connecting');
    setError(null);
    setDeviceError(null);

    const refresh = () => {
      if (!cancelled) setMembers(snapshot(room));
    };

    room
      .on(RoomEvent.ParticipantConnected, () => {
        if (!deafenedRef.current) playVoiceSound('join');
        refresh();
      })
      .on(RoomEvent.ParticipantDisconnected, () => {
        if (!deafenedRef.current) playVoiceSound('leave');
        refresh();
      })
      .on(RoomEvent.TrackSubscribed, (track) => {
        if (track.kind === Track.Kind.Audio) {
          const el = track.attach();
          el.muted = deafenedRef.current;
          document.body.appendChild(el);
        }
        refresh();
      })
      .on(RoomEvent.TrackUnsubscribed, (track) => {
        track.detach().forEach((el) => el.remove());
        refresh();
      })
      .on(RoomEvent.TrackMuted, refresh)
      .on(RoomEvent.TrackUnmuted, refresh)
      .on(RoomEvent.LocalTrackPublished, refresh)
      .on(RoomEvent.LocalTrackUnpublished, refresh)
      .on(RoomEvent.ActiveSpeakersChanged, refresh)
      .on(RoomEvent.ParticipantNameChanged, refresh)
      .on(RoomEvent.Reconnecting, () => !cancelled && setStatus('reconnecting'))
      .on(RoomEvent.Reconnected, () => !cancelled && setStatus('connected'))
      .on(RoomEvent.AudioPlaybackStatusChanged, () => !cancelled && setAudioBlocked(!room.canPlaybackAudio))
      .on(RoomEvent.Disconnected, () => {
        if (!cancelled) {
          setStatus('error');
          setError('A conexão com a sala caiu.');
        }
      });

    const onChatPacket = (packet: Record<string, unknown>, from: string) => {
      const store = chatRef.current;
      const profileId = profileRef.current.id;
      switch (packet.type) {
        case 'message': {
          const m = parseChatMessage(packet.message, profileId);
          // Mensagem nova só vale assinada por quem a enviou.
          if (m && m.authorId === from) store.receive(channelId, [m]);
          break;
        }
        case 'delete': {
          const target = store.history.find((m) => m.id === packet.id);
          if (target && target.authorId === from) store.remove(channelId, target.id);
          break;
        }
        case 'history-request': {
          // Responde só quem tem o menor id entre os que já estavam, para não repetir o envio.
          const me = room.localParticipant.identity;
          const ids = [me, ...[...room.remoteParticipants.values()].map((p) => p.identity)].filter((id) => id !== from);
          if (ids.sort()[0] !== me || !store.history.length) break;
          const messages = store.history.slice(-CHAT_HISTORY_LIMIT).map((m) => toWire(m, profileRef.current));
          void sendChatPacket(room, { type: 'history', messages }, [from]).catch(() => {});
          break;
        }
        case 'history': {
          if (!Array.isArray(packet.messages)) break;
          const messages = packet.messages
            .slice(-CHAT_HISTORY_LIMIT)
            .map((m) => parseChatMessage(m, profileId))
            .filter((m): m is Message => !!m);
          if (messages.length) store.receive(channelId, messages);
          break;
        }
      }
    };

    room.registerTextStreamHandler(CHAT_TOPIC, (reader, { identity }) => {
      reader
        .readAll()
        .then((text) => {
          if (cancelled) return;
          const packet: unknown = JSON.parse(text);
          if (packet && typeof packet === 'object') onChatPacket(packet as Record<string, unknown>, identity);
        })
        .catch((err) => console.warn('[voz] mensagem de chat inválida', err));
    });

    (async () => {
      try {
        const res = await fetch('/api/livekit?action=token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ channelId, identity: profile.id, name: profile.name }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(errorMessage(res.status, data.error));
        if (cancelled) return;

        try {
          await room.connect(data.url, data.token);
        } catch (err) {
          console.error('[voz] falha ao conectar no LiveKit', err);
          throw new Error('Não foi possível conectar ao servidor de voz. Confira o LIVEKIT_URL e sua internet.');
        }
        if (cancelled) return;
        // O microfone é ligado pelo efeito de "silenciar" logo abaixo, ao ver o status mudar.
        setStatus('connected');
        setAudioBlocked(!room.canPlaybackAudio);
        refresh();
        if (room.remoteParticipants.size > 0) {
          void sendChatPacket(room, { type: 'history-request' }).catch(() => {});
        }
      } catch (err) {
        if (cancelled) return;
        setStatus('error');
        setError(err instanceof Error ? err.message : 'Não foi possível entrar na sala.');
      }
    })();

    return () => {
      cancelled = true;
      room.removeAllListeners();
      room.unregisterTextStreamHandler(CHAT_TOPIC);
      for (const p of room.remoteParticipants.values()) {
        for (const pub of p.audioTrackPublications.values()) pub.track?.detach().forEach((el) => el.remove());
      }
      void room.disconnect();
      roomRef.current = null;
      setMembers([]);
      setAudioBlocked(false);
    };
    // O nome só vale para a próxima entrada: mudar o nome não derruba a chamada.
  }, [channelId, profile.id, attempt]);

  // Silenciar = parar de publicar o microfone.
  useEffect(() => {
    const room = roomRef.current;
    if (!room || status !== 'connected') return;
    room.localParticipant
      .setMicrophoneEnabled(!muted)
      .then(() => setMembers(snapshot(room)))
      .catch(() => setDeviceError('Sem permissão para usar o microfone. Você só vai ouvir.'));
  }, [muted, status]);

  // Desativar o áudio = silenciar tudo o que chega dos outros.
  useEffect(() => {
    const room = roomRef.current;
    if (!room) return;
    for (const p of room.remoteParticipants.values()) {
      for (const pub of p.audioTrackPublications.values()) {
        pub.track?.attachedElements.forEach((el) => (el.muted = deafened));
      }
    }
  }, [deafened, members]);

  const toggleCamera = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    const lp = room.localParticipant;
    try {
      await lp.setCameraEnabled(!lp.isCameraEnabled, { resolution: { width: 1280, height: 720 } });
      setDeviceError(null);
    } catch {
      setDeviceError('Sem permissão para usar a câmera.');
    }
    setMembers(snapshot(room));
  }, []);

  const toggleScreen = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    const lp = room.localParticipant;
    try {
      await lp.setScreenShareEnabled(!lp.isScreenShareEnabled, { audio: true });
      setDeviceError(null);
    } catch {
      setDeviceError('Compartilhamento de tela cancelado ou bloqueado.');
    }
    setMembers(snapshot(room));
  }, []);

  const startAudio = useCallback(() => {
    void roomRef.current?.startAudio().then(() => setAudioBlocked(false));
  }, []);

  const sendChat = useCallback(
    (content: string) => {
      const room = roomRef.current;
      const text = content.trim().slice(0, CHAT_MAX_LENGTH);
      if (!room || !channelId || !text) return;
      const message: Message = { id: crypto.randomUUID(), authorId: ME, content: text, timestamp: Date.now() };
      chatRef.current.receive(channelId, [message]);
      sendChatPacket(room, { type: 'message', message: toWire(message, profileRef.current) }).catch(() =>
        setDeviceError('Não foi possível enviar a mensagem para a sala.'),
      );
    },
    [channelId],
  );

  const deleteChat = useCallback(
    (messageId: string) => {
      const room = roomRef.current;
      if (!room || !channelId) return;
      chatRef.current.remove(channelId, messageId);
      sendChatPacket(room, { type: 'delete', id: messageId }).catch(() =>
        setDeviceError('Não foi possível apagar a mensagem para todos.'),
      );
    },
    [channelId],
  );

  const local = members.find((m) => m.isLocal);
  return {
    status,
    error,
    deviceError,
    members,
    cameraOn: !!local?.camera,
    screenOn: !!local?.screen,
    audioBlocked,
    toggleCamera,
    toggleScreen,
    startAudio,
    retry: () => setAttempt((a) => a + 1),
    sendChat,
    deleteChat,
  };
}

/* ---------------------------------------------------------------- presença */

const OCCUPANCY_POLL_MS = 10_000;

/**
 * Consulta periodicamente quem está em cada canal de voz, para a barra lateral
 * mostrar as pessoas mesmo antes de você entrar. Só consulta com a aba visível.
 */
export function useVoiceOccupancy(refreshKey: string | null): Occupancy {
  const [occupancy, setOccupancy] = useState<Occupancy>({});

  useEffect(() => {
    let stopped = false;
    const load = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const res = await fetch('/api/livekit?action=rooms');
        if (res.status === 503) {
          stopped = true; // sem LiveKit configurado: não adianta insistir
          return;
        }
        if (res.ok) setOccupancy((await res.json()).occupancy ?? {});
      } catch {
        // rede instável: tenta de novo no próximo ciclo
      }
    };
    void load();
    const id = setInterval(() => !stopped && void load(), OCCUPANCY_POLL_MS);
    const onVisible = () => !stopped && void load();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refreshKey]);

  return occupancy;
}
