import type { Project } from '../../types';
import { TimelineHeader } from './TimelineHeader';
import { PhaseRibbon } from './PhaseRibbon';
import { TaskBar } from './TaskBar';
import { MilestoneMarker } from './MilestoneMarker';
import { TodayLine } from './TodayLine';

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
  hoveredTaskId
}: Props) {
  return (
    <div
      style={{
        background: 'var(--paper)',
        border: '1px solid var(--line)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}
    >
      <TimelineHeader rangeStart={rangeStart} rangeEnd={rangeEnd} view={view} />
      <div style={{ position: 'relative' }}>
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
          />
        ))}
      </div>
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
  hoveredTaskId
}: RowProps) {
  // 找出当前正在进行的任务（6/16 时）
  const activeTask = project.tasks.find(
    (t) => t.actualStart && !t.actualEnd && t.progress > 0 && t.progress < 100
  );

  return (
    <div
      style={{
        display: 'flex',
        borderBottom: isLast ? 'none' : '1px solid var(--line)',
        minHeight: 60,
        position: 'relative'
      }}
    >
      {/* 左侧项目名 */}
      <div
        style={{
          width: 160,
          padding: '8px 14px',
          borderRight: '1px solid var(--line)',
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          background: 'var(--paper)'
        }}
      >
        <div
          style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 10,
            fontWeight: 700,
            color: 'var(--mute)',
            letterSpacing: '0.05em'
          }}
        >
          {project.code}
        </div>
        <div
          style={{
            fontFamily: 'Inter Tight, sans-serif',
            fontWeight: 600,
            fontSize: 12,
            color: 'var(--ink)',
            marginTop: 2
          }}
        >
          {project.name}
        </div>
        {activeTask && (
          <div
            style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 9,
              color: 'var(--accent-2)',
              marginTop: 4,
              fontWeight: 600
            }}
          >
            ▸ {activeTask.name} {activeTask.progress}%
          </div>
        )}
      </div>
      {/* 甘特区 */}
      <div
        style={{
          flex: 1,
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
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
            onHover={(taskId) => onTaskHover?.(project.id, taskId)}
            onClick={(taskId) => onTaskClick?.(project.id, taskId)}
            isHovered={hoveredTaskId === t.id}
            isSelected={selectedTaskId === t.id}
          />
        ))}
        {project.milestones.map((m) => (
          <MilestoneMarker
            key={m.id}
            milestone={m}
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
          />
        ))}
        <TodayLine today={today} rangeStart={rangeStart} rangeEnd={rangeEnd} />
      </div>
    </div>
  );
}
