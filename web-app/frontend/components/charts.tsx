import type { StandingCounts } from '../lib/api';
import { standingLabels } from '../lib/labels';
import { StandingBadge } from './standing';

export interface MeterRow { key: string; label: string; value: number | null; max: number; display: string; hint?: string }

/** One hue, one bar per named row, figure beside it; null values read "No data". */
export function MeterList({ rows, label }: { rows: MeterRow[]; label: string }) {
  return (
    <ul className="meter-list" aria-label={label}>
      {rows.map(row => (
        <li key={row.key} title={row.hint ?? `${row.label}: ${row.display}`}>
          <span className="meter-label">{row.label}</span>
          <span className="meter-track" aria-hidden="true">
            {row.value !== null && <span className="meter-fill" style={{ width: `${Math.max(0, Math.min(100, (row.value / Math.max(row.max, 1e-9)) * 100))}%` }} />}
          </span>
          <span className="meter-figure">{row.value === null ? 'No data' : row.display}</span>
        </li>
      ))}
    </ul>
  );
}

const SEGMENTS = [['RED', 'critical'], ['YELLOW', 'warning'], ['GREEN', 'good'], ['UNDETERMINED', 'none']] as const;

/** A whole split into standing levels: status fills with 2px gaps, share printed where it fits, legend with icon and label. */
export function StandingSplit({ counts, compact = false }: { counts: StandingCounts; compact?: boolean }) {
  const total = SEGMENTS.reduce((sum, [key]) => sum + counts[key], 0);
  if (total === 0) return <p className="muted">No students</p>;
  const parts = SEGMENTS.filter(([key]) => counts[key] > 0);
  return (
    <div className={compact ? 'split compact' : 'split'}>
      <div className="split-bar" role="img" aria-label={parts.map(([key]) => `${counts[key]} ${key === 'UNDETERMINED' ? 'not determined' : standingLabels[key].toLowerCase()}`).join(', ')}>
        {parts.map(([key, tone]) => {
          const share = (counts[key] / total) * 100;
          return (
            <span key={key} className={`split-part ${tone}`} style={{ flexGrow: counts[key] }} title={`${key === 'UNDETERMINED' ? 'Not determined' : standingLabels[key]}: ${counts[key]} (${Math.round(share)}%)`}>
              {!compact && share >= 12 && <span className="split-share">{Math.round(share)}%</span>}
            </span>
          );
        })}
      </div>
      {!compact && (
        <ul className="split-legend">
          {SEGMENTS.map(([key]) => (
            <li key={key}>
              {key === 'UNDETERMINED' ? <span className="standing none">Not determined</span> : <StandingBadge level={key} />}
              <span className="figure">{counts[key]}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Ordered categories as columns in one hue, value on each cap. */
export function ColumnChart({ data, label }: { data: Array<{ key: string; value: number }>; label: string }) {
  const max = Math.max(1, ...data.map(item => item.value));
  return (
    <div className="columns" role="img" aria-label={`${label}: ${data.map(item => `${item.key} ${item.value}`).join(', ')}`}>
      {data.map(item => (
        <div key={item.key} className="column" title={`${item.key}: ${item.value}`}>
          <span className="column-value">{item.value}</span>
          <span className="column-bar" style={{ height: `${(item.value / max) * 100}%` }} />
          <span className="column-key">{item.key}</span>
        </div>
      ))}
    </div>
  );
}
