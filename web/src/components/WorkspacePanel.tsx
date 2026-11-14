import { useEffect, useId, type ReactNode } from 'react';

export function WorkspacePanel({ id, open, title, onClose, children, keepMounted = false }: {
  id: string;
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  keepMounted?: boolean;
}) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  return (
    <aside id={id} className="workspace-panel" hidden={!open} aria-labelledby={titleId}>
      <div className="panel-heading">
        <span id={titleId}>{title}</span>
        <button className="quiet-button close-button" type="button" aria-label={`Close ${title.toLowerCase()}`} onClick={onClose}>&times;</button>
      </div>
      <div className="panel-content" tabIndex={0} role="region" aria-label={`${title} content`}>
        {(open || keepMounted) && children}
      </div>
    </aside>
  );
}
