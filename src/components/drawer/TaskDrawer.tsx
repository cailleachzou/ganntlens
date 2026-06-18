import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { Task, Project } from '../../types';

interface Props {
  task: Task;
  project: Project;
  isOpen: boolean;
  onClose: () => void;
  onAction?: (action: string, task: Task) => void;
}

type TabKey = 'subtasks' | 'docs' | 'deliverables' | 'ai';

const TABS: { key: TabKey; label: string; count: number }[] = [
  { key: 'subtasks', label: 'SUBTASKS', count: 5 },
  { key: 'docs', label: 'DOCS', count: 8 },
  { key: 'deliverables', label: 'DLV', count: 3 },
  { key: 'ai', label: 'AI', count: 2 }
];

const SHORTCUTS = ['启动节点', '延后 +3d', '提前 -2d', '风险扫描', '生成周报', '拆解 WBS'];

/**
 * 4-Tab 抽屉 v7 — 420px 全功能面板
 * 头部：面包屑 + 标题 + 状态徽标
 * 4 Tab：子任务/文档/交付物/AI笔记
 * 底部：AI 快捷指令条
 */
export function TaskDrawer({ task, project, isOpen, onClose, onAction }: Props) {
  const [tab, setTab] = useState<TabKey>('subtasks');
  const [mounted, setMounted] = useState(isOpen);
  const [phase, setPhase] = useState<'opening' | 'open' | 'closing' | 'closed'>(
    isOpen ? 'open' : 'closed'
  );

  useEffect(() => {
    if (isOpen) {
      setMounted(true);
      // 先 closed → 下一帧 open，触发 transition
      setPhase('closed');
      const t = window.setTimeout(() => setPhase('open'), 20);
      return () => window.clearTimeout(t);
    } else {
      setPhase('closing');
      const t = window.setTimeout(() => {
        setMounted(false);
        setPhase('closed');
      }, 220);
      return () => window.clearTimeout(t);
    }
  }, [isOpen]);
  const phaseRef = project.phases.find((p) => p.id === task.phaseId);
  const phaseLabel = phaseRef?.name.split(' · ')[0] ?? '';

  // 子任务（mock 数据，按 progress 推算）
  const subtasks = [
    { name: '材料准备', start: '6/16', end: '6/17', dur: '2d', done: task.progress >= 25, owner: '张工' },
    { name: '现场勘查', start: '6/18', end: '6/18', dur: '1d', done: task.progress >= 50, owner: '李工' },
    { name: '主体施工', start: '6/19', end: '6/24', dur: '6d', done: task.progress >= 75, owner: '陈工' },
    { name: '质量检查', start: '6/25', end: '6/25', dur: '1d', done: task.progress >= 90, owner: '王工' },
    { name: '验收交付', start: '6/26', end: '6/26', dur: '1d', done: task.progress === 100, owner: '某某' }
  ];

  // 文档（mock）
  const docs = [
    { name: '技术规格书.pdf', ext: 'pdf', size: '890K' },
    { name: '施工图纸 v2.dwg', ext: 'dwg', size: '3.2M' },
    { name: '材料清单.xlsx', ext: 'xlsx', size: '124K' },
    { name: '进度报告.docx', ext: 'docx', size: '256K' }
  ];

  // 交付物（mock）
  const deliverables = [
    { name: '完工报告', status: 'pending' },
    { name: '验收测试报告', status: 'pending' },
    { name: '培训签到表', status: 'pending' }
  ];

  if (!mounted) return null;

  return (
    <aside
      className={`task-drawer ${phase === 'open' || phase === 'opening' ? 'open' : 'closed'}`}
      role="dialog"
      aria-label="任务详情"
      data-testid="task-drawer"
    >
      {/* 头部 */}
      <div
        style={{
          background: phaseRef?.color ?? 'var(--accent-bg)',
          padding: '14px 16px',
          borderBottom: '1.5px solid var(--ink)'
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
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
                fontSize: 18,
                color: 'var(--ink)',
                marginTop: 2
              }}
            >
              {task.name}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'var(--paper)',
              border: '1px solid var(--ink)',
              padding: '2px 8px',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 10,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4
            }}
          >
            <X size={11} />
            CLOSE
          </button>
        </div>
        <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
          <Badge>
            {!task.actualEnd && task.progress > 0
              ? '○ ACTIVE'
              : task.progress === 100
                ? '✓ DONE'
                : '○ PENDING'}
          </Badge>
          <Badge>
            {task.planStart.slice(5)} → {task.planEnd.slice(5)} ·{' '}
            {Math.round(
              (new Date(task.planEnd).getTime() - new Date(task.planStart).getTime()) / 86400000
            ) + 1}
            d
          </Badge>
          <Badge>OWNER · {task.owner ?? '—'}</Badge>
        </div>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          borderBottom: '1.5px solid var(--ink)',
          background: 'var(--bg-2)'
        }}
      >
        {TABS.map((t) => (
          <div
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              flex: 1,
              padding: '10px 4px',
              textAlign: 'center',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 10,
              fontWeight: 700,
              color: tab === t.key ? 'var(--ink)' : 'var(--mute)',
              cursor: 'pointer',
              background: tab === t.key ? 'var(--paper)' : 'transparent',
              borderBottom: tab === t.key ? '2px solid var(--accent)' : '2px solid transparent',
              textTransform: 'uppercase',
              letterSpacing: '0.1em'
            }}
          >
            {t.label}
            <span
              style={{
                display: 'block',
                fontSize: 9,
                color: 'var(--mute-2)',
                fontWeight: 500,
                marginTop: 2
              }}
            >
              {t.count}
            </span>
          </div>
        ))}
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* 进度块（所有 tab 都显示） */}
        <div
          style={{
            padding: '12px 16px',
            background: 'var(--bg-2)',
            borderBottom: '1px solid var(--line)'
          }}
        >
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
          <div style={{ height: 6, background: 'var(--line)' }}>
            <div
              style={{
                width: `${task.progress}%`,
                height: '100%',
                background: 'var(--accent)'
              }}
            />
          </div>
        </div>

        {tab === 'subtasks' && (
          <div>
            {subtasks.map((s, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '8px 16px',
                  gap: 10,
                  borderBottom: '1px solid var(--line)',
                  cursor: 'pointer'
                }}
              >
                <div
                  style={{
                    width: 14,
                    height: 14,
                    border: '1.5px solid var(--ink-3)',
                    background: s.done ? 'var(--ink)' : 'transparent',
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontSize: 10
                  }}
                >
                  {s.done && '✓'}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink)' }}>
                    {s.name}
                  </div>
                  <div
                    style={{
                      fontFamily: 'JetBrains Mono, monospace',
                      fontSize: 10,
                      color: 'var(--mute)',
                      marginTop: 2
                    }}
                  >
                    {s.start} → {s.end} · <span style={{ color: 'var(--ink-3)', fontWeight: 600 }}>{s.dur}</span>
                  </div>
                </div>
                <span
                  style={{
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: 9,
                    color: 'var(--mute)',
                    padding: '2px 4px',
                    border: '1px solid var(--line)'
                  }}
                >
                  {s.owner}
                </span>
              </div>
            ))}
          </div>
        )}

        {tab === 'docs' && (
          <div>
            {docs.map((d, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '10px 16px',
                  gap: 10,
                  borderBottom: '1px solid var(--line)',
                  cursor: 'pointer'
                }}
              >
                <div
                  style={{
                    width: 28,
                    height: 32,
                    border: '1px solid var(--line-2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: 8,
                    fontWeight: 700,
                    color: 'var(--mute)',
                    background: 'var(--bg-2)'
                  }}
                >
                  {d.ext.toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 500 }}>{d.name}</div>
                  <div
                    style={{
                      fontFamily: 'JetBrains Mono, monospace',
                      fontSize: 10,
                      color: 'var(--mute)',
                      marginTop: 2
                    }}
                  >
                    {d.size}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'deliverables' && (
          <div>
            {deliverables.map((d, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '12px 16px',
                  gap: 10,
                  borderBottom: '1px solid var(--line)'
                }}
              >
                <div
                  style={{
                    width: 16,
                    height: 16,
                    border: '1.5px solid var(--ink)',
                    background: d.status === 'approved' ? 'var(--ink)' : 'transparent'
                  }}
                />
                <div style={{ flex: 1, fontSize: 12, fontWeight: 500 }}>{d.name}</div>
                <span
                  style={{
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: 9,
                    fontWeight: 700,
                    color: 'var(--accent-2)',
                    textTransform: 'uppercase'
                  }}
                >
                  {d.status}
                </span>
              </div>
            ))}
          </div>
        )}

        {tab === 'ai' && (
          <div style={{ padding: '12px 16px' }}>
            <div
              style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 9,
                color: 'var(--accent-2)',
                fontWeight: 700,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                marginBottom: 6
              }}
            >
              AI · NOTE 1
            </div>
            <div
              style={{
                fontSize: 11,
                color: 'var(--ink)',
                lineHeight: 1.6,
                marginBottom: 12
              }}
            >
              任务处于关键路径。开工 6/16，距 M1 4 天。建议提前 1 天启动以预留调试缓冲。
            </div>
            <div
              style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 9,
                color: 'var(--accent-2)',
                fontWeight: 700,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                marginBottom: 6
              }}
            >
              AI · NOTE 2
            </div>
            <div style={{ fontSize: 11, color: 'var(--ink)', lineHeight: 1.6 }}>
              子任务「材料准备」需 2 天。可与「现场勘查」并行（不同人员），预计节省 1 天。
            </div>
          </div>
        )}
      </div>

      {/* 底部 AI 快捷条 */}
      <div
        style={{
          padding: '10px 16px',
          borderTop: '1.5px solid var(--ink)',
          background: 'var(--ink)',
          color: '#fff'
        }}
      >
        <div
          style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 9,
            color: 'var(--accent)',
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            fontWeight: 700,
            marginBottom: 6
          }}
        >
          AI · QUICK ACTIONS
        </div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {SHORTCUTS.map((s) => (
            <button
              key={s}
              onClick={() => onAction?.(s, task)}
              style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 10,
                fontWeight: 600,
                padding: '4px 8px',
                background: '#1e293b',
                color: '#fff',
                border: '1px solid #334155',
                cursor: 'pointer'
              }}
            >
              {s}
            </button>
            // 重置 hover
          ))}
        </div>
      </div>
    </aside>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 9,
        fontWeight: 700,
        padding: '2px 6px',
        background: 'var(--paper)',
        border: '1px solid var(--accent)',
        color: 'var(--ink)',
        textTransform: 'uppercase',
        letterSpacing: '0.05em'
      }}
    >
      {children}
    </span>
  );
}
