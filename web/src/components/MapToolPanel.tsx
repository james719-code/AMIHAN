import { useState, type ReactNode } from 'react';
import { PanelActions } from './PanelActions';

export function MapToolPanel({ id, title, visible, onMinimize, onClose, children }: {
  id: string;
  title: string;
  visible: boolean;
  onMinimize: () => void;
  onClose: () => void;
  children: ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <aside id={id} className={`map-tool-popup map-sheet${expanded ? ' is-expanded' : ''}`} hidden={!visible} aria-labelledby={`${id}-title`}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          onMinimize();
        }
      }}>
      <div className="tool-popup-heading">
        <strong id={`${id}-title`}>{title}</strong>
        <PanelActions title={title} expanded={expanded} onToggle={() => setExpanded((value) => !value)} onMinimize={onMinimize} onClose={onClose} />
      </div>
      <div id={`${id}-body`} className="map-tool-body" tabIndex={0} role="region" aria-label={`${title} content`}>
        {visible && children}
      </div>
    </aside>
  );
}
