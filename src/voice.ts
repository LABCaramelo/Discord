import { useCallback, useEffect, useRef, useState } from 'react';

/** Volume (RMS, 0–1) acima do qual consideramos que há fala no microfone. */
const SPEAKING_THRESHOLD = 0.04;
/** Mantém o anel aceso um pouco depois da fala parar, para não piscar entre sílabas. */
const SPEAKING_HOLD_MS = 250;

/**
 * Abre o microfone enquanto `active` for verdadeiro e informa se o usuário está falando.
 * O stream continua aberto quando silenciado (como no Discord); só o indicador é desligado.
 */
export function useMicSpeaking(active: boolean, muted: boolean) {
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!active) {
      setError(null);
      return;
    }
    let cancelled = false;
    let stream: MediaStream | null = null;
    let ctx: AudioContext | null = null;
    let raf = 0;

    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Microfone indisponível neste navegador');
      return;
    }

    navigator.mediaDevices
      .getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
      .then((s) => {
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = s;
        setError(null);
        ctx = new AudioContext();
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        ctx.createMediaStreamSource(s).connect(analyser);
        const buf = new Uint8Array(analyser.fftSize);
        let lastLoud = -Infinity;

        const tick = () => {
          analyser.getByteTimeDomainData(buf);
          let sum = 0;
          for (const v of buf) {
            const x = (v - 128) / 128;
            sum += x * x;
          }
          const now = performance.now();
          if (Math.sqrt(sum / buf.length) > SPEAKING_THRESHOLD) lastLoud = now;
          setSpeaking(now - lastLoud < SPEAKING_HOLD_MS);
          raf = requestAnimationFrame(tick);
        };
        tick();
      })
      .catch(() => {
        if (!cancelled) setError('Sem permissão para usar o microfone');
      });

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
      void ctx?.close();
      setSpeaking(false);
    };
  }, [active]);

  return { speaking: speaking && !muted, error };
}

/** Faz os participantes fictícios "falarem" em turnos aleatórios. */
export function useSimulatedSpeakers(userIds: string[]) {
  const [speaking, setSpeaking] = useState<Set<string>>(new Set());
  const key = userIds.join(',');

  useEffect(() => {
    if (!userIds.length) {
      setSpeaking(new Set());
      return;
    }
    const id = setInterval(() => {
      setSpeaking((prev) => {
        const next = new Set<string>();
        for (const u of userIds) {
          // Quem está falando tende a continuar; quem está quieto raramente começa.
          const chance = prev.has(u) ? 0.7 : 0.08;
          if (Math.random() < chance) next.add(u);
        }
        return next;
      });
    }, 400);
    return () => clearInterval(id);
  }, [key]);

  return speaking;
}

export interface LocalMedia {
  camera: MediaStream | null;
  screen: MediaStream | null;
  error: string | null;
  toggleCamera: () => void;
  toggleScreen: () => void;
}

const stopStream = (s: MediaStream | null) => s?.getTracks().forEach((t) => t.stop());

/**
 * Webcam e compartilhamento de tela enquanto você estiver numa sala de voz.
 * Sair da sala desliga os dois; parar pelo aviso do navegador também é detectado.
 */
export function useLocalMedia(connected: boolean): LocalMedia {
  const [camera, setCamera] = useState<MediaStream | null>(null);
  const [screen, setScreen] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cameraRef = useRef<MediaStream | null>(null);
  const screenRef = useRef<MediaStream | null>(null);
  const connectedRef = useRef(connected);
  connectedRef.current = connected;

  const setCam = (s: MediaStream | null) => {
    cameraRef.current = s;
    setCamera(s);
  };
  const setScr = (s: MediaStream | null) => {
    screenRef.current = s;
    setScreen(s);
  };

  useEffect(() => {
    if (connected) return;
    stopStream(cameraRef.current);
    stopStream(screenRef.current);
    setCam(null);
    setScr(null);
    setError(null);
  }, [connected]);

  useEffect(
    () => () => {
      stopStream(cameraRef.current);
      stopStream(screenRef.current);
    },
    [],
  );

  /** Guarda o stream só se ainda estivermos na sala; o navegador pode demorar a responder. */
  const adopt = (s: MediaStream, set: (s: MediaStream | null) => void, ref: React.MutableRefObject<MediaStream | null>) => {
    if (!connectedRef.current) {
      stopStream(s);
      return;
    }
    s.getVideoTracks()[0]?.addEventListener('ended', () => {
      if (ref.current === s) set(null);
    });
    set(s);
    setError(null);
  };

  const toggleCamera = useCallback(async () => {
    if (cameraRef.current) {
      stopStream(cameraRef.current);
      setCam(null);
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Câmera indisponível neste navegador');
      return;
    }
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 } });
      adopt(s, setCam, cameraRef);
    } catch {
      setError('Sem permissão para usar a câmera');
    }
  }, []);

  const toggleScreen = useCallback(async () => {
    if (screenRef.current) {
      stopStream(screenRef.current);
      setScr(null);
      return;
    }
    if (!navigator.mediaDevices?.getDisplayMedia) {
      setError('Compartilhamento de tela indisponível neste navegador');
      return;
    }
    try {
      const s = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      adopt(s, setScr, screenRef);
    } catch {
      setError('Compartilhamento de tela cancelado ou bloqueado');
    }
  }, []);

  return { camera, screen, error, toggleCamera, toggleScreen };
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
