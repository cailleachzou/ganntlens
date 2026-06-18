import { useRef } from 'react';
import type { Task } from '../../types';
import { rangeToPercent } from '../../lib/gantt/dateUtils';

interface Props {
  task: Task;
  rangeStart: string;
  rangeEnd: string;
  /** hover/click 回调 */
  onHover?: (taskId: string | null) => void;
  onClick?: (taskId: string) => void;
  isHovered?: boolean;
  isSelected?: boolean;
}

/**
 * 任务条 - 双轨（计划 + 实际）
 * 计划：上半部分细灰条
 * 实际：下半部分粗黑条（按 progress 加橙色）
 */
export function TaskBar({ task, rangeStart, rangeEnd, onHover, onClick, isHovered, isSelected }: Props) {
  const hoverEnterTime = useRef<number>(0);
  const planPos = rangeToPercent(task.planStart, task.planEnd, rangeStart, rangeEnd);
  // 实际：actualStart/actualEnd 决定位置，progress 决定填充
  const actualStart = task.actualStart ?? task.planStart;
  const actualEnd = task.actualEnd ?? (task.actualStart ? rangeEnd : task.planStart);
  const actualPos = rangeToPercent(actualStart, actualEnd, rangeStart, rangeEnd);
  const actualPct = Math.max(0, Math.min(100, task.progress));

  // 高亮：进行中（active）
  const isActive =
    !task.actualEnd && task.actualStart && task.progress > 0 && task.progress < 100;
  // 延期：实际结束超过计划结束
  const isDelayed =
    task.actualEnd && task.planEnd && task.actualEnd > task.planEnd;

  return (
    <div
      onMouseEnter={(e) => {
        hoverEnterTime.current = Date.now();
        onHover?.(task.id);
      }}
      onMouseLeave={() => onHover?.(null)}
      onClick={(e) => {
        e.stopPropagation();
        // 防误触：hover 后 150ms 内点击视为 hover 误触
        if (Date.now() - hoverEnterTime.current < 150) return;
        onClick?.(task.id);
      }}
      style={{
        position: 'absolute',
        left: `${planPos.left}%`,
        width: `${planPos.width}%`,
        top: 0,
        height: '100%',
        cursor: 'pointer',
        zIndex: 2
      }}
      title={`${task.name} · ${task.planStart} → ${task.planEnd} · ${task.progress}%`}
    >
      {/* 计划虚线（细） */}
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
      {/* 实际条（粗） */}
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
          transition: 'box-shadow 120ms'
        }}
      />
      {/* 实际条进度文字（仅当 active 时显示） */}
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
    </div>
  );
}
