export type WorkspaceView = 'planner' | 'map' | 'readings' | 'overview';

export function WorkspaceMenu({ active, links }: {
  active: WorkspaceView;
  links: readonly { view: WorkspaceView; label: string; href: string }[];
}) {
  return (
    <nav className="app-nav" aria-label="Main navigation">
      {links.map(({ view, label, href }) => (
        <a key={view} href={href} aria-current={active === view ? 'page' : undefined} data-app-link>
          {label}
        </a>
      ))}
    </nav>
  );
}
