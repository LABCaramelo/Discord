import { ME, users } from '../data';
import type { Server, Status, User } from '../types';
import { Avatar } from './Avatar';

/** Agrupa por cargo quem está online e junta todo mundo offline no fim, como o Discord faz. */
export function MemberList({ server, myStatus }: { server: Server; myStatus: Status }) {
  const statusOf = (u: User) => (u.id === ME ? myStatus : u.status);
  const seen = new Set<string>();
  const groups: { title: string; color?: string; members: User[] }[] = [];

  for (const role of server.roles) {
    const online = role.members
      .filter((id) => !seen.has(id))
      .map((id) => users[id])
      .filter((u) => statusOf(u) !== 'offline');
    online.forEach((u) => seen.add(u.id));
    if (online.length) groups.push({ title: role.name, color: role.color, members: online });
  }

  const offline = server.roles
    .flatMap((r) => r.members)
    .filter((id, i, all) => all.indexOf(id) === i && !seen.has(id))
    .map((id) => users[id]);
  if (offline.length) groups.push({ title: 'Offline', members: offline });

  return (
    <aside className="member-list" aria-label="Membros">
      {groups.map((g) => (
        <section key={g.title}>
          <h2 className="member-group">
            {g.title} — {g.members.length}
          </h2>
          {g.members.map((u) => {
            const status = statusOf(u);
            return (
              <button key={u.id} className={`member ${status === 'offline' ? 'offline' : ''}`}>
                <Avatar user={u} size={32} status={status === 'offline' ? null : status} ring="var(--bg-secondary)" />
                <span className="member-text">
                  <span className="member-name" style={{ color: status === 'offline' ? undefined : g.color }}>
                    {u.name}
                    {u.bot && <span className="bot-tag">APP</span>}
                  </span>
                  {status !== 'offline' && u.activity && <span className="member-activity">{u.activity}</span>}
                </span>
              </button>
            );
          })}
        </section>
      ))}
    </aside>
  );
}
