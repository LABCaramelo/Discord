import { useEffect, useRef } from 'react';
import type { Track } from 'livekit-client';
import { Hangup, Headphones, Mic, ScreenShare, Speaker, Video } from '../icons';
import type { Action, State } from '../store';
import type { Channel } from '../types';
import { memberUser, type Occupancy, type VoiceSession } from '../voice';
import { Avatar } from './Avatar';

interface Props {
  serverId: string;
  channel: Channel;
  state: State;
  session: VoiceSession;
  occupancy: Occupancy;
  dispatch: (a: Action) => void;
}

export function TrackVideo({ track, mirrored }: { track: Track; mirrored?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    track.attach(el);
    return () => {
      track.detach(el);
    };
  }, [track]);
  return <video ref={ref} className={`stream-video ${mirrored ? 'mirrored' : ''}`} autoPlay muted playsInline />;
}

export function VoiceView({ serverId, channel, state, session, occupancy, dispatch }: Props) {
  const connected = state.voice?.channelId === channel.id;

  return (
    <main className="voice-view">
      <header className="voice-view-header">
        <Speaker size={24} />
        <h1>{channel.name}</h1>
      </header>

      {connected ? <Call state={state} session={session} dispatch={dispatch} /> : (
        <Lobby
          channel={channel}
          people={occupancy[channel.id] ?? []}
          onJoin={() => dispatch({ type: 'joinVoice', serverId, channelId: channel.id })}
        />
      )}
    </main>
  );
}

function Call({ state, session, dispatch }: { state: State; session: VoiceSession; dispatch: (a: Action) => void }) {
  const screens = session.members.filter((m) => m.screen);
  const tileCount = session.members.length + screens.length;

  return (
    <>
      {session.status === 'error' ? (
        <div className="voice-lobby">
          <h2>Não deu para conectar</h2>
          <p>{session.error}</p>
          <button className="voice-join" onClick={session.retry}>
            Tentar de novo
          </button>
        </div>
      ) : session.status === 'connecting' ? (
        <div className="voice-lobby">
          <p>Conectando…</p>
        </div>
      ) : (
        <div className="voice-grid" data-count={Math.min(tileCount, 4)}>
          {screens.map((m) => (
            <div key={`${m.identity}-screen`} className="voice-tile screen">
              <TrackVideo track={m.screen!} />
              <span className="live-badge">AO VIVO</span>
              <span className="voice-tile-name">
                <ScreenShare size={14} />
                Tela de {m.name}
              </span>
            </div>
          ))}
          {session.members.map((m) => {
            const user = memberUser(m);
            return (
              <div key={m.identity} className={`voice-tile ${m.speaking ? 'speaking' : ''} ${m.camera ? 'video' : ''}`}>
                {m.camera ? (
                  // A própria câmera aparece espelhada, como num espelho.
                  <TrackVideo track={m.camera} mirrored={m.isLocal} />
                ) : (
                  <>
                    <div className="voice-tile-bg" style={{ background: user.color }} />
                    <Avatar user={user} size={80} />
                  </>
                )}
                <span className="voice-tile-name">
                  {m.micMuted && (
                    <span className="slashed">
                      <Mic size={14} />
                    </span>
                  )}
                  {m.name}
                  {m.isLocal && ' (você)'}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {session.status === 'reconnecting' && <p className="voice-warning">Reconectando…</p>}
      {session.deviceError && <p className="voice-warning">{session.deviceError}</p>}
      {session.audioBlocked && (
        <p className="voice-warning">
          O navegador bloqueou o som da chamada.{' '}
          <button className="link-button" onClick={session.startAudio}>
            Clique para ouvir
          </button>
        </p>
      )}

      <div className="voice-controls">
        <button
          className={state.muted ? 'off slashed' : ''}
          onClick={() => dispatch({ type: 'toggleMute' })}
          aria-label={state.muted ? 'Ativar microfone' : 'Silenciar'}
          title={state.muted ? 'Ativar microfone' : 'Silenciar'}
        >
          <Mic size={24} />
        </button>
        <button
          className={state.deafened ? 'off slashed' : ''}
          onClick={() => dispatch({ type: 'toggleDeafen' })}
          aria-label={state.deafened ? 'Ativar áudio' : 'Desativar áudio'}
          title={state.deafened ? 'Ativar áudio' : 'Desativar áudio'}
        >
          <Headphones size={24} />
        </button>
        <button
          className={session.cameraOn ? 'on' : ''}
          onClick={session.toggleCamera}
          disabled={session.status !== 'connected'}
          aria-label={session.cameraOn ? 'Desligar câmera' : 'Ligar câmera'}
          aria-pressed={session.cameraOn}
          title={session.cameraOn ? 'Desligar câmera' : 'Ligar câmera'}
        >
          <Video size={24} />
        </button>
        <button
          className={session.screenOn ? 'on' : ''}
          onClick={session.toggleScreen}
          disabled={session.status !== 'connected'}
          aria-label={session.screenOn ? 'Parar transmissão' : 'Compartilhar tela'}
          aria-pressed={session.screenOn}
          title={session.screenOn ? 'Parar transmissão' : 'Compartilhar tela'}
        >
          <ScreenShare size={24} />
        </button>
        <button
          className="hangup"
          onClick={() => dispatch({ type: 'leaveVoice' })}
          aria-label="Desconectar"
          title="Desconectar"
        >
          <Hangup size={24} />
        </button>
      </div>
    </>
  );
}

function Lobby({
  channel,
  people,
  onJoin,
}: {
  channel: Channel;
  people: { identity: string; name: string }[];
  onJoin: () => void;
}) {
  return (
    <div className="voice-lobby">
      <div className="voice-lobby-avatars">
        {people.map((p) => (
          <Avatar key={p.identity} user={memberUser(p)} size={48} />
        ))}
      </div>
      <h2>{channel.name}</h2>
      <p>
        {people.length
          ? `${people.map((p) => p.name).join(', ')} ${people.length === 1 ? 'está' : 'estão'} na sala.`
          : 'Ninguém está aqui ainda.'}
      </p>
      <button className="voice-join" onClick={onJoin}>
        Entrar na voz
      </button>
    </div>
  );
}
