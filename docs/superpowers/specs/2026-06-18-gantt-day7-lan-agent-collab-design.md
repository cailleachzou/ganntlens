# GanttLens D7 Design — 局域网 + AGENT 协作 + 数据外置 JSON

**Date:** 2026-06-18
**Status:** Implemented (D7 全部完成, 14 task 全部 ✓, verify-day7.py 5 大检查全通过)
**Author:** DUDU & Cailleach
**前置：** D6 commit `4e49c12`（拖拽编辑 15 task 全部完成） + D5 commit `4ace3be`（AI Chat Panel）

**一句话目标：** 把 GanttLens 从"单端单用户 SPA"变成"**数据即文件 + 局域网共享 + AGENT IDE 主力编辑**"——前端只读 + 拖拽写 + AI plan 不编辑；AGENT + IDE 改 JSON 是主力写路径。

---

## 1. 范围

### 1.1 D7 包含

| # | 主题 | 备注 |
|---|------|------|
| 1 | 数据外置：业务 JSON 落到 `data/` 共享盘 | 替换 `persist` 中间件 |
| 2 | dev-server.mjs：挂在 Vite dev plugin 上 | 唯一 API 入口（前端拖拽用） |
| 3 | chokidar 监听 + SSE 推变更 | AGENT 写盘也能感知 |
| 4 | 软锁：dev-server 写盘前自动加锁 | AGENT 写盘前自己查 |
| 5 | AI plan 模式：commandRouter 砍成纯生成器 | 不动数据，只出 patch JSON |
| 6 | 项目文件夹化：`data/projects/<id>/*.json + *.md` | AGENT 直写最友好 |
| 7 | AGENT.md：根目录 + 每个项目一份 | AGENT 入门必读 |
| 8 | Playwright 验证脚本 | 端到端：UI 拖拽写盘 → chokidar → SSE → 其他端 reload |

### 1.2 D7 不包含（YAGNI）

- ❌ Yjs / CRDT 真协同（光标可见 / 多端光标同步）
- ❌ 鉴权 / 登录 / 用户系统（弱电小团队不需要）
- ❌ 数据库 / 后端服务（dev-server 够用）
- ❌ 拖拽撤销栈
- ❌ 移动端触屏
- ❌ md 文件预览（前端不解析 md，AGENT-only 区域）

---

## 2. 角色分工（三件套）

| 角色 | 写动作 | 读动作 | 备注 |
|---|---|---|---|
| **GanttLens 前端** | 拖拽（commit 走 dev-server） | 渲染 + 显示 plan | 拖拽期间本地乐观更新 |
| **前端 AI Chat** | **零**（plan 模式不写） | 读 store + 输出建议 + 生成 patch JSON | 命令路由变只读 |
| **AGENT（同事的 Trae IDE）** | **直接 Edit 文件**（主力） | Read 文件 | 读 `AGENT.md` 入门 |
| **dev-server.mjs** | 接收前端 patch + 写盘 | chokidar 监听 + 推 SSE | 内存 Map 软锁 |

**核心简化**：dev-server 不是"中间写者"，而是"**读 + 监听 + 转发 + 接收前端写**"——AGENT 拥有最直接的写路径。

---

## 3. 数据模型 & 文件布局

### 3.1 根目录

```
ganntlens/
├── data/                              ← 新增（共享盘 / NAS 软链）
│   ├── manifest.json                  ← 项目清单 + mtime
│   ├── AGENT-README.md                ← 根目录：data/ 怎么用，AGENT 必读
│   ├── projects/
│   │   ├── m-2026/                    ← 一个项目一个文件夹
│   │   ├── dc-2026/
│   │   └── ofc-2026/
│   └── locks/                         ← 软锁文件目录
│       └── m-2026.lock                ← dev-server 写，AGENT 写前必查
```

### 3.2 每个项目文件夹

```
data/projects/m-2026/
├── project.json              ← 甘特核心（phases / milestones / tasks）
├── files.json                ← 抽屉「文件」Tab
├── activities.json           ← 抽屉「活动」Tab
├── ai-notes.json             ← 抽屉「AI 建议」Tab
├── README.md                 ← 项目背景 + 决策记录
├── contacts.md               ← 客户/供应商对接人
├── risks.md                  ← 风险登记
├── weekly-log.md             ← 周报
└── equipment.md              ← 设备/型号/批次
```

### 3.3 schema

**`project.json` 形态**（去掉 files/activities/aiNotes，**与现有 `Project` 类型对齐裁剪**）：

```typescript
interface ProjectData {
  id: string;
  code: string;
  name: string;
  status: 'planning' | 'active' | 'completed' | 'archived';
  start: string;          // YYYY-MM-DD
  end: string;
  description?: string;
  phases: Phase[];        // 不变
  milestones: Milestone[];// 不变
  tasks: Task[];          // 不变（保留 fileIds/deliverableIds 引用）
  lastModifiedBy?: string;
  lastModifiedAt?: string;
}
```

**`files.json` / `activities.json` / `ai-notes.json` 形态**：

```typescript
interface FilesData {
  projectId: string;
  files: FileNode[];
  lastModifiedBy?: string;
  lastModifiedAt?: string;
}

interface ActivitiesData {
  projectId: string;
  activities: Activity[];   // 现有 ProjectStore 中的 Activity 类型
  lastModifiedBy?: string;
  lastModifiedAt?: string;
}

interface AINotesData {
  projectId: string;
  notes: AINote[];
  lastModifiedBy?: string;
  lastModifiedAt?: string;
}
```

**`manifest.json` 形态**：

```json
{
  "version": "1.0",
  "projects": [
    {
      "id": "m-2026",
      "code": "M-2026",
      "name": "XX 博物馆弱电智能化",
      "status": "active",
      "mtime": 1718724000000
    }
  ]
}
```

**锁文件 `data/locks/<id>.lock` 形态**：

```json
{
  "projectId": "m-2026",
  "owner": "ui-dude",        // 或 "agent-claude" / "agent-trae"
  "ts": 1718724000000,
  "reason": "drag-resize-T-012",
  "ttlMs": 120000             // 2 分钟自动失效
}
```

**md 文件（带 YAML frontmatter）**：

```markdown
---
projectId: m-2026
type: contacts   # / risks / weekly / equipment / readme
lastModifiedBy: cailleach
lastModifiedAt: 2026-06-18
---

# 客户对接人

## XX 博物馆（业主）
- 姓名：张三
- 电话：138-xxxx-xxxx
- 邮箱：zhangsan@example.com
- 备注：决策快，付款及时
```

- 前端**不解析 md**（AGENT-only 区域）
- md 文件不锁

### 3.4 对现有 types 的影响

`src/types/index.ts` 拆成：
- `Project` → 拆为 `ProjectData / FilesData / ActivitiesData / AINotesData`（去掉 `files / activities` 字段）
- `FileNode / Phase / Milestone / Task / AINote` 不变
- 新增 `Manifest / ProjectEvent / ProjectPatch`

---

## 4. 核心机制

### 4.1 dev-server.mjs（~250 行，挂在 Vite dev plugin）

**4 端点**：

| Method | Path | 行为 |
|--------|------|------|
| GET | `/api/manifest` | 读 `data/manifest.json` |
| GET | `/api/projects/:id` | 读 `data/projects/<id>/` 4 个 JSON（project/files/activities/ai-notes）打包返回 |
| POST | `/api/projects/:id` | body = `ProjectPatch`；dev-server 拿锁 → 写盘 → 释放 |
| GET | `/api/events` | SSE 推送（chokidar 触发） |

**写盘流程**（POST）：

```
1. 检查 locks Map[projectId]，已锁则返回 409
2. 在 data/locks/<id>.lock 写锁文件（atomic write）
3. 解析 patch body，按字段全量替换：
   - patch.tasks → 替换 project.json 的 tasks 字段
   - patch.phases → 替换 phases 字段
   - patch.milestones → 替换 milestones 字段
   - patch.meta → 改 lastModifiedBy/lastModifiedAt
4. 写盘：writeFile('.tmp') → rename('.tmp', real)
5. 释放锁（unlink lock 文件）
6. 不主动推 SSE —— chokidar 会自己推
```

**chokidar 监听**：

```js
const watcher = chokidar.watch(DATA, { ignoreInitial: true });
watcher.on('change', (filePath) => {
  const evt = parsePath(filePath);
  // 跳过锁文件 + AGENT-README.md + 自身 .tmp
  if (evt.skip) return;
  bus.emit('change', evt);
});
```

**自我回路规避**：
- dev-server 自己写的文件也会触发 chokidar
- 解法：dev-server 维护一个 `recentSelfWrites: Set<filePath>`，写盘前加入，50ms 后清除
- chokidar 推前查 `recentSelfWrites`，命中就 skip

**SSE 事件格式**：

```
event: project-updated
data: {"projectId":"m-2026","file":"project.json","mtime":1718724000000}

event: files-updated
data: {"projectId":"m-2026","file":"files.json","mtime":1718724000000}
```

**锁清理**：
- 启动时扫 `data/locks/`，`ts + ttlMs < now` 的删
- 写盘后强制 unlink
- 30s 周期扫描兜底

### 4.2 前端 apiClient + sseClient

**`src/lib/data/apiClient.ts`**：

```typescript
class ApiError extends Error {
  constructor(public status: number, public body: any) {
    super(body?.message ?? 'API error');
  }
}

export const api = {
  async getManifest(): Promise<Manifest>,
  async getProject(id: string): Promise<{
    project: ProjectData;
    files: FilesData;
    activities: ActivitiesData;
    aiNotes: AINotesData;
  }>,
  async patchProject(id: string, patch: ProjectPatch): Promise<{ mtime: number }>
};
```

`ProjectPatch` 形态（**全量字段替换，不做 deep merge**）：

```typescript
type ProjectPatch = {
  tasks?: Task[];
  phases?: Phase[];
  milestones?: Milestone[];
  meta?: { lastModifiedBy: string; lastModifiedAt: string };
};
```

**`src/lib/data/sseClient.ts`**：

```typescript
export function useProjectEvents(handler: (evt: ProjectEvent) => void) {
  useEffect(() => {
    const es = new EventSource('/api/events');
    ['project-updated', 'files-updated', 'activities-updated', 'ai-notes-updated']
      .forEach((kind) => es.addEventListener(kind, (e) => handler(JSON.parse(e.data))));
    return () => es.close();
  }, [handler]);
}
```

### 4.3 projectStore 改造

`src/store/projectStore.ts`：

```typescript
// 启动时 fetch 全部
const init = async () => {
  const manifest = await api.getManifest();
  const projects = await Promise.all(manifest.projects.map(p => api.getProject(p.id)));
  set({ projects, manifest });
};

// 拖拽 action —— 乐观更新 + 写盘
moveTask: async (projectId, taskId, newPlanStart) => {
  const before = get().projects;
  set(/* 本地 set — 跟手 */);  // 1. 立即更新
  try {
    await api.patchProject(projectId, {
      tasks: nextTasks,
      meta: { lastModifiedBy: 'ui-dude', lastModifiedAt: nowIso() }
    });
  } catch (e) {
    set({ projects: before });  // 2. 失败回滚
    toast.error('写盘失败：' + e.message);
  }
}

// SSE 收到 —— 不打断用户
applyRemoteUpdate: (evt) => {
  const { projectId, file } = evt;
  if (file === 'project.json') {
    api.getProject(projectId).then(({ project }) => {
      // shallow diff，只 set 变化的字段
      set(/* diff merge */);
    });
  }
  // files/activities/ai-notes 同理
}
```

**乐观更新**保证拖拽跟手；SSE 回来的更新**用 shallow diff 合并**——避免关抽屉、reset hover、闪烁。

**关键 store action 改造**：
- `moveTask / resizeTask / moveMilestone`：从 `set` 改"乐观 + apiClient"
- `addTask / deleteTask`：同上
- `updateTaskProgress`：**改成 plan 模式**——保留 mock 引擎但不再调 store
- `shiftMilestone`：保留作为 `moveMilestone` 的级联 helper（不暴露 UI）

**移除**：
- `persist` middleware（dev-server 是源）

### 4.4 AI plan 模式

**`src/lib/ai/commandRouter.ts` —— 重大简化**：

```typescript
// 之前：执行 action（调 store.shiftMilestone / updateTaskProgress）
// 之后：只生成 plan，不执行
export async function runPlan(input: string, scope: AIScope): Promise<PlanResult> {
  const resp = await mockLLM(input, projectsForEngine);
  return {
    content: resp.content,           // 自然语言解释
    plan: resp.action ?? null,       // 结构化 patch 描述
    outOfScope: ...
  };
}
```

- `shift_milestone` / `update_progress` action 保留为"plan 描述"格式
- **不再**调 `store.shiftMilestone` 等
- `mockLLM` 不变（它本来就只生成 action 描述）
- 删除老 `runCommand` 的副作用分支代码

**`src/components/ai/AIChatPanel.tsx` 改造**：

```typescript
// 渲染 plan
{msg.plan && (
  <details>
    <summary>📋 方案（不自动应用）</summary>
    <pre>{JSON.stringify(msg.plan, null, 2)}</pre>
    <button onClick={() => navigator.clipboard.writeText(JSON.stringify(msg.plan, null, 2))}>
      复制 plan
    </button>
    <button onClick={() => downloadFile('patch.json', JSON.stringify(msg.plan, null, 2))}>
      下载 patch.json
    </button>
  </details>
)}
```

- 不调任何 store action
- 按钮只导出文本/文件

### 4.5 锁的规则

| 写者 | 流程 |
|---|---|
| **前端 UI（拖拽 commit）** | apiClient.patchProject → dev-server 拿锁（写 lock 文件） → 写盘 → 释放锁 |
| **AGENT IDE（主力）** | 1) `cat data/locks/<id>.lock`；2) 有锁则 warn + 让用户决定；3) 直接 Edit 文件；4) **不建锁**；5) chokidar 推 SSE |

**锁 TTL = 2 分钟**：
- 防止前端崩了不释放
- 启动时清过期 + 30s 周期扫描
- AGENT.md 教："看到 lock 等 2 分钟或问用户"

---

## 5. AGENT.md 内容

### 5.1 `data/AGENT-README.md`（根目录）

```markdown
# GanttLens AGENT 入门

你是同事的 Trae IDE/Claude Code AGENT，工作目录是 GanttLens 的 data/ 目录。
你的工作方式：**直接 Edit JSON / md 文件**。不要试图改源码（源码是 vite 跑的，AGENT 不要动）。

## data/ 结构

- `manifest.json` —— 项目清单（**不要改**）
- `projects/<id>/` —— 一个项目一个文件夹
  - `project.json` —— 甘特核心（phases/milestones/tasks）
  - `files.json` / `activities.json` / `ai-notes.json` —— 抽屉 4 Tab 数据
  - `*.md` —— 你的笔记区（contacts/risks/weekly/equipment/readme）
- `locks/<id>.lock` —— 软锁（前端 UI 拖拽时会有，写盘前必查）

## 改 JSON 流程

1. **改盘前必查锁**：`cat data/locks/<projectId>.lock`
   - 存在 → 警告用户「前端 UI 正在编辑，2 分钟后失效；或问用户能否先停」
2. **读 project.json 当前内容**（`Read` 工具）
3. **Edit 工具改字段**（用最小 diff 改，不要全量重写）
4. **不要动 `lastModifiedBy` / `lastModifiedAt`**（dev-server 写盘时自动维护；你改 .json 的话自己写 `lastModifiedBy: "agent-claude"`）
5. **改完告诉用户**：「已改 m-2026/project.json，刷新 GanttLens 页面」

## 改 md 流程

随便改。没有锁。AGENT 专属区域。

## 严禁

- ❌ 不要改 manifest.json（项目清单由 GanttLens 维护）
- ❌ 不要绕过锁文件强写 JSON
- ❌ 不要写源码（`src/`、`server/`、`vite.config.ts`）
- ❌ 不要建子目录或挪文件位置
- ❌ 不要批量重写整个 JSON（用 Edit 工具做最小 diff）

## Schema 参考

见每个项目文件夹下的 `README.md` 第一节「本项目数据结构」。
```

### 5.2 每个项目 `README.md` 第一节

```markdown
## 本项目数据结构

- `project.json` 见 `src/types/index.ts` 的 `ProjectData` 类型
- 任务 ID 命名：`T-001` 起，里程碑 `M1/M2`，阶段 `design/construction/acceptance`
- 阶段/里程碑/任务联动规则见 `docs/superpowers/specs/2026-06-18-gantt-day6-drag-edit-design.md` §2.1
```

---

## 6. 错误处理

### 6.1 错误分类与处理

| 错误 | 触发 | 处理 |
|---|---|---|
| dev-server 写盘失败（磁盘满） | writeFile 抛 | 释放锁 + 返回 500 + 前端 toast + 自动回滚 |
| 锁冲突（同事前端在拖） | dev-server POST 时锁已存在 | 返回 409 + 前端 toast「同事正在编辑 X 项目」+ 保持本地乐观态 |
| JSON 解析失败（AGENT 改坏了） | dev-server GET 抛 | 启动时检测 → 报警告 → 前端降级用 seedData |
| SSE 断线 | EventSource error | 自动重连（EventSource 内建）+ 前端显示「重连中」角标 |
| chokidar 自我回路 | dev-server 自己写盘 | `recentSelfWrites` Set 过滤（50ms TTL） |
| AGENT 绕过锁强写 | AGENT 直接 Edit 期间 dev-server POST 撞 | dev-server 写盘前再读一次文件，**mtime 不一致则放弃**（防止 AGENT 改的版本被 dev-server 覆盖） |
| 拖拽时 AGENT 改了同一文件 | 拖拽 commit 时 | 拖完 patchProject 失败 → 回滚 + toast「AGENT 改过这个项目，请刷新」 |

### 6.2 关键 race condition

**场景**：前端 A 拖完准备写盘，AGENT B 在最后一刻 Edit 同一文件。

```
A: drag commit → apiClient.patchProject (读 project.json，准备写)
B: Edit project.json (写盘)
A: 写盘 (覆盖 B 的内容)
```

**解法**：
- dev-server POST 处理：写盘前 `fs.stat` 拿当前 mtime，与 manifest / 内存缓存对比
- 不一致 → 409 conflict，前端 toast「AGENT 在你拖的时候改了文件，请刷新」+ 自动回滚本地态

---

## 7. 验证（D7 Playwright 端到端）

`verify-day7.py`（沿用 D6 风格）：

| # | 用例 | 预期 |
|---|------|------|
| 1 | 启动 GanttLens，dev-server 起来 | 3 个项目 chip 正常 |
| 2 | 拖一个任务条 commit | 0.5s 内写盘 + mtime 更新 + lock 文件出现再消失 |
| 3 | 拖完开第二个 tab 访问同 URL | SSE 收到 `project-updated` 事件，UI 同步刷新 |
| 4 | 模拟 AGENT 直接 Edit project.json（Playwright 用 Node fs） | chokidar 监听到 + 第二个 tab 收到 SSE 事件 |
| 5 | 软锁冲突：dev-server 写盘期间另一个 POST | 第二个 POST 返回 409 |
| 6 | 端到端 dev-server 自己写的 chokidar 自我回路 | 拖完不重复推 SSE（用事件计数器验证） |
| 7 | 启动前手动破坏 project.json（非合法 JSON） | 启动时报警告 + 降级用 seedData + 前端显示警告 banner |
| 8 | AI plan 模式：前端 AI Chat 输入"把 M1 延后 3 天" | AI 回复含 plan JSON；不调 store；UI 数据不变 |
| 9 | 数据校验：plan 按钮"复制 plan" | 剪贴板内容是合法 JSON patch |

---

## 8. 落地文件清单

### 8.1 新增

- `ganntlens/server/dev-server.mjs` —— 4 端点 + chokidar + 锁管理
- `ganntlens/src/lib/data/apiClient.ts`
- `ganntlens/src/lib/data/sseClient.ts`
- `ganntlens/src/lib/data/lockStore.ts`（前端锁状态条 store）
- `ganntlens/src/components/layout/LockBanner.tsx`（顶部锁状态条）
- `ganntlens/src/lib/ai/planGenerator.ts`（替代 commandRouter 的 plan 模式逻辑）
- `ganntlens/data/AGENT-README.md`
- `ganntlens/data/projects/m-2026/{project,files,activities,ai-notes}.json` + 5 个 md
- `ganntlens/data/projects/dc-2026/*` + `ofc-2026/*`（从 seedData 导出）
- `ganntlens/data/manifest.json`
- `verify-day7.py` + 4-6 张截图
- `docs/superpowers/plans/2026-06-18-gantt-day7-lan-agent-collab.md`（实施 plan）

### 8.2 修改

- `ganntlens/src/types/index.ts` —— 拆 `Project` 类型
- `ganntlens/src/store/projectStore.ts` —— 移除 persist、启动 fetch、写操作走 apiClient、SSE 订阅
- `ganntlens/src/store/uiStore.ts` —— 加 `lockState`
- `ganntlens/src/lib/ai/commandRouter.ts` —— 改成 plan 模式（或被 planGenerator 替代）
- `ganntlens/src/lib/ai/mockEngine.ts` —— 不变（本来就只生成）
- `ganntlens/src/components/ai/AIChatPanel.tsx` —— plan 模式 UI
- `ganntlens/vite.config.ts` —— 挂 dev-server plugin
- `ganntlens/package.json` —— 加 `chokidar` 依赖

### 8.3 不变

- D6 拖拽 hook（`useDragController`）/ D6 store action 名（`moveTask/resizeTask/moveMilestone`）/ D4 hover + drawer / D5 AI Provider 配置

---

## 9. 风险与回滚

| 风险 | 概率 | 缓解 |
|---|---|---|
| chokidar 性能（data/ 树大时） | 低 | 项目文件夹 < 10 个文件，监听成本可忽略 |
| 同事机器没挂共享盘 | 中 | dev-server 启动时检测 + 提示 |
| AGENT 改坏了 JSON | 中 | dev-server GET 时 try/catch 降级 + 数据备份（实施时加 `*.bak`） |
| dev-server 自己写盘 chokidar 回路 | 已解决 | recentSelfWrites Set 50ms 过滤 |
| 端口冲突（5173 被占） | 低 | 沿用 Vite 端口（dev-server 挂 plugin 上） |
| 锁文件残留 | 低 | 启动清过期 + 30s 周期扫描 + 2min TTL |

**回滚**：保留 D6 完整 commit。`git revert` 即可回到纯内存版本。

---

## 10. Spec 自审

- ✅ 无占位符（"TBD" / "TODO"）出现在主体中（实施时 todo 在 plan 里）
- ✅ 内部一致：段 1 三件套 ↔ 段 3 写锁规则 ↔ 段 5 AGENT.md 流程
- ✅ 范围聚焦：单 spec 范围明确（不试图做 Yjs / 鉴权 / DB）
- ✅ 歧义点已消：
  - "AGENT 锁不锁" —— 已写明 AGENT 写盘不建锁
  - "patch 是 diff 还是全量" —— 已写明全量字段替换
  - "自我回路怎么过滤" —— recentSelfWrites 50ms

---

**D7 完成定义**：

- [ ] dev-server 起来 + 4 端点工作
- [ ] chokidar 监听 + SSE 推事件
- [ ] 前端启动 fetch 替代 persist
- [ ] 拖拽 commit 走 dev-server 写盘
- [ ] AGENT Edit 文件能推到其他端
- [ ] AI plan 模式：commandRouter 不写数据
- [ ] 软锁防冲突 + 自我回路规避
- [ ] AGENT.md 写好
- [ ] Playwright 9 个用例全过
- [ ] typecheck 0 errors
- [ ] 至少 1 张截图证明跨 tab 同步

**下一步**：写实施 plan（`docs/superpowers/plans/2026-06-18-gantt-day7-lan-agent-collab.md`），按 subagent-driven-development 落地。
