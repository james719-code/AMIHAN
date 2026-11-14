import type { ComponentProps, ReactNode } from 'react';
import { MapControlIcon } from './MapControlIcon';

export function SummaryStat({ icon, label, value, note }: {
  icon: ComponentProps<typeof MapControlIcon>['name'];
  label: string;
  value: ReactNode;
  note?: string;
}) {
  return (
    <div className="summary-stat">
      <dt><MapControlIcon name={icon} /><span>{label}</span></dt>
      <dd>{value}{note && <span className="summary-stat-note">{note}</span>}</dd>
    </div>
  );
}
