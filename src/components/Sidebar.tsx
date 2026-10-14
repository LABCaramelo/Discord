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
import { findChannel, voiceParticipants, type Action, type State } from '../store';
import type { Channel, Server, Status } from '../types';
import type { LocalMedia } from '../voice';
import { Avatar, statusLabel } from './Avatar';

/** Estado de voz que as barras laterais precisam para desenhar quem fala e o painel de conexão. */
export interface VoiceUi {
  speaking: Set<string>;
  micError: string | null;
  media: LocalMedia;
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
  const ids = voiceParticipants(channelId, state.voice);
  if (!ids.length) return null;
  const { speaking, media } = voiceUi;
  return (
    <ul className="voice-users">
      {ids.map((id) => {
        const u = users[id];
        const isMe = id === ME;
        return (
          <li key={id} className={`voice-user ${speaking.has(id) ? 'speaking' : ''}`}>
            <Avatar user={u} size={24} speaking={speaking.has(id)} />
            <span className="voice-user-name">{u.name}</span>
            {isMe && (state.muted || state.deafened || media.camera || media.screen) && (
              <span className="voice-user-flags">
                {media.camera && (
                  <span className="voice-user-icon" title="Câmera ligada">
                    <Video size={14} />
                  </span>
                )}
                {media.screen && <span className="live-badge small">AO VIVO</span>}
                {state.muted && (
                  <span className="slashed" title="Microfone silenciado">
                    <Mic size={14} />
                  </span>
                )}
                {state.deafened && (
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

function VoiceConnectedPanel({ state, voiceUi, dispatch }: { state: State; voiceUi: VoiceUi; dispatch: (a: Action) => void }) {
  if (!state.voice) return null;
  const { serverId, channelId } = state.voice;
  const channel = findChannel(serverId, channelId)!;
  const server = servers.find((s) => s.id === serverId)!;
  return (
    <div className="voice-panel">
      <div className="voice-panel-row">
        <div className="voice-panel-info">
          <span className={`voice-panel-status ${voiceUi.micError ? 'warn' : ''}`}>
            <Signal size={16} />
            {voiceUi.micError ? 'Sem microfone' : 'Voz conectada'}
          </span>
          <button
            className="voice-panel-channel"
            onClick={() => dispatch({ type: 'openChannel', serverId, channelId })}
            title={voiceUi.micError ?? undefined}
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
          className={voiceUi.media.camera ? 'on' : ''}
          onClick={voiceUi.media.toggleCamera}
          aria-label={voiceUi.media.camera ? 'Desligar câmera' : 'Ligar câmera'}
          aria-pressed={!!voiceUi.media.camera}
          title={voiceUi.media.camera ? 'Desligar câmera' : 'Ligar câmera'}
        >
          <Video size={18} />
        </button>
        <button
          className={voiceUi.media.screen ? 'on' : ''}
          onClick={voiceUi.media.toggleScreen}
          aria-label={voiceUi.media.screen ? 'Parar transmissão' : 'Compartilhar tela'}
          aria-pressed={!!voiceUi.media.screen}
          title={voiceUi.media.screen ? 'Parar transmissão' : 'Compartilhar tela'}
        >
          <ScreenShare size={18} />
        </button>
      </div>
      {voiceUi.media.error && <p className="voice-panel-error">{voiceUi.media.error}</p>}
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
