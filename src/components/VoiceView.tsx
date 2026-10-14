import { useEffect, useRef, useState, type RefObject } from 'react';
import type { Track } from 'livekit-client';
import {
  ChatBubble,
  Close,
  Fullscreen,
  FullscreenExit,
  Grid,
  Hangup,
  Headphones,
  Mic,
  ScreenShare,
  Speaker,
  Video,
} from '../icons';
import type { Action, State } from '../store';
import type { Channel, Message } from '../types';
import { memberUser, type Occupancy, type VoiceMember, type VoiceSession } from '../voice';
import { Avatar } from './Avatar';
import { Conversation } from './Chat';

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
  const messages = state.messages[channel.id] ?? [];
  const showChat = state.showVoiceChat;
  const unread = useUnread(messages.length, showChat);

  return (
    <main className="voice-view">
      <section className="voice-stage">
        <header className="voice-view-header">
          <Speaker size={24} />
          <h1>{channel.name}</h1>
          <button
            className={`voice-chat-toggle ${showChat ? 'on' : ''}`}
            onClick={() => dispatch({ type: 'toggleVoiceChat' })}
            aria-pressed={showChat}
            aria-label={
              showChat ? 'Ocultar chat' : unread ? `Mostrar chat (${unread} ${unread === 1 ? 'nova' : 'novas'})` : 'Mostrar chat'
            }
            title={showChat ? 'Ocultar chat' : 'Mostrar chat'}
          >
            <ChatBubble size={24} />
            {unread > 0 && <span className="unread-badge">{unread > 99 ? '99+' : unread}</span>}
          </button>
        </header>

        {connected ? <Call state={state} session={session} dispatch={dispatch} /> : (
          <Lobby
            channel={channel}
            people={occupancy[channel.id] ?? []}
            onJoin={() => dispatch({ type: 'joinVoice', serverId, channelId: channel.id })}
          />
        )}
      </section>

      {showChat && (
        <VoiceChat
          channel={channel}
          messages={messages}
          canSend={connected && session.status === 'connected'}
          session={session}
          onClose={() => dispatch({ type: 'toggleVoiceChat' })}
        />
      )}
    </main>
  );
}

/** Quantas mensagens chegaram enquanto o chat estava fechado. */
function useUnread(count: number, open: boolean) {
  const [seen, setSeen] = useState(count);
  useEffect(() => {
    if (open) setSeen(count);
  }, [open, count]);
  return open ? 0 : Math.max(0, count - seen);
}

function VoiceChat({
  channel,
  messages,
  canSend,
  session,
  onClose,
}: {
  channel: Channel;
  messages: Message[];
  canSend: boolean;
  session: VoiceSession;
  onClose: () => void;
}) {
  return (
    <aside className="voice-chat" aria-label={`Chat de ${channel.name}`}>
      <header className="voice-chat-header">
        <Speaker size={20} />
        <h2>{channel.name}</h2>
        <button onClick={onClose} aria-label="Fechar chat" title="Fechar chat">
          <Close size={20} />
        </button>
      </header>
      <Conversation
        conversationId={channel.id}
        welcome={
          <>
            <div className="welcome-icon">
              <Speaker size={36} />
            </div>
            <h2>Bem-vindo(a) a {channel.name}!</h2>
            <p>As mensagens deste chat chegam a todos que estão na sala de voz.</p>
          </>
        }
        messages={messages}
        placeholder={canSend ? `Conversar em ${channel.name}` : 'Entre na sala de voz para conversar'}
        disabled={!canSend}
        onSend={session.sendChat}
        onDelete={canSend ? session.deleteChat : undefined}
      />
    </aside>
  );
}

/* ---------------------------------------------------------------- chamada */

/** Um quadro da chamada: a tela compartilhada de alguém ou a própria pessoa (câmera ou avatar). */
interface TileInfo {
  key: string;
  member: VoiceMember;
  screen: boolean;
}

function videoOf(tile: TileInfo) {
  return tile.screen ? tile.member.screen : tile.member.camera;
}

function Call({ state, session, dispatch }: { state: State; session: VoiceSession; dispatch: (a: Action) => void }) {
  const tiles: TileInfo[] = [
    ...session.members.filter((m) => m.screen).map((m) => ({ key: `${m.identity}:tela`, member: m, screen: true })),
    ...session.members.map((m) => ({ key: m.identity, member: m, screen: false })),
  ];
  const [focusedKey, setFocusedKey] = useState<string | null>(null);
  // Se a transmissão ampliada acabar (ou a câmera desligar), volta sozinho para a grade.
  const focused = tiles.find((t) => t.key === focusedKey && videoOf(t)) ?? null;

  useEffect(() => {
    if (!focused) return;
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && e.target.closest('textarea, input');
      if (e.key === 'Escape' && !typing && !document.fullscreenElement) setFocusedKey(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [focused]);

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
      ) : focused ? (
        <div className="voice-focus">
          <div className="voice-focus-main">
            <CallTile tile={focused} mode="focus" onGrid={() => setFocusedKey(null)} />
          </div>
          <div className="voice-strip">
            {tiles
              .filter((t) => t !== focused)
              .map((t) => (
                <CallTile key={t.key} tile={t} mode="strip" onFocus={() => setFocusedKey(t.key)} />
              ))}
          </div>
        </div>
      ) : (
        <div className="voice-grid" data-count={Math.min(tiles.length, 4)}>
          {tiles.map((t) => (
            <CallTile key={t.key} tile={t} mode="grid" onFocus={() => setFocusedKey(t.key)} />
          ))}
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

function useIsFullscreen(ref: RefObject<HTMLElement>) {
  const [fullscreen, setFullscreen] = useState(false);
  useEffect(() => {
    const update = () => setFullscreen(!!ref.current && document.fullscreenElement === ref.current);
    document.addEventListener('fullscreenchange', update);
    return () => document.removeEventListener('fullscreenchange', update);
  }, [ref]);
  return fullscreen;
}

/**
 * grid: na grade, clicar num vídeo amplia; focus: o vídeo ampliado (duplo clique = tela cheia);
 * strip: miniaturas embaixo do vídeo ampliado, clicar troca qual está ampliado.
 */
function CallTile({
  tile,
  mode,
  onFocus,
  onGrid,
}: {
  tile: TileInfo;
  mode: 'grid' | 'focus' | 'strip';
  onFocus?: () => void;
  onGrid?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const fullscreen = useIsFullscreen(ref);
  const { member: m, screen } = tile;
  const video = videoOf(tile);
  const user = memberUser(m);
  const label = screen ? `a tela de ${m.name}` : `a câmera de ${m.name}`;

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void ref.current?.requestFullscreen().catch(() => {});
  };

  return (
    <div
      ref={ref}
      className={`voice-tile ${mode} ${screen ? 'screen' : ''} ${video && !screen ? 'video' : ''} ${
        !screen && m.speaking ? 'speaking' : ''
      }`}
    >
      {video ? (
        // A própria câmera aparece espelhada, como num espelho.
        <TrackVideo track={video} mirrored={!screen && m.isLocal} />
      ) : (
        <>
          <div className="voice-tile-bg" style={{ background: user.color }} />
          <Avatar user={user} size={mode === 'strip' ? 48 : 80} />
        </>
      )}

      {video &&
        (mode === 'focus' || fullscreen ? (
          <div className="voice-tile-hit" onDoubleClick={toggleFullscreen} />
        ) : (
          <button className="voice-tile-hit" onClick={onFocus} aria-label={`Ampliar ${label}`} title="Clique para ampliar" />
        ))}

      {screen && <span className="live-badge">AO VIVO</span>}
      <span className="voice-tile-name">
        {screen ? (
          <ScreenShare size={14} />
        ) : (
          m.micMuted && (
            <span className="slashed">
              <Mic size={14} />
            </span>
          )
        )}
        {screen ? `Tela de ${m.name}` : m.name}
        {!screen && m.isLocal && ' (você)'}
      </span>

      {video && mode !== 'strip' && (
        <div className="voice-tile-actions">
          {mode === 'focus' && (
            <button onClick={onGrid} aria-label="Voltar para a grade" title="Voltar para a grade (Esc)">
              <Grid size={20} />
            </button>
          )}
          <button
            onClick={toggleFullscreen}
            aria-label={fullscreen ? 'Sair da tela cheia' : `Ver ${label} em tela cheia`}
            title={fullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
          >
            {fullscreen ? <FullscreenExit size={20} /> : <Fullscreen size={20} />}
          </button>
        </div>
      )}
    </div>
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
