import type { Task, Project, Phase } from '../../types';
import { daysBetween, rangeDays, parseDate } from '../../lib/gantt/dateUtils';

interface Props {
  task: Task;
  project: Project;
  rangeStart: string;
  rangeEnd: string;
}

/**
 * Hover 预览卡 v8 — 浮在任务条上方，320px 紧凑卡
 * 4 关键数字 + 进度条 + AI 摘要 + 风险标 + 引导
 */
export function HoverPreviewCard({ task, project, rangeStart, rangeEnd }: Props) {
  const phase = project.phases.find((p) => p.id === task.phaseId);
  const phaseLabel = phase?.name.split(' · ')[0] ?? '';

  // 风险判断
  const today = '2026-06-16';
  const isActive = !task.actualEnd && task.actualStart && task.progress > 0 && task.progress < 100;
  const isDelayed = task.actualEnd && task.planEnd && task.actualEnd > task.planEnd;
  const isUpcoming =
    !task.actualStart && daysBetween(today, task.planStart) > 0 && daysBetween(today, task.planStart) <= 14;

  // 数字
  const duration = daysBetween(task.planStart, task.planEnd) + 1;
  // 子任务数（mock：固定 5）
  const subCount = 5;
  const subDone = task.progress === 100 ? 5 : task.progress === 0 ? 0 : Math.floor((task.progress / 100) * 5);
  // 文档数（mock：固定 8）
  const docCount = 8;
  // 交付物
  const dlvCount = 3;

  // AI 摘要（mock：根据状态生成）
  let aiNote = '';
  if (isActive) {
    aiNote = `关键路径任务。开工 ${task.actualStart}，计划 ${task.planEnd} 完成。${task.progress}% 进度，建议监控。`;
  } else if (isDelayed) {
    aiNote = `⚠️ 实际完工 ${task.actualEnd}，延期 ${daysBetween(task.planEnd, task.actualEnd!)} 天，需复盘原因。`;
  } else if (task.progress === 100) {
    aiNote = `✅ 已完成（${task.actualEnd}），提前/按时 ${daysBetween(task.actualEnd!, task.planEnd)} 天。`;
  } else if (isUpcoming) {
    aiNote = `即将开始（${daysBetween(today, task.planStart)} 天后）。可触发 AI 拆解 WBS 或预排资源。`;
  } else {
    aiNote = `${phaseLabel}阶段任务。持续时间 ${duration} 天。`;
  }

  return (
    <div
      style={{
        width: 320,
        background: 'var(--paper)',
        border: '1.5px solid var(--accent)',
        boxShadow: '6px 6px 0 var(--ink)',
        zIndex: 20
      }}
    >
      {/* 头部 */}
      <div
        style={{
          background: phase?.color ?? 'var(--accent-bg)',
          padding: '10px 12px',
          borderBottom: '1px solid var(--accent)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <div>
          <div
            style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 9,
              color: 'var(--accent-2)',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              fontWeight: 700
            }}
          >
            {project.code} · {phaseLabel} · {task.id.toUpperCase()}
          </div>
          <div
            style={{
              fontFamily: 'Inter Tight, sans-serif',
              fontWeight: 700,
              fontSize: 15,
              color: 'var(--ink)',
              marginTop: 2
            }}
          >
            {task.name}
          </div>
        </div>
        <span
          style={{
            padding: '2px 8px',
            background: 'var(--paper)',
            border: '1px solid var(--accent)',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 9,
            fontWeight: 700,
            color: 'var(--accent-2)',
            textTransform: 'uppercase',
            letterSpacing: '0.1em'
          }}
        >
          {isActive ? 'ACTIVE' : task.progress === 100 ? 'DONE' : isUpcoming ? 'UPCOMING' : 'PENDING'}
        </span>
      </div>

      {/* 4 列关键数字 */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          borderBottom: '1px solid var(--line)'
        }}
      >
        <Cell v={String(duration)} unit="d" k="DUR" />
        <Cell v={`${subDone}`} unit={`/${subCount}`} k="SUB" />
        <Cell v={String(docCount)} k="DOCS" />
        <Cell v={String(dlvCount)} k="DLV" />
      </div>

      {/* 进度条 */}
      <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--line)' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 10,
            marginBottom: 4
          }}
        >
          <span
            style={{
              color: 'var(--mute)',
              fontFamily: 'JetBrains Mono, monospace',
              textTransform: 'uppercase',
              letterSpacing: '0.1em'
            }}
          >
            PROGRESS
          </span>
          <span
            style={{
              color: 'var(--ink)',
              fontFamily: 'JetBrains Mono, monospace',
              fontWeight: 700
            }}
          >
            {task.progress}%
          </span>
        </div>
        <div style={{ height: 4, background: 'var(--line)', position: 'relative' }}>
          <div
            style={{
              width: `${task.progress}%`,
              height: '100%',
              background: isDelayed ? 'var(--today)' : 'var(--accent)'
            }}
          />
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 10,
            color: 'var(--mute)',
            marginTop: 4
          }}
        >
          <span>
            {task.planStart.slice(5)} → {task.planEnd.slice(5)}
          </span>
          <span>OWNER · {task.owner ?? '—'}</span>
        </div>
      </div>

      {/* AI 摘要 */}
      <div
        style={{
          padding: '10px 12px',
          background: 'var(--bg-2)',
          borderBottom: '1px solid var(--line)'
        }}
      >
        <div
          style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 9,
            color: 'var(--mute)',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            fontWeight: 700,
            marginBottom: 4
          }}
        >
          AI · NOTE
        </div>
        <div style={{ fontSize: 11, color: 'var(--ink)', lineHeight: 1.6 }}>{aiNote}</div>
      </div>

      {/* 风险标签 */}
      <div
        style={{
          display: 'flex',
          gap: 4,
          padding: '8px 12px',
          borderBottom: '1px solid var(--line)'
        }}
      >
        {isActive && (
          <span
            style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 9,
              fontWeight: 700,
              padding: '3px 6px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              background: 'var(--accent)',
              color: 'var(--ink)'
            }}
          >
            进行中 · IN PROGRESS
          </span>
        )}
        {isDelayed && (
          <span
            style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 9,
              fontWeight: 700,
              padding: '3px 6px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              background: 'var(--today)',
              color: '#fff'
            }}
          >
            延期 · DELAYED
          </span>
        )}
        {task.progress === 100 && (
          <span
            style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 9,
              fontWeight: 700,
              padding: '3px 6px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              background: '#10b981',
              color: '#fff'
            }}
          >
            已完成 · COMPLETED
          </span>
        )}
      </div>

      {/* 底部引导 */}
      <div
        style={{
          padding: '8px 12px',
          background: 'var(--ink)',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 10,
          textTransform: 'uppercase',
          letterSpacing: '0.1em'
        }}
      >
        <span>CLICK → OPEN 4-TAB DRAWER</span>
        <span style={{ color: 'var(--accent)' }}>→</span>
      </div>
    </div>
  );
}

function Cell({ v, unit, k }: { v: string; unit?: string; k: string }) {
  return (
    <div
      style={{
        padding: '10px 4px',
        textAlign: 'center',
        borderRight: '1px solid var(--line)'
      }}
    >
      <div
        style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontWeight: 700,
          fontSize: 18,
          color: 'var(--ink)'
        }}
      >
        {v}
        {unit && <span style={{ fontSize: 11, color: 'var(--mute)' }}>{unit}</span>}
      </div>
      <div
        style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 9,
          color: 'var(--mute)',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          marginTop: 2
        }}
      >
        {k}
      </div>
    </div>
  );
}
