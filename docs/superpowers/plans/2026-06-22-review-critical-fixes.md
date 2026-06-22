# Review Critical Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 3 critical issues from ganntlens-review.md: task bar names, AI breakdown regex, drawer real data.

**Architecture:** Three independent fixes across TaskBar, mockEngine, and TaskDrawer. No data model changes, no API changes, no new files.

**Tech Stack:** React 18 + TypeScript + Zustand

**Spec:** [2026-06-22-review-critical-fixes-design.md](file:///c:/git-project/TRAE/docs/superpowers/specs/2026-06-22-review-critical-fixes-design.md)

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/components/gantt/TaskBar.tsx` | Modify | Add task name text overlay on bars wider than 8% |
| `src/lib/ai/mockEngine.ts` | Modify | Fix matchBreakdown regex + add milestone fallback |
| `src/components/drawer/TaskDrawer.tsx` | Modify | Connect docs to project.files, ai-notes to project.aiNotes, label mock sections, dynamic tab counts |

---

### Task 1: TaskBar — add task name text overlay

**Files:**
- Modify: `src/components/gantt/TaskBar.tsx:206-323` (return JSX)

- [ ] **Step 1: Add task name overlay inside TaskBar return JSX**

In `src/components/gantt/TaskBar.tsx`, find the `{/* 进度文字 */}` block (around line 262). After that block and before the `{/* 拖动 handle - 整条（move） */}` block, insert:

```typescript
      {/* 任务名文字叠加 */}
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

- [ ] **Step 2: Run typecheck**

Run: `cd c:\git-project\TRAE && npm run typecheck`
Expected: 0 errors

- [ ] **Step 3: Verify in browser**

Open `http://localhost:5173/ganntlens/` — task bars wide enough should show task names. Hover should increase opacity.

- [ ] **Step 4: Commit**

```bash
cd c:\git-project\TRAE
git add src/components/gantt/TaskBar.tsx
git commit -m "fix(review-1): add task name overlay on gantt bars for mobile usability"
```

---

### Task 2: mockEngine — fix matchBreakdown regex + milestone fallback

**Files:**
- Modify: `src/lib/ai/mockEngine.ts:185-209` (matchBreakdown function)

- [ ] **Step 1: Read current matchBreakdown function**

Read `src/lib/ai/mockEngine.ts` lines 185-209 to confirm current code matches:
```typescript
function matchBreakdown(input: string, projects: Project[]): MockResponse | null {
  const m = input.match(/拆解|分解|breakdown/i);
  if (!m) return null;
  const kw = input.replace(/拆解|分解|breakdown|把|M\d|的|任务|一下|看看/g, '').trim();

  for (const p of projects) {
    const target = kw
      ? p.tasks.find((t) => t.name.includes(kw))
      : p.tasks.find((t) => t.progress === 0) || p.tasks[0];
    if (target) {
      // ... subTasks generation
    }
  }
  return null;
}
```

- [ ] **Step 2: Replace matchBreakdown with fixed version**

Replace the entire `matchBreakdown` function (lines 185-209) with:

```typescript
function matchBreakdown(input: string, projects: Project[]): MockResponse | null {
  const m = input.match(/拆解|分解|breakdown/i);
  if (!m) return null;
  // 修复：从 strip 正则里删 M\d，保留里程碑 ID 用于匹配
  const kw = input.replace(/拆解|分解|breakdown|把|的|任务|一下|看看/g, '').trim();

  for (const p of projects) {
    let target: Task | undefined;

    if (!kw) {
      // 无关键词：取第一个未开始的任务
      target = p.tasks.find((t) => t.progress === 0) || p.tasks[0];
    } else if (/^M[12]$/.test(kw)) {
      // 里程碑 ID：找该里程碑对应阶段的第一个任务
      const ms = p.milestones.find((mm) => mm.id === kw);
      if (ms) {
        const phaseId = ms.betweenPhases[0];
        target = p.tasks.find((t) => t.phaseId === phaseId);
      }
    } else {
      // 普通关键词：按任务名匹配
      target = p.tasks.find((t) => t.name.includes(kw));
    }

    if (target) {
      const subTasks = [
        '1. 准备材料 & 工具到位',
        '2. 现场勘察 & 测量复核',
        '3. 主任务执行（按 WBS 拆分到子步骤）',
        '4. 自检 & 整改',
        '5. 提交验收 & 归档'
      ];
      return {
        content: `${pick(FILLER)}「${target.name}」建议拆解为 5 个子步骤：\n\n${subTasks.join('\n')}\n\n项目：${p.code}\n负责人：${target.owner || '未指定'}\n\n需要我帮你建立子任务并加入项目吗？`,
        delay: 900
      };
    }
  }
  return null;
}
```

- [ ] **Step 3: Check if Task type is imported**

Read `src/lib/ai/mockEngine.ts` line 1-5. If `Task` is not in the imports, add it.

The import should look like:
```typescript
import type { Project, Task } from '../../types';
```

- [ ] **Step 4: Run typecheck**

Run: `cd c:\git-project\TRAE && npm run typecheck`
Expected: 0 errors

- [ ] **Step 5: Verify in browser**

Open `http://localhost:5173/ganntlens/` — open AI chat panel, type "拆解M1" — should return a design phase task, not tasks[0].

- [ ] **Step 6: Commit**

```bash
cd c:\git-project\TRAE
git add src/lib/ai/mockEngine.ts
git commit -m "fix(review-2): AI breakdown regex no longer strips M1/M2, add milestone fallback"
```

---

### Task 3: TaskDrawer — connect real data + label mock sections

**Files:**
- Modify: `src/components/drawer/TaskDrawer.tsx:15-79` (TABS + mock data) and body sections

- [ ] **Step 1: Replace hardcoded TABS with dynamic counts**

In `src/components/drawer/TaskDrawer.tsx`, find the hardcoded `TABS` constant (lines 15-20):

```typescript
const TABS: { key: TabKey; label: string; count: number }[] = [
  { key: 'subtasks', label: 'SUBTASKS', count: 5 },
  { key: 'docs', label: 'DOCS', count: 8 },
  { key: 'deliverables', label: 'DLV', count: 3 },
  { key: 'ai', label: 'AI', count: 2 }
];
```

Delete this top-level constant. It will be replaced with a dynamic version inside the component in Step 3.

- [ ] **Step 2: Replace hardcoded mock data with real data sources**

Find the mock data block (lines 56-79):

```typescript
  // 子任务（mock 数据，按 progress 推算）
  const subtasks = [
    { name: '材料准备', start: '6/16', end: '6/17', dur: '2d', done: task.progress >= 25, owner: '张工' },
    { name: '现场勘查', start: '6/18', end: '6/18', dur: '1d', done: task.progress >= 50, owner: '李工' },
    { name: '主体施工', start: '6/19', end: '6/24', dur: '6d', done: task.progress >= 75, owner: '陈工' },
    { name: '质量检查', start: '6/25', end: '6/25', dur: '1d', done: task.progress >= 90, owner: '王工' },
    { name: '验收交付', start: '6/26', end: '6/26', dur: '1d', done: task.progress === 100, owner: '某某' }
  ];

  // 文档（mock）
  const docs = [
    { name: '技术规格书.pdf', ext: 'pdf', size: '890K' },
    { name: '施工图纸 v2.dwg', ext: 'dwg', size: '3.2M' },
    { name: '材料清单.xlsx', ext: 'xlsx', size: '124K' },
    { name: '进度报告.docx', ext: 'docx', size: '256K' }
  ];

  // 交付物（mock）
  const deliverables = [
    { name: '完工报告', status: 'pending' },
    { name: '验收测试报告', status: 'pending' },
    { name: '培训签到表', status: 'pending' }
  ];
```

Replace with:

```typescript
  // 子任务（AI 建议拆解，按 progress 推算）
  const subtasks = [
    { name: '材料准备', start: '6/16', end: '6/17', dur: '2d', done: task.progress >= 25, owner: '张工' },
    { name: '现场勘查', start: '6/18', end: '6/18', dur: '1d', done: task.progress >= 50, owner: '李工' },
    { name: '主体施工', start: '6/19', end: '6/24', dur: '6d', done: task.progress >= 75, owner: '陈工' },
    { name: '质量检查', start: '6/25', end: '6/25', dur: '1d', done: task.progress >= 90, owner: '王工' },
    { name: '验收交付', start: '6/26', end: '6/26', dur: '1d', done: task.progress === 100, owner: '某某' }
  ];

  // 文档：接 project.files 真实数据
  const taskFileIds = task.fileIds ?? [];
  const docs = taskFileIds.length > 0
    ? project.files.filter((f) => f.type === 'file' && taskFileIds.includes(f.id))
    : project.files.filter((f) => f.type === 'file');

  // 交付物（AI 建议，非真实数据）
  const deliverables = [
    { name: '完工报告', status: 'pending' },
    { name: '验收测试报告', status: 'pending' },
    { name: '培训签到表', status: 'pending' }
  ];

  // AI 笔记：接 project.aiNotes 真实数据
  const taskAiNotes = project.aiNotes.filter(
    (n) => n.taskId === task.id || !n.taskId
  );

  // 动态 tab 计数
  const TABS: { key: TabKey; label: string; count: number }[] = [
    { key: 'subtasks', label: 'SUBTASKS', count: subtasks.length },
    { key: 'docs', label: 'DOCS', count: docs.length },
    { key: 'deliverables', label: 'DLV', count: deliverables.length },
    { key: 'ai', label: 'AI', count: taskAiNotes.length }
  ];
```

- [ ] **Step 3: Add "AI 建议" label to SUBTASKS tab content**

Find the `{tab === 'subtasks' && (` block (around line 259). After the opening `<div>` and before `{subtasks.map(...)`, insert:

```typescript
            <div style={{ fontSize: 10, color: 'var(--mute)', padding: '8px 16px 4px', fontStyle: 'italic' }}>
              ⚠ AI 建议拆解，非真实子任务数据
            </div>
```

- [ ] **Step 4: Add "AI 建议" label to DELIVERABLES tab content**

Find the `{tab === 'deliverables' && (` block (around line 369). After the opening `<div>` and before `{deliverables.map(...)`, insert:

```typescript
            <div style={{ fontSize: 10, color: 'var(--mute)', padding: '8px 16px 4px', fontStyle: 'italic' }}>
              ⚠ AI 建议交付物，非真实数据
            </div>
```

- [ ] **Step 5: Replace hardcoded AI tab content with real aiNotes**

Find the `{tab === 'ai' && (` block (around line 407). Replace the entire block with:

```typescript
        {tab === 'ai' && (
          <div style={{ padding: '12px 16px' }}>
            {taskAiNotes.length === 0 ? (
              <div style={{ fontSize: 11, color: 'var(--mute)', textAlign: 'center', padding: '24px 0' }}>
                暂无 AI 笔记
              </div>
            ) : (
              taskAiNotes.map((note, i) => (
                <div key={note.id} style={{ marginBottom: 12 }}>
                  <div
                    style={{
                      fontFamily: 'JetBrains Mono, monospace',
                      fontSize: 9,
                      color: 'var(--accent-2)',
                      fontWeight: 700,
                      letterSpacing: '0.12em',
                      textTransform: 'uppercase',
                      marginBottom: 6
                    }}
                  >
                    AI · {note.type.toUpperCase()} · NOTE {i + 1}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--ink)', lineHeight: 1.6 }}>
                    {note.content}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
```

- [ ] **Step 6: Add empty state to DOCS tab**

Find the `{tab === 'docs' && (` block. Replace with:

```typescript
        {tab === 'docs' && (
          <div>
            {docs.length === 0 ? (
              <div style={{ fontSize: 11, color: 'var(--mute)', textAlign: 'center', padding: '24px 0' }}>
                暂无文件
              </div>
            ) : (
              docs.map((d, i) => (
                <div
                  key={d.id || i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '10px 16px',
                    gap: 10,
                    borderBottom: '1px solid var(--line)',
                    cursor: 'pointer'
                  }}
                >
                  <div
                    style={{
                      width: 28,
                      height: 32,
                      border: '1px solid var(--line-2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontFamily: 'JetBrains Mono, monospace',
                      fontSize: 8,
                      fontWeight: 700,
                      color: 'var(--mute)',
                      background: 'var(--bg-2)'
                    }}
                  >
                    {(d.ext ?? 'FILE').toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 500 }}>{d.name}</div>
                    <div
                      style={{
                        fontFamily: 'JetBrains Mono, monospace',
                        fontSize: 10,
                        color: 'var(--mute)',
                        marginTop: 2
                      }}
                    >
                      {d.size ? `${Math.round(d.size / 1024)}K` : '—'}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
```

- [ ] **Step 7: Run typecheck**

Run: `cd c:\git-project\TRAE && npm run typecheck`
Expected: 0 errors

- [ ] **Step 8: Verify in browser**

Open `http://localhost:5173/ganntlens/` — click a task bar to open drawer:
- DOCS tab: should show real files from project.files (or "暂无文件" if empty)
- AI tab: should show "暂无 AI 笔记" (since aiNotes is empty)
- SUBTASKS tab: should show "⚠ AI 建议拆解" label above list
- DLV tab: should show "⚠ AI 建议交付物" label above list
- Tab counts should be dynamic (not hardcoded 5/8/3/2)

- [ ] **Step 9: Commit**

```bash
cd c:\git-project\TRAE
git add src/components/drawer/TaskDrawer.tsx
git commit -m "fix(review-3): drawer connects real files + aiNotes, labels mock sections"
```

---

## Self-Review

**Spec coverage:**
- §1 Task bar names → Task 1 ✓
- §2 AI breakdown regex → Task 2 ✓
- §3.1 DOCS → project.files → Task 3 Step 2, 6 ✓
- §3.2 AI tab → project.aiNotes → Task 3 Step 2, 5 ✓
- §3.3 SUBTASKS label → Task 3 Step 3 ✓
- §3.4 DELIVERABLES label → Task 3 Step 4 ✓
- §3.5 Tab count dynamic → Task 3 Step 2 ✓

**Placeholder scan:** No TBD/TODO. All code blocks are complete.

**Type consistency:** `Task` type used in Task 2 matches existing types. `FileNode` properties (`ext`, `size`, `name`, `id`) match types/index.ts. `AINote` properties (`id`, `type`, `content`, `taskId`) match types/index.ts.
