import { useRef } from 'react';
import type { Project } from '../../types';
import { TimelineHeader } from './TimelineHeader';
import { PhaseRibbon } from './PhaseRibbon';
import { TaskBar } from './TaskBar';
import { MilestoneMarker } from './MilestoneMarker';
import { TodayLine } from './TodayLine';
import { DragPreview } from './DragPreview';

interface Props {
  project: Project;
  rangeStart: string;
  rangeEnd: string;
  today: string;
  view?: 'week' | 'month';
  onTaskClick?: (taskId: string) => void;
  onTaskHover?: (taskId: string | null) => void;
  selectedTaskId?: string | null;
  hoveredTaskId?: string | null;
}

/**
 * 单项目详情页甘特
 * - 行 1：阶段色带
 * - 行 2：里程碑
 * - 行 3+：每个任务一行
 * 共享时间轴 + 今天线
 */
export function ProjectGantt({
  project,
  rangeStart,
  rangeEnd,
  today,
  view = 'week',
  onTaskClick,
  onTaskHover,
  selectedTaskId,
  hoveredTaskId
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={containerRef}
      style={{
        background: 'var(--paper)',
        border: '1px solid var(--line)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative'
      }}
    >
      <TimelineHeader rangeStart={rangeStart} rangeEnd={rangeEnd} view={view} />

      {/* 阶段行 */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--line)' }}>
        <div
          style={{
            width: 130,
            padding: '0 14px',
            borderRight: '1px solid var(--line)',
            display: 'flex',
            alignItems: 'center',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 9,
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            color: 'var(--mute)',
            fontWeight: 700,
            background: 'var(--bg-2)',
            height: 28
          }}
        >
          阶段
        </div>
        <div style={{ flex: 1, position: 'relative' }}>
          <PhaseRibbon phases={project.phases} rangeStart={rangeStart} rangeEnd={rangeEnd} height={28} />
        </div>
      </div>

      {/* 里程碑行 */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--line)' }}>
        <div
          style={{
            width: 130,
            padding: '0 14px',
            borderRight: '1px solid var(--line)',
            display: 'flex',
            alignItems: 'center',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 9,
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            color: 'var(--mute)',
            fontWeight: 700,
            background: 'var(--bg-2)',
            height: 36
          }}
        >
          里程碑
        </div>
        <div style={{ flex: 1, position: 'relative', height: 36 }}>
          {project.milestones.map((m) => (
            <MilestoneMarker
              key={m.id}
              milestone={m}
              projectId={project.id}
              rangeStart={rangeStart}
              rangeEnd={rangeEnd}
              projectStart={project.start}
              projectEnd={project.end}
              containerRef={containerRef}
            />
          ))}
        </div>
      </div>

      {/* 任务行 */}
      {project.tasks.map((t) => {
        const isSel = selectedTaskId === t.id;
        const isHov = hoveredTaskId === t.id;
        return (
          <div
            key={t.id}
            onMouseEnter={() => onTaskHover?.(t.id)}
            onMouseLeave={() => onTaskHover?.(null)}
            onClick={() => onTaskClick?.(t.id)}
            style={{
              display: 'flex',
              borderBottom: '1px solid var(--line)',
              background: isSel ? 'var(--accent-bg)' : isHov ? '#fef9c3' : 'var(--paper)',
              boxShadow: isSel ? 'inset 3px 0 0 var(--accent)' : 'none',
              minHeight: 32,
              cursor: 'pointer'
            }}
          >
            <div
              style={{
                width: 130,
                padding: '6px 14px',
                borderRight: '1px solid var(--line)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center'
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: isSel ? 600 : 500,
                  color: 'var(--ink)'
                }}
              >
                {t.name}
              </div>
              <div
                style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 9,
                  color: 'var(--mute)',
                  marginTop: 1
                }}
              >
                {t.owner ?? '—'} · {t.progress}%
              </div>
            </div>
            <div style={{ flex: 1, position: 'relative', height: 32 }}>
              <TaskBar
                task={t}
                projectId={project.id}
                rangeStart={rangeStart}
                rangeEnd={rangeEnd}
                onHover={onTaskHover}
                onClick={onTaskClick}
                isHovered={isHov}
                isSelected={isSel}
                containerRef={containerRef}
              />
            </div>
          </div>
        );
      })}

      {/* 共享今天线 */}
      <TodayLine today={today} rangeStart={rangeStart} rangeEnd={rangeEnd} />
      <DragPreview />
    </div>
  );
}
