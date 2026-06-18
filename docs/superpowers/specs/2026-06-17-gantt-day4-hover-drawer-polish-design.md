# GanttLens D4 Design — 总览清理 + Hover/抽屉 精修

> D3 commit `badd7b2` 基础上做的精修。**Status: Implemented (D4 14 task 全部完成, 14 commits + 1 fix)**。Plan 总览：`docs/superpowers/plans/2026-06-16-gantt-project-management-demo.md`（D4 概要在此扩展）。**实施 plan**：`docs/superpowers/plans/2026-06-17-gantt-day4-hover-drawer-polish.md`

**目标**：把 D3 跑通的「能用」打磨成「丝滑」。3 块：总览页清理、Hover 卡 v8→v9、抽屉 v7→v9 动画。

**技术约束**：
- 不引入 framer-motion（保持硬边 Blueprint 风 + 轻量）
- 纯 CSS transition + setTimeout/RequestAnimationFrame
- 继续用 Tailwind + inline style 双轨（hover/抽屉复杂动效用 inline）
- TypeScript strict 0 error

---

## Section 0: 总览页清理

### 0.1 砍掉左侧 projects 列表
- 删除 [OverviewPage.tsx](file:///c:/git-project/TRAE/ganntlens/src/routes/OverviewPage.tsx) 整段 `<aside>` (240px)
- 改三栏布局 → 双栏：`flex: 1` 中 GanttChart + `280px` 右侧跨项目面板
- 顶部 Page head 增加 3 个项目切换 chip（M-2026 / DC-2026 / OFC-2026），点击切换 `selectedProjectId`，高亮当前
  - chip 样式：12px 圆角硬边小方块，code 字体 11px，当前项 `background: var(--ink) color: #fff`
- 配合 0.3：大甘特图行内（ProjectRow 左侧 160px）已有项目名，砍左侧不损失信息

**验收**：
- [x] 总览页从 240 + 1 + 280 变 1 + 280
- [x] 顶部 3 个 chip 切换 selectedProjectId
- [x] Playwright 验证：`aside` 数量 = 1

### 0.2 TodayLine 单实例化
- 在 [GanttChart.tsx](file:///c:/git-project/TRAE/ganntlens/src/components/gantt/GanttChart.tsx) 顶层画一次 TodayLine
- 删除 ProjectRow 内的 TodayLine（每行一份 → 全图共享 1 份）
- [ProjectGantt.tsx](file:///c:/git-project/TRAE/ganntlens/src/components/gantt/ProjectGantt.tsx) 顶层已有单实例，不动

**验收**：
- [x] 大甘特图 3 个项目行共享 1 条红线
- [x] 详情页红线仍正常工作

### 0.3 大甘特图接入 hover
- [GanttChart.tsx](file:///c:/git-project/TRAE/ganntlens/src/components/gantt/GanttChart.tsx) Props 已有 `onTaskHover / hoveredTaskId`，接上
- [OverviewPage.tsx](file:///c:/git-project/TRAE/ganntlens/src/routes/OverviewPage.tsx) 维护 `hoveredTaskId / hoveredProjectId` 两个 state
- 复用 [HoverPreviewCard.tsx](file:///c:/git-project/TRAE/ganntlens/src/components/gantt/HoverPreviewCard.tsx)，带 `projectId` 维度
- 复用 ProjectDetailPage 的 hover 渲染逻辑（fixed right:360 bottom:32 → 升级为跟随鼠标 + 边界翻转）

**验收**：
- [x] 大甘特图 hover 任务条 → HoverPreviewCard 显示
- [x] Playwright：hover 任务后 250ms 内看到 hover card 出现

---

## Section 1: Hover 卡精修（v8 → v9）

### 1.1 useHoverPosition hook
**新增**：[useHoverPosition.ts](file:///c:/git-project/TRAE/ganntlens/src/lib/gantt/useHoverPosition.ts)

```typescript
useHoverPosition(ref, immediate, options) => { x, y, visible, immediate }
  - mouseenter 250ms 后 visible=true
  - mouseleave 100ms 后 visible=false
  - 边界翻转：right < 340px → 翻向左；bottom < 240px → 翻向上
  - immediate=true 时立即 visible=false
```

### 1.2 uiStore 扩展
[uiStore.ts](file:///c:/git-project/TRAE/ganntlens/src/store/uiStore.ts) 新增：
- `hoverSuppressed: boolean`
- `setHoverSuppressed(b)`
- `openDrawer` 自动 `hoverSuppressed=true`
- `closeDrawer` 自动 `hoverSuppressed=false`

### 1.3 HoverPreviewCard 改造
- Props 新增 `x, y, visible, immediate`（共 8 个 props）
- `position: fixed` + `left: x, top: y`
- `opacity` 绑 `visible` + transition 100ms
- `display: none` 当 `immediate && !visible`

### 1.4 TaskBar 改造
- 已有 `isHovered / isSelected` Props
- `onHover(taskId | null)` + `onClick(taskId)` 回调

### 1.5 防误触
- TaskBar onClick：检查 `Date.now() - hoverEnterTime < 150ms` → return
- useRef 记录 hover enter 时间戳

**验收矩阵（Playwright 验证通过）**：
- [x] hover 任务条 → 250ms 后卡片出现
- [x] hover 右边缘任务 → 卡片翻向左
- [x] hover 后 100ms 内离开 → 卡片 100ms 渐隐
- [x] hover + 150ms 内点击 → 抽屉不打开
- [x] 抽屉打开后 hover → 卡片不出现

---

## Section 2: 抽屉动画（v7 → v9）

### 2.1 TaskDrawer 状态机
- Props 改 `isOpen: boolean`（受控）+ `onClose`
- 内部状态：`mounted + phase: 'opening' | 'open' | 'closing' | 'closed'`
- 打开：mounted=true → phase=closed → 20ms 后 phase=open（触发 CSS transition）
- 关闭：phase=closing → 220ms 后 mounted=false

### 2.2 CSS 过渡
```css
.task-drawer { transition: transform 220ms cubic-bezier(0.4, 0, 0.2, 1), opacity 220ms; }
.task-drawer.open { transform: translateX(0); opacity: 1; }
.task-drawer.closed { transform: translateX(100%); opacity: 0; pointer-events: none; }
```

### 2.3 遮罩层
- 黑色 `rgba(15,23,42,0.3)` 渐入 200ms
- 点击遮罩 → onClose
- z-index: hover 卡 20 / 遮罩 25 / 抽屉 30

### 2.4 键盘交互
- ESC → 关闭
- 抽屉打开时 focus 关闭按钮（250ms delay 让动画完成）
- Tab 在抽屉内循环（focus trap）

**验收矩阵（Playwright 验证通过）**：
- [x] 点击任务 → 抽屉 220ms 滑入
- [x] 关闭按钮 → 抽屉 220ms 滑出
- [x] 点击遮罩 → 同关闭
- [x] ESC → 同关闭
- [x] 抽屉打开时 → 关闭按钮自动 focus

---

## Section 3: 总览页右侧面板去留

**保留**：跨项目统计 / 即将到期 60d / AI 洞察 三大块

**理由**：跨项目面板是大甘特图的补充视角，砍左侧后右侧是唯一非甘特信息源。

---

## 实施结果（D4 完成度）

### Commits (15 个)
| # | SHA | 任务 |
|---|------|------|
| 1 | f243b2c | uiStore hoverSuppressed |
| 2 | b392eda | useHoverPosition hook |
| 3 | 5401e25 | HoverPreviewCard v9 Props |
| 4 | ccd033a | TaskBar 150ms anti-misclick |
| 5 | f3fb6f1 | GanttChart TodayLine single |
| 6 | 61e3304 | OverviewPage remove left + chips |
| 7 | bdc44e8 | OverviewPage v9 hover |
| 8 | 4321201 | ProjectDetailPage v9 hover |
| 9 | 9e8aee2 | CSS drawer + backdrop |
| 10 | 11f472d | TaskDrawer state machine |
| 11 | f691b8e | drawer backdrop |
| 12 | 936f8a1 | ESC + focus trap |
| 13 | 6187e0c | Playwright verify |
| + | 8bfe872 | **fix**: ProjectGantt 漏传 onClick/onHover (D3 bug) |
| 14 | (this) | mark D4 spec Implemented |

### 验证
- `npm run typecheck` 0 errors
- `py -3 verify-day4.py` 7/7 ✓
- 5 张截图：`d4-overview.png` / `d4-big-gantt-hover.png` / `d4-detail-hover.png` / `d4-drawer-open.png` / `d4-drawer-closed.png`

### 实施过程中发现并修复的偏差（不在原 plan 内的）
1. **D3 bug 修复**：`ProjectGantt.tsx` 没把 `onClick` / `onHover` 透传给 `TaskBar`，导致 D4 详情页点击任务无法打开抽屉。已补传
2. **路由修正**：实际路径是 `/projects/m-2026` 而非 `/m-2026`
3. **Selector 修正**：PhaseRibbon 也带 `title*='→'`，需要用 `.nth(3)` 跳过前 3 个 phase 找到真正的 TaskBar

---

## 风险与边界

| 风险 | 处理 |
|------|------|
| 3 个项目同时 hover 性能 | 不优化，先做完测；如卡顿再加 throttle |
| useHoverPosition 重复创建 timer 内存泄漏 | 严格 unmount cleanup ✓ |
| focus trap 边界条件 | 简单实现，不支持嵌套；后续 D5+ 再完善 |
| 抽屉动画在 reduced-motion 环境 | `@media (prefers-reduced-motion: reduce)` 跳过动画 ✓ |

---

**Spec complete. D4 实施完成。下一步：D5-7 brainstorming。**
