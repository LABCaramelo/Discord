import { Fragment, useEffect, useRef, useState } from 'react';
import { ME, users } from '../data';
import { Bell, Emoji, Gif, Gift, Members, Pin, Plus, Search, Threads } from '../icons';
import type { Action } from '../store';
import type { Message, User } from '../types';
import { memberUser } from '../voice';
import { Avatar } from './Avatar';

/** Mensagens do mesmo autor com menos de 7 minutos de intervalo são agrupadas. */
const GROUP_WINDOW_MS = 7 * 60_000;

interface Props {
  conversationId: string;
  title: string;
  icon: React.ReactNode;
  topic?: string;
  placeholder: string;
  welcome: React.ReactNode;
  messages: Message[];
  showMembers: boolean;
  membersToggle: boolean;
  dispatch: (a: Action) => void;
}

export function Chat(p: Props) {
  return (
    <main className="chat">
      <header className="chat-header">
        <span className="chat-header-icon">{p.icon}</span>
        <h1 className="chat-header-title">{p.title}</h1>
        {p.topic && (
          <>
            <span className="chat-header-divider" />
            <span className="chat-header-topic">{p.topic}</span>
          </>
        )}
        <div className="chat-header-tools">
          {p.membersToggle && (
            <button title="Threads" aria-label="Threads">
              <Threads size={24} />
            </button>
          )}
          <button title="Notificações" aria-label="Notificações">
            <Bell size={24} />
          </button>
          <button title="Mensagens fixadas" aria-label="Mensagens fixadas">
            <Pin size={24} />
          </button>
          {p.membersToggle && (
            <button
              className={p.showMembers ? 'on' : ''}
              onClick={() => p.dispatch({ type: 'toggleMembers' })}
              title="Lista de membros"
              aria-label="Lista de membros"
              aria-pressed={p.showMembers}
            >
              <Members size={24} />
            </button>
          )}
          <label className="header-search">
            <input placeholder="Buscar" aria-label="Buscar" />
            <Search size={16} />
          </label>
        </div>
      </header>

      <Conversation
        conversationId={p.conversationId}
        welcome={p.welcome}
        messages={p.messages}
        placeholder={p.placeholder}
        onSend={(content) => p.dispatch({ type: 'send', conversationId: p.conversationId, content })}
        onDelete={(id) => p.dispatch({ type: 'delete', conversationId: p.conversationId, messageId: id })}
      />
    </main>
  );
}

interface ConversationProps {
  conversationId: string;
  welcome: React.ReactNode;
  messages: Message[];
  placeholder: string;
  /** Mostra a caixa de envio, mas sem deixar escrever. */
  disabled?: boolean;
  onSend: (content: string) => void;
  /** Sem esta função, suas mensagens não podem ser apagadas. */
  onDelete?: (id: string) => void;
}

/** Mensagens e caixa de envio, usadas nos canais de texto e no chat das salas de voz. */
export function Conversation(p: ConversationProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [p.conversationId, p.messages.length]);

  return (
    <>
      <div className="messages" role="log" aria-live="polite">
        <div className="messages-welcome">{p.welcome}</div>
        <MessageList messages={p.messages} onDelete={p.onDelete} />
        <div ref={endRef} className="messages-end" />
      </div>

      <Composer key={p.conversationId} placeholder={p.placeholder} disabled={p.disabled} onSend={p.onSend} />
    </>
  );
}

function MessageList({ messages, onDelete }: { messages: Message[]; onDelete?: (id: string) => void }) {
  return (
    <>
      {messages.map((m, i) => {
        const prev = messages[i - 1];
        const newDay = !prev || !sameDay(prev.timestamp, m.timestamp);
        const grouped = !!prev && !newDay && prev.authorId === m.authorId && m.timestamp - prev.timestamp < GROUP_WINDOW_MS;
        // Quem fala nas salas de voz não está no diretório local: usa o nome que veio com a mensagem.
        const author = users[m.authorId] ?? memberUser({ identity: m.authorId, name: m.authorName ?? 'Alguém' });
        return (
          <Fragment key={m.id}>
            {newDay && (
              <div className="day-divider">
                <span>{formatDay(m.timestamp)}</span>
              </div>
            )}
            <article className={`message ${grouped ? 'grouped' : ''}`}>
              {grouped ? (
                <time className="message-hover-time">{formatTime(m.timestamp)}</time>
              ) : (
                <div className="message-avatar">
                  <Avatar user={author} size={40} />
                </div>
              )}
              <div className="message-body">
                {!grouped && (
                  <h3 className="message-meta">
                    <span className="message-author" style={{ color: author.color }}>
                      {author.name}
                    </span>
                    {author.bot && <span className="bot-tag">APP</span>}
                    <time className="message-time">{formatDateTime(m.timestamp)}</time>
                  </h3>
                )}
                <div className="message-content">
                  <RichText text={m.content} />
                </div>
              </div>
              {m.authorId === ME && onDelete && (
                <div className="message-actions">
                  <button onClick={() => onDelete(m.id)} title="Excluir mensagem" aria-label="Excluir mensagem">
                    🗑️
                  </button>
                </div>
              )}
            </article>
          </Fragment>
        );
      })}
    </>
  );
}

/** Destaca menções (@Nome) e trechos `código`, preservando quebras de linha. */
function RichText({ text }: { text: string }) {
  const names = Object.values(users).map((u: User) => u.name);
  const parts = text.split(/(`[^`]+`|@\w+)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
          return <code key={i}>{part.slice(1, -1)}</code>;
        }
        if (part.startsWith('@') && names.includes(part.slice(1))) {
          return (
            <span key={i} className="mention">
              {part}
            </span>
          );
        }
        return <Fragment key={i}>{part}</Fragment>;
      })}
    </>
  );
}

function Composer({
  placeholder,
  disabled,
  onSend,
}: {
  placeholder: string;
  disabled?: boolean;
  onSend: (content: string) => void;
}) {
  const [value, setValue] = useState('');
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 300)}px`;
  }, [value]);

  const submit = () => {
    if (disabled || !value.trim()) return;
    onSend(value);
    setValue('');
  };

  return (
    <form
      className="composer"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className={`composer-box ${disabled ? 'disabled' : ''}`}>
        <button type="button" className="composer-attach" aria-label="Enviar arquivo" disabled={disabled}>
          <Plus size={20} />
        </button>
        <textarea
          ref={ref}
          rows={1}
          value={value}
          disabled={disabled}
          placeholder={placeholder}
          aria-label={placeholder}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            // Enter envia; Shift+Enter quebra a linha.
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
        />
        <div className="composer-tools">
          <button type="button" className="composer-extra" aria-label="Presente" disabled={disabled}>
            <Gift size={24} />
          </button>
          <button type="button" className="composer-extra" aria-label="GIF" disabled={disabled}>
            <Gif size={24} />
          </button>
          <button type="button" aria-label="Emoji" disabled={disabled} onClick={() => setValue((v) => v + '😄')}>
            <Emoji size={24} />
          </button>
        </div>
      </div>
    </form>
  );
}

function sameDay(a: number, b: number) {
  return new Date(a).toDateString() === new Date(b).toDateString();
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function formatDay(ts: number) {
  return new Date(ts).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatDateTime(ts: number) {
  const d = new Date(ts);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameDay(ts, now.getTime())) return `Hoje às ${formatTime(ts)}`;
  if (sameDay(ts, yesterday.getTime())) return `Ontem às ${formatTime(ts)}`;
  return `${d.toLocaleDateString('pt-BR')} ${formatTime(ts)}`;
}
