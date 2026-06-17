import { Routes, Route, NavLink } from 'react-router-dom';
import { DEMO_TODAY } from './lib/seed/seedData';
import { useProjectStore } from './store/projectStore';
import { OverviewPage } from './routes/OverviewPage';

export default function App() {
  const projects = useProjectStore((s) => s.projects);
  const selectedProjectId = useProjectStore((s) => s.selectedProjectId);

  return (
    <div className="h-full blueprint">
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
          <Route
            path="/projects/:projectId"
            element={
              <div style={{ padding: 32 }}>
                <h2
                  style={{
                    fontFamily: 'Inter Tight, sans-serif',
                    fontWeight: 700,
                    fontSize: 24,
                    marginBottom: 16
                  }}
                >
                  项目详情
                </h2>
                <p style={{ color: 'var(--mute)' }}>Day 3 实施</p>
              </div>
            }
          />
        </Routes>
      </main>
    </div>
  );
}
