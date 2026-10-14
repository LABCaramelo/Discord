import type { Status, User } from '../types';

interface Props {
  user: User;
  size?: number;
  status?: Status | null;
  /** Cor do anel ao redor do indicador de status (deve casar com o fundo). */
  ring?: string;
  /** Acende o anel verde de "falando" dos canais de voz. */
  speaking?: boolean;
}

export function Avatar({ user, size = 40, status, ring = 'var(--bg-secondary)', speaking }: Props) {
  const dot = Math.round(size * 0.3);
  return (
    <div
      className={`avatar ${speaking ? 'speaking' : ''}`}
      style={{ width: size, height: size, '--ring-gap': ring } as React.CSSProperties}
    >
      <div className="avatar-img" style={{ background: user.color, fontSize: size * 0.42 }}>
        {user.name[0].toUpperCase()}
      </div>
      {status && (
        <span
          className={`status-dot status-${status}`}
          style={{ width: dot, height: dot, borderColor: ring, borderWidth: Math.max(2, Math.round(size * 0.075)) }}
        />
      )}
    </div>
  );
}

export const statusLabel: Record<Status, string> = {
  online: 'Disponível',
  idle: 'Ausente',
  dnd: 'Não perturbar',
  offline: 'Invisível',
};
