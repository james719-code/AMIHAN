export type WorkspaceView = 'explore' | 'rotation' | 'climate';

const items: { view: WorkspaceView; label: string; icon: string }[] = [
  { view: 'explore', label: 'Explore', icon: 'M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3V6zm6-3v15m6-12v15' },
  { view: 'rotation', label: 'Planner', icon: 'M12 21v-9m0 3C5 15 3 11 3 6c6 0 9 3 9 9zm0-3c0-6 3-9 9-9 0 6-3 9-9 9z' },
  { view: 'climate', label: 'Readings', icon: 'M4 3v17h17M8 15l4-5 4 3 5-7' }
];

export function WorkspaceMenu({ active, onSelect }: {
  active: WorkspaceView | null;
  onSelect: (view: WorkspaceView) => void;
}) {
  return (
    <nav className="workspace-nav" aria-label="Workspace tools">
      {items.map(({ view, label, icon }) => (
        <button key={view} className="workspace-menu-button" type="button"
          aria-expanded={active === view}
          aria-controls={view === 'explore' ? 'place-sidebar' : `${view}-panel`}
          onClick={() => onSelect(view)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d={icon} />
          </svg>
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}
