import { useEffect } from 'react';
import { Routes, Route, NavLink } from 'react-router-dom';
import { DEMO_TODAY } from './lib/seed/seedData';
import { useProjectStore } from './store/projectStore';
import { useProjectEvents } from './lib/data/sseClient';
import { LockBanner } from './components/layout/LockBanner';
import { OverviewPage } from './routes/OverviewPage';
import { ProjectDetailPage } from './routes/ProjectDetailPage';

export default function App() {
  const projects = useProjectStore((s) => s.projects);
  const selectedProjectId = useProjectStore((s) => s.selectedProjectId);
  const initFromApi = useProjectStore((s) => s.initFromApi);
  const applyRemoteUpdate = useProjectStore((s) => s.applyRemoteUpdate);
  const loaded = useProjectStore((s) => s.loaded);
  const loadError = useProjectStore((s) => s.loadError);

  useEffect(() => {
    initFromApi();
  }, [initFromApi]);

  useProjectEvents((evt) => {
    applyRemoteUpdate(evt);
  });

  if (!loaded) return <div>Loading...</div>;

  return (
    <div className="h-full blueprint">
      <LockBanner />
      <header
        style={{
          background: 'var(--ink)',
          color: '#fff',
          height: 48,
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          gap: 24,
          borderBottom: '2px solid var(--ink)'
        }}
      >
        <div
          style={{
            fontFamily: 'Inter Tight, sans-serif',
            fontWeight: 700,
            fontSize: 15,
            letterSpacing: '-0.01em'
          }}
        >
          GANTTLENS<span style={{ color: 'var(--accent)' }}>.</span>
        </div>
        <nav style={{ display: 'flex', gap: 4, marginLeft: 12 }}>
          <NavLink
            to="/"
            end
            style={({ isActive }) => ({
              textDecoration: 'none',
              padding: '4px 10px',
              fontSize: 12,
              fontWeight: 500,
              borderRadius: 2,
              color: isActive ? 'var(--ink)' : '#cbd5e1',
              background: isActive ? 'var(--accent)' : 'transparent'
            })}
          >
            OVERVIEW
          </NavLink>
          {projects.map((p) => (
            <NavLink
              key={p.id}
              to={`/projects/${p.id}`}
              style={({ isActive }) => ({
                textDecoration: 'none',
                padding: '4px 10px',
                fontSize: 12,
                fontWeight: 500,
                borderRadius: 2,
                color: isActive ? 'var(--ink)' : '#cbd5e1',
                background: isActive ? 'var(--accent)' : 'transparent'
              })}
            >
              {p.code}
            </NavLink>
          ))}
        </nav>
        <div
          style={{
            marginLeft: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            fontSize: 12
          }}
        >
          <span
            style={{
              fontFamily: 'JetBrains Mono, monospace',
              color: '#94a3b8'
            }}
          >
            {DEMO_TODAY}
          </span>
          <span style={{ color: '#fff', fontWeight: 500 }}>Cailleach ▾</span>
        </div>
      </header>
      <main style={{ height: 'calc(100% - 48px)', overflow: 'auto' }}>
        <Routes>
          <Route path="/" element={<OverviewPage />} />
          <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
        </Routes>
      </main>
      {loadError && (
        <div
          style={{
            position: 'fixed',
            bottom: 16,
            left: 16,
            background: 'var(--today)',
            color: '#fff',
            padding: '8px 16px',
            borderRadius: 4,
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 12,
            zIndex: 99
          }}
        >
          ⚠️ 数据加载失败（{loadError}），已降级到内置示例
        </div>
      )}
    </div>
  );
}
