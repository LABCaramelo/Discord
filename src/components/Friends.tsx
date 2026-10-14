import { useState } from 'react';
import { ME, directMessages, users } from '../data';
import { Friends as FriendsIcon, Search } from '../icons';
import type { Action } from '../store';
import { Avatar, statusLabel } from './Avatar';

type Tab = 'online' | 'all' | 'pending' | 'add';

export function FriendsView({ dispatch }: { dispatch: (a: Action) => void }) {
  const [tab, setTab] = useState<Tab>('online');
  const [query, setQuery] = useState('');
  const friends = Object.values(users).filter((u) => u.id !== ME && !u.bot);
  const shown = friends
    .filter((u) => (tab === 'online' ? u.status !== 'offline' : true))
    .filter((u) => u.name.toLowerCase().includes(query.toLowerCase()));
  const active = friends.filter((u) => u.status === 'online' && u.activity);

  const openDm = (userId: string) => {
    const dm = directMessages.find((d) => d.userId === userId);
    if (dm) dispatch({ type: 'openHome', dmId: dm.id });
  };

  return (
    <div className="friends">
      <main className="chat">
        <header className="chat-header">
          <span className="chat-header-icon">
            <FriendsIcon size={24} />
          </span>
          <h1 className="chat-header-title">Amigos</h1>
          <span className="chat-header-divider" />
          <nav className="friends-tabs">
            <button className={tab === 'online' ? 'active' : ''} onClick={() => setTab('online')}>
              Disponível
            </button>
            <button className={tab === 'all' ? 'active' : ''} onClick={() => setTab('all')}>
              Todos
            </button>
            <button className={tab === 'pending' ? 'active' : ''} onClick={() => setTab('pending')}>
              Pendente
            </button>
            <button className={`add ${tab === 'add' ? 'active' : ''}`} onClick={() => setTab('add')}>
              Adicionar amigo
            </button>
          </nav>
        </header>

        <div className="friends-body">
          {tab === 'add' ? (
            <div className="add-friend">
              <h2>Adicionar amigo</h2>
              <p>Você pode adicionar amigos com o nome de usuário deles no Discord.</p>
              <form className="add-friend-form" onSubmit={(e) => e.preventDefault()}>
                <input placeholder="Você pode adicionar amigos com o nome de usuário deles." />
                <button type="submit">Enviar pedido de amizade</button>
              </form>
            </div>
          ) : tab === 'pending' ? (
            <p className="friends-empty">Não há pedidos de amizade pendentes.</p>
          ) : (
            <>
              <label className="friends-search">
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar" />
                <Search size={18} />
              </label>
              <h2 className="friends-count">
                {tab === 'online' ? 'Disponível' : 'Todos os amigos'} — {shown.length}
              </h2>
              {shown.map((u) => (
                <div key={u.id} className="friend-row" onClick={() => openDm(u.id)}>
                  <Avatar user={u} size={32} status={u.status} ring="var(--bg-primary)" />
                  <div className="friend-text">
                    <span className="friend-name">{u.name}</span>
                    <span className="friend-status">{u.activity ?? statusLabel[u.status]}</span>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </main>

      <aside className="active-now">
        <h2>Ativo agora</h2>
        {active.map((u) => (
          <div key={u.id} className="active-card">
            <Avatar user={u} size={32} status={u.status} ring="var(--bg-secondary)" />
            <div className="friend-text">
              <span className="friend-name">{u.name}</span>
              <span className="friend-status">{u.activity}</span>
            </div>
          </div>
        ))}
      </aside>
    </div>
  );
}
