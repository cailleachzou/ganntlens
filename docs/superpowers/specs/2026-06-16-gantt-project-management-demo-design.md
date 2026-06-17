# Spec: 可交互施工甘特图管理 Demo

**Date:** 2026-06-16
**Status:** Draft (待用户审阅)
**Author:** DUDU & Cailleach
**Target:** TRAE AI 创造力大赛 · 初赛（6.16-7.15）· 学习工作赛道

---

## 1. 目标

构建一个**可交互的施工项目甘特图管理 Demo**，参加 TRAE AI 创造力大赛初赛。

**核心价值：**
- 解决项目经理「甘特图改日期要手动算 + 文档和节点对不上」的真实痛点
- 通过 **AI 实时联动**让用户用自然语言调整项目进度
- 评审维度（创新 / 完成度 / 体验 / 文档）都对得上

**Demo 目标用户：** 弱电 / 建筑 / 装修等行业的中型项目管理者（1 人 3-5 个并行项目场景）

---

## 2. 范围（In Scope）

### 2.1 核心功能

| 功能 | 描述 |
|------|------|
| **总览大甘特** | 一张 Gantt 展示 3 个项目按实际时间平铺 |
| **项目详情** | 单项目放大：阶段色带 + 双里程碑 + 计划/实际双轨 + 今天线 |
| **节点下钻** | 点击任务 → 右侧 4-Tab 抽屉：子任务/文档/交付物/AI 笔记 |
| **文件树** | 左侧项目文件结构（不与 4 阶段混淆） |
| **AI 聊天** | 应用内嵌 LLM，支持跨项目分析 + 节点级快捷操作 |
| **里程碑拖拽** | 拖动 ◆ 调整阶段边界，整段工期自动平移 |
| **通用 LLM 接入** | 7 家预置 Provider + Custom，所有用 OpenAI 兼容协议 |

### 2.2 不做（Out of Scope）

- 用户系统 / 鉴权（公开 demo，单用户本地）
- 真实文件上传 / 预览（用占位文件名 + emoji 示意）
- 多人协作 / 实时同步
- 移动端适配（桌面浏览器优先，宽度 ≥ 1280px）
- 国际化（仅简体中文）
- 测试覆盖率要求（demo 性质，核心交互手动验证即可）

---

## 3. 技术栈

```
frontend:  React 18 + TypeScript + Vite
state:     Zustand (3 stores: project / ui / ai)
styling:   Tailwind CSS
gantt:     frappe-gantt (基础任务条) + 自定义覆盖层
icons:     lucide-react
ai:        混合：Mock LLM 优先 + 真实 LLM 可选（用户配置）
data:      seed JSON (3 项目预填) + localStorage 持久化
deploy:    Vercel / Netlify
```

**为什么不用纯自建 Gantt：**
- frappe-gantt 提供现成的拖拽 + 日期计算
- 阶段色带 / 里程碑 / 双轨 / 今天线 / 抽屉 / AI 都是自定义 React 组件
- 复用基础库节省 30% 工作量，专注差异化功能

---

## 4. 数据模型（7 实体）

```typescript
// types/index.ts
type ProjectStatus = 'planning' | 'active' | 'completed' | 'archived';

interface Project {
  id: string;              // 'm-2026'
  code: string;            // 'M-2026'
  name: string;            // '某博物馆弱电集成'
  status: ProjectStatus;
  start: string;           // '2026-06-15'
  end: string;             // '2026-08-01'
  phases: Phase[];
  milestones: Milestone[];
  tasks: Task[];
  files: FileNode[];
}

interface Phase {
  id: string;              // 'design' / 'construction' / 'acceptance'
  name: string;            // '前期 · 设计'
  color: string;           // '#dbeafe'
  order: number;
  planStart: string;
  planEnd: string;
  actualStart?: string;
  actualEnd?: string;
}

interface Milestone {
  id: string;              // 'm1' / 'm2'
  name: string;            // 'M1 开工'
  date: string;            // '2026-06-20'
  betweenPhases: [string, string];
  status: 'pending' | 'reached' | 'missed';
}

interface Task {
  id: string;
  name: string;
  phaseId: string;
  planStart: string;
  planEnd: string;
  actualStart?: string;
  actualEnd?: string;
  progress: number;        // 0-100
  parentId?: string;       // 子任务
  owner?: string;
  fileIds?: string[];
  deliverableIds?: string[];
}

interface FileNode {
  id: string;
  name: string;
  type: 'folder' | 'file';
  parentId?: string;
  ext?: string;            // 'docx', 'pdf', 'dwg'
  size?: number;
  taskIds?: string[];      // 关联任务
}

interface Deliverable {
  id: string;
  name: string;
  taskId: string;
  status: 'pending' | 'in-review' | 'approved';
  criteria?: string[];     // 验收标准
}

interface AINote {
  id: string;
  projectId: string;
  taskId?: string;
  type: 'summary' | 'risk' | 'change' | 'insight';
  content: string;
  createdAt: string;
}
```

**关系：**
- Project `1:N` Phase / Milestone / Task / FileNode
- Phase `1:N` Task
- Task `N:M` FileNode（通过 fileIds 关联）
- Task `1:N` Deliverable
- Project/Task `1:N` AINote

---

## 5. AI 集成：混合方案

### 5.1 三层 fallback

```
用户消息 → 1) Mock LLM 匹配 → 命中？返回
                       ↓ 未命中
                2) 真实 LLM（用户配了 key？）→ 调用
                       ↓ 未配
                3) 通用 fallback 提示
```

### 5.2 预置 Provider（7 家）

| Provider | Endpoint | Model |
|----------|----------|-------|
| OpenAI | `https://api.openai.com/v1/chat/completions` | `gpt-4o-mini` |
| DeepSeek | `https://api.deepseek.com/v1/chat/completions` | `deepseek-chat` |
| Moonshot (Kimi) | `https://api.moonshot.cn/v1/chat/completions` | `moonshot-v1-8k` |
| Zhipu (GLM) | `https://open.bigmodel.cn/api/paas/v4/chat/completions` | `glm-4-flash` |
| MiniMax | `https://api.minimaxi.com/v1/text/chatcompletion_v2` | `MiniMax-Text-01` |
| MiMo (小米) | `https://api.xiaomi.com/mimo/v1/chat/completions` | `mimo-7b` |
| Custom | 用户自填 | 用户自填 |

### 5.3 Mock LLM 支持的指令（预设响应）

- 「把 X 延后 N 天」→ shiftTask + 自动联动 milestone
- 「M1/M2 改成 X」→ shiftMilestone + 整段平移
- 「X 完成 N%」→ updateTaskProgress
- 「今天该做啥」→ 列出今天在进行的任务 + 即将到期的里程碑
- 「时间冲突」→ 跨项目重叠期分析
- 「生成周报」→ 汇总本周完成 + 下周计划
- 「查所有延期任务」→ 列出 actualStart > planStart 的任务

### 5.4 密钥安全（GitHub 公开前提）

- 所有 LLM 配置（endpoint / apiKey / model）**只存 localStorage**
- `.env.example` 提交到 Git 留占位
- `.env` / `.env.local` 加入 `.gitignore`
- README 提供「打开 Settings → 填 Key」的使用说明

---

## 6. 目录结构

```
src/
├── main.tsx
├── App.tsx
├── routes/
│   ├── OverviewPage.tsx           # 大甘特（3 项目）
│   └── ProjectDetailPage.tsx      # 单项目详情
├── components/
│   ├── gantt/                     # 甘特图核心 (6)
│   │   ├── GanttChart.tsx
│   │   ├── PhaseRibbon.tsx        # 顶部 3 色带
│   │   ├── MilestoneMarker.tsx    # 菱形
│   │   ├── TaskBar.tsx            # 双轨
│   │   ├── TodayLine.tsx          # 红色今天线
│   │   └── TimelineHeader.tsx
│   ├── drawer/                    # 4-Tab 抽屉 (5)
│   │   ├── NodeDrawer.tsx
│   │   ├── SubTasksTab.tsx
│   │   ├── DocumentsTab.tsx
│   │   ├── DeliverablesTab.tsx
│   │   └── AINotesTab.tsx
│   ├── ai/                        # AI 模块 (2)
│   │   ├── AIChat.tsx
│   │   └── AISettings.tsx
│   ├── file/                      # 文件树 (1)
│   │   └── FileTree.tsx
│   ├── layout/                    # 布局 (2)
│   │   ├── AppHeader.tsx
│   │   └── AppShell.tsx
│   └── ui/                        # 通用 (4)
│       ├── Button.tsx
│       ├── Modal.tsx
│       ├── Badge.tsx
│       └── Tabs.tsx
├── store/                         # Zustand (3)
│   ├── projectStore.ts            # 项目/任务/里程碑/文档
│   ├── uiStore.ts                 # 抽屉/选中节点
│   └── aiStore.ts                 # 聊天 + LLM 配置
├── lib/
│   ├── ai/                        # LLM 集成 (4)
│   │   ├── client.ts              # 通用 OpenAI 协议
│   │   ├── providers.ts           # 7 家预置
│   │   ├── mockLLM.ts             # Mock 模式
│   │   └── prompts.ts             # 系统提示词
│   ├── gantt/                     # 工具 (2)
│   │   ├── dateUtils.ts
│   │   └── layoutUtils.ts         # px ↔ 日期
│   └── seed/
│       └── seedData.ts            # 3 项目预填
├── types/
│   └── index.ts                   # 7 实体 TS 接口
└── styles/
    └── globals.css
```

总计 **~40 个文件**。

---

## 7. Store 拆分

```typescript
// store/projectStore.ts
useProjectStore = create((set) => ({
  projects: seedData,
  selectedProjectId: 'm-2026',
  shiftMilestone: (id, days) => set(...),         // 里程碑平移 + 联动任务
  updateTaskProgress: (id, pct) => set(...),
  addTask: (task) => set(...),
  deleteTask: (id) => set(...),
  persist: () => localStorage.setItem('pm-projects', JSON.stringify(...))
}))

// store/uiStore.ts
useUIStore = create((set) => ({
  drawerOpen: false,
  selectedTaskId: null,
  openDrawer: (id) => set({ drawerOpen: true, selectedTaskId: id }),
  closeDrawer: () => set({ drawerOpen: false })
}))

// store/aiStore.ts
useAIStore = create((set) => ({
  llmConfig: loadFromLocalStorage(),              // {provider, endpoint, apiKey, model}
  messages: [],
  send: (msg) => callLLM(msg, getState())
}))
```

---

## 8. 关键交互流程

### 8.1 拖动里程碑

```
用户拖 M1 菱形向右
  → frappe-gantt 检测 on_date_change
  → useProjectStore.shiftMilestone('m1', +3)
  → 算法：M1 之后所有任务的 planStart/planEnd 顺延 3 天
  → M2（与 M1 联动）也顺延 3 天
  → AI 收到变更事件，生成一条 AINote(type='change')
  → 甘特图重渲染
```

### 8.2 AI 自然语言改里程碑

```
用户输入「把 M1 开工延后 3 天」
  → mockLLM.match() 命中 shiftMilestone 模式
  → 调用 useProjectStore.shiftMilestone('m1', +3)
  → 同 8.1 流程
  → AI 响应：「✅ 已将 M1 开工从 6/20 调整为 6/23，施工期、M2、关联任务全部顺延 3 天。」
```

### 8.3 点击节点打开抽屉

```
用户点击「弱电管线」任务条
  → onClick → useUIStore.openDrawer('t3')
  → NodeDrawer 滑入右侧
  → 默认显示 SubTasksTab（5 个子任务列表 + 进度条 0/5）
  → 用户切换 Tab → DocumentsTab（8 个关联文件）→ ...
  → 点击 ✕ → useUIStore.closeDrawer() → AI 聊天面板恢复
```

---

## 9. UI 设计要点

- **配色**：蓝（前期 / 设计）/ 黄（中期 / 施工）/ 绿（后期 / 调试验收）
- **里程碑**：橙色菱形（未达成）/ 绿色菱形（已达成）
- **今天线**：红色 (#ef4444) 1.5px 垂直线 + 顶部「📍 今天 6/16」标签
- **计划 vs 实际**：上虚线（计划） / 下实色带百分比（实际）
- **Hover 预览卡**：浮动卡片，含 AI 摘要 + 数字 + 风险标
- **抽屉宽度**：420px，覆盖右侧 AI 聊天面板
- **整体布局**：三栏（左文件树 + 中甘特 + 右 AI/抽屉），固定 1280px+

---

## 10. 开发计划（7 天冲刺）

| Day | 任务 | 产出 |
|-----|------|------|
| 1 | 脚手架 + Seed 数据 + 3 Store + types | 基础框架跑通 |
| 2 | GanttChart + frappe-gantt spike + 任务条 | 总览页能渲染（如 spike 失败则切自建） |
| 3 | 叠加 PhaseRibbon + Milestone + TodayLine + 双轨 | 详情页可视化完成 |
| 4 | NodeDrawer（4-Tab）+ FileTree + 布局整合 | 节点交互完整 |
| 5 | AIChat + Mock LLM + AI Settings 面板 | AI 工作流跑通 |
| 6 | 交互打磨 + 拖拽调试 + 本地测试 | 全功能演示无 bug |
| 7 | 文档 + 截图 + Vercel 部署 + 论坛帖 | 提交完成 |

---

## 11. 演示剧本（3 分钟版本）

1. **[0:00] 开场 · 痛点** — Excel 改日期要手动算 + 文档节点对不上
2. **[0:45] 总览 · 全局视角** — 3 项目大甘特 + 今天线 + 跨项目冲突
3. **[1:30] 详情 · 节点下钻** — 阶段色带 + Hover 预览 + 4-Tab 抽屉
4. **[2:15] AI · 实时改动** — 「把弱电管线延后 3 天」→ 自动联动
5. **[2:50] 收尾** — TRAE 开发 + 通用 LLM 协议 + 零 API 成本

---

## 12. 初赛提交检查表

- [ ] **体验链接** — Vercel 部署地址（必须可用）
- [ ] **截图 ≥ 3 张** — 总览 / 详情 / 节点抽屉
- [ ] **Session ID ≥ 3 个** — 每个功能模块的开发对话
- [ ] **论坛帖正文** — 按模板：简介 / 思路 / 体验地址 / TRAE 过程
- [ ] **GitHub Repo** — 代码（含 .gitignore，API key 不泄露）
- [ ] **README.md** — 去敏版，含本地运行说明

### 去敏规则（GitHub / 论坛帖）

- 删除所有「Tendo」「江阴博物馆」等公司 / 客户项目名
- 替换为「某某」 / M-2026 / DC-2026 / OFC-2026
- 用户真名 Cailleach 可保留（个人项目）
- README 对外版不得含任何客户信息

---

## 13. 风险与缓解

| 风险 | 概率 | 影响 | 缓解 |
|------|------|------|------|
| frappe-gantt 拖拽与自定义组件冲突 | 中 | 中 | 关键路径先用自建 Gantt 验证，再决定是否引库 |
| CORS 拦截真实 LLM 调用 | 中 | 低 | 默认 Mock 演示；真实 LLM 留给用户自配 |
| 7 天开发时间紧 | 高 | 中 | 砍掉：移动端 / 测试覆盖率 / 多用户；保留：核心交互 |
| 评委评审 7.21-23 期间 API 不稳定 | 低 | 低 | Mock 默认 100% 稳 |
| 真实项目数据泄密 | 低 | 高 | 全程用 M-2026/DC-2026/OFC-2026 演示项目 + 客户名替换 |

---

## 14. 验收标准

### 功能验收

- [ ] 启动后能直接看到 3 项目的总览大甘特
- [ ] 今天线显示在 6/16 位置
- [ ] 点击左树项目 → 进入详情页
- [ ] 详情页能看到三阶段色带 + 双里程碑 + 计划/实际双轨
- [ ] 鼠标悬停任务条 → 弹出预览卡
- [ ] 点击任务条 → 右侧抽屉滑出 4-Tab
- [ ] 4-Tab 都能正常切换显示内容
- [ ] AI 聊天输入「把 M1 延后 3 天」→ 甘特图自动更新
- [ ] AI 设置面板能切换 7 家 Provider + 填 Key
- [ ] 无 Key 也能完整演示（Mock fallback）

### 体验验收

- [ ] 桌面 1280px+ 浏览器下布局正常
- [ ] 拖动里程碑流畅（无卡顿）
- [ ] 抽屉滑入/滑出动画顺滑
- [ ] 加载 < 2s

### 文档验收

- [ ] GitHub README 含本地运行步骤
- [ ] 论坛帖含 3+ 截图 + 3+ Session ID
- [ ] 所有 Tendo / 江阴博物馆字眼已去除
