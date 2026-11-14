import { MapControlIcon } from './MapControlIcon';

export type WorkspaceView = 'explore' | 'rotation' | 'climate';

const items = [
  { view: 'rotation', label: 'Planner', icon: 'planner' },
  { view: 'climate', label: 'Readings', icon: 'readings' }
] as const;

export function WorkspaceMenu({ active, onSelect }: {
  active: WorkspaceView | null;
  onSelect: (view: WorkspaceView) => void;
}) {
  return (
    <nav className="workspace-nav" aria-label="Workspace tools">
      {items.map(({ view, label, icon }) => (
        <button key={view} className="workspace-menu-button" type="button"
          aria-expanded={active === view}
          aria-controls={`${view}-panel`}
          onClick={() => onSelect(view)}>
          <MapControlIcon name={icon} />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}
