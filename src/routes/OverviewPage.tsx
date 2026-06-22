import { useEffect, useRef, useState } from 'react';
import { useProjectStore } from '../store/projectStore';
import { useUIStore } from '../store/uiStore';
import { DEMO_TODAY, seedProjects } from '../lib/seed/seedData';
import { GanttChart } from '../components/gantt/GanttChart';
import { HoverPreviewCard } from '../components/gantt/HoverPreviewCard';
import { AIChatPanel } from '../components/ai/AIChatPanel';
import { useHoverPosition } from '../lib/gantt/useHoverPosition';
import { rangeDays, parseDate, formatDate } from '../lib/gantt/dateUtils';

export function OverviewPage() {
  const projects = useProjectStore((s) => s.projects);

  // 总览时间轴：基于实际任务的最早 planStart 和最晚 planEnd，前后各加 30 天 padding
  const allTaskStarts = projects.flatMap((p) => p.tasks.map((t) => t.planStart));
  const allTaskEnds = projects.flatMap((p) => p.tasks.map((t) => t.planEnd));
  const earliestTask = allTaskStarts.sort()[0];
  const latestTask = allTaskEnds.sort().reverse()[0];
  const rangeStart = formatDate(new Date(parseDate(earliestTask).getTime() - 30 * 86400000));
  const rangeEnd = formatDate(new Date(parseDate(latestTask).getTime() + 30 * 86400000));
  const totalDays = rangeDays(rangeStart, rangeEnd);

  // 跨项目统计
  const activeCount = projects.filter((p) => p.status === 'active').length;
  const planningCount = projects.filter((p) => p.status === 'planning').length;

  // 14 天内到期里程碑
  const upcomingMilestones = projects
    .flatMap((p) =>
      p.milestones
        .filter((m) => m.status === 'pending')
        .map((m) => ({ project: p, milestone: m }))
    )
    .filter((x) => {
      const days = Math.round(
        (new Date(x.milestone.date).getTime() - new Date(DEMO_TODAY).getTime()) / 86400000
      );
      return days >= 0 && days <= 60;
    })
    .sort((a, b) => a.milestone.date.localeCompare(b.milestone.date))
    .slice(0, 5);

  const drawerOpen = useUIStore((s) => s.drawerOpen);
  const dragState = useUIStore((s) => s.dragState);
  const cancelDrag = useUIStore((s) => s.cancelDrag);
  const hoverSuppressed = useUIStore((s) => s.hoverSuppressed);
  const [hoveredTaskId, setHoveredTaskId] = useState<string | null>(null);
  const [hoveredProjectId, setHoveredProjectId] = useState<string | null>(null);
  const hoverRef = useRef<HTMLDivElement>(null);
  const { x, y, visible, immediate } = useHoverPosition(hoverRef, hoverSuppressed);

  // 抽屉打开时取消 drag
  useEffect(() => {
    if (drawerOpen && dragState) {
      cancelDrag();
    }
  }, [drawerOpen, dragState, cancelDrag]);

  const hoveredProject = hoveredProjectId ? projects.find((p) => p.id === hoveredProjectId) : null;
  const hoveredTask =
    hoveredProject && hoveredTaskId ? hoveredProject.tasks.find((t) => t.id === hoveredTaskId) : null;

  return (
    <div style={{ padding: '0 32px 32px' }}>
      {/* Page head */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          padding: '24px 0 16px'
        }}
      >
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 12,
              marginBottom: 6
            }}
          >
            <span
              style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontWeight: 700,
                fontSize: 11,
                color: 'var(--mute)',
                letterSpacing: '0.18em',
                textTransform: 'uppercase'
              }}
            >
              PROJECT · {String(projects.length).padStart(2, '0')}
            </span>
            <span style={{ color: 'var(--line-2)' }}>/</span>
            <span style={{ fontSize: 12, color: 'var(--mute)' }}>OVERVIEW · ACTIVE</span>
          </div>
          <h1
            style={{
              fontFamily: 'Inter Tight, sans-serif',
              fontWeight: 700,
              fontSize: 26,
              color: 'var(--ink)',
              margin: '0 0 2px',
              letterSpacing: '-0.02em'
            }}
          >
            2026 Q2-Q3 在建项目 · 大甘特图
          </h1>
          <div style={{ fontSize: 12, color: 'var(--mute)' }}>
            {projects.length} 个项目按实际时间平铺 · 共享时间轴 {rangeStart} → {rangeEnd} ({totalDays}d) · 共享今天线 {DEMO_TODAY}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div
            style={{
              display: 'inline-flex',
              border: '1px solid var(--line-2)',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 10,
              fontWeight: 600,
              opacity: 0.5,
              cursor: 'not-allowed'
            }}
            title="时间粒度切换 - 开发中"
          >
            <span style={{ padding: '4px 10px', color: 'var(--mute)' }}>DAY</span>
            <span style={{ padding: '4px 10px', color: 'var(--mute)' }}>WEEK</span>
            <span style={{ padding: '4px 10px', color: 'var(--mute)' }}>MONTH</span>
          </div>
          <button
            style={{
              padding: '5px 12px',
              fontSize: 11,
              fontWeight: 500,
              border: '1px solid var(--line-2)',
              background: 'var(--paper)',
              cursor: 'not-allowed',
              fontFamily: 'Inter, sans-serif',
              borderRadius: 2,
              opacity: 0.5
            }}
            disabled
            title="导出 PDF - 开发中"
          >
            导出 PDF
          </button>
          <button
            style={{
              padding: '5px 12px',
              fontSize: 11,
              fontWeight: 500,
              border: '1px solid var(--ink)',
              background: 'var(--ink)',
              color: '#fff',
              cursor: 'not-allowed',
              fontFamily: 'Inter, sans-serif',
              borderRadius: 2,
              opacity: 0.5
            }}
            disabled
            title="新建项目 - 开发中"
          >
            + 新建项目
          </button>
        </div>
      </div>

      {/* 三栏：左 GanttChart + 中 stats 280px + 右 AI 320px */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        {/* 大甘特图 */}
        <main ref={hoverRef} style={{ flex: 1, minWidth: 0 }}>
          <GanttChart
            projects={projects}
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
            today={DEMO_TODAY}
            view="week"
            onTaskHover={(projectId, taskId) => {
              setHoveredProjectId(taskId ? projectId : null);
              setHoveredTaskId(taskId);
            }}
            hoveredTaskId={hoveredTaskId}
            hoveredProjectId={hoveredProjectId}
          />
        </main>

        {/* 中：跨项目统计面板 */}
        <aside
          style={{
            width: 260,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            flexShrink: 0
          }}
        >
          {/* 跨项目统计 */}
          <div
            style={{
              background: 'var(--paper)',
              border: '1px solid var(--line)'
            }}
          >
            <div
              style={{
                padding: '10px 14px',
                borderBottom: '1px solid var(--line)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <span
                style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 10,
                  color: 'var(--mute)',
                  letterSpacing: '0.15em',
                  textTransform: 'uppercase',
                  fontWeight: 700
                }}
              >
                CROSS-PROJECT
              </span>
              <span
                style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 9,
                  color: 'var(--accent-2)',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em'
                }}
              >
                LIVE
              </span>
            </div>
            <div style={{ padding: '12px 14px' }}>
              <StatRow k="在建项目" v={String(activeCount)} />
              <StatRow k="筹备中" v={String(planningCount)} />
              <StatRow
                k="本周到期里程碑"
                v={String(upcomingMilestones.filter((x) => {
                  const days = Math.round(
                    (new Date(x.milestone.date).getTime() - new Date(DEMO_TODAY).getTime()) / 86400000
                  );
                  return days <= 7;
                }).length)}
                warn
              />
              <StatRow k="总工期跨度" v={`${totalDays}d`} />
            </div>
          </div>

          {/* 即将到期 */}
          <div
            style={{
              background: 'var(--paper)',
              border: '1px solid var(--line)'
            }}
          >
            <div
              style={{
                padding: '10px 14px',
                borderBottom: '1px solid var(--line)'
              }}
            >
              <span
                style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 10,
                  color: 'var(--mute)',
                  letterSpacing: '0.15em',
                  textTransform: 'uppercase',
                  fontWeight: 700
                }}
              >
                UPCOMING · 60d
              </span>
            </div>
            <div style={{ padding: '0 14px' }}>
              {upcomingMilestones.map((x) => {
                const days = Math.round(
                  (new Date(x.milestone.date).getTime() - new Date(DEMO_TODAY).getTime()) / 86400000
                );
                const sev = days <= 7 ? 'h' : days <= 30 ? 'm' : 'l';
                return (
                  <div
                    key={`${x.project.id}-${x.milestone.id}`}
                    style={{
                      display: 'flex',
                      gap: 8,
                      padding: '8px 0',
                      borderBottom: '1px dashed var(--line)'
                    }}
                  >
                    <span
                      style={{
                        fontFamily: 'JetBrains Mono, monospace',
                        fontSize: 9,
                        fontWeight: 700,
                        padding: '2px 4px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        flexShrink: 0,
                        height: 18,
                        background:
                          sev === 'h' ? 'var(--today)' : sev === 'm' ? 'var(--accent)' : 'var(--bg-2)',
                        color: sev === 'l' ? 'var(--mute)' : sev === 'h' ? '#fff' : 'var(--ink)'
                      }}
                    >
                      {days}d
                    </span>
                    <div style={{ fontSize: 11, lineHeight: 1.4 }}>
                      <div style={{ color: 'var(--ink)', fontWeight: 600 }}>
                        {x.project.code} · {x.milestone.name}
                      </div>
                      <div
                        style={{
                          color: 'var(--mute)',
                          fontFamily: 'JetBrains Mono, monospace',
                          fontSize: 9,
                          marginTop: 2
                        }}
                      >
                        {x.milestone.date} · {x.project.name}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* AI 洞察卡片已删除（右侧 AIChatPanel 已替代） */}
        </aside>

        {/* 右：AI Chat Panel（global scope） */}
        <AIChatPanel scope="global" />

        {hoveredTask && hoveredProject && (
          <HoverPreviewCard
            task={hoveredTask}
            project={hoveredProject}
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
            x={x}
            y={y}
            visible={visible}
            immediate={immediate}
          />
        )}
      </div>
    </div>
  );
}

function StatRow({ k, v, warn, danger }: { k: string; v: string; warn?: boolean; danger?: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6px 0',
        borderBottom: '1px dashed var(--line)'
      }}
    >
      <span style={{ color: 'var(--mute)', fontSize: 11 }}>{k}</span>
      <span
        style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontWeight: 700,
          fontSize: 14,
          color: danger ? 'var(--today)' : warn ? 'var(--accent)' : 'var(--ink)'
        }}
      >
        {v}
      </span>
    </div>
  );
}
