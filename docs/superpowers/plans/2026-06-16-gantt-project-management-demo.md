# GanttLens Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 构建一个可交互施工甘特图管理 Demo (GanttLens)，参加 TRAE AI 创造力大赛初赛

**Architecture:** React 18 + TypeScript + Vite 单页应用，Zustand 状态管理，frappe-gantt 基础库 + 自定义覆盖层（阶段色带/里程碑/双轨/今天线/抽屉），混合 AI（Mock LLM 默认 + 7 家真实 Provider 可选）

**Tech Stack:** React 18 / TypeScript / Vite / Zustand / Tailwind CSS / frappe-gantt / lucide-react

**Spec:** `docs/superpowers/specs/2026-06-16-gantt-project-management-demo-design.md`

---

## 文件结构

```
ganntlens/                              # 项目根目录
├── src/
│   ├── main.tsx                        # Vite 入口
│   ├── App.tsx                         # 路由 + 布局
│   ├── routes/
│   │   ├── OverviewPage.tsx            # 总览大甘特（3 项目）
│   │   └── ProjectDetailPage.tsx       # 单项目详情
│   ├── components/
│   │   ├── gantt/                      # 6 文件
│   │   ├── drawer/                     # 5 文件
│   │   ├── ai/                         # 2 文件
│   │   ├── file/FileTree.tsx           # 1 文件
│   │   ├── layout/                     # 2 文件
│   │   └── ui/                         # 4 文件
│   ├── store/                          # 3 文件 (project/ui/ai)
│   ├── lib/
│   │   ├── ai/                         # 4 文件 (client/providers/mock/prompts)
│   │   ├── gantt/                      # 2 文件
│   │   └── seed/seedData.ts
│   ├── types/index.ts
│   └── styles/globals.css
├── docs/
├── .env.example
├── .gitignore
├── README.md
├── package.json
├── tsconfig.json
├── tailwind.config.js
├── postcss.config.js
├── vite.config.ts
└── index.html
```

---

## Day 1: 脚手架 + 数据基础（目标：基础框架跑通）

### Task 1.1: 创建项目目录 + package.json

**Files:**
- Create: `ganntlens/package.json`
- Create: `ganntlens/.gitignore`
- Create: `ganntlens/index.html`
- Create: `ganntlens/tsconfig.json`
- Create: `ganntlens/vite.config.ts`
- Create: `ganntlens/.env.example`

- [ ] **Step 1: 创建项目根目录**

```bash
mkdir ganntlens
cd ganntlens
```

- [ ] **Step 2: 写入 package.json**

```json
{
  "name": "ganntlens",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.26.0",
    "zustand": "^4.5.4",
    "frappe-gantt": "^0.6.1",
    "lucide-react": "^0.451.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.5",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "typescript": "^5.5.4",
    "vite": "^5.4.6",
    "tailwindcss": "^3.4.13",
    "postcss": "^8.4.47",
    "autoprefixer": "^10.4.20"
  }
}
```

- [ ] **Step 3: 写入 .gitignore**

```gitignore
node_modules
dist
.env
.env.local
*.log
.DS_Store
.vscode
.idea
```

- [ ] **Step 4: 写入 .env.example**

```
# 复制为 .env.local 后填入
# 默认使用 Mock LLM，无需配置
# 如需真实 LLM，在 UI 设置面板填入即可（存 localStorage）
VITE_DEFAULT_LLM=mock
```

- [ ] **Step 5: 写入 index.html**

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1280" />
    <title>GanttLens · 施工甘特图管理</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 6: 写入 tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"]
}
```

- [ ] **Step 7: 写入 vite.config.ts**

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true
  }
})
```

- [ ] **Step 8: 安装依赖**

Run: `npm install`
Expected: 安装完成，无 error

- [ ] **Step 9: Commit**

```bash
git add ganntlens/
git commit -m "feat: initialize Vite + React + TS project"
```

---

### Task 1.2: 配置 Tailwind

**Files:**
- Create: `ganntlens/tailwind.config.js`
- Create: `ganntlens/postcss.config.js`
- Create: `ganntlens/src/styles/globals.css`

- [ ] **Step 1: 写入 tailwind.config.js**

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        phase1: '#dbeafe',  // 蓝 - 前期
        phase2: '#fef3c7',  // 黄 - 中期
        phase3: '#d1fae5',  // 绿 - 后期
        today: '#ef4444',
        milestone: '#f97316',
        milestoneDone: '#10b981'
      }
    }
  },
  plugins: []
}
```

- [ ] **Step 2: 写入 postcss.config.js**

```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {}
  }
}
```

- [ ] **Step 3: 写入 globals.css**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

html, body, #root {
  height: 100%;
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
}
```

---

### Task 1.3: 数据模型（7 实体）

**Files:**
- Create: `ganntlens/src/types/index.ts`

- [ ] **Step 1: 写入 7 实体 TypeScript 接口**

```typescript
export type ProjectStatus = 'planning' | 'active' | 'completed' | 'archived';
export type MilestoneStatus = 'pending' | 'reached' | 'missed';
export type AIProvider = 'mock' | 'openai' | 'deepseek' | 'moonshot' | 'zhipu' | 'MiniMax' | 'mimo' | 'custom';

export interface Project {
  id: string;
  code: string;
  name: string;
  status: ProjectStatus;
  start: string;
  end: string;
  description?: string;
  phases: Phase[];
  milestones: Milestone[];
  tasks: Task[];
  files: FileNode[];
}

export interface Phase {
  id: string;
  name: string;
  color: string;
  order: number;
  planStart: string;
  planEnd: string;
  actualStart?: string;
  actualEnd?: string;
}

export interface Milestone {
  id: string;
  name: string;
  date: string;
  betweenPhases: [string, string];
  status: MilestoneStatus;
}

export interface Task {
  id: string;
  name: string;
  phaseId: string;
  planStart: string;
  planEnd: string;
  actualStart?: string;
  actualEnd?: string;
  progress: number;
  parentId?: string;
  owner?: string;
  fileIds?: string[];
  deliverableIds?: string[];
}

export interface FileNode {
  id: string;
  name: string;
  type: 'folder' | 'file';
  parentId?: string;
  ext?: string;
  size?: number;
  taskIds?: string[];
}

export interface Deliverable {
  id: string;
  name: string;
  taskId: string;
  status: 'pending' | 'in-review' | 'approved';
  criteria?: string[];
}

export interface AINote {
  id: string;
  projectId: string;
  taskId?: string;
  type: 'summary' | 'risk' | 'change' | 'insight';
  content: string;
  createdAt: string;
}
```

---

### Task 1.4: Seed 数据（3 项目）

**Files:**
- Create: `ganntlens/src/lib/seed/seedData.ts`

- [ ] **Step 1: 写入 3 项目 mock 数据**

参考 spec 中的 7 实体结构，按 M-2026 / DC-2026 / OFC-2026 三项目填入，每个项目 3 阶段 + 2 里程碑 + 8-10 任务 + 1 文件树。

```typescript
import type { Project } from '../../types';

// 去敏：所有项目代号 M-2026 / DC-2026 / OFC-2026
// 起始日期 2026-06-20（开工日）
// 今天 = 2026-06-16（演示基线）
export const seedProjects: Project[] = [
  {
    id: 'm-2026',
    code: 'M-2026',
    name: '某博物馆弱电集成',
    status: 'active',
    start: '2026-06-20',
    end: '2026-08-30',
    description: '弱电系统集成 · 安防/广播/网络',
    phases: [
      { id: 'design', name: '前期 · 设计', color: '#dbeafe', order: 1, planStart: '2026-06-20', planEnd: '2026-07-10' },
      { id: 'construction', name: '中期 · 施工', color: '#fef3c7', order: 2, planStart: '2026-07-11', planEnd: '2026-08-15' },
      { id: 'acceptance', name: '后期 · 调试验收', color: '#d1fae5', order: 3, planStart: '2026-08-16', planEnd: '2026-08-30' }
    ],
    milestones: [
      { id: 'm1', name: 'M1 开工', date: '2026-06-20', betweenPhases: ['design', 'construction'], status: 'pending' },
      { id: 'm2', name: 'M2 竣工验收', date: '2026-08-30', betweenPhases: ['construction', 'acceptance'], status: 'pending' }
    ],
    tasks: [
      { id: 't1', name: '方案设计', phaseId: 'design', planStart: '2026-06-20', planEnd: '2026-06-30', progress: 0, owner: '某某' },
      { id: 't2', name: '图纸审核', phaseId: 'design', planStart: '2026-07-01', planEnd: '2026-07-10', progress: 0, owner: '某某' },
      { id: 't3', name: '弱电管线', phaseId: 'construction', planStart: '2026-07-11', planEnd: '2026-07-25', progress: 0, owner: '某某' },
      { id: 't4', name: '设备安装', phaseId: 'construction', planStart: '2026-07-26', planEnd: '2026-08-05', progress: 0, owner: '某某' },
      { id: 't5', name: '系统调试', phaseId: 'construction', planStart: '2026-08-06', planEnd: '2026-08-15', progress: 0, owner: '某某' },
      { id: 't6', name: '验收测试', phaseId: 'acceptance', planStart: '2026-08-16', planEnd: '2026-08-25', progress: 0, owner: '某某' },
      { id: 't7', name: '交付培训', phaseId: 'acceptance', planStart: '2026-08-26', planEnd: '2026-08-30', progress: 0, owner: '某某' }
    ],
    files: [
      { id: 'f1', name: '设计文档', type: 'folder' },
      { id: 'f2', name: '施工图纸.dwg', type: 'file', ext: 'dwg', parentId: 'f1' },
      { id: 'f3', name: '施工方案.docx', type: 'file', ext: 'docx', parentId: 'f1' },
      { id: 'f4', name: '合同', type: 'folder' },
      { id: 'f5', name: '主合同.pdf', type: 'file', ext: 'pdf', parentId: 'f4' },
      { id: 'f6', name: '验收', type: 'folder' },
      { id: 'f7', name: '验收标准.docx', type: 'file', ext: 'docx', parentId: 'f6' }
    ]
  },
  {
    id: 'dc-2026',
    code: 'DC-2026',
    name: '某数据中心机房',
    status: 'active',
    start: '2026-06-25',
    end: '2026-09-10',
    description: '机房弱电 · 综合布线',
    phases: [
      { id: 'design', name: '前期 · 设计', color: '#dbeafe', order: 1, planStart: '2026-06-25', planEnd: '2026-07-15' },
      { id: 'construction', name: '中期 · 施工', color: '#fef3c7', order: 2, planStart: '2026-07-16', planEnd: '2026-08-20' },
      { id: 'acceptance', name: '后期 · 调试验收', color: '#d1fae5', order: 3, planStart: '2026-08-21', planEnd: '2026-09-10' }
    ],
    milestones: [
      { id: 'm1', name: 'M1 开工', date: '2026-06-25', betweenPhases: ['design', 'construction'], status: 'pending' },
      { id: 'm2', name: 'M2 竣工验收', date: '2026-09-10', betweenPhases: ['construction', 'acceptance'], status: 'pending' }
    ],
    tasks: [
      { id: 't1', name: '布线设计', phaseId: 'design', planStart: '2026-06-25', planEnd: '2026-07-10', progress: 0 },
      { id: 't2', name: '设备选型', phaseId: 'design', planStart: '2026-07-05', planEnd: '2026-07-15', progress: 0 },
      { id: 't3', name: '机柜安装', phaseId: 'construction', planStart: '2026-07-16', planEnd: '2026-08-05', progress: 0 },
      { id: 't4', name: '网络调试', phaseId: 'construction', planStart: '2026-08-06', planEnd: '2026-08-20', progress: 0 },
      { id: 't5', name: '验收测试', phaseId: 'acceptance', planStart: '2026-08-21', planEnd: '2026-09-05', progress: 0 }
    ],
    files: []
  },
  {
    id: 'ofc-2026',
    code: 'OFC-2026',
    name: '某办公楼智能化',
    status: 'planning',
    start: '2026-07-01',
    end: '2026-09-30',
    description: '智能楼宇 · BA/IBMS',
    phases: [
      { id: 'design', name: '前期 · 设计', color: '#dbeafe', order: 1, planStart: '2026-07-01', planEnd: '2026-07-25' },
      { id: 'construction', name: '中期 · 施工', color: '#fef3c7', order: 2, planStart: '2026-07-26', planEnd: '2026-09-10' },
      { id: 'acceptance', name: '后期 · 调试验收', color: '#d1fae5', order: 3, planStart: '2026-09-11', planEnd: '2026-09-30' }
    ],
    milestones: [
      { id: 'm1', name: 'M1 开工', date: '2026-07-01', betweenPhases: ['design', 'construction'], status: 'pending' },
      { id: 'm2', name: 'M2 竣工验收', date: '2026-09-30', betweenPhases: ['construction', 'acceptance'], status: 'pending' }
    ],
    tasks: [
      { id: 't1', name: '需求调研', phaseId: 'design', planStart: '2026-07-01', planEnd: '2026-07-15', progress: 0 },
      { id: 't2', name: '方案设计', phaseId: 'design', planStart: '2026-07-10', planEnd: '2026-07-25', progress: 0 }
    ],
    files: []
  }
];
```

---

### Task 1.5: 3 个 Zustand Stores

**Files:**
- Create: `ganntlens/src/store/projectStore.ts`
- Create: `ganntlens/src/store/uiStore.ts`
- Create: `ganntlens/src/store/aiStore.ts`

- [ ] **Step 1: 写入 projectStore.ts**

```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { seedProjects } from '../lib/seed/seedData';
import type { Project, Milestone, Task } from '../types';

interface ProjectState {
  projects: Project[];
  selectedProjectId: string;
  setSelectedProject: (id: string) => void;
  shiftMilestone: (projectId: string, milestoneId: string, days: number) => void;
  updateTaskProgress: (projectId: string, taskId: string, pct: number) => void;
  addTask: (projectId: string, task: Task) => void;
  deleteTask: (projectId: string, taskId: string) => void;
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set) => ({
      projects: seedProjects,
      selectedProjectId: 'm-2026',
      setSelectedProject: (id) => set({ selectedProjectId: id }),
      shiftMilestone: (projectId, milestoneId, days) => set((state) => {
        const projects = state.projects.map((p) => {
          if (p.id !== projectId) return p;
          const ms = p.milestones.find((m) => m.id === milestoneId);
          if (!ms) return p;
          const msDate = new Date(ms.date);
          msDate.setDate(msDate.getDate() + days);
          return {
            ...p,
            milestones: p.milestones.map((m) => 
              m.id === milestoneId ? { ...m, date: msDate.toISOString().split('T')[0] } : m
            )
          };
        });
        return { projects };
      }),
      updateTaskProgress: (projectId, taskId, pct) => set((state) => ({
        projects: state.projects.map((p) => 
          p.id === projectId 
            ? { ...p, tasks: p.tasks.map((t) => t.id === taskId ? { ...t, progress: pct } : t) }
            : p
        )
      })),
      addTask: (projectId, task) => set((state) => ({
        projects: state.projects.map((p) => 
          p.id === projectId ? { ...p, tasks: [...p.tasks, task] } : p
        )
      })),
      deleteTask: (projectId, taskId) => set((state) => ({
        projects: state.projects.map((p) => 
          p.id === projectId ? { ...p, tasks: p.tasks.filter((t) => t.id !== taskId) } : p
        )
      }))
    }),
    { name: 'pm-projects' }
  )
);
```

- [ ] **Step 2: 写入 uiStore.ts**

```typescript
import { create } from 'zustand';

interface UIState {
  drawerOpen: boolean;
  selectedTaskId: string | null;
  selectedProjectId: string | null;
  hoverTaskId: string | null;
  openDrawer: (taskId: string, projectId: string) => void;
  closeDrawer: () => void;
  setHoverTask: (taskId: string | null) => void;
}

export const useUIStore = create<UIState>((set) => ({
  drawerOpen: false,
  selectedTaskId: null,
  selectedProjectId: null,
  hoverTaskId: null,
  openDrawer: (taskId, projectId) => set({ drawerOpen: true, selectedTaskId: taskId, selectedProjectId: projectId }),
  closeDrawer: () => set({ drawerOpen: false }),
  setHoverTask: (taskId) => set({ hoverTaskId: taskId })
}));
```

- [ ] **Step 3: 写入 aiStore.ts（Day 1 只占位）**

```typescript
import { create } from 'zustand';
import type { AIProvider } from '../types';

export interface LLMConfig {
  provider: AIProvider;
  endpoint?: string;
  apiKey?: string;
  model?: string;
}

interface AIState {
  config: LLMConfig;
  messages: Array<{ role: 'user' | 'assistant'; content: string; ts: string }>;
  loading: boolean;
  setConfig: (config: LLMConfig) => void;
  addMessage: (msg: { role: 'user' | 'assistant'; content: string }) => void;
  setLoading: (b: boolean) => void;
}

const defaultConfig: LLMConfig = { provider: 'mock' };

export const useAIStore = create<AIState>()(
  persist(
    (set) => ({
      config: defaultConfig,
      messages: [],
      loading: false,
      setConfig: (config) => set({ config }),
      addMessage: (msg) => set((state) => ({ 
        messages: [...state.messages, { ...msg, ts: new Date().toISOString() }] 
      })),
      setLoading: (b) => set({ loading: b })
    }),
    { name: 'pm-ai-config' }
  )
);
```

---

### Task 1.6: 入口 + 占位 App

**Files:**
- Create: `ganntlens/src/main.tsx`
- Create: `ganntlens/src/App.tsx`

- [ ] **Step 1: 写入 main.tsx**

```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './styles/globals.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
```

- [ ] **Step 2: 写入 App.tsx（占位路由）**

```typescript
import { Routes, Route, Link } from 'react-router-dom';

export default function App() {
  return (
    <div className="h-full bg-gray-50">
      <header className="bg-white border-b px-6 py-3 flex items-center gap-6">
        <h1 className="text-lg font-semibold text-gray-900">GanttLens</h1>
        <nav className="flex gap-4 text-sm">
          <Link to="/" className="text-gray-600 hover:text-gray-900">总览</Link>
          <Link to="/m-2026" className="text-gray-600 hover:text-gray-900">M-2026</Link>
        </nav>
        <span className="ml-auto text-xs text-gray-500">今天 2026-06-16</span>
      </header>
      <main className="p-6">
        <Routes>
          <Route path="/" element={
            <div>
              <h2 className="text-2xl font-semibold mb-4">项目总览</h2>
              <p className="text-gray-600">Day 1 框架跑通 ✓</p>
            </div>
          } />
          <Route path="/:projectId" element={
            <div>
              <h2 className="text-2xl font-semibold mb-4">项目详情</h2>
              <p className="text-gray-600">Day 2 开始渲染甘特图</p>
            </div>
          } />
        </Routes>
      </main>
    </div>
  );
}
```

---

### Task 1.7: 验证

- [ ] **Step 1: typecheck**

Run: `npm run typecheck`
Expected: 0 errors

- [ ] **Step 2: dev 启动**

Run: `npm run dev`
Expected: localhost:5173 启动，总览页显示 "项目总览" 和 "Day 1 框架跑通 ✓"

- [ ] **Step 3: Commit**

```bash
git add ganntlens/
git commit -m "feat(day1): scaffold + types + seed + 3 stores + tailwind"
```

---

## Day 2-7 概要

### Day 2: GanttChart 基础
- GanttChart.tsx（容器，px↔日期工具）
- frappe-gantt spike 验证
- TaskBar.tsx（基础任务条）
- TimelineHeader.tsx
- OverviewPage 渲染 3 项目大甘特

### Day 3: 自定义覆盖层
- PhaseRibbon.tsx（3 色带）
- MilestoneMarker.tsx（◆ 拖拽）
- TodayLine.tsx（红色今天线）
- TaskBar 双轨（计划虚线 / 实际实色）
- ProjectDetailPage 完整可视化

### Day 4: 抽屉 + 文件树
- NodeDrawer.tsx + 4 Tab
- FileTree.tsx（左侧文件结构）
- AppShell 三栏布局整合
- Hover 预览卡

### Day 5: AI 模块
- lib/ai/providers.ts（7 家配置）
- lib/ai/client.ts（OpenAI 兼容协议）
- lib/ai/mockLLM.ts（模式匹配）
- AIChat.tsx + AISettings.tsx
- shiftMilestone 等交互验证

### Day 6: 交互打磨
- 拖拽调试
- 抽屉动画
- localStorage 持久化
- 手动全流程验证

### Day 7: 部署
- README（去敏）
- 3+ 截图
- Vercel 部署
- 论坛帖 + 3+ Session ID

---

**Plan complete and saved to `docs/superpowers/plans/2026-06-16-gantt-project-management-demo.md`.**
