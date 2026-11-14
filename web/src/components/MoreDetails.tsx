import type { ReactNode } from 'react';
import { MapControlIcon } from './MapControlIcon';

export function MoreDetails({ children, title = 'More details' }: { children: ReactNode; title?: string }) {
  return (
    <details className="more-details">
      <summary><MapControlIcon name="info" /><span>{title}</span><MapControlIcon name="chevron" /></summary>
      <div className="more-details-content">{children}</div>
    </details>
  );
}
