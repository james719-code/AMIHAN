export function PanelActions({ title, expanded, onToggle, onClose, onMinimize }: {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  onClose: () => void;
  onMinimize?: () => void;
}) {
  return (
    <div className="panel-actions">
      <button className="quiet-button panel-action-button panel-size-button" type="button"
        aria-label={`${expanded ? 'Restore' : 'Expand'} ${title}`}
        title={expanded ? 'Restore size' : 'Expand panel'}
        aria-pressed={expanded} onClick={onToggle}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d={expanded ? 'M4 9h5V4m11 5h-5V4M4 15h5v5m11-5h-5v5' : 'M9 4H4v5m11-5h5v5M4 15v5h5m11-5v5h-5'} />
        </svg>
      </button>
      {onMinimize && <button className="quiet-button panel-action-button" type="button" aria-label={`Minimize ${title}`} title="Minimize; keep the map layer active" onClick={onMinimize}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M5 12h14" />
        </svg>
      </button>}
      <button className="quiet-button panel-action-button" type="button" aria-label={`Close ${title}`} title="Close panel" onClick={onClose}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m6 6 12 12M6 18 18 6" />
        </svg>
      </button>
    </div>
  );
}
