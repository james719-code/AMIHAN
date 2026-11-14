import { useEffect, useId, useState, type ReactNode } from 'react';
import { PanelActions } from './PanelActions';

export function WorkspacePanel({ id, open, title, onClose, children, keepMounted = false }: {
  id: string;
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  keepMounted?: boolean;
}) {
  const titleId = useId();
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  return (
    <aside id={id} className={`workspace-panel${expanded ? ' is-expanded' : ''}`} hidden={!open} aria-labelledby={titleId}>
      <div className="panel-heading">
        <span id={titleId}>{title}</span>
        <PanelActions title={title.toLowerCase()} expanded={expanded} onToggle={() => setExpanded((value) => !value)} onClose={onClose} />
      </div>
      <div className="panel-content" tabIndex={0} role="region" aria-label={`${title} content`}>
        {(open || keepMounted) && children}
      </div>
    </aside>
  );
}
