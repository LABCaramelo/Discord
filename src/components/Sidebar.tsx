import { useState } from 'react';
import { ME, directMessages, servers, users } from '../data';
import {
  ChevronDown,
  Close,
  Friends,
  Gear,
  Hangup,
  Hash,
  Headphones,
  Megaphone,
  Mic,
  Plus,
  ScreenShare,
  Signal,
  Speaker,
  Video,
} from '../icons';
import { findChannel, type Action, type State } from '../store';
import type { Channel, Server, Status } from '../types';
import { memberUser, type Occupancy, type VoiceMember, type VoiceSession } from '../voice';
import { Avatar, statusLabel } from './Avatar';

/** Estado de voz que as barras laterais precisam: a chamada atual e quem está em cada canal. */
export interface VoiceUi {
  session: VoiceSession;
  occupancy: Occupancy;
}

export function ChannelIcon({ channel, size = 20 }: { channel: Channel; size?: number }) {
  if (channel.kind === 'voice') return <Speaker size={size} />;
  if (channel.kind === 'announcement') return <Megaphone size={size} />;
  return <Hash size={size} />;
}

interface ServerSidebarProps {
  server: Server;
  state: State;
  voiceUi: VoiceUi;
  dispatch: (a: Action) => void;
}

export function ServerSidebar({ server, state, voiceUi, dispatch }: ServerSidebarProps) {
  const activeChannel = state.channelByServer[server.id];
  const connectedChannel = state.voice?.channelId;
  return (
    <aside className="sidebar">
      <button className="sidebar-header server-header">
        <span>{server.name}</span>
        <ChevronDown size={18} />
      </button>
      <div className="sidebar-scroll">
        {server.categories.map((cat) => {
          const collapsed = !!state.collapsed[cat.id];
          return (
            <section key={cat.id} className="category">
              <div className="category-header">
                <button
                  className={`category-toggle ${collapsed ? 'collapsed' : ''}`}
                  onClick={() => dispatch({ type: 'toggleCategory', categoryId: cat.id })}
                  aria-expanded={!collapsed}
                >
                  <ChevronDown size={12} />
                  <span>{cat.name}</span>
                </button>
                <button className="category-add" title="Criar canal" aria-label="Criar canal">
                  <Plus size={16} />
                </button>
              </div>
              {cat.channels
                .filter((ch) => !collapsed || ch.id === activeChannel || ch.id === connectedChannel)
                .map((ch) => (
                  <div key={ch.id}>
                    <button
                      className={`channel ${ch.id === activeChannel ? 'active' : ''} ${ch.kind}`}
                      onClick={() => dispatch({ type: 'openChannel', serverId: server.id, channelId: ch.id })}
                    >
                      <ChannelIcon channel={ch} />
                      <span className="channel-name">{ch.name}</span>
                    </button>
                    {ch.kind === 'voice' && <VoiceUserList channelId={ch.id} state={state} voiceUi={voiceUi} />}
                  </div>
                ))}
            </section>
          );
        })}
      </div>
      <VoiceConnectedPanel state={state} voiceUi={voiceUi} dispatch={dispatch} />
      <UserPanel state={state} dispatch={dispatch} />
    </aside>
  );
}

function VoiceUserList({ channelId, state, voiceUi }: { channelId: string; state: State; voiceUi: VoiceUi }) {
  const { session, occupancy } = voiceUi;
  // No canal em que você está, a lista vem da própria chamada (ao vivo); nos outros, do servidor.
  const live = state.voice?.channelId === channelId && session.members.length > 0;
  const people: VoiceMember[] = live
    ? session.members
    : (occupancy[channelId] ?? [])
        .filter((p) => p.identity !== state.profile.id)
        .map((p) => ({ ...p, isLocal: false, speaking: false, micMuted: false, camera: null, screen: null }));
  if (!people.length) return null;

  return (
    <ul className="voice-users">
      {people.map((m) => {
        const deafened = m.isLocal && state.deafened;
        return (
          <li key={m.identity} className={`voice-user ${m.speaking ? 'speaking' : ''}`}>
            <Avatar user={memberUser(m)} size={24} speaking={m.speaking} />
            <span className="voice-user-name">{m.name}</span>
            {(m.micMuted || deafened || m.camera || m.screen) && (
              <span className="voice-user-flags">
                {m.camera && (
                  <span className="voice-user-icon" title="Câmera ligada">
                    <Video size={14} />
                  </span>
                )}
                {m.screen && <span className="live-badge small">AO VIVO</span>}
                {m.micMuted && (
                  <span className="slashed" title="Microfone silenciado">
                    <Mic size={14} />
                  </span>
                )}
                {deafened && (
                  <span className="slashed" title="Áudio desativado">
                    <Headphones size={14} />
                  </span>
                )}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

const panelStatus: Record<VoiceSession['status'], { label: string; tone: string }> = {
  idle: { label: 'Voz conectada', tone: '' },
  connecting: { label: 'Conectando…', tone: 'warn' },
  connected: { label: 'Voz conectada', tone: '' },
  reconnecting: { label: 'Reconectando…', tone: 'warn' },
  error: { label: 'Falha na conexão', tone: 'error' },
};

function VoiceConnectedPanel({ state, voiceUi, dispatch }: { state: State; voiceUi: VoiceUi; dispatch: (a: Action) => void }) {
  if (!state.voice) return null;
  const { session } = voiceUi;
  const { serverId, channelId } = state.voice;
  const channel = findChannel(serverId, channelId)!;
  const server = servers.find((s) => s.id === serverId)!;
  const status = panelStatus[session.status];
  const problem = session.error ?? session.deviceError;
  return (
    <div className="voice-panel">
      <div className="voice-panel-row">
        <div className="voice-panel-info">
          <span className={`voice-panel-status ${status.tone}`}>
            <Signal size={16} />
            {status.label}
          </span>
          <button
            className="voice-panel-channel"
            onClick={() => dispatch({ type: 'openChannel', serverId, channelId })}
          >
            {channel.name} / {server.name}
          </button>
        </div>
        <button
          className="voice-panel-hangup"
          onClick={() => dispatch({ type: 'leaveVoice' })}
          aria-label="Desconectar"
          title="Desconectar"
        >
          <Hangup size={20} />
        </button>
      </div>
      <div className="voice-panel-buttons">
        <button
          className={session.cameraOn ? 'on' : ''}
          onClick={session.toggleCamera}
          disabled={session.status !== 'connected'}
          aria-label={session.cameraOn ? 'Desligar câmera' : 'Ligar câmera'}
          aria-pressed={session.cameraOn}
          title={session.cameraOn ? 'Desligar câmera' : 'Ligar câmera'}
        >
          <Video size={18} />
        </button>
        <button
          className={session.screenOn ? 'on' : ''}
          onClick={session.toggleScreen}
          disabled={session.status !== 'connected'}
          aria-label={session.screenOn ? 'Parar transmissão' : 'Compartilhar tela'}
          aria-pressed={session.screenOn}
          title={session.screenOn ? 'Parar transmissão' : 'Compartilhar tela'}
        >
          <ScreenShare size={18} />
        </button>
      </div>
      {problem && <p className="voice-panel-error">{problem}</p>}
    </div>
  );
}

interface HomeSidebarProps {
  dmId: string | null;
  state: State;
  voiceUi: VoiceUi;
  dispatch: (a: Action) => void;
}

export function HomeSidebar({ dmId, state, voiceUi, dispatch }: HomeSidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <button className="search-trigger">Encontre ou comece uma conversa</button>
      </div>
      <div className="sidebar-scroll">
        <button
          className={`channel home-link ${dmId === null ? 'active' : ''}`}
          onClick={() => dispatch({ type: 'openHome', dmId: null })}
        >
          <Friends size={24} />
          <span className="channel-name">Amigos</span>
        </button>
        <div className="dm-heading">
          <span>Mensagens diretas</span>
          <Plus size={16} />
        </div>
        {directMessages.map((dm) => {
          const u = users[dm.userId];
          return (
            <button
              key={dm.id}
              className={`channel dm ${dm.id === dmId ? 'active' : ''}`}
              onClick={() => dispatch({ type: 'openHome', dmId: dm.id })}
            >
              <Avatar user={u} size={32} status={u.status} ring="var(--bg-secondary)" />
              <span className="dm-text">
                <span className="channel-name">{u.name}</span>
                {u.activity && <span className="dm-activity">{u.activity}</span>}
              </span>
              <Close size={16} className="dm-close" />
            </button>
          );
        })}
      </div>
      <VoiceConnectedPanel state={state} voiceUi={voiceUi} dispatch={dispatch} />
      <UserPanel state={state} dispatch={dispatch} />
    </aside>
  );
}

function UserPanel({ state, dispatch }: { state: State; dispatch: (a: Action) => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const me = users[ME];
  return (
    <div className="user-panel">
      <button className="user-panel-me" onClick={() => setMenuOpen((v) => !v)}>
        <Avatar user={me} size={32} status={state.myStatus} ring="var(--bg-panel)" />
        <span className="user-panel-text">
          <span className="user-panel-name">{me.name}</span>
          <span className="user-panel-sub">{statusLabel[state.myStatus]}</span>
        </span>
      </button>
      {menuOpen && (
        <div className="status-menu" role="menu">
          {(['online', 'idle', 'dnd', 'offline'] as Status[]).map((s) => (
            <button
              key={s}
              role="menuitem"
              onClick={() => {
                dispatch({ type: 'setStatus', status: s });
                setMenuOpen(false);
              }}
            >
              <span className={`status-dot static status-${s}`} />
              {statusLabel[s]}
            </button>
          ))}
          <div className="status-menu-separator" />
          <button
            role="menuitem"
            onClick={() => {
              dispatch({ type: 'editName', open: true });
              setMenuOpen(false);
            }}
          >
            Alterar nome
          </button>
        </div>
      )}
      <div className="user-panel-actions">
        <button
          className={state.muted ? 'off slashed' : ''}
          onClick={() => dispatch({ type: 'toggleMute' })}
          aria-label={state.muted ? 'Ativar microfone' : 'Silenciar'}
          title={state.muted ? 'Ativar microfone' : 'Silenciar'}
        >
          <Mic size={20} />
        </button>
        <button
          className={state.deafened ? 'off slashed' : ''}
          onClick={() => dispatch({ type: 'toggleDeafen' })}
          aria-label={state.deafened ? 'Ativar áudio' : 'Desativar áudio'}
          title={state.deafened ? 'Ativar áudio' : 'Desativar áudio'}
        >
          <Headphones size={20} />
        </button>
        <button aria-label="Configurações de usuário" title="Configurações de usuário">
          <Gear size={20} />
        </button>
      </div>
    </div>
  );
}
