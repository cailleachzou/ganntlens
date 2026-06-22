import { useRef } from 'react';
import type { Project } from '../../types';
import { TimelineHeader } from './TimelineHeader';
import { PhaseRibbon } from './PhaseRibbon';
import { TaskBar } from './TaskBar';
import { MilestoneMarker } from './MilestoneMarker';
import { TodayLine } from './TodayLine';
import { DragPreview } from './DragPreview';

interface Props {
  projects: Project[];
  rangeStart: string;
  rangeEnd: string;
  today: string;
  view?: 'week' | 'month';
  onTaskClick?: (projectId: string, taskId: string) => void;
  onTaskHover?: (projectId: string, taskId: string | null) => void;
  selectedTaskId?: string | null;
  hoveredTaskId?: string | null;
  hoveredProjectId?: string | null;
}

/**
 * 大甘特图容器
 * 共享时间轴 + 多项目行（每行 = 1 个项目）
 */
export function GanttChart({
  projects,
  rangeStart,
  rangeEnd,
  today,
  view = 'week',
  onTaskClick,
  onTaskHover,
  selectedTaskId,
  hoveredTaskId,
  hoveredProjectId
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  return (
    <div
      style={{
        background: 'var(--paper)',
        border: '1px solid var(--line)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative'
      }}
    >
      {/* TimelineHeader 和标签列对齐 */}
      <div style={{ display: 'flex' }}>
        <div
          style={{
            width: 90,
            flexShrink: 0,
            borderRight: '1px solid var(--line)',
            background: 'var(--paper-2)'
          }}
        />
        <div style={{ flex: 1 }}>
          <TimelineHeader rangeStart={rangeStart} rangeEnd={rangeEnd} view={view} />
        </div>
      </div>
      {/* 行区域：标签列 + 甘特区 */}
      <div style={{ display: 'flex' }}>
        {/* 标签列 */}
        <div
          style={{
            width: 90,
            flexShrink: 0,
            borderRight: '1px solid var(--line)',
            background: 'var(--paper-2)'
          }}
        >
          {projects.map((p, idx) => (
            <div
              key={p.id}
              style={{
                height: 60,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderBottom: idx === projects.length - 1 ? 'none' : '1px solid var(--line)',
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--accent)',
                letterSpacing: '0.05em'
              }}
            >
              {p.code}
            </div>
          ))}
        </div>
        {/* 甘特区 */}
        <div ref={containerRef} style={{ flex: 1, position: 'relative' }}>
          {projects.map((p, idx) => (
            <ProjectRow
              key={p.id}
              project={p}
              rangeStart={rangeStart}
              rangeEnd={rangeEnd}
              today={today}
              isLast={idx === projects.length - 1}
              onTaskClick={onTaskClick}
              onTaskHover={onTaskHover}
              selectedTaskId={selectedTaskId}
              hoveredTaskId={hoveredTaskId}
              hoveredProjectId={hoveredProjectId}
              containerRef={containerRef}
            />
          ))}
          {/* 共享今天线 - 单实例，跨所有项目行 */}
          <TodayLine today={today} rangeStart={rangeStart} rangeEnd={rangeEnd} />
        </div>
      </div>
      <DragPreview />
    </div>
  );
}

interface RowProps {
  project: Project;
  rangeStart: string;
  rangeEnd: string;
  today: string;
  isLast: boolean;
  onTaskClick?: (projectId: string, taskId: string) => void;
  onTaskHover?: (projectId: string, taskId: string | null) => void;
  selectedTaskId?: string | null;
  hoveredTaskId?: string | null;
  hoveredProjectId?: string | null;
  containerRef: React.RefObject<HTMLDivElement>;
}

function ProjectRow({
  project,
  rangeStart,
  rangeEnd,
  today,
  isLast,
  onTaskClick,
  onTaskHover,
  selectedTaskId,
  hoveredTaskId,
  hoveredProjectId,
  containerRef
}: RowProps) {
  // 找出当前正在进行的任务（6/16 时）
  const activeTask = project.tasks.find(
    (t) => t.actualStart && !t.actualEnd && t.progress > 0 && t.progress < 100
  );

  return (
    <div
      style={{
        borderBottom: isLast ? 'none' : '1px solid var(--line)',
        minHeight: 60,
        position: 'relative',
        height: 60
      }}
    >
      <PhaseRibbon
        phases={project.phases}
        rangeStart={rangeStart}
        rangeEnd={rangeEnd}
      />
      {project.tasks.map((t) => (
        <TaskBar
          key={t.id}
          task={t}
          projectId={project.id}
          rangeStart={rangeStart}
          rangeEnd={rangeEnd}
          onHover={(taskId) => onTaskHover?.(project.id, taskId)}
          onClick={(taskId) => onTaskClick?.(project.id, taskId)}
          isHovered={hoveredProjectId === project.id && hoveredTaskId === t.id}
          isSelected={selectedTaskId === t.id}
          containerRef={containerRef}
        />
      ))}
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
  );
}
