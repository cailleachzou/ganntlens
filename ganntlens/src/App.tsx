import { Routes, Route, Link } from 'react-router-dom';
import { DEMO_TODAY } from './lib/seed/seedData';
import { useProjectStore } from './store/projectStore';

export default function App() {
  const projects = useProjectStore((s) => s.projects);
  const selectedProjectId = useProjectStore((s) => s.selectedProjectId);

  return (
    <div className="h-full bg-gray-50">
      <header className="bg-white border-b px-6 py-3 flex items-center gap-6">
        <h1 className="text-lg font-semibold text-gray-900">GanttLens</h1>
        <nav className="flex gap-4 text-sm">
          <Link to="/" className="text-gray-600 hover:text-gray-900">总览</Link>
          {projects.map((p) => (
            <Link
              key={p.id}
              to={`/projects/${p.id}`}
              className={
                p.id === selectedProjectId
                  ? 'text-blue-600 font-medium'
                  : 'text-gray-600 hover:text-gray-900'
              }
            >
              {p.code}
            </Link>
          ))}
        </nav>
        <span className="ml-auto text-xs text-gray-500">今天 {DEMO_TODAY}</span>
      </header>
      <main className="p-6">
        <Routes>
          <Route
            path="/"
            element={
              <div>
                <h2 className="text-2xl font-semibold mb-4">项目总览</h2>
                <p className="text-gray-600 mb-2">Day 1 框架跑通 ✓</p>
                <ul className="space-y-2">
                  {projects.map((p) => (
                    <li
                      key={p.id}
                      className="p-3 bg-white rounded border flex items-center gap-4"
                    >
                      <span className="font-mono text-sm text-gray-500">{p.code}</span>
                      <span className="font-medium">{p.name}</span>
                      <span className="text-xs text-gray-500">{p.start} → {p.end}</span>
                      <span className="ml-auto text-xs px-2 py-0.5 rounded bg-gray-100">
                        {p.status}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            }
          />
          <Route
            path="/projects/:projectId"
            element={
              <div>
                <h2 className="text-2xl font-semibold mb-4">项目详情</h2>
                <p className="text-gray-600">Day 2 开始渲染甘特图</p>
              </div>
            }
          />
        </Routes>
      </main>
    </div>
  );
}
