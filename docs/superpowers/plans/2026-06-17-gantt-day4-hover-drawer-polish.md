# D4 GanttLens 精修 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 D3 跑通的「能用」打磨成「丝滑」——总览页清理 + Hover 卡 v8→v9 + 抽屉 v7→v9 动画

**Architecture:** 不引入新依赖。纯 CSS transition + 自写 `useHoverPosition` hook + Zustand 状态机。验证统一走 Playwright Python 脚本（沿用 D1-D3 风格）。

**Tech Stack:** React 18 + TypeScript + Vite + Zustand + Tailwind CSS（CSS 变量走 `:root`）

**Spec:** `docs/superpowers/specs/2026-06-17-gantt-day4-hover-drawer-polish-design.md`

**当前状态：** D3 commit `badd7b2` 基础上做精修。dev server 跑在 http://localhost:5173/。

---

## 文件结构

### 新增
- `ganntlens/src/lib/gantt/useHoverPosition.ts` —— hover 位置 / 延迟 / 边界翻转 hook
- `verify-day4.py` —— Playwright 端到端验证脚本（D1-D3 风格延续）

### 修改
- `ganntlens/src/store/uiStore.ts` —— 加 `hoverSuppressed` 状态
- `ganntlens/src/styles/globals.css` —— 加 `.task-drawer` / `.drawer-backdrop` 过渡类
- `ganntlens/src/components/gantt/HoverPreviewCard.tsx` —— 接收 x/y/visible Props
- `ganntlens/src/components/gantt/TaskBar.tsx` —— 加 150ms 防误触
- `ganntlens/src/components/gantt/GanttChart.tsx` —— TodayLine 单实例化
- `ganntlens/src/components/drawer/TaskDrawer.tsx` —— 改受控 + 状态机
- `ganntlens/src/routes/OverviewPage.tsx` —— 砍左侧 + 接大甘特图 hover
- `ganntlens/src/routes/ProjectDetailPage.tsx` —— 接 v9 hover + 抽屉 isOpen + 遮罩 + ESC

---

## Task 1: uiStore 扩展 hoverSuppressed

**Files:**
- Modify: `ganntlens/src/store/uiStore.ts:1-22`

- [ ] **Step 1: 修改 uiStore.ts**

替换整个文件内容为：

```typescript
import { create } from 'zustand';

interface UIState {
  drawerOpen: boolean;
  selectedTaskId: string | null;
  selectedProjectId: string | null;
  hoverTaskId: string | null;
  /** 抽屉打开时抑制 hover 卡立即隐藏 */
  hoverSuppressed: boolean;
  openDrawer: (taskId: string, projectId: string) => void;
  closeDrawer: () => void;
  setHoverTask: (taskId: string | null) => void;
  setHoverSuppressed: (b: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  drawerOpen: false,
  selectedTaskId: null,
  selectedProjectId: null,
  hoverTaskId: null,
  hoverSuppressed: false,
  openDrawer: (taskId, projectId) =>
    set({ drawerOpen: true, selectedTaskId: taskId, selectedProjectId: projectId, hoverSuppressed: true }),
  closeDrawer: () => set({ drawerOpen: false, hoverSuppressed: false }),
  setHoverTask: (taskId) => set({ hoverTaskId: taskId }),
  setHoverSuppressed: (b) => set({ hoverSuppressed: b })
}));
```

- [ ] **Step 2: 验证 typecheck**

Run: `npm run typecheck`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add ganntlens/src/store/uiStore.ts
git commit -m "feat(d4): uiStore - hoverSuppressed + openDrawer auto-suppress"
```

---

## Task 2: useHoverPosition hook

**Files:**
- Create: `ganntlens/src/lib/gantt/useHoverPosition.ts`

- [ ] **Step 1: 创建 hook 文件**

写入完整内容：

```typescript
import { useEffect, useRef, useState } from 'react';

export interface UseHoverPositionOptions {
  /** 鼠标进入后多少 ms 才显示（默认 250） */
  delayIn?: number;
  /** 鼠标离开后多少 ms 渐隐（默认 100） */
  delayOut?: number;
  /** 卡片离鼠标的水平/垂直偏移（默认 16） */
  offsetX?: number;
  offsetY?: number;
  /** 边界翻转阈值：卡片宽 320 / 高 240 默认 */
  flipThreshold?: { x: number; y: number };
}

export interface HoverPosition {
  /** clientX（视口坐标） */
  x: number;
  y: number;
  visible: boolean;
  /** 抽屉打开时 = true，调用方应立即隐藏 */
  immediate: boolean;
}

const DEFAULTS = {
  delayIn: 250,
  delayOut: 100,
  offsetX: 16,
  offsetY: 16,
  flipThreshold: { x: 340, y: 240 }
};

/**
 * 跟踪 hover 元素位置 + 延迟显示 + 边界翻转
 * - 依赖 ref 指向 hover 触发元素（TaskBar 容器）
 * - 返回的 x/y 是 clientX/clientY（用于 position: fixed）
 * - 边界翻转：右距 < flipThreshold.x → 翻向左；下距 < flipThreshold.y → 翻向上
 */
export function useHoverPosition(
  ref: React.RefObject<HTMLElement>,
  immediate: boolean = false,
  options: UseHoverPositionOptions = {}
): HoverPosition {
  const opts = { ...DEFAULTS, ...options, flipThreshold: { ...DEFAULTS.flipThreshold, ...options.flipThreshold } };
  const [pos, setPos] = useState<HoverPosition>({ x: 0, y: 0, visible: false, immediate });

  const showTimer = useRef<number | null>(null);
  const hideTimer = useRef<number | null>(null);
  const mouseRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const clear = (t: React.MutableRefObject<number | null>) => {
    if (t.current !== null) {
      window.clearTimeout(t.current);
      t.current = null;
    }
  };

  const compute = (mx: number, my: number) => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let x = mx + opts.offsetX;
    let y = my + opts.offsetY;
    if (vw - x < opts.flipThreshold.x) x = mx - opts.flipThreshold.x + 32; // 翻向左
    if (vh - y < opts.flipThreshold.y) y = my - opts.flipThreshold.y + 16; // 翻向上
    return { x, y };
  };

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onEnter = (e: MouseEvent) => {
      if (immediate) return;
      clear(hideTimer);
      mouseRef.current = { x: e.clientX, y: e.clientY };
      const { x, y } = compute(e.clientX, e.clientY);
      showTimer.current = window.setTimeout(() => {
        setPos({ x, y, visible: true, immediate: false });
      }, opts.delayIn);
    };

    const onMove = (e: MouseEvent) => {
      if (immediate) return;
      mouseRef.current = { x: e.clientX, y: e.clientY };
      // mousemove 时取消 show timer 重置（防止快速移动不显示）
      clear(showTimer);
      const { x, y } = compute(e.clientX, e.clientY);
      showTimer.current = window.setTimeout(() => {
        setPos({ x, y, visible: true, immediate: false });
      }, opts.delayIn);
    };

    const onLeave = () => {
      clear(showTimer);
      hideTimer.current = window.setTimeout(() => {
        setPos((p) => ({ ...p, visible: false }));
      }, opts.delayOut);
    };

    el.addEventListener('mouseenter', onEnter);
    el.addEventListener('mousemove', onMove);
    el.addEventListener('mouseleave', onLeave);
    return () => {
      el.removeEventListener('mouseenter', onEnter);
      el.removeEventListener('mousemove', onMove);
      el.removeEventListener('mouseleave', onLeave);
      clear(showTimer);
      clear(hideTimer);
    };
  }, [ref, immediate, opts.delayIn, opts.delayOut, opts.offsetX, opts.offsetY, opts.flipThreshold.x, opts.flipThreshold.y]);

  // 抽屉打开时立即隐藏
  useEffect(() => {
    if (immediate) {
      clear(showTimer);
      clear(hideTimer);
      setPos((p) => ({ ...p, visible: false, immediate: true }));
    }
  }, [immediate]);

  return pos;
}
```

- [ ] **Step 2: 验证 typecheck**

Run: `npm run typecheck`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add ganntlens/src/lib/gantt/useHoverPosition.ts
git commit -m "feat(d4): useHoverPosition hook - delay + boundary flip + immediate"
```

---

## Task 3: HoverPreviewCard 改造支持 v9 Props

**Files:**
- Modify: `ganntlens/src/components/gantt/HoverPreviewCard.tsx:1-286`

- [ ] **Step 1: 修改 Props 接口**

在文件顶部 Props 部分（L4-L9）替换为：

```typescript
interface Props {
  task: Task;
  project: Project;
  rangeStart: string;
  rangeEnd: string;
  /** 鼠标 clientX（v9 跟随用） */
  x: number;
  /** 鼠标 clientY */
  y: number;
  /** 是否可见（v9 延迟显示） */
  visible: boolean;
  /** 抽屉打开时 = true，立即隐藏 */
  immediate: boolean;
}
```

- [ ] **Step 2: 修改函数签名**

替换函数签名（L15）：

```typescript
export function HoverPreviewCard({ task, project, rangeStart, rangeEnd, x, y, visible, immediate }: Props) {
```

- [ ] **Step 3: 包裹最外层容器**

替换最外层 `<div>` 起始（L51-L58），加入 `position: fixed` + 动态 left/top + opacity transition + display 逻辑：

```typescript
  return (
    <div
      style={{
        position: 'fixed',
        left: x,
        top: y,
        width: 320,
        background: 'var(--paper)',
        border: '1.5px solid var(--accent)',
        boxShadow: '6px 6px 0 var(--ink)',
        zIndex: 20,
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? 'auto' : 'none',
        transition: 'opacity 100ms ease-out',
        display: immediate && !visible ? 'none' : 'block'
      }}
    >
```

> 注意：原 v8 的 `zIndex: 20` 和 `boxShadow` 保留；新增 `position: fixed` + `left/top` + `opacity` + `display` 兜底隐藏。

- [ ] **Step 4: 验证 typecheck + dev 跑通**

Run: `npm run typecheck`
Expected: 0 errors

手动：访问 http://localhost:5173/m-2026，hover 一个任务条 —— 应该看不到卡（因为 ProjectDetailPage 还没传 x/y）
预期：页面**不报错**就行

- [ ] **Step 5: Commit**

```bash
git add ganntlens/src/components/gantt/HoverPreviewCard.tsx
git commit -m "feat(d4): HoverPreviewCard v9 - position fixed + x/y/visible/immediate"
```

---

## Task 4: TaskBar 加 150ms 防误触

**Files:**
- Modify: `ganntlens/src/components/gantt/TaskBar.tsx:20-105`

- [ ] **Step 1: 加 useRef + 改 onClick**

替换 import 区域（L1）：

```typescript
import { useRef } from 'react';
import type { Task } from '../../types';
import { rangeToPercent } from '../../lib/gantt/dateUtils';
```

在函数签名内、return 前加入 ref（修改函数体 L20 之后）：

```typescript
export function TaskBar({ task, rangeStart, rangeEnd, onHover, onClick, isHovered, isSelected }: Props) {
  const hoverEnterTime = useRef<number>(0);
  const planPos = rangeToPercent(task.planStart, task.planEnd, rangeStart, rangeEnd);
```

替换 `onMouseEnter` 行为（L37）：

```typescript
      onMouseEnter={(e) => {
        hoverEnterTime.current = Date.now();
        onHover?.(task.id);
      }}
```

替换 `onClick` 行为（L39-L42）：

```typescript
      onClick={(e) => {
        e.stopPropagation();
        // 防误触：hover 后 150ms 内点击视为 hover 误触
        if (Date.now() - hoverEnterTime.current < 150) return;
        onClick?.(task.id);
      }}
```

- [ ] **Step 2: 验证 typecheck**

Run: `npm run typecheck`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add ganntlens/src/components/gantt/TaskBar.tsx
git commit -m "feat(d4): TaskBar - 150ms hover anti-misclick"
```

---

## Task 5: GanttChart TodayLine 单实例化

**Files:**
- Modify: `ganntlens/src/components/gantt/GanttChart.tsx:46-61, 177-186`

- [ ] **Step 1: 顶层 div 加 position: relative**

修改 L46 `<div style={{ position: 'relative' }}>` 的内层 div（保持），**外层加 TodayLine 渲染位置**：

替换 L46-L61：

```typescript
      <div style={{ position: 'relative' }}>
        {projects.map((p, idx) => (
          <ProjectRow
            key={p.id}
            project={p}
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
            today={today}
            isLast={idx === projects.length - 1}
            onTaskClick={onTaskClick}
            onTaskHover={onTaskHover}
            selectedTaskId={selectedTaskId}
            hoveredTaskId={hoveredTaskId}
          />
        ))}
        {/* 共享今天线 - 单实例，跨所有项目行 */}
        <TodayLine today={today} rangeStart={rangeStart} rangeEnd={rangeEnd} />
      </div>
```

- [ ] **Step 2: 删除 ProjectRow 内的 TodayLine**

修改 L177-L186（ProjectRow 的甘特区）：

```typescript
        <PhaseRibbon
          phases={project.phases}
          rangeStart={rangeStart}
          rangeEnd={rangeEnd}
        />
        {project.tasks.map((t) => (
          <TaskBar
            key={t.id}
            task={t}
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
            onHover={(taskId) => onTaskHover?.(project.id, taskId)}
            onClick={(taskId) => onTaskClick?.(project.id, taskId)}
            isHovered={hoveredTaskId === t.id}
            isSelected={selectedTaskId === t.id}
          />
        ))}
        {project.milestones.map((m) => (
          <MilestoneMarker
            key={m.id}
            milestone={m}
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
          />
        ))}
        {/* TodayLine 已上移到顶层，这里删除 */}
```

- [ ] **Step 3: 验证 dev 看红线只有 1 条**

手动：访问 http://localhost:5173/ 总览页
预期：1 条红色今天线贯穿 3 个项目行（之前是 3 条叠在一起）

- [ ] **Step 4: Commit**

```bash
git add ganntlens/src/components/gantt/GanttChart.tsx
git commit -m "fix(d4): GanttChart - TodayLine single instance across project rows"
```

---

## Task 6: OverviewPage 砍左侧 projects 列表

**Files:**
- Modify: `ganntlens/src/routes/OverviewPage.tsx:140-300`

- [ ] **Step 1: 替换三栏布局为双栏**

替换 L140-L300 整段（从 `{/* 三栏布局 */}` 到 `<main>` 之前）为：

```typescript
      {/* 双栏布局：左 0 + 中 GanttChart + 右 280 跨项目面板 */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        {/* 顶部项目切换 chip */}
        <div
          style={{
            display: 'flex',
            gap: 6,
            marginBottom: 12,
            flexWrap: 'wrap'
          }}
        >
          {projects.map((p) => {
            const isActive = p.id === selectedProjectId;
            return (
              <button
                key={p.id}
                onClick={() => setSelectedProject(p.id)}
                data-testid={`project-chip-${p.code}`}
                style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontWeight: 700,
                  fontSize: 11,
                  padding: '4px 10px',
                  border: '1px solid var(--ink-3)',
                  background: isActive ? 'var(--ink)' : 'var(--paper)',
                  color: isActive ? '#fff' : 'var(--ink)',
                  cursor: 'pointer',
                  letterSpacing: '0.05em',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    background: p.status === 'active' ? 'var(--accent)' : '#3b82f6'
                  }}
                />
                {p.code}
              </button>
            );
          })}
        </div>

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

        {/* 右：跨项目面板（保留） */}
        <aside
          style={{
            width: 280,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            flexShrink: 0
          }}
        >
```

- [ ] **Step 2: 验证 dev 看布局**

手动：访问 http://localhost:5173/
预期：左侧 240px 列表消失，顶部多 3 个 chip（M-2026 / DC-2026 / OFC-2026），中间甘特图变宽

- [ ] **Step 3: Commit**

```bash
git add ganntlens/src/routes/OverviewPage.tsx
git commit -m "refactor(d4): OverviewPage - remove left projects list + add top chips"
```

---

## Task 7: OverviewPage 接入大甘特图 hover + v9 卡

**Files:**
- Modify: `ganntlens/src/routes/OverviewPage.tsx:1-12, 41-300`

- [ ] **Step 1: 加 imports**

替换文件顶部 imports（L1-L4）：

```typescript
import { useRef, useState } from 'react';
import { useProjectStore } from '../store/projectStore';
import { useUIStore } from '../store/uiStore';
import { DEMO_TODAY, seedProjects } from '../lib/seed/seedData';
import { GanttChart } from '../components/gantt/GanttChart';
import { HoverPreviewCard } from '../components/gantt/HoverPreviewCard';
import { useHoverPosition } from '../lib/gantt/useHoverPosition';
import { rangeDays } from '../lib/gantt/dateUtils';
```

- [ ] **Step 2: 加 hover state + hook**

在 `OverviewPage` 函数体内、L38 之前（`<div style={{ padding: '0 32px 32px' }}>` 之前）加入：

```typescript
  const hoverSuppressed = useUIStore((s) => s.hoverSuppressed);
  const [hoveredTaskId, setHoveredTaskId] = useState<string | null>(null);
  const [hoveredProjectId, setHoveredProjectId] = useState<string | null>(null);
  const hoverRef = useRef<HTMLDivElement>(null);
  const { x, y, visible, immediate } = useHoverPosition(hoverRef, hoverSuppressed);

  const hoveredProject = hoveredProjectId ? projects.find((p) => p.id === hoveredProjectId) : null;
  const hoveredTask =
    hoveredProject && hoveredTaskId ? hoveredProject.tasks.find((t) => t.id === hoveredTaskId) : null;
```

- [ ] **Step 3: GanttChart 接收 onTaskHover/hoveredTaskId**

修改 L294-L298 附近 `<GanttChart>` 调用：

```typescript
        <main style={{ flex: 1, minWidth: 0 }} ref={hoverRef}>
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
          />
        </main>
```

- [ ] **Step 4: 渲染 HoverPreviewCard**

在 `<aside>` 之后、`</div>` 闭合总览大 div 之前，加入：

```typescript
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
```

- [ ] **Step 5: 验证 dev 测 hover**

手动：访问 http://localhost:5173/，hover 任意任务条
预期：~250ms 后 hover 卡出现在右上方，鼠标移走 100ms 渐隐

- [ ] **Step 6: typecheck**

Run: `npm run typecheck`
Expected: 0 errors

- [ ] **Step 7: Commit**

```bash
git add ganntlens/src/routes/OverviewPage.tsx
git commit -m "feat(d4): OverviewPage - v9 hover card on big gantt"
```

---

## Task 8: ProjectDetailPage 接入 v9 hover 卡

**Files:**
- Modify: `ganntlens/src/routes/ProjectDetailPage.tsx:1-220`

- [ ] **Step 1: 加 useHoverPosition import**

修改 L1-L12 imports：

```typescript
import { useEffect, useRef, useState } from 'react';
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
import { useHoverPosition } from '../lib/gantt/useHoverPosition';
```

- [ ] **Step 2: 接入 v9 hook + 改造 hover state**

替换 L19-L21（L19 `const [hoveredTaskId, ...]`）：

```typescript
  const [hoveredTaskId, setHoveredTaskId] = useState<string | null>(null);
  const hoverSuppressed = useUIStore((s) => s.hoverSuppressed);
  const drawerOpen = useUIStore((s) => s.drawerOpen);
  const drawerTaskId = useUIStore((s) => s.selectedTaskId);
  const drawerProjectId = useUIStore((s) => s.selectedProjectId);
  const openDrawer = useUIStore((s) => s.openDrawer);
  const closeDrawer = useUIStore((s) => s.closeDrawer);
  const ganttRef = useRef<HTMLDivElement>(null);
  const { x, y, visible, immediate } = useHoverPosition(ganttRef, hoverSuppressed);
```

删除 L20 `const [selectedTaskId, setSelectedTaskId] = useState`（改用 store）和 L33 `const drawerOpen = selectedTask !== null` 和 L34 `const selectedTask = selectedTaskId ? project.tasks.find...`。

替换 L32-L34：

```typescript
  const hoveredTask = hoveredTaskId ? project.tasks.find((t) => t.id === hoveredTaskId) : null;
  const selectedTask =
    drawerOpen && drawerProjectId === project.id && drawerTaskId
      ? project.tasks.find((t) => t.id === drawerTaskId)
      : null;
```

- [ ] **Step 3: 替换渲染 hover 卡 + 抽屉**

替换 L178-L205（hover 卡 + drawer 区域）：

```typescript
        {/* Hover 预览卡 v9 - 跟随鼠标 + 边界翻转 */}
        {hoveredTask && !drawerOpen && (
          <HoverPreviewCard
            task={hoveredTask}
            project={project}
            rangeStart={project.start}
            rangeEnd={project.end}
            x={x}
            y={y}
            visible={visible}
            immediate={immediate}
          />
        )}

        {/* 抽屉（始终渲染，isOpen 控制状态机）*/}
        {selectedTask && (
          <TaskDrawer
            task={selectedTask}
            project={project}
            isOpen={drawerOpen}
            onClose={closeDrawer}
          />
        )}
```

- [ ] **Step 4: ganttRef 挂到 main 容器**

修改 L167-L177 甘特区，包裹一层带 ref 的 div：

```typescript
        <div
          ref={ganttRef}
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
            onTaskClick={(taskId) => openDrawer(taskId, project.id)}
            onTaskHover={(taskId) => setHoveredTaskId(taskId)}
            selectedTaskId={drawerTaskId}
            hoveredTaskId={hoveredTaskId}
          />
        </div>
```

- [ ] **Step 5: typecheck + dev 测 hover**

Run: `npm run typecheck`
Expected: 0 errors

手动：访问 http://localhost:5173/m-2026，hover 任务
预期：~250ms 后卡片跟随鼠标出现在右上方，边界附近自动翻向

- [ ] **Step 6: Commit**

```bash
git add ganntlens/src/routes/ProjectDetailPage.tsx
git commit -m "feat(d4): ProjectDetailPage - v9 hover card + ref-based tracking"
```

---

## Task 9: CSS 增加抽屉/遮罩过渡类

**Files:**
- Modify: `ganntlens/src/styles/globals.css:55-end`

- [ ] **Step 1: 加抽屉 + 遮罩 CSS**

在文件末尾加入：

```css
@layer components {
  /* 抽屉滑入/滑出 */
  .task-drawer {
    position: absolute;
    right: 0;
    top: 0;
    bottom: 0;
    width: 420px;
    background: var(--paper);
    border-left: 2px solid var(--ink);
    box-shadow: -8px 0 24px rgba(15, 23, 42, 0.18);
    z-index: 30;
    display: flex;
    flex-direction: column;
    transition: transform 220ms cubic-bezier(0.4, 0, 0.2, 1),
      opacity 220ms ease-out;
  }
  .task-drawer.open {
    transform: translateX(0);
    opacity: 1;
  }
  .task-drawer.closed {
    transform: translateX(100%);
    opacity: 0;
    pointer-events: none;
  }

  /* 抽屉遮罩 */
  .drawer-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.3);
    z-index: 25;
    transition: opacity 200ms ease-out;
  }
  .drawer-backdrop.open {
    opacity: 1;
    pointer-events: auto;
  }
  .drawer-backdrop.closed {
    opacity: 0;
    pointer-events: none;
  }
}

@layer utilities {
  .respect-motion-reduce {
    @media (prefers-reduced-motion: reduce) {
      .task-drawer,
      .drawer-backdrop {
        transition: none;
      }
    }
  }
}
```

- [ ] **Step 2: 验证 dev 跑通（CSS 暂不生效，等 Task 10/11 接入）**

手动：访问 http://localhost:5173/ 看页面无样式破
预期：页面正常，仅抽屉行为还没接入

- [ ] **Step 3: Commit**

```bash
git add ganntlens/src/styles/globals.css
git commit -m "feat(d4): CSS - task-drawer + drawer-backdrop transition classes"
```

---

## Task 10: TaskDrawer 状态机改造

**Files:**
- Modify: `ganntlens/src/components/drawer/TaskDrawer.tsx:5-29, 58-72`

- [ ] **Step 1: 加 isOpen Props + mounted state**

修改 Props 接口（L5-L10）：

```typescript
interface Props {
  task: Task;
  project: Project;
  isOpen: boolean;
  onClose: () => void;
  onAction?: (action: string, task: Task) => void;
}
```

在函数体 `useState` 区域（L30）后加入 mounted + animation 状态：

```typescript
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
```

> 别忘了在 imports 加 `useEffect`：
```typescript
import { useEffect, useState } from 'react';
```

- [ ] **Step 2: 替换最外层 div 绑 class**

替换 L58-L72 最外层 div：

```typescript
  if (!mounted) return null;

  return (
    <aside
      className={`task-drawer ${phase === 'open' || phase === 'opening' ? 'open' : 'closed'}`}
      role="dialog"
      aria-label="任务详情"
      data-testid="task-drawer"
    >
```

- [ ] **Step 3: 验证 typecheck**

Run: `npm run typecheck`
Expected: 0 errors

手动：访问 http://localhost:5173/m-2026，点击任务
预期：抽屉出现（暂不带动画，下一 Task 加），关闭按钮工作

- [ ] **Step 4: Commit**

```bash
git add ganntlens/src/components/drawer/TaskDrawer.tsx
git commit -m "feat(d4): TaskDrawer - isOpen controlled + mount/phase state machine"
```

---

## Task 11: ProjectDetailPage 接入抽屉 isOpen + 遮罩

**Files:**
- Modify: `ganntlens/src/routes/ProjectDetailPage.tsx:198-220`

- [ ] **Step 1: 加遮罩 + 包裹 div**

替换 L198-L205（抽屉渲染区域）：

```typescript
        {/* 抽屉遮罩 */}
        {selectedTask && (
          <div
            className={`drawer-backdrop ${drawerOpen ? 'open' : 'closed'}`}
            onClick={closeDrawer}
            data-testid="drawer-backdrop"
          />
        )}
```

**注意**：这一步需要在 Task 10 渲染 `TaskDrawer` 之前加遮罩 DOM，并保证遮罩在抽屉下面（z-index 25 < 30，已在 CSS 保证）。

- [ ] **Step 2: typecheck + dev 看遮罩**

Run: `npm run typecheck`
Expected: 0 errors

手动：访问 /m-2026 点击任务 → 抽屉滑入，遮罩半透明渐入
预期：220ms 滑入 + 200ms 遮罩渐入；点击遮罩关闭

- [ ] **Step 3: Commit**

```bash
git add ganntlens/src/routes/ProjectDetailPage.tsx
git commit -m "feat(d4): drawer backdrop + 220ms slide-in animation"
```

---

## Task 12: ESC 关闭 + 焦点陷阱

**Files:**
- Modify: `ganntlens/src/routes/ProjectDetailPage.tsx:1-12, 30-40`

- [ ] **Step 1: 加 ESC keydown + 焦点管理**

在 `ProjectDetailPage` 函数体内、`useState` 之后加入：

```typescript
  // ESC 关闭抽屉
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeDrawer();
      }
      // 简单 focus trap：Tab 循环
      if (e.key === 'Tab' && selectedTask) {
        const drawerEl = document.querySelector('[data-testid="task-drawer"]') as HTMLElement | null;
        if (!drawerEl) return;
        const focusables = drawerEl.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    // 自动 focus 关闭按钮
    const t = window.setTimeout(() => {
      const closeBtn = document.querySelector(
        '[data-testid="task-drawer"] button'
      ) as HTMLElement | null;
      closeBtn?.focus();
    }, 250);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.clearTimeout(t);
    };
  }, [drawerOpen, selectedTask, closeDrawer]);
```

- [ ] **Step 2: 验证 ESC + focus**

手动：访问 /m-2026
1. 点击任务 → 抽屉打开，关闭按钮自动 focus
2. 按 ESC → 抽屉关闭
3. 抽屉打开时按 Tab → 焦点在抽屉内循环，不跑到外面

- [ ] **Step 3: Commit**

```bash
git add ganntlens/src/routes/ProjectDetailPage.tsx
git commit -m "feat(d4): ESC to close + focus trap + auto-focus close button"
```

---

## Task 13: Playwright 端到端验证

**Files:**
- Create: `verify-day4.py`（项目根目录，沿用 D1-D3 风格）

- [ ] **Step 1: 创建 verify-day4.py**

写入完整内容：

```python
"""D4 验证脚本：总览清理 + v9 hover + v9 抽屉动画"""
import time
from playwright.sync_api import sync_playwright

URL = "http://localhost:5173"

def main():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        ctx = browser.new_context(viewport={"width": 1440, "height": 900})
        page = ctx.new_page()
        errors = []
        page.on("console", lambda msg: errors.append(f"[{msg.type}] {msg.text}") if msg.type == "error" else None)
        page.on("pageerror", lambda err: errors.append(f"[pageerror] {err}"))

        # ---- 0. 总览页 ----
        page.goto(URL)
        page.wait_for_load_state("networkidle")
        time.sleep(0.5)

        # 0.1 左侧 240px projects aside 应该不存在
        aside_count = page.locator("aside").count()
        assert aside_count == 1, f"expected 1 aside (right panel only), got {aside_count}"

        # 0.2 顶部 3 个项目 chip
        chips = page.locator("[data-testid^='project-chip-']")
        assert chips.count() == 3, f"expected 3 project chips, got {chips.count()}"

        # 0.3 TodayLine 数量 = 1
        today_lines = page.locator(".task-drawer").count()  # 占位，确认组件可查
        # 通过查询 [style*="--today"] 红色元素
        red_lines = page.locator("div[style*='background: var(--today)']").count()
        assert red_lines >= 1, f"expected >=1 red today line, got {red_lines}"

        page.screenshot(path="d4-overview.png", full_page=False)
        print("✓ 0. OverviewPage 验证通过")

        # ---- 1. v9 hover 卡片（大甘特图）----
        # 找第一个任务条
        first_task = page.locator("[title*='→']").first
        first_task.hover()
        time.sleep(0.4)  # 250ms 延迟 + buffer

        # hover 卡应可见
        hover_card_visible = page.evaluate("""() => {
            const cards = document.querySelectorAll('[style*="width: 320px"]');
            for (const c of cards) {
                const op = parseFloat(getComputedStyle(c).opacity);
                if (op > 0) return true;
            }
            return false;
        }""")
        assert hover_card_visible, "hover card not visible on big gantt"
        print("✓ 1. v9 hover card on big gantt works")
        page.screenshot(path="d4-big-gantt-hover.png", full_page=False)

        # 鼠标移走
        page.mouse.move(10, 10)
        time.sleep(0.3)

        # ---- 2. 详情页 hover + 抽屉 ----
        page.goto(f"{URL}/m-2026")
        page.wait_for_load_state("networkidle")
        time.sleep(0.5)

        # 2.1 hover 任务
        task_in_detail = page.locator("[title*='→']").first
        task_in_detail.hover()
        time.sleep(0.4)
        page.screenshot(path="d4-detail-hover.png", full_page=False)

        # 2.2 离开 hover 后点击（防误触 150ms 后才能 click）
        time.sleep(0.2)
        task_in_detail.click()
        time.sleep(0.3)

        # 2.3 抽屉打开
        drawer = page.locator("[data-testid='task-drawer']")
        assert drawer.is_visible(), "drawer not visible after click"
        # 抽屉应有 open class
        has_open = page.evaluate("""() => {
            const d = document.querySelector('[data-testid="task-drawer"]');
            return d && d.className.includes('open');
        }""")
        assert has_open, "drawer missing 'open' class"
        print("✓ 2. drawer opened with open class")
        page.screenshot(path="d4-drawer-open.png", full_page=False)

        # 2.4 遮罩
        backdrop = page.locator("[data-testid='drawer-backdrop']")
        assert backdrop.is_visible(), "backdrop not visible"
        print("✓ 3. backdrop visible")

        # 2.5 ESC 关闭
        page.keyboard.press("Escape")
        time.sleep(0.3)
        # 抽屉应还在 DOM（关闭动画期间）但不带 open class
        drawer_state = page.evaluate("""() => {
            const d = document.querySelector('[data-testid="task-drawer"]');
            return d ? d.className : null;
        }""")
        assert drawer_state and "closed" in drawer_state, f"drawer not closed after ESC, class={drawer_state}"
        print("✓ 4. ESC closes drawer")
        time.sleep(0.3)  # 等动画结束
        page.screenshot(path="d4-drawer-closed.png", full_page=False)

        # 2.6 点击遮罩关闭（重新打开后测试）
        task_in_detail.click()
        time.sleep(0.3)
        backdrop.click()
        time.sleep(0.3)
        drawer_state2 = page.evaluate("""() => {
            const d = document.querySelector('[data-testid="task-drawer"]');
            return d ? d.className : null;
        }""")
        assert drawer_state2 and "closed" in drawer_state2, "backdrop click did not close drawer"
        print("✓ 5. backdrop click closes drawer")

        # ---- 错误检查 ----
        assert len(errors) == 0, f"console errors: {errors}"
        print(f"✓ no console errors")

        browser.close()
        print("\n🎉 D4 全部验证通过")

if __name__ == "__main__":
    main()
```

- [ ] **Step 2: 跑 Playwright**

Run: `py -3 verify-day4.py`
Expected: 全部 ✓ 打印，无 AssertionError

- [ ] **Step 3: 修任何失败的 case**

如果某项失败：
- 看截图定位
- 回到对应 Task 修代码
- 重跑验证

- [ ] **Step 4: Commit**

```bash
git add verify-day4.py d4-*.png
git commit -m "test(d4): Playwright verify - overview cleanup + v9 hover + v9 drawer"
```

---

## Task 14: 提交总览 + 更新 spec 状态

**Files:**
- Modify: `docs/superpowers/specs/2026-06-17-gantt-day4-hover-drawer-polish-design.md:1-7`

- [ ] **Step 1: 标 spec 为 Implemented**

修改 spec 顶部：

```markdown
# GanttLens D4 Design — 总览清理 + Hover/抽屉 精修

> D3 commit `badd7b2` 基础上做的精修。**Status: Implemented (commit 见 git log)**。Plan 总览：`docs/superpowers/plans/2026-06-16-gantt-project-management-demo.md`（D4 概要在此扩展）
```

- [ ] **Step 2: 跑 typecheck 收尾**

Run: `npm run typecheck`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/specs/2026-06-17-gantt-day4-hover-drawer-polish-design.md
git commit -m "docs(d4): mark D4 spec as Implemented"
```

---

## Self-Review Checklist

执行完后确认：

- [ ] 14 个 Task 全部 ✓
- [ ] 13 个 commit 落地（D1 已计入）
- [ ] `npm run typecheck` 0 error
- [ ] `py -3 verify-day4.py` 5+ ✓
- [ ] http://localhost:5173/ 总览页：左侧 0 列表 + 3 chip + 1 红线 + hover 卡跟随
- [ ] http://localhost:5173/m-2026 详情页：hover 卡 v9 跟随 + 抽屉 220ms 滑入 + 遮罩 + ESC 关闭
- [ ] 4 个截图存档（d4-overview / d4-big-gantt-hover / d4-detail-hover / d4-drawer-open / d4-drawer-closed）
- [ ] 暂存的 Session ID 字符串（用户发的那串）确认用途
