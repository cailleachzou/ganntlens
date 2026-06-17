import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Plus } from 'lucide-react';
import { useProjectStore } from '../store/projectStore';
import { useUIStore } from '../store/uiStore';
import { DEMO_TODAY } from '../lib/seed/seedData';
import { FileTree } from '../components/file/FileTree';
import { AIChatPanel } from '../components/ai/AIChatPanel';
import { HoverPreviewCard } from '../components/gantt/HoverPreviewCard';
import { TaskDrawer } from '../components/drawer/TaskDrawer';
import { ProjectGantt } from '../components/gantt/ProjectGantt';
import { useState } from 'react';

export function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const project = useProjectStore((s) => s.projects.find((p) => p.id === projectId));
  const setSelectedProject = useProjectStore((s) => s.setSelectedProject);

  const [hoveredTaskId, setHoveredTaskId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);

  if (!project) {
    return (
      <div style={{ padding: 32 }}>
        <p>项目不存在: {projectId}</p>
        <Link to="/" style={{ color: 'var(--accent)' }}>返回总览</Link>
      </div>
    );
  }

  const hoveredTask = hoveredTaskId ? project.tasks.find((t) => t.id === hoveredTaskId) : null;
  const selectedTask = selectedTaskId ? project.tasks.find((t) => t.id === selectedTaskId) : null;
  const drawerOpen = selectedTask !== null;

  // 设置左侧项目
  if (projectId) {
    setSelectedProject(projectId);
  }

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 48px)' }}>
      {/* 左侧：文件树 */}
      <FileTree files={project.files} />

      {/* 中间：详情主区 */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          position: 'relative',
          minWidth: 0
        }}
      >
        {/* 工具栏 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '12px 24px',
            background: 'var(--paper)',
            borderBottom: '1px solid var(--line)',
            gap: 12
          }}
        >
          <button
            onClick={() => navigate('/')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              color: 'var(--ink-3)',
              background: 'transparent',
              border: '1px solid var(--line-2)',
              padding: '4px 10px',
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer'
            }}
          >
            <ArrowLeft size={12} />
            OVERVIEW
          </button>
          <span
            style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 10,
              color: 'var(--mute)',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              fontWeight: 700
            }}
          >
            PROJECT · {project.code}
          </span>
          <span
            style={{
              fontFamily: 'Inter Tight, sans-serif',
              fontWeight: 700,
              fontSize: 16,
              color: 'var(--ink)'
            }}
          >
            {project.name}
          </span>
          <span
            style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 10,
              color: 'var(--mute)',
              padding: '2px 6px',
              border: '1px solid var(--line-2)',
              textTransform: 'uppercase',
              letterSpacing: '0.1em'
            }}
          >
            {project.status}
          </span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '4px 10px',
                fontSize: 11,
                fontWeight: 500,
                border: '1px solid var(--line-2)',
                background: 'var(--paper)',
                cursor: 'pointer'
              }}
            >
              <Download size={11} />
              导出 PDF
            </button>
            <button
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '4px 10px',
                fontSize: 11,
                fontWeight: 500,
                border: '1px solid var(--ink)',
                background: 'var(--ink)',
                color: '#fff',
                cursor: 'pointer'
              }}
            >
              <Plus size={11} />
              新建任务
            </button>
          </div>
        </div>

        {/* 甘特区 */}
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            padding: '16px 24px',
            position: 'relative'
          }}
        >
          <ProjectGantt
            project={project}
            rangeStart={project.start}
            rangeEnd={project.end}
            today={DEMO_TODAY}
            onTaskClick={(taskId) => setSelectedTaskId(taskId)}
            onTaskHover={(taskId) => setHoveredTaskId(taskId)}
            selectedTaskId={selectedTaskId}
            hoveredTaskId={hoveredTaskId}
          />
        </div>

        {/* Hover 预览卡 */}
        {hoveredTask && !drawerOpen && (
          <div
            style={{
              position: 'fixed',
              right: 360,
              bottom: 32,
              zIndex: 20
            }}
          >
            <HoverPreviewCard
              task={hoveredTask}
              project={project}
              rangeStart={project.start}
              rangeEnd={project.end}
            />
          </div>
        )}

        {/* 抽屉 */}
        {drawerOpen && selectedTask && (
          <TaskDrawer
            task={selectedTask}
            project={project}
            onClose={() => setSelectedTaskId(null)}
          />
        )}
      </div>

      {/* 右侧：AI 面板（被抽屉覆盖时淡化） */}
      <div
        style={{
          opacity: drawerOpen ? 0.3 : 1,
          pointerEvents: drawerOpen ? 'none' : 'auto',
          transition: 'opacity 200ms',
          display: 'flex'
        }}
      >
        <AIChatPanel provider="MOCK" />
      </div>
    </div>
  );
}
