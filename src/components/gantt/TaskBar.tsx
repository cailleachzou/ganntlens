import { useRef, useCallback } from 'react';
import type { Task } from '../../types';
import { rangeToPercent } from '../../lib/gantt/dateUtils';
import { useUIStore } from '../../store/uiStore';
import { useDragController } from '../../lib/gantt/useDragController';
import { useProjectStore } from '../../store/projectStore';
import { parseDate, formatDate } from '../../lib/gantt/dateUtils';

interface Props {
  task: Task;
  projectId: string;
  rangeStart: string;
  rangeEnd: string;
  /** hover/click 回调 */
  onHover?: (taskId: string | null) => void;
  onClick?: (taskId: string) => void;
  isHovered?: boolean;
  isSelected?: boolean;
  /** 甘特区容器 ref（用于 useDragController） */
  containerRef: React.RefObject<HTMLDivElement>;
}

/**
 * 任务条 - 双轨（计划 + 实际）
 * - 计划：上半部分细灰条
 * - 实际：下半部分粗黑条（按 progress 加橙色）
 * - 拖动：整条 move handle + 左右各 6px resize handle
 */
export function TaskBar({ task, projectId, rangeStart, rangeEnd, onHover, onClick, isHovered, isSelected, containerRef }: Props) {
  const moveHandleRef = useRef<HTMLDivElement>(null);
  const resizeStartRef = useRef<HTMLDivElement>(null);
  const resizeEndRef = useRef<HTMLDivElement>(null);
  const hoverEnterTime = useRef<number>(0);
  const planPos = rangeToPercent(task.planStart, task.planEnd, rangeStart, rangeEnd);
  // 实际：actualStart/actualEnd 决定位置，progress 决定填充
  const actualStart = task.actualStart ?? task.planStart;
  const actualEnd = task.actualEnd ?? (task.actualStart ? rangeEnd : task.planStart);
  const actualPct = Math.max(0, Math.min(100, task.progress));

  // 高亮
  const isActive = !task.actualEnd && task.actualStart && task.progress > 0 && task.progress < 100;
  const isDelayed = task.actualEnd && task.planEnd && task.actualEnd > task.planEnd;

  // 拖动状态（用于 outline + opacity）
  const dragState = useUIStore((s) => s.dragState);
  const isDraggingThis = dragState?.id === task.id && (dragState?.type === 'task-move' || dragState?.type === 'task-resize-start' || dragState?.type === 'task-resize-end');

  // 找 phase（用于 computePreview 边界检测）— 用 selector 只在该 phase 变化时重渲染
  const phase = useProjectStore((s) => {
    const p = s.projects.find((p) => p.id === projectId);
    return p?.phases.find((ph) => ph.id === task.phaseId);
  });

  // computePreview 回调（useCallback 保证引用稳定，配合 hook 的 callback ref 模式）
  const computePreviewForMove = useCallback(
    (daysDelta: number) => {
      if (!phase) return { previewStart: task.planStart, previewEnd: task.planEnd, outOfBounds: false };
      const newStart = formatDate(new Date(parseDate(task.planStart).getTime() + daysDelta * 86400000));
      const newEnd = formatDate(new Date(parseDate(task.planEnd).getTime() + daysDelta * 86400000));
      const outOfBounds = newStart < phase.planStart || newEnd > phase.planEnd;
      return { previewStart: newStart, previewEnd: newEnd, outOfBounds };
    },
    [phase, task.planStart, task.planEnd]
  );

  const computePreviewForResizeEnd = useCallback(
    (daysDelta: number) => {
      if (!phase) return { previewStart: task.planStart, previewEnd: task.planEnd, outOfBounds: false };
      const newEnd = formatDate(new Date(parseDate(task.planEnd).getTime() + daysDelta * 86400000));
      const outOfBounds = newEnd > phase.planEnd || newEnd <= task.planStart;
      return { previewStart: task.planStart, previewEnd: newEnd, outOfBounds };
    },
    [phase, task.planStart, task.planEnd]
  );

  const computePreviewForResizeStart = useCallback(
    (daysDelta: number) => {
      if (!phase) return { previewStart: task.planStart, previewEnd: task.planEnd, outOfBounds: false };
      const newStart = formatDate(new Date(parseDate(task.planStart).getTime() + daysDelta * 86400000));
      const outOfBounds = newStart < phase.planStart || newStart >= task.planEnd;
      return { previewStart: newStart, previewEnd: task.planEnd, outOfBounds };
    },
    [phase, task.planStart, task.planEnd]
  );

  const startDrag = useUIStore((s) => s.startDrag);
  const endDrag = useUIStore((s) => s.endDrag);
  const moveTask = useProjectStore((s) => s.moveTask);
  const resizeTask = useProjectStore((s) => s.resizeTask);

  const onDragForMove = useCallback(
    (p: { previewStart: string; previewEnd: string; daysDelta: number; outOfBounds: boolean; clientX: number; clientY: number }) => {
      startDrag({
        type: 'task-move',
        projectId,
        id: task.id,
        previewStart: p.previewStart,
        previewEnd: p.previewEnd,
        daysDelta: p.daysDelta,
        outOfBounds: p.outOfBounds,
        clientX: p.clientX,
        clientY: p.clientY
      });
    },
    [startDrag, projectId, task.id]
  );

  const onCommitForMove = useCallback(
    (f: { previewStart: string; previewEnd: string; daysDelta: number; outOfBounds: boolean }) => {
      if (!f.outOfBounds && f.daysDelta !== 0) {
        moveTask(projectId, task.id, f.previewStart);
      }
      endDrag();
    },
    [moveTask, endDrag, projectId, task.id]
  );

  const onDragForResizeEnd = useCallback(
    (p: { previewStart: string; previewEnd: string; daysDelta: number; outOfBounds: boolean; clientX: number; clientY: number }) => {
      startDrag({
        type: 'task-resize-end',
        projectId,
        id: task.id,
        previewStart: p.previewStart,
        previewEnd: p.previewEnd,
        daysDelta: p.daysDelta,
        outOfBounds: p.outOfBounds,
        clientX: p.clientX,
        clientY: p.clientY
      });
    },
    [startDrag, projectId, task.id]
  );

  const onCommitForResizeEnd = useCallback(
    (f: { previewStart: string; previewEnd: string; daysDelta: number; outOfBounds: boolean }) => {
      if (!f.outOfBounds && f.daysDelta !== 0) {
        resizeTask(projectId, task.id, f.previewEnd, 'end');
      }
      endDrag();
    },
    [resizeTask, endDrag, projectId, task.id]
  );

  const onDragForResizeStart = useCallback(
    (p: { previewStart: string; previewEnd: string; daysDelta: number; outOfBounds: boolean; clientX: number; clientY: number }) => {
      startDrag({
        type: 'task-resize-start',
        projectId,
        id: task.id,
        previewStart: p.previewStart,
        previewEnd: p.previewEnd,
        daysDelta: p.daysDelta,
        outOfBounds: p.outOfBounds,
        clientX: p.clientX,
        clientY: p.clientY
      });
    },
    [startDrag, projectId, task.id]
  );

  const onCommitForResizeStart = useCallback(
    (f: { previewStart: string; previewEnd: string; daysDelta: number; outOfBounds: boolean }) => {
      if (!f.outOfBounds && f.daysDelta !== 0) {
        resizeTask(projectId, task.id, f.previewStart, 'start');
      }
      endDrag();
    },
    [resizeTask, endDrag, projectId, task.id]
  );

  // 三个 useDragController 实例
  useDragController({
    containerRef,
    handleRef: moveHandleRef,
    rangeStart,
    rangeEnd,
    enabled: true,
    computePreview: computePreviewForMove,
    onDrag: onDragForMove,
    onCommit: onCommitForMove
  });

  useDragController({
    containerRef,
    handleRef: resizeEndRef,
    rangeStart,
    rangeEnd,
    enabled: true,
    computePreview: computePreviewForResizeEnd,
    onDrag: onDragForResizeEnd,
    onCommit: onCommitForResizeEnd
  });

  useDragController({
    containerRef,
    handleRef: resizeStartRef,
    rangeStart,
    rangeEnd,
    enabled: true,
    computePreview: computePreviewForResizeStart,
    onDrag: onDragForResizeStart,
    onCommit: onCommitForResizeStart
  });

  return (
    <div
      onMouseEnter={() => {
        hoverEnterTime.current = Date.now();
        onHover?.(task.id);
      }}
      onMouseLeave={() => onHover?.(null)}
      onClick={(e) => {
        e.stopPropagation();
        if (Date.now() - hoverEnterTime.current < 150) return;
        onClick?.(task.id);
      }}
      style={{
        position: 'absolute',
        left: `${planPos.left}%`,
        width: `${planPos.width}%`,
        top: 0,
        height: '100%',
        zIndex: 2
      }}
      title={`${task.name} · ${task.planStart} → ${task.planEnd} · ${task.progress}%`}
    >
      {/* 计划虚线 */}
      <div
        style={{
          position: 'absolute',
          top: 8,
          left: 0,
          right: 0,
          height: 0,
          borderTop: '1.5px dashed var(--plan)',
          opacity: 0.5
        }}
      />
      {/* 实际条 */}
      <div
        style={{
          position: 'absolute',
          top: 16,
          left: 0,
          width: `${actualPct}%`,
          height: 5,
          background: isDelayed ? 'var(--today)' : isActive ? 'var(--accent)' : 'var(--actual)',
          borderRadius: 1,
          boxShadow:
            isHovered || isSelected
              ? '0 0 0 2px var(--accent)'
              : isActive
                ? '0 0 0 1px var(--accent)'
                : 'none',
          transition: 'box-shadow 120ms',
          opacity: isDraggingThis ? 0.85 : 1,
          outline: isDraggingThis ? `2px solid ${dragState?.outOfBounds ? 'var(--today)' : 'var(--accent)'}` : 'none',
          outlineOffset: 2
        }}
      />
      {/* 进度文字 */}
      {isActive && planPos.width > 6 && (
        <div
          style={{
            position: 'absolute',
            top: 24,
            left: 0,
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 9,
            color: 'var(--mute)',
            fontWeight: 600,
            background: 'rgba(255,255,255,0.85)',
            padding: '0 2px',
            whiteSpace: 'nowrap'
          }}
        >
          {actualPct}%
        </div>
      )}
      {/* 任务名文字叠加 */}
      {planPos.width > 8 && (
        <div
          style={{
            position: 'absolute',
            top: 2,
            left: 4,
            fontFamily: 'Inter, sans-serif',
            fontSize: 10,
            fontWeight: 600,
            color: 'var(--ink)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            pointerEvents: 'none',
            zIndex: 3,
            opacity: isHovered || isSelected ? 1 : 0.7
          }}
        >
          {task.name}
        </div>
      )}
      {/* 拖动 handle - 整条（move） */}
      <div
        ref={moveHandleRef}
        style={{
          position: 'absolute',
          inset: 0,
          cursor: 'grab',
          zIndex: 4
        }}
        onClick={(e) => e.stopPropagation()}
        data-testid={`task-move-${task.id}`}
      />
      {/* 拖动 handle - 左边 resize */}
      <div
        ref={resizeStartRef}
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 6,
          cursor: 'ew-resize',
          zIndex: 5
        }}
        onClick={(e) => e.stopPropagation()}
        data-testid={`task-resize-start-${task.id}`}
      />
      {/* 拖动 handle - 右边 resize */}
      <div
        ref={resizeEndRef}
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          bottom: 0,
          width: 6,
          cursor: 'ew-resize',
          zIndex: 5
        }}
        onClick={(e) => e.stopPropagation()}
        data-testid={`task-resize-end-${task.id}`}
      />
    </div>
  );
}
