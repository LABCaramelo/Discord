import { useEffect, useReducer } from 'react';
import { ME, seedMessages, servers } from './data';
import type { Message, Status } from './types';

export type View = { kind: 'home'; dmId: string | null } | { kind: 'server'; serverId: string };

export interface VoiceConnection {
  serverId: string;
  channelId: string;
}

/** Quem é este visitante nas salas de voz: id estável por navegador e nome escolhido. */
export interface Profile {
  id: string;
  name: string;
}

export interface State {
  profile: Profile;
  editingName: boolean;
  view: View;
  channelByServer: Record<string, string>;
  voice: VoiceConnection | null;
  messages: Record<string, Message[]>;
  collapsed: Record<string, boolean>;
  showMembers: boolean;
  showVoiceChat: boolean;
  muted: boolean;
  deafened: boolean;
  myStatus: Status;
}

export type Action =
  | { type: 'openHome'; dmId?: string | null }
  | { type: 'openServer'; serverId: string }
  | { type: 'openChannel'; serverId: string; channelId: string }
  | { type: 'joinVoice'; serverId: string; channelId: string }
  | { type: 'leaveVoice' }
  | { type: 'send'; conversationId: string; content: string }
  | { type: 'receive'; conversationId: string; messages: Message[] }
  | { type: 'delete'; conversationId: string; messageId: string }
  | { type: 'toggleCategory'; categoryId: string }
  | { type: 'toggleMembers' }
  | { type: 'toggleVoiceChat' }
  | { type: 'toggleMute' }
  | { type: 'toggleDeafen' }
  | { type: 'setStatus'; status: Status }
  | { type: 'setName'; name: string }
  | { type: 'editName'; open: boolean };

const STORAGE_KEY = 'discord-clone:v1';

function firstTextChannel(serverId: string): string {
  const server = servers.find((s) => s.id === serverId)!;
  for (const cat of server.categories) {
    const ch = cat.channels.find((c) => c.kind !== 'voice' && c.name === 'geral');
    if (ch) return ch.id;
  }
  return server.categories.flatMap((c) => c.channels).find((c) => c.kind !== 'voice')!.id;
}

export function findChannel(serverId: string, channelId: string) {
  return servers
    .find((s) => s.id === serverId)
    ?.categories.flatMap((c) => c.channels)
    .find((c) => c.id === channelId);
}

function initialState(): State {
  const fallback: State = {
    profile: { id: crypto.randomUUID(), name: '' },
    editingName: false,
    view: { kind: 'server', serverId: servers[0].id },
    channelByServer: Object.fromEntries(servers.map((s) => [s.id, firstTextChannel(s.id)])),
    voice: null,
    messages: seedMessages,
    collapsed: {},
    showMembers: true,
    showVoiceChat: true,
    muted: false,
    deafened: false,
    myStatus: 'online',
  };
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    // A conexão de voz depende do microfone aberto, então nunca é restaurada.
    if (saved) return { ...fallback, ...JSON.parse(saved), voice: null, editingName: false };
  } catch {
    // armazenamento indisponível ou corrompido: usa os dados de exemplo
  }
  return fallback;
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'openHome':
      return {
        ...state,
        view: { kind: 'home', dmId: action.dmId === undefined ? (state.view.kind === 'home' ? state.view.dmId : null) : action.dmId },
      };
    case 'openServer':
      return { ...state, view: { kind: 'server', serverId: action.serverId } };
    case 'openChannel': {
      // Como no Discord, clicar num canal de voz já conecta nele.
      const joins = findChannel(action.serverId, action.channelId)?.kind === 'voice';
      return {
        ...state,
        view: { kind: 'server', serverId: action.serverId },
        channelByServer: { ...state.channelByServer, [action.serverId]: action.channelId },
        voice: joins ? { serverId: action.serverId, channelId: action.channelId } : state.voice,
      };
    }
    case 'joinVoice':
      return { ...state, voice: { serverId: action.serverId, channelId: action.channelId } };
    case 'leaveVoice':
      return { ...state, voice: null };
    case 'send': {
      const content = action.content.trim();
      if (!content) return state;
      const message: Message = { id: crypto.randomUUID(), authorId: ME, content, timestamp: Date.now() };
      const list = state.messages[action.conversationId] ?? [];
      return { ...state, messages: { ...state.messages, [action.conversationId]: [...list, message] } };
    }
    case 'receive': {
      // Mensagens que chegam de outras pessoas (ou um histórico inteiro): ignora as já conhecidas.
      const list = state.messages[action.conversationId] ?? [];
      const known = new Set(list.map((m) => m.id));
      const fresh = action.messages.filter((m) => !known.has(m.id) && known.add(m.id));
      if (!fresh.length) return state;
      const merged = [...list, ...fresh].sort((a, b) => a.timestamp - b.timestamp);
      return { ...state, messages: { ...state.messages, [action.conversationId]: merged } };
    }
    case 'delete': {
      const list = state.messages[action.conversationId] ?? [];
      return {
        ...state,
        messages: { ...state.messages, [action.conversationId]: list.filter((m) => m.id !== action.messageId) },
      };
    }
    case 'toggleCategory':
      return { ...state, collapsed: { ...state.collapsed, [action.categoryId]: !state.collapsed[action.categoryId] } };
    case 'toggleMembers':
      return { ...state, showMembers: !state.showMembers };
    case 'toggleVoiceChat':
      return { ...state, showVoiceChat: !state.showVoiceChat };
    case 'toggleMute':
      // Reativar o microfone também reativa o áudio, como no Discord.
      return { ...state, muted: !state.muted, deafened: state.muted ? false : state.deafened };
    case 'toggleDeafen':
      return { ...state, deafened: !state.deafened, muted: !state.deafened };
    case 'setStatus':
      return { ...state, myStatus: action.status };
    case 'setName': {
      const name = action.name.trim().slice(0, 32);
      return name ? { ...state, profile: { ...state.profile, name }, editingName: false } : state;
    }
    case 'editName':
      return { ...state, editingName: action.open };
  }
}

export function useAppStore() {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // sem persistência neste navegador
    }
  }, [state]);

  return [state, dispatch] as const;
}
