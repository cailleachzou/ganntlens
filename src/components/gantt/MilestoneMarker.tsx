import type { Milestone } from '../../types';
import { dateToPercent } from '../../lib/gantt/dateUtils';

interface Props {
  milestone: Milestone;
  rangeStart: string;
  rangeEnd: string;
}

/** 里程碑菱形 ◆ - 黑边橙底（reached=绿底） */
export function MilestoneMarker({ milestone, rangeStart, rangeEnd }: Props) {
  const left = dateToPercent(milestone.date, rangeStart, rangeEnd);
  const reached = milestone.status === 'reached';
  return (
    <div
      style={{
        position: 'absolute',
        top: 14,
        left: `${left}%`,
        transform: 'translateX(-50%)',
        zIndex: 3,
        pointerEvents: 'none'
      }}
      title={`${milestone.name} · ${milestone.date}`}
    >
      {/* 标签 */}
      <div
        style={{
          position: 'absolute',
          top: -16,
          left: '50%',
          transform: 'translateX(-50%)',
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 9,
          fontWeight: 700,
          color: 'var(--ink)',
          whiteSpace: 'nowrap',
          background: 'var(--paper)',
          padding: '0 3px'
        }}
      >
        {milestone.name.split(' ')[0]}
      </div>
      {/* 菱形 */}
      <div
        style={{
          width: 10,
          height: 10,
          background: reached ? '#10b981' : 'var(--accent)',
          border: '1.5px solid var(--ink)',
          transform: 'rotate(45deg)'
        }}
      />
    </div>
  );
}
