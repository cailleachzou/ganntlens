# GanttLens 审查报告严重问题修复

> 日期：2026-06-22
> 来源：ganntlens-review.md §四 🔴 严重
> 状态：Spec

## 1. 任务条显示名称（#1）

### 1.1 现状

[TaskBar.tsx:206-323](file:///c:/git-project/TRAE/src/components/gantt/TaskBar.tsx#L206-L323) — 任务条只有 HTML `title` tooltip，没有可见文字。移动端/触屏无 hover，用户完全看不到任务名。

### 1.2 修复

在 TaskBar 的实际条（actual bar）上方叠加任务名文字，条件渲染：

```typescript
{planPos.width > 8 && (
  <div
    style={{
      position: 'absolute',
      top: 2,
      left: 4,
      fontFamily: 'Inter, sans-serif',
      fontSize: 10,
      fontWeight: 600,
      color: 'var(--ink)',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      pointerEvents: 'none',
      zIndex: 3,
      opacity: isHovered || isSelected ? 1 : 0.7
    }}
  >
    {task.name}
  </div>
)}
```

- 条宽度 > 8% 才显示（太窄放不下字）
- `pointerEvents: none` 不挡拖拽 handle
- hover/selected 时 opacity 提升到 1
- 桌面 + 移动都能看到

### 1.3 不做

- 不加任务名列（overview 每行多任务重叠，列对不齐）
- 不加移动端专属逻辑（文字叠加已覆盖移动端）

---

## 2. AI 拆解正则过度匹配（#2）

### 2.1 现状

[mockEngine.ts:188](file:///c:/git-project/TRAE/src/lib/ai/mockEngine.ts#L188)：
```javascript
const kw = input.replace(/拆解|分解|breakdown|把|M\d|的|任务|一下|看看/g, '').trim();
```

输入 `"拆解M1"` → 去掉 `拆解` + `M1` → `kw = ""` → 回退到 `p.tasks[0]`，返回错误任务。

### 2.2 修复

两步：

**Step 1**：从 strip 正则里删 `M\d`，保留里程碑 ID：
```javascript
const kw = input.replace(/拆解|分解|breakdown|把|的|任务|一下|看看/g, '').trim();
```

**Step 2**：加里程碑匹配 fallback。如果 `kw` 是 `M1`/`M2`（里程碑 ID），找该里程碑对应阶段的第一个任务：

```typescript
function matchBreakdown(input: string, projects: Project[]): MockResponse | null {
  const m = input.match(/拆解|分解|breakdown/i);
  if (!m) return null;
  const kw = input.replace(/拆解|分解|breakdown|把|的|任务|一下|看看/g, '').trim();

  for (const p of projects) {
    let target: Task | undefined;

    if (!kw) {
      // 无关键词：取第一个未开始的任务
      target = p.tasks.find((t) => t.progress === 0) || p.tasks[0];
    } else if (/^M[12]$/.test(kw)) {
      // 里程碑 ID：找该里程碑对应阶段的第一个任务
      const ms = p.milestones.find((m) => m.id === kw);
      if (ms) {
        const phaseId = ms.betweenPhases[0]; // M1 → 'design', M2 → 'construction'
        target = p.tasks.find((t) => t.phaseId === phaseId);
      }
    } else {
      // 普通关键词：按任务名匹配
      target = p.tasks.find((t) => t.name.includes(kw));
    }

    if (target) {
      // ... 原有 subTasks 生成逻辑
    }
  }
  return null;
}
```

### 2.3 测试用例

| 输入 | 旧结果 | 新结果 |
|------|--------|--------|
| `拆解M1` | tasks[0]（错误） | 设计阶段第一个任务（正确） |
| `拆解M2` | tasks[0]（错误） | 施工阶段第一个任务（正确） |
| `拆解弱电管线` | 按名匹配（正确） | 按名匹配（不变） |
| `拆解` | tasks[0] | 第一个未开始任务 |

---

## 3. 抽屉接真实数据（#3）

### 3.1 现状

[TaskDrawer.tsx:57-79](file:///c:/git-project/TRAE/src/components/drawer/TaskDrawer.tsx#L57-L79) — subtasks/docs/deliverables/ai-notes 全是硬编码 mock。`project.files` 有 12 个真实文件但没用。

### 3.2 修复

#### DOCS tab → 接 project.files

```typescript
// 用 task.fileIds 过滤，没有 fileIds 就显示全部文件
const taskFileIds = task.fileIds ?? [];
const docs = taskFileIds.length > 0
  ? project.files.filter((f) => f.type === 'file' && taskFileIds.includes(f.id))
  : project.files.filter((f) => f.type === 'file');
```

- 显示文件名、扩展名、大小（如果有）
- 空列表显示 "暂无文件"

#### AI tab → 接 project.aiNotes

```typescript
const taskAiNotes = project.aiNotes.filter(
  (n) => n.taskId === task.id || !n.taskId
);
```

- 空列表显示 "暂无 AI 笔记"
- 有笔记按 type 显示（summary/risk/change/insight）

#### SUBTASKS tab → 标注 "AI 建议"

subtasks 保持按 progress 推算的 mock 逻辑（因为没有真实子任务数据），但加标注：

```typescript
// 在 subtasks 列表上方加一行提示
<div style={{ fontSize: 10, color: 'var(--mute)', padding: '8px 16px' }}>
  ⚠ AI 建议拆解，非真实子任务数据
</div>
```

#### DELIVERABLES tab → 标注 "AI 建议"

同上，保持 mock 但加标注。

#### Tab count 动态化

```typescript
const TABS = [
  { key: 'subtasks', label: 'SUBTASKS', count: subtasks.length },
  { key: 'docs', label: 'DOCS', count: docs.length },
  { key: 'deliverables', label: 'DLV', count: deliverables.length },
  { key: 'ai', label: 'AI', count: taskAiNotes.length }
];
```

### 3.3 不做

- 不接 activities（空数组，接了也是空状态，投入产出比低）
- 不做文件预览（D9 范围）
- 不做子任务真实数据（需要数据模型扩展，D10 范围）

---

## 4. 落地清单

### 修改
- `src/components/gantt/TaskBar.tsx` — 加任务名文字叠加
- `src/lib/ai/mockEngine.ts` — 修 matchBreakdown 正则 + 里程碑 fallback
- `src/components/drawer/TaskDrawer.tsx` — docs 接 project.files + ai-notes 接 project.aiNotes + subtasks/deliverables 标注 + tab count 动态化

### 不修改
- 数据模型（不加 subtasks/deliverables 到 types）
- API 层（不新增端点）
- 数据文件（不改 JSON）

---

## 5. 验证

- typecheck 0 errors
- 手动验证：
  - 任务条上能看到任务名
  - AI 输入"拆解M1"返回设计阶段任务
  - 抽屉 DOCS tab 显示真实文件列表
  - 抽屉 AI tab 空状态正确显示
