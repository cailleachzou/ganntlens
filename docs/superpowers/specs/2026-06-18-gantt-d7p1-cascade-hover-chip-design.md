# D7.1 甘特图三修 — 拖拽级联 / Hover 高亮 / 冗余 Chip

**Date:** 2026-06-18
**Status:** Draft
**Author:** DUDU & Cailleach
**前置：** D7 commit `c85ba69`（build hang 修复后）

**三件事一句话：**
1. 里程碑拖拽改成"总工期锁死"级联——M1 移压缩/扩散设计↔施工，M2 移压缩/扩散施工↔验收
2. Hover 高亮 bug——只比 taskId 不比 projectId，导致跨项目同 ID 条全亮
3. 删冗余——OverviewPage 底部的项目切换 chip 行（顶部黑条已有）

---

## 1. 拖拽级联（总工期锁死模型）

### 1.1 现状问题

当前 [projectStore.ts:84-99](file:///c:/git-project/TRAE/src/store/projectStore.ts#L84-L99) 的 `shiftMilestone`：M1 移 → M1 及之后所有里程碑 + 任务全跟着移相同天数。**总工期会变**。

### 1.2 目标行为

**总工期锁死**：项目 `start` 和 `end` 不变，M1/M2 移动只重新分配相邻阶段的时长。

**阶段定义**（现有 3 阶段）：
- 设计（design）：project.start → M1
- 施工（construction）：M1 → M2
- 验收（acceptance）：M2 → project.end

**M1 移动规则**：

| 方向 | 设计阶段 | 施工阶段 | 验收阶段 | 项目 start/end |
|------|----------|----------|----------|----------------|
| 往前（左移 N 天） | 压缩 N 天 | 扩散 N 天 | 不动 | 不动 |
| 往后（右推 N 天） | 扩散 N 天 | 压缩 N 天 | 不动 | 不动 |

**M2 移动规则**：

| 方向 | 设计阶段 | 施工阶段 | 验收阶段 | 项目 start/end |
|------|----------|----------|----------|----------------|
| 往前（左移 N 天） | 不动 | 压缩 N 天 | 扩散 N 天 | 不动 |
| 往后（右推 N 天） | 不动 | 扩散 N 天 | 压缩 N 天 | 不动 |

### 1.3 边界约束

- **禁止越过 project.start**：M1 往前移不能让设计阶段 < 0 天。如果 M1 新位置 ≤ project.start，**clamp 到 project.start + 1 天**（设计至少留 1 天）
- **禁止越过 M2**：M1 往后移不能撞 M2。如果 M1 新位置 ≥ M2，**clamp 到 M2 - 1 天**
- **禁止越过 M1**：M2 往前移不能撞 M1。clamp 到 M1 + 1 天
- **禁止越过 project.end**：M2 往后移不能让验收阶段 < 0 天。clamp 到 project.end - 1 天

### 1.4 任务联动

阶段内的任务跟着阶段边界走：
- **设计阶段任务**：planStart/planEnd 在 project.start ~ M1 之间的，整体跟随 M1 移动方向平移（保持任务相对位置）
- **施工阶段任务**：在 M1 ~ M2 之间的，跟随 M1 和 M2 的净位移
- **验收阶段任务**：在 M2 ~ project.end 之间的，跟随 M2 移动方向平移

**简化实现**：任务按 `task.planStart` 判断属于哪个阶段，然后：
- 设计阶段任务：跟随 M1 的位移（M1 左移 N 天 → 设计任务也左移 N 天，但 clamp 不超 project.start）
- 施工阶段任务：跟随 (M1 位移 + M2 位移) / 2？还是跟随 M1 位移？

**决策**：施工阶段任务跟随 **M1 的位移**（M1 是施工起点，M2 不动时施工任务跟着起点走）。M2 移动时施工任务跟随 **M2 的位移**（M2 是施工终点）。两个都移时取 **M1 位移**（起点优先）。

### 1.5 阶段色带同步（关键）

**现状 bug**：[PhaseRibbon.tsx:26](file:///c:/git-project/TRAE/src/components/gantt/PhaseRibbon.tsx#L26) 读 `p.planStart / p.planEnd` 渲染阶段背景色带。但当前 `moveMilestone` 只改 `milestones` 数组，**不同步更新 `phases` 数组的 planStart/planEnd** → 拖 M1 时阶段色带不动。

**修复**：`rebalancePhases` 必须同时更新 `phases` 数组的边界：
- 设计阶段：`planStart = project.start`，`planEnd = M1 新位置`
- 施工阶段：`planStart = M1 新位置`，`planEnd = M2 位置`
- 验收阶段：`planStart = M2 位置`，`planEnd = project.end`

这样 PhaseRibbon 自动跟着重算宽度。

### 1.6 实际完工保护

**规则**：M1 不能往前拖过"设计阶段已实际完工的点"。

**具体**：
- 找设计阶段所有 `actualEnd` 存在的任务，取**最晚的 actualEnd** 作为 `designActualEnd`
- M1 往前移时，新位置不能 < `designActualEnd`（否则把已完工的工程挤没了）
- 如果新位置 ≤ `designActualEnd`，**clamp 到 `designActualEnd` + 1 天**

**M2 同理**：
- 找施工阶段所有 `actualEnd` 存在的任务，取最晚 actualEnd 作为 `constructionActualEnd`
- M2 往前移不能 < `constructionActualEnd` + 1 天

**往后移不需要保护**（往后移只会扩散阶段，不会压缩已完工部分）。

### 1.7 实现位置

改 [projectStore.ts](file:///c:/git-project/TRAE/src/store/projectStore.ts) 的 `moveMilestone` action。当前实现调 `shiftMilestone`（全平移），改成新的 `rebalancePhases` 逻辑——同时更新 milestones + phases + tasks。

---

## 2. Hover 高亮 Bug

### 2.1 现状

[GanttChart.tsx:137](file:///c:/git-project/TRAE/src/components/gantt/GanttChart.tsx#L137)：
```typescript
isHovered={hoveredTaskId === t.id}
```

`hoveredTaskId` 只存 taskId，不存 projectId。三个项目有同 ID 的任务（如"方案设计"）→ 全亮。

### 2.2 修复

`hoveredTaskId` 改成 `hoveredTaskKey: string`（格式 `${projectId}:${taskId}`），或者加 `hoveredProjectId: string | null`。

**决策**：用复合 key `${projectId}:${taskId}`，改动最小。

涉及文件：
- [GanttChart.tsx](file:///c:/git-project/TRAE/src/components/gantt/GanttChart.tsx) — Props 加 `hoveredProjectId`，`isHovered` 判断改成 `hoveredProjectId === project.id && hoveredTaskId === t.id`
- [OverviewPage.tsx](file:///c:/git-project/TRAE/src/routes/OverviewPage.tsx) — `onTaskHover` 回调存 `{projectId, taskId}` 或复合 key
- [ProjectDetailPage.tsx](file:///c:/git-project/TRAE/src/routes/ProjectDetailPage.tsx) — 同理（单项目时 projectId 固定）

---

## 3. 删冗余 Chip 行

### 3.1 现状

[OverviewPage.tsx:164-195](file:///c:/git-project/TRAE/src/routes/OverviewPage.tsx#L164-L195) 有一行项目切换 chip（M-2026 / DC-2026 / OFC-2026）。顶部黑条（Layout header）已有项目切换。重复。

### 3.2 修复

删掉 OverviewPage 的 chip 行（164-195 行）。甘特图占满全宽。

---

## 4. 删 AI · INSIGHT 提示卡片

### 4.1 现状

[OverviewPage.tsx:397-412](file:///c:/git-project/TRAE/src/routes/OverviewPage.tsx#L397-L412) 有个静态提示卡片：
```
AI · INSIGHT
👉 在右侧 AI 面板里和 AI 对话 — 跨项目调整、生成周报、检测冲突
```

纯文案占位，无实际功能。右侧已有 AIChatPanel，这个提示多余。

### 4.2 修复

删掉这个 `<div>` 块（397-412 行）。如果它在 `<aside>` 里且 aside 没其他内容，整个 aside 一起删，让 AIChatPanel 占满右侧。

---

## 5. 首页甘特图时间轴 padding 收紧

### 5.1 现状

[OverviewPage.tsx:17-20](file:///c:/git-project/TRAE/src/routes/OverviewPage.tsx#L17-L20)：
```typescript
const allStarts = projects.map((p) => p.start);
const allEnds = projects.map((p) => p.end);
const rangeStart = allStarts.sort()[0];
const rangeEnd = allEnds.sort().reverse()[0];
```

`rangeStart = 所有项目最早的 start`，`rangeEnd = 所有项目最晚的 end`。但项目 start/end 本身可能离实际任务很远（如 m-2026 start=3-24 但第一个任务 4-15 开始），导致前后大片空位（约两个月）。

### 5.2 修复

改成基于**实际任务的最早 planStart 和最晚 planEnd**计算范围，再各加 30 天 padding：

```typescript
const allTaskStarts = projects.flatMap((p) => p.tasks.map((t) => t.planStart));
const allTaskEnds = projects.flatMap((p) => p.tasks.map((t) => t.planEnd));
const earliestTask = allTaskStarts.sort()[0];
const latestTask = allTaskEnds.sort().reverse()[0];
const rangeStart = shiftDate(earliestTask, -30);  // 前 30 天
const rangeEnd = shiftDate(latestTask, 30);        // 后 30 天
```

这样时间轴紧贴实际任务范围 + 前后各 30 天缓冲，不再有大片空位。

---

## 6. 甘特条前加项目名标签

### 6.1 现状

[GanttChart.tsx:114](file:///c:/git-project/TRAE/src/components/gantt/GanttChart.tsx#L114) 注释写着"去掉项目名侧列，TimelineHeader 占满 100% 宽"。首页甘特图三个项目的甘特条堆叠，但**没有项目名标签**，分不清哪条是哪个项目。

### 6.2 修复

在 `ProjectRow` 的甘特区左侧加一个固定宽度的项目名标签列：

```typescript
<div style={{ width: 80, flexShrink: 0, ... }}>
  {project.code}
</div>
<div ref={containerRef} style={{ flex: 1, ... }}>
  {/* 甘特区 */}
</div>
```

- 显示 `project.code`（如 M-2026 / DC-2026 / OFC-2026），紧凑
- 固定 80px 宽，不影响甘特区
- 字体 JetBrains Mono，小号

---

## 7. 落地清单

### 修改
- `src/store/projectStore.ts` — `moveMilestone` 改 `rebalancePhases` 逻辑（总工期锁死 + clamp + phases 同步 + 实际完工保护）
- `src/components/gantt/GanttChart.tsx` — `isHovered` 加 projectId 判断 + ProjectRow 加项目名标签列
- `src/routes/OverviewPage.tsx` — 删 chip 行 + 删 AI · INSIGHT 卡片 + hover state 改复合 key + rangeStart/rangeEnd 改任务范围 + 30 天 padding
- `src/routes/ProjectDetailPage.tsx` — hover state 改复合 key（如果也用了）

### 不变
- D6 拖拽 hook（`useDragController`）
- D7 dev-server / apiClient / SSE
- AI plan 模式

### 验证
- 拖 M1 往前 → 设计压缩 + 施工扩散 + 验收不动 + 总工期不变
- 拖 M1 撞 project.start → clamp
- Hover 一个项目的"方案设计" → 只亮那一条
- OverviewPage 底部无 chip 行

---

## 5. 风险

| 风险 | 缓解 |
|------|------|
| `rebalancePhases` 逻辑复杂算错 | 写 unit test 覆盖 4 种方向 + 4 种 clamp |
| 任务跨阶段边界（planStart 在 M1 前，planEnd 在 M1 后） | 按 planStart 归属阶段，不拆分 |
| Hover 复合 key 漏改某处 | typecheck + 手动验证 |
