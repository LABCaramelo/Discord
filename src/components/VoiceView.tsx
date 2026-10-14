import { useEffect, useRef } from 'react';
import { ME, users } from '../data';
import { Hangup, Headphones, Mic, ScreenShare, Speaker, Video } from '../icons';
import { voiceParticipants, type Action, type State } from '../store';
import type { Channel } from '../types';
import type { LocalMedia } from '../voice';
import { Avatar } from './Avatar';

interface Props {
  serverId: string;
  channel: Channel;
  state: State;
  speaking: Set<string>;
  micError: string | null;
  media: LocalMedia;
  dispatch: (a: Action) => void;
}

export function StreamVideo({ stream, mirrored }: { stream: MediaStream; mirrored?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream;
  }, [stream]);
  return <video ref={ref} className={`stream-video ${mirrored ? 'mirrored' : ''}`} autoPlay muted playsInline />;
}

export function VoiceView({ serverId, channel, state, speaking, micError, media, dispatch }: Props) {
  const connected = state.voice?.channelId === channel.id;
  const ids = voiceParticipants(channel.id, state.voice);
  const me = users[ME];
  const tileCount = ids.length + (media.screen ? 1 : 0);
  const warning = media.error ?? (micError && `${micError}. Os outros não vão ver você falando.`);

  return (
    <main className="voice-view">
      <header className="voice-view-header">
        <Speaker size={24} />
        <h1>{channel.name}</h1>
      </header>

      {connected ? (
        <>
          <div className="voice-grid" data-count={Math.min(tileCount, 4)}>
            {media.screen && (
              <div className="voice-tile screen">
                <StreamVideo stream={media.screen} />
                <span className="live-badge">AO VIVO</span>
                <span className="voice-tile-name">
                  <ScreenShare size={14} />
                  Tela de {me.name}
                </span>
              </div>
            )}
            {ids.map((id) => {
              const u = users[id];
              const isMe = id === ME;
              const video = isMe ? media.camera : null;
              return (
                <div key={id} className={`voice-tile ${speaking.has(id) ? 'speaking' : ''} ${video ? 'video' : ''}`}>
                  {video ? (
                    // A própria câmera aparece espelhada, como num espelho.
                    <StreamVideo stream={video} mirrored />
                  ) : (
                    <>
                      <div className="voice-tile-bg" style={{ background: u.color }} />
                      <Avatar user={u} size={80} />
                    </>
                  )}
                  <span className="voice-tile-name">
                    {isMe && state.muted && (
                      <span className="slashed">
                        <Mic size={14} />
                      </span>
                    )}
                    {u.name}
                  </span>
                </div>
              );
            })}
          </div>
          {warning && <p className="voice-warning">{warning}</p>}
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
              className={media.camera ? 'on' : ''}
              onClick={media.toggleCamera}
              aria-label={media.camera ? 'Desligar câmera' : 'Ligar câmera'}
              aria-pressed={!!media.camera}
              title={media.camera ? 'Desligar câmera' : 'Ligar câmera'}
            >
              <Video size={24} />
            </button>
            <button
              className={media.screen ? 'on' : ''}
              onClick={media.toggleScreen}
              aria-label={media.screen ? 'Parar transmissão' : 'Compartilhar tela'}
              aria-pressed={!!media.screen}
              title={media.screen ? 'Parar transmissão' : 'Compartilhar tela'}
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
      ) : (
        <div className="voice-lobby">
          <div className="voice-lobby-avatars">
            {ids.map((id) => (
              <Avatar key={id} user={users[id]} size={48} />
            ))}
          </div>
          <h2>{channel.name}</h2>
          <p>
            {ids.length
              ? `${ids.map((id) => users[id].name).join(', ')} ${ids.length === 1 ? 'está' : 'estão'} na sala.`
              : 'Ninguém está aqui ainda.'}
          </p>
          <button
            className="voice-join"
            onClick={() => dispatch({ type: 'joinVoice', serverId, channelId: channel.id })}
          >
            Entrar na voz
          </button>
        </div>
      )}
    </main>
  );
}
