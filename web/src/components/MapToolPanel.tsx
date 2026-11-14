import { useState, type ReactNode } from 'react';

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
    <aside id={id} className={`map-tool-popup${expanded ? ' is-expanded' : ''}`} hidden={!visible} aria-labelledby={`${id}-title`}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          onMinimize();
        }
      }}>
      <div className="tool-popup-heading">
        <strong id={`${id}-title`}>{title}</strong>
        <div className="tool-panel-actions">
          <button className="quiet-button tool-sheet-expand" type="button" aria-expanded={expanded}
            aria-controls={`${id}-body`} onClick={() => setExpanded(!expanded)}>{expanded ? 'Reduce' : 'Expand'}</button>
          <button className="quiet-button close-button" type="button" aria-label={`Minimize ${title}`} title="Minimize; keep the map layer active" onClick={onMinimize}>&minus;</button>
          <button className="quiet-button close-button" type="button" aria-label={`Close ${title}`} title="Close tool" onClick={onClose}>&times;</button>
        </div>
      </div>
      <div id={`${id}-body`} className="map-tool-body" tabIndex={0} role="region" aria-label={`${title} content`}>
        {visible && children}
      </div>
    </aside>
  );
}
