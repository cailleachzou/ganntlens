# GanttLens D6 Design — 甘特图拖拽编辑

**Date:** 2026-06-18
**Status:** Implemented (D6 15 task 全部完成, 4 个 verify screenshot 见 git log + verify-day6.py)
**Author:** DUDU & Cailleach
**前置：** D5 commit `4ace3be`（AI Chat Panel + Settings Modal + command engine）

**一句话目标：** 鼠标拖动任务条 / milestone 直接改日期，跟 D5 `/move` 命令形成「**双通道**」——AI 命令后用户可手动微调，用户拖动后可以让 AI 解释这次变更。

---

## 1. 范围

D6 支持三种拖动：

| # | 操作 | 触发方式 | 改的字段 |
|---|------|---------|---------|
| 1 | **移动任务条** | 拖整条 TaskBar（非边缘 6px） | `planStart` + `planEnd` 整体平移 |
| 2 | **改结束** | 拖 TaskBar 右边 6px 手柄 | `planEnd` 变（duration 改） |
| 3 | **改开始** | 拖 TaskBar 左边 6px 手柄 | `planStart` 变（duration 改） |
| 4 | **拖 milestone** | 拖整个 MilestoneMarker | `milestone.date` + 后续级联 |

**留 TODO（不在 D6）**：触屏支持、多选拖动、撤销栈（D7）、拖动时联动 AI 建议。

---

## 2. 架构（4 层）

### 2.1 数据层：projectStore 新增 3 个 action

修改 [projectStore.ts](file:///c:/git-project/TRAE/src/store/projectStore.ts)：

```typescript
// 新增到 ProjectState
moveTask: (projectId: string, taskId: string, newPlanStart: string) => void;
resizeTask: (projectId: string, taskId: string, newStartOrEnd: string, side: 'start' | 'end') => void;
moveMilestone: (projectId: string, milestoneId: string, newDate: string) => void;
```

**联动规则**（实际在 moveTask/resizeTask 内部实现）：

| Task 状态 | 触发条件 | actual 联动 |
|----------|---------|-------------|
| 未开始 `!actualStart` | moveTask / resizeTask | `actualStart` 跟着平移；`actualEnd` 跟着平移 |
| 进行中 `actualStart && !actualEnd && progress < 100` | moveTask | `actualStart` 跟着平移 |
| 进行中 | resizeTask('end') | `actualEnd` 跟着平移 |
| 进行中 | resizeTask('start') | `actualStart` 跟着平移 |
| 已完成 `actualEnd` 有值 | 任意拖动 | **不动**（actual 是历史事实） |

`moveMilestone` 内部调用现有 `shiftMilestone(projectId, milestoneId, days)` —— 跟 D5 `/move` 命令走同一条级联逻辑。

### 2.2 状态层：uiStore 扩展

修改 [uiStore.ts](file:///c:/git-project/TRAE/src/store/uiStore.ts)：

```typescript
export type DragState = {
  type: 'task-move' | 'task-resize-start' | 'task-resize-end' | 'milestone';
  projectId: string;
  /** task id or milestone id */
  id: string;
  /** 拖动期间临时值（不写 store，preview 用） */
  previewStart: string;
  previewEnd: string;
  /** 相对原值的偏移天数（+5 / -3），用于 tooltip */
  daysDelta: number;
  /** 鼠标 clientX，用于 DragPreview 定位 */
  clientX: number;
  clientY: number;
  /** 是否越界（true → cursor not-allowed，松手回弹） */
  outOfBounds: boolean;
} | null;

interface UIState {
  // ... 现有
  dragState: DragState;
  startDrag: (s: DragState) => void;
  updateDrag: (patch: Partial<DragState>) => void;
  endDrag: () => void;
  cancelDrag: () => void;
}
```

### 2.3 Hook 层：useDragController

新增 [src/lib/gantt/useDragController.ts](file:///c:/git-project/TRAE/src/lib/gantt/useDragController.ts)：

```typescript
export interface UseDragControllerOptions {
  /** ref 指向甘特区容器（用于计算像素→百分比） */
  containerRef: React.RefObject<HTMLElement>;
  /** ref 指向触发元素（TaskBar / MilestoneMarker） */
  handleRef: React.RefObject<HTMLElement>;
  /** 拖动类型（决定 cursor 和转换方向） */
  dragType: 'task-move' | 'task-resize-start' | 'task-resize-end' | 'milestone';
  /** range 区间（用于像素→日期换算） */
  rangeStart: string;
  rangeEnd: string;
  /** 当前值（拖动期间作为 baseline） */
  currentStart: string;
  currentEnd: string;
  /** 边界检测回调：返回 { outOfBounds, validStart, validEnd } */
  validate: (proposed: { start: string; end: string }) => { outOfBounds: boolean; validStart: string; validEnd: string };
  /** 拖动期间实时回调（更新 uiStore.dragState） */
  onDrag: (preview: { start: string; end: string; daysDelta: number; outOfBounds: boolean; clientX: number; clientY: number }) => void;
  /** 拖动结束（commit store action） */
  onCommit: (final: { start: string; end: string }) => void;
}
```

**实现要点**：
- `mousedown` 时记录 `startX` + `baselineStart`/`baselineEnd` + `isDragging = true`
- `mousemove`（监听 `window` 防止出容器）：`deltaPx → deltaDays → proposedStart/End → validate → onDrag`
- `mouseup`（监听 `window`）：`isDragging=false` + `onCommit`（如果 !outOfBounds）
- 越界：`validate` 返回 `outOfBounds=true` → `onDrag` 不更新 preview + `onCommit` 调 `cancelDrag()`
- mouseup 在 window 外：监听 `document.addEventListener('mouseup')` 兜底
- 拖动期间 `drawerOpen=true` / AI 命令触发 → `cancelDrag`

### 2.4 组件层

#### TaskBar 改造

[TaskBar.tsx](file:///c:/git-project/TRAE/src/components/gantt/TaskBar.tsx)：
- 整条 = move handle（cursor: grab）
- 左右各 6px = resize handle（cursor: ew-resize）
- 接收 `onDragStart(type, baseline)` 回调
- 拖动态：opacity 0.85 + outline 2px solid var(--accent) + zIndex 10

#### MilestoneMarker 改造

[MilestoneMarker.tsx](file:///c:/git-project/TRAE/src/components/gantt/MilestoneMarker.tsx)：
- 整块 = move handle（cursor: grab）
- 接收 `onDragStart(type, baseline)` 回调
- 拖动态：同 TaskBar 描边

#### DragPreview 浮层

新增 [src/components/gantt/DragPreview.tsx](file:///c:/git-project/TRAE/src/components/gantt/DragPreview.tsx)：
- `position: fixed`，跟随 `dragState.clientX/Y`
- 右上角小方块：JetBrains Mono 11px，硬边 1.5px solid var(--ink)
- 内容：`+7d → 6-25`（移动）/ `+5d (6-30)`（resize 改结束）/ `M1 → 6-30`（milestone）
- 越界时：红底白字 + `not-allowed` 字样

---

## 3. 边界规则

### 3.1 硬边界（cursor: not-allowed，松手回弹）

| 规则 | 适用 |
|------|------|
| `task.start ≥ phase.planStart` | moveTask / resizeTask('start') |
| `task.end ≤ phase.planEnd` | moveTask / resizeTask('end') |
| 同一 phase 内 task 之间不重叠 | moveTask / resizeTask |
| `project.start ≤ milestone.date ≤ project.end` | moveMilestone |

### 3.2 级联（仅 milestone）

- `moveMilestone` 内部调 `shiftMilestone(projectId, milestoneId, days)`，复用 D5 已有的级联逻辑
- 拖 task **不**级联其他 task（避免连锁反应）

### 3.3 联动 plan/actual

见 §2.1 表格。**关键不变量**：completed task 的 actual 是历史，不动。

---

## 4. 拖动期间视觉

### 4.1 实时跟随

- TaskBar / MilestoneMarker 拖动态：
  - `opacity: 0.85`
  - `outline: 2px solid var(--accent)`（hover 时的 box-shadow 改 outline，避免 layout shift）
  - `zIndex: 10`
- 越界：
  - `cursor: not-allowed`
  - outline 颜色 `var(--today)` 红色

### 4.2 DragPreview 浮层

- 位置：`position: fixed`，跟随鼠标右上 16px 偏移
- 样式：硬边 Blueprint 风
  - background: `var(--paper)`（正常）/ `var(--today)` 红底（越界）
  - border: 1.5px solid var(--ink)
  - font: JetBrains Mono 11px / 700
  - padding: 4px 8px
- 内容（不同时刻动态切换）：
  - task-move: `+7d → 6-25`（含 start/end 改动）
  - task-resize-end: `+5d (6-30 → 7-5)`
  - milestone: `M1 → 6-30`

### 4.3 联动预览（不写 store，只 preview）

- 拖 planStart 时，actualStart 虚线 ghost 跟着移
- 拖 planEnd 时，actualEnd 虚线 ghost 跟着移
- 实现：在 TaskBar 内根据 `dragState` 计算 ghost 位置

---

## 5. 错误处理

| 情况 | 处理 |
|------|------|
| mouseup 在 window 外 | 监听 `document.addEventListener('mouseup')` 兜底 |
| 拖动期间打开抽屉 | drawer open 触发 `cancelDrag()` + preview 回滚 |
| 拖动期间 AI 命令触发 | 命令开始时 `cancelDrag()`，避免 store 竞态 |
| 越界拖动 | `dragState.preview` 不更新 + mouseup 时 store action 不触发，直接 `cancelDrag()` |
| 鼠标快速多次点击 | mousedown 后 150ms 内不进入 drag 模式（沿用 D4 防误触） |
| 拖动期间页面 unload | `beforeunload` 提示「拖动未保存」 |

---

## 6. 测试矩阵（Playwright `verify-day6.py`）

| # | 场景 | 验证点 |
|---|------|--------|
| 1 | 拖任务条 move | planStart + planEnd 同步 +N 天；actualStart 跟着平移（in-progress task） |
| 2 | 拖右边手柄 resize | planEnd 变；planStart 不动 |
| 3 | 拖 milestone | milestone.date 变 + 后续 task/milestone 级联（与 /move M1 +7d 行为一致） |
| 4 | 越界 | cursor not-allowed + 松手回弹（store 不变） |
| 5 | 联动 actual | in-progress task 拖 planStart → actualStart 跟着；completed task 拖 plan → actual 不动 |
| 6 | drag + drawer 冲突 | 抽屉打开时 drag 取消 |
| 7 | 拖左边手柄 resize | planStart 变；planEnd 不动 |
| 8 | DragPreview 浮层 | 拖动期间浮层显示 +7d / → 6-25 / 越界时红底 |

---

## 7. 风险与边界

| 风险 | 处理 |
|------|------|
| 拖动期间 AI 命令竞态 | zustand 同步 set，命令开始前 `cancelDrag()` |
| 跨项目拖动 | D6 不支持，`dragState.projectId` 限定单 project |
| 触屏 / 移动端 | D6 不支持，hover tooltip 加「桌面端限定」提示 |
| 撤销栈 | D6 不做，D7 上 zundo 覆盖所有 store mutation |
| 拖动期间性能（mousemove 60fps） | 用 `requestAnimationFrame` 节流 updateDrag（已有 hook 内部实现） |
| 持久化 | projectStore 已有 zustand persist，拖动结束后自动写 localStorage |

---

## 8. 不在 D6 范围

明确划线，避免 scope creep：
- 触屏 / pointer events
- 多选拖动
- 撤销 / 重做（zundo）
- 拖动时实时 AI 建议（"这个变更对项目的影响"）
- 拖动 actual 单独手柄（plan 联动 actual 已经够用）

---

## 9. 实施 Plan 概要（待 writing-plans 展开）

预计 14 个 Task：

1. projectStore：moveTask / resizeTask / moveMilestone action + actual 联动逻辑
2. projectStore：moveMilestone 内部调 shiftMilestone 复用级联
3. uiStore：dragState + startDrag/updateDrag/endDrag/cancelDrag
4. useDragController hook：mousedown/move/up + 像素→日期 + 越界检测
5. useDragController：document mouseup 兜底 + drawer open 取消
6. dateUtils：pixelToDate 工具（新增）
7. TaskBar：拆分 move / resize-start / resize-end handle + cursor 切换
8. TaskBar：拖动态 outline / opacity / zIndex
9. MilestoneMarker：拖动 handle + 拖动态样式
10. DragPreview 浮层组件
11. ProjectGantt / GanttChart：接入 useDragController + 透传给 TaskBar / MilestoneMarker
12. CSS：拖动态类 / DragPreview 浮层样式
13. Playwright verify-day6.py：8 个场景
14. 提交总览 + 截图

---

**Spec complete. D6 实施进入 plan 阶段。**
