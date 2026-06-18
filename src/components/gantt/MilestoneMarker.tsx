import { useRef, useCallback } from 'react';
import type { Milestone } from '../../types';
import { dateToPercent, parseDate, formatDate } from '../../lib/gantt/dateUtils';
import { useUIStore } from '../../store/uiStore';
import { useProjectStore } from '../../store/projectStore';
import { useDragController } from '../../lib/gantt/useDragController';

interface Props {
  milestone: Milestone;
  rangeStart: string;
  rangeEnd: string;
  projectStart: string;
  projectEnd: string;
  containerRef: React.RefObject<HTMLDivElement>;
}

/** 里程碑菱形 ◆ - 黑边橙底（reached=绿底），可拖动改 date */
export function MilestoneMarker({ milestone, rangeStart, rangeEnd, projectStart, projectEnd, containerRef }: Props) {
  const handleRef = useRef<HTMLDivElement>(null);
  const left = dateToPercent(milestone.date, rangeStart, rangeEnd);
  const reached = milestone.status === 'reached';

  const project = useProjectStore.getState().projects.find((p) => p.milestones.some((m) => m.id === milestone.id));
  const projectId = project?.id ?? '';
  const startDrag = useUIStore((s) => s.startDrag);
  const endDrag = useUIStore((s) => s.endDrag);
  const moveMilestone = useProjectStore((s) => s.moveMilestone);
  const dragState = useUIStore((s) => s.dragState);
  const isDraggingThis = dragState?.id === milestone.id && dragState?.type === 'milestone';

  // computePreview 边界检测：milestone 必须在 project.start..project.end 范围内
  const computePreview = useCallback(
    (daysDelta: number) => {
      const newDate = formatDate(new Date(parseDate(milestone.date).getTime() + daysDelta * 86400000));
      const outOfBounds = newDate < projectStart || newDate > projectEnd;
      return { previewStart: newDate, previewEnd: newDate, outOfBounds };
    },
    [milestone.date, projectStart, projectEnd]
  );

  const onDrag = useCallback(
    (p: { previewStart: string; previewEnd: string; daysDelta: number; outOfBounds: boolean; clientX: number; clientY: number }) => {
      startDrag({
        type: 'milestone',
        projectId,
        id: milestone.id,
        previewStart: p.previewStart,
        previewEnd: p.previewEnd,
        daysDelta: p.daysDelta,
        outOfBounds: p.outOfBounds,
        clientX: p.clientX,
        clientY: p.clientY
      });
    },
    [startDrag, projectId, milestone.id]
  );

  const onCommit = useCallback(
    (f: { previewStart: string; previewEnd: string; daysDelta: number; outOfBounds: boolean }) => {
      if (!f.outOfBounds && f.daysDelta !== 0) {
        moveMilestone(projectId, milestone.id, f.previewStart);
      }
      endDrag();
    },
    [moveMilestone, endDrag, projectId, milestone.id]
  );

  useDragController({
    containerRef,
    handleRef,
    rangeStart,
    rangeEnd,
    enabled: !!project,
    computePreview,
    onDrag,
    onCommit
  });

  return (
    <div
      style={{
        position: 'absolute',
        top: 14,
        left: `${left}%`,
        transform: 'translateX(-50%)',
        zIndex: 3
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
      {/* 菱形 + 拖动 handle */}
      <div
        ref={handleRef}
        style={{
          width: 10,
          height: 10,
          background: reached ? '#10b981' : 'var(--accent)',
          border: '1.5px solid var(--ink)',
          transform: 'rotate(45deg)',
          cursor: 'grab',
          opacity: isDraggingThis ? 0.85 : 1,
          outline: isDraggingThis ? `2px solid ${dragState?.outOfBounds ? 'var(--today)' : 'var(--accent)'}` : 'none',
          outlineOffset: 2
        }}
        data-testid={`milestone-${milestone.id}`}
      />
    </div>
  );
}
