import type { Phase } from '../../types';
import { rangeToPercent } from '../../lib/gantt/dateUtils';

interface Props {
  phases: Phase[];
  rangeStart: string;
  rangeEnd: string;
  height?: number;
}

/** 阶段色带 - 渲染在每行顶部 */
export function PhaseRibbon({ phases, rangeStart, rangeEnd, height = 8 }: Props) {
  return (
    <div
      style={{
        position: 'absolute',
        top: 6,
        left: 0,
        right: 0,
        height,
        display: 'flex',
        pointerEvents: 'none'
      }}
    >
      {phases.map((p) => {
        const { left, width } = rangeToPercent(p.planStart, p.planEnd, rangeStart, rangeEnd);
        return (
          <div
            key={p.id}
            style={{
              position: 'absolute',
              left: `${left}%`,
              width: `${width}%`,
              height: '100%',
              background: p.color
            }}
            title={`${p.name} · ${p.planStart} → ${p.planEnd}`}
          />
        );
      })}
    </div>
  );
}
