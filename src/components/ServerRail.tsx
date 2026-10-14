import { servers } from '../data';
import { Compass, HomeLogo, Plus } from '../icons';
import type { Action, View } from '../store';

interface Props {
  view: View;
  dispatch: (a: Action) => void;
}

export function ServerRail({ view, dispatch }: Props) {
  const homeActive = view.kind === 'home';
  return (
    <nav className="server-rail" aria-label="Servidores">
      <RailItem label="Mensagens diretas" active={homeActive} onClick={() => dispatch({ type: 'openHome' })} brand>
        <HomeLogo size={28} />
      </RailItem>
      <div className="rail-separator" />
      {servers.map((s) => (
        <RailItem
          key={s.id}
          label={s.name}
          active={view.kind === 'server' && view.serverId === s.id}
          color={s.color}
          onClick={() => dispatch({ type: 'openServer', serverId: s.id })}
        >
          {s.acronym}
        </RailItem>
      ))}
      <RailItem label="Adicionar um servidor" green onClick={() => {}}>
        <Plus size={24} />
      </RailItem>
      <RailItem label="Explorar servidores" green onClick={() => {}}>
        <Compass size={24} />
      </RailItem>
    </nav>
  );
}

interface ItemProps {
  label: string;
  active?: boolean;
  color?: string;
  brand?: boolean;
  green?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

function RailItem({ label, active, color, brand, green, onClick, children }: ItemProps) {
  const cls = ['rail-item', active && 'active', brand && 'brand', green && 'green'].filter(Boolean).join(' ');
  return (
    <div className={cls}>
      <span className="rail-pill" />
      <button
        className="rail-button"
        style={color ? ({ '--server-color': color } as React.CSSProperties) : undefined}
        onClick={onClick}
        aria-label={label}
        aria-current={active ? 'page' : undefined}
      >
        {children}
      </button>
      <span className="rail-tooltip">{label}</span>
    </div>
  );
}
