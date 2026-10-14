import { useCallback, useEffect, useRef, useState } from 'react';
import { Room, RoomEvent, Track, type Participant } from 'livekit-client';
import type { Profile, VoiceConnection } from './store';
import type { User } from './types';

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
  /** Problema com um dispositivo; a conexão continua. */
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
      } catch (err) {
        if (cancelled) return;
        setStatus('error');
        setError(err instanceof Error ? err.message : 'Não foi possível entrar na sala.');
      }
    })();

    return () => {
      cancelled = true;
      room.removeAllListeners();
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
