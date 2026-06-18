import { dateToPercent } from '../../lib/gantt/dateUtils';

interface Props {
  today: string; // YYYY-MM-DD
  rangeStart: string;
  rangeEnd: string;
}

/** 今天线 - 红色 1.5px 竖线 + 顶部标签 */
export function TodayLine({ today, rangeStart, rangeEnd }: Props) {
  const left = dateToPercent(today, rangeStart, rangeEnd);
  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: `${left}%`,
        width: 1.5,
        background: 'var(--today)',
        zIndex: 4,
        pointerEvents: 'none'
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: -14,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'var(--today)',
          color: '#fff',
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 9,
          fontWeight: 700,
          padding: '1px 4px',
          whiteSpace: 'nowrap',
          letterSpacing: '0.05em'
        }}
      >
        TODAY · {today.slice(5).replace('-', '/')}
      </div>
    </div>
  );
}
