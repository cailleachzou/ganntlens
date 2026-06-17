import { useProjectStore } from '../store/projectStore';
import { DEMO_TODAY, seedProjects } from '../lib/seed/seedData';
import { GanttChart } from '../components/gantt/GanttChart';
import { rangeDays } from '../lib/gantt/dateUtils';

export function OverviewPage() {
  const projects = useProjectStore((s) => s.projects);
  const selectedProjectId = useProjectStore((s) => s.selectedProjectId);
  const setSelectedProject = useProjectStore((s) => s.setSelectedProject);

  // 总览时间轴：覆盖所有项目
  const allStarts = projects.map((p) => p.start);
  const allEnds = projects.map((p) => p.end);
  const rangeStart = allStarts.sort()[0];
  const rangeEnd = allEnds.sort().reverse()[0];
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
              fontWeight: 600
            }}
          >
            <span style={{ padding: '4px 10px', color: 'var(--mute)' }}>DAY</span>
            <span
              style={{ padding: '4px 10px', background: 'var(--ink)', color: '#fff' }}
            >
              WEEK
            </span>
            <span style={{ padding: '4px 10px', color: 'var(--mute)' }}>MONTH</span>
          </div>
          <button
            style={{
              padding: '5px 12px',
              fontSize: 11,
              fontWeight: 500,
              border: '1px solid var(--line-2)',
              background: 'var(--paper)',
              cursor: 'pointer',
              fontFamily: 'Inter, sans-serif',
              borderRadius: 2
            }}
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
              cursor: 'pointer',
              fontFamily: 'Inter, sans-serif',
              borderRadius: 2
            }}
          >
            + 新建项目
          </button>
        </div>
      </div>

      {/* 三栏布局 */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        {/* 左：项目列表 */}
        <aside
          style={{
            width: 240,
            background: 'var(--paper)',
            border: '1px solid var(--line)',
            flexShrink: 0
          }}
        >
          <div
            style={{
              padding: '12px 16px',
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
              PROJECTS
            </span>
            <span
              style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 10,
                color: 'var(--ink-3)',
                fontWeight: 700
              }}
            >
              {String(projects.length).padStart(2, '0')}
            </span>
          </div>
          {projects.map((p) => {
            const totalTasks = p.tasks.length;
            const doneTasks = p.tasks.filter((t) => t.progress === 100).length;
            const progress = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
            const isActive = p.id === selectedProjectId;
            return (
              <div
                key={p.id}
                onClick={() => setSelectedProject(p.id)}
                style={{
                  padding: '12px 16px',
                  borderBottom: '1px solid var(--line)',
                  cursor: 'pointer',
                  position: 'relative',
                  background: isActive ? 'var(--accent-bg)' : 'transparent',
                  boxShadow: isActive ? 'inset 3px 0 0 var(--accent)' : 'none'
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 6
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'JetBrains Mono, monospace',
                      fontWeight: 700,
                      fontSize: 12,
                      padding: '1px 6px',
                      background: 'var(--ink-2)',
                      color: '#fff'
                    }}
                  >
                    {p.code}
                  </span>
                  <span
                    style={{
                      fontFamily: 'JetBrains Mono, monospace',
                      fontSize: 9,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.1em',
                      color: p.status === 'active' ? 'var(--accent-2)' : '#1e40af',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4
                    }}
                  >
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: p.status === 'active' ? 'var(--accent)' : '#3b82f6'
                      }}
                    />
                    {p.status}
                  </span>
                </div>
                <div
                  style={{
                    fontFamily: 'Inter Tight, sans-serif',
                    fontWeight: 600,
                    fontSize: 13,
                    color: 'var(--ink)'
                  }}
                >
                  {p.name}
                </div>
                <div
                  style={{
                    display: 'flex',
                    gap: 12,
                    marginTop: 6,
                    fontSize: 10,
                    color: 'var(--mute)',
                    fontFamily: 'JetBrains Mono, monospace'
                  }}
                >
                  <span>
                    {p.start.slice(5)} → {p.end.slice(5)}
                  </span>
                  <span style={{ color: 'var(--ink-3)', fontWeight: 600 }}>{progress}%</span>
                </div>
                <div
                  style={{
                    height: 3,
                    background: 'var(--line)',
                    marginTop: 6,
                    position: 'relative'
                  }}
                >
                  <div
                    style={{
                      width: `${progress}%`,
                      height: '100%',
                      background: 'var(--accent)'
                    }}
                  />
                </div>
              </div>
            );
          })}
        </aside>

        {/* 中：大甘特图 */}
        <main style={{ flex: 1, minWidth: 0 }}>
          <GanttChart
            projects={projects}
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
            today={DEMO_TODAY}
            view="week"
          />
        </main>

        {/* 右：跨项目面板 */}
        <aside
          style={{
            width: 280,
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

          {/* AI 洞察 */}
          <div
            style={{
              background: 'var(--ink)',
              color: '#fff',
              border: '1px solid var(--ink)'
            }}
          >
            <div
              style={{
                padding: '10px 14px',
                borderBottom: '1px solid #334155',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <span
                style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 10,
                  color: 'var(--accent)',
                  letterSpacing: '0.15em',
                  textTransform: 'uppercase',
                  fontWeight: 700
                }}
              >
                AI · INSIGHT
              </span>
              <span
                style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 9,
                  color: '#10b981',
                  fontWeight: 700
                }}
              >
                MOCK
              </span>
            </div>
            <div style={{ padding: '12px 14px', fontSize: 12, lineHeight: 1.7 }}>
              <AILabel>STATUS</AILabel>
              <div style={{ color: '#cbd5e1' }}>
                3 个项目在 6/16 处于{' '}
                <strong style={{ background: 'var(--accent)', color: 'var(--ink)', padding: '0 3px' }}>
                  不同阶段
                </strong>
                ：设计 / 施工 / 验收
              </div>
              <AILabel>SUGGEST</AILabel>
              <div style={{ color: '#cbd5e1' }}>
                关注{' '}
                <strong style={{ background: 'var(--accent)', color: 'var(--ink)', padding: '0 3px' }}>
                  M-2026 验收测试
                </strong>
                ，50% 进度，6/26 到期 — 可用 AI 加速
              </div>
              <div
                style={{
                  marginTop: 10,
                  paddingTop: 10,
                  borderTop: '1px solid #334155',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <span
                  style={{
                    color: '#94a3b8',
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: 9,
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em'
                  }}
                >
                  APPLY · ⏎
                </span>
                <span style={{ color: 'var(--accent)' }}>→</span>
              </div>
            </div>
          </div>
        </aside>
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

function AILabel({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        color: 'var(--accent)',
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 9,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        fontWeight: 700,
        marginTop: 10,
        display: 'block'
      }}
    >
      {children}
    </span>
  );
}
