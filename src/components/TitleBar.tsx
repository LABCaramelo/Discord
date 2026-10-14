import { Close, Help, Inbox, Maximize, Minimize } from '../icons';

/**
 * O app desktop cria a janela com `frame: false` (core.asar, bundle.js) e
 * desenha a própria barra de título; esta é a versão web dela.
 */
export function TitleBar({ title }: { title: string }) {
  return (
    <header className="titlebar">
      <div className="titlebar-title">{title}</div>
      <div className="titlebar-actions">
        <button className="titlebar-icon" title="Caixa de entrada" aria-label="Caixa de entrada">
          <Inbox size={18} />
        </button>
        <button className="titlebar-icon" title="Ajuda" aria-label="Ajuda">
          <Help size={18} />
        </button>
        <div className="window-controls">
          <button aria-label="Minimizar">
            <Minimize size={10} />
          </button>
          <button aria-label="Maximizar">
            <Maximize size={10} />
          </button>
          <button className="close" aria-label="Fechar">
            <Close size={14} />
          </button>
        </div>
      </div>
    </header>
  );
}
