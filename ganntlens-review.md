# GanttLens 项目审查报告

> 仓库：https://github.com/cailleachzou/ganntlens
>
> 审查时间：2026-06-22
>
> 类型：React + TypeScript + Vite (Tailwind CSS)

---

## 一、构建结果

| 检查项 | 结果 |
|--------|:----:|
| `npx tsc --noEmit` | ✅ 0 错误 |
| `npm run build` (tsc + vite build) | ✅ 2 秒构建成功 |
| 模块数 | 1615 个，无 warning |
| 产物大小 | JS 259KB (gzip 80KB) + CSS 8KB |

---

## 二、项目概览

GanttLens 是一个面向弱电智能化施工项目的"节点下钻式"甘特图管理工具。作者是非程序员（Vibe Coding 方式），React + TypeScript 代码质量在可接受范围以上。

### 技术栈

- **前端框架：** React 18.3 + TypeScript 5.5（strict 模式）
- **构建工具：** Vite 5.4
- **状态管理：** Zustand 4.5
- **路由：** React Router 6.26
- **样式：** Tailwind CSS 3.4 + 自定义 CSS 变量
- **图标：** lucide-react 0.451
- **后端 API：** 内部 Node.js dev-server（chokidar 监听文件 + SSE 推变更）

### 目录结构

```
ganntlens/
├── data/                    # 项目数据（JSON 文件驱动）
│   ├── manifest.json
│   ├── locks/               # 软锁（防并发冲突）
│   └── projects/{dc,m,ofc}-2026/
├── server/
│   ├── dev-server.mjs       # API + SSE 服务端
│   └── createDevPlugin.mjs  # Vite 插件封装
├── src/
│   ├── components/
│   │   ├── gantt/           # 甘特图相关（GanttChart, TaskBar, TimelineHeader 等）
│   │   ├── drawer/          # 任务详情抽屉（4-Tab）
│   │   ├── ai/              # AI 聊天面板
│   │   ├── file/            # 文件树
│   │   └── layout/          # 布局（LockBanner）
│   ├── lib/
│   │   ├── gantt/           # 工具（dateUtils, useDragController, useHoverPosition）
│   │   ├── data/            # API 客户端 + SSE 客户端
│   │   ├── ai/              # Mock LLM 引擎 + 命令路由
│   │   └── seed/            # Seed 数据（3 个演示项目）
│   ├── store/               # Zustand stores（project, ui, ai）
│   ├── routes/              # 页面（OverviewPage, ProjectDetailPage）
│   └── types/               # TypeScript 类型定义
```

---

## 三、架构亮点

### 1. 数据流：乐观更新 + 失败回滚

```
用户操作 → 乐观更新 store → API 写盘 → 成功保持 / 失败回滚
                                        ↓
                               chokidar 检测到文件变更
                                        ↓
                              SSE → 其他客户端同步更新
```

### 2. 拖拽系统

`useDragController` 是一个通用拖拽 hook，抽象了：

- mousedown → mousemove → mouseup 事件生命周期
- 像素 → 天数换算
- 越界检测（出阶段边界时 visual feedback）
- ref 缓存模式避免 render 抖动

### 3. 并发控制

- 文件级软锁（`data/locks/<projectId>.lock`）
- 2 分钟 TTL，30 秒清理周期
- 冲突时返回 409，UI 展示 LockBanner
- Atomic write（写临时文件 → rename）

### 4. Mock LLM 引擎

覆盖 7 种场景，零网络依赖：

| 场景 | 触发关键词 |
|------|-----------|
| 里程碑平移 | `M1 延后 3 天` / `M2 提前 1 周` |
| 任务进度更新 | `验收测试 进度 70%` / `M1 进度 50%` |
| 冲突检测 | `冲突` / `风险` |
| 周报生成 | `周报` / `weekly` |
| 完成度统计 | `完成度` / `进度总览` |
| 任务拆解 | `拆解 弱电管线` |
| 页面跳转 | `打开 DC-2026` |

---

## 四、存在问题

### 🔴 严重（建议修复）

#### 1. 总览页任务条无名称标识（移动端不可用）

- **位置：** `src/components/gantt/GanttChart.tsx`
- **问题：** 总览页上任务条直接绘制，没有名称列，只能通过鼠标 hover 预览卡识别任务。手机/触屏设备没有 hover，用户完全看不到任务名
- **影响：** 移动端体验为 0
- **建议：** 在 ProjectRow 左侧加一个 120-140px 的任务名称列，或至少每个任务行显示名称 tooltip

#### 2. AI 拆解功能正则过度匹配

- **位置：** `src/lib/ai/mockEngine.ts:188`
- **代码：**
  ```javascript
  const kw = input.replace(/拆解|分解|breakdown|把|M\d|的|任务|一下|看看/g, '').trim();
  ```
- **问题：** 输入 `"拆解M1"` → 去掉 `拆解` 和 `M1` → `kw = ""` → 回退到 `p.tasks[0]`，返回了错误的任务
- **影响：** 用户意图是拆解 M1，结果拆解了别的任务

#### 3. 抽屉里子任务/文档/交付物是硬编码假数据

- **位置：** `src/components/drawer/TaskDrawer.tsx:57-79`
- **问题：** `subtasks`、`docs`、`deliverables` 都是固定的 mock 数组，不引用 `files.json` / `activities.json` 中的真实数据
- **影响：** 文件树（FileTree）展示了真实文件列表，但抽屉的 DOCS tab 和它不一致
- **建议：** 从 project 的 `files` / `activities` 属性读取

### 🟡 中等（建议关注）

#### 4. 日期排序语义不对

- **位置：** `src/routes/OverviewPage.tsx:19-20`
- **代码：**
  ```javascript
  const allStarts = projects.map((p) => p.start);
  const allEnds = projects.map((p) => p.end);
  const rangeStart = allStarts.sort()[0];
  const rangeEnd = allEnds.sort().reverse()[0];
  ```
- **问题：** `.sort()` 默认按字典序排序字符串，YYYY-MM-DD 格式碰巧正确，但语义上应使用 Date 对象
- **建议：**
  ```javascript
  const rangeStart = projects.map(p => new Date(p.start)).sort((a,b) => a-b)[0].toISOString().split('T')[0];
  ```

#### 5. Dev server 无请求体大小限制

- **位置：** `server/dev-server.mjs:137-141`
- **问题：** `POST /api/projects/:id` 直接用 `buf += c` 拼接请求体，无大小上限
- **影响：** demo 环境无风险，生产部署需要加 `maxBodySize` 限制

#### 6. API 无版本号

- **位置：** `src/lib/data/apiClient.ts:8`
- **代码：** `const BASE = '/api'`
- **问题：** API 路径硬编码为 `/api`，无版本前缀
- **建议：** 改为 `/api/v1`，便于未来兼容

#### 7. AIChatPanel useEffect 忽略依赖

- **位置：** `src/components/ai/AIChatPanel.tsx:65-66`
- **问题：** eslint-disable react-hooks/exhaustive-deps。scope 变化时 seed 消息不会重新注入
- **影响：** 从总览页（global scope）切到项目详情页（scoped scope）时，旧的 seed 消息还在

### 🟢 轻微（纯建议）

#### 8. 内联样式过多，Tailwind 基本没用

- **位置：** 全局，16+ 组件
- **问题：** 绝大多数样式用 `style={{...}}` 写，虽然 CSS 变量让它保持了一定一致性，但代码量可以用 Tailwind utility classes 减少约 40%
- **示例对比：**
  ```jsx
  // 当前内联
  <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--ink)' }}>
  // 可简化为 Tailwind
  <div className="text-[11px] font-medium text-ink">
  ```

#### 9. seed 数据基线日期已过时

- **位置：** `src/lib/seed/seedData.ts:20`
- **代码：** `const today = '2026-06-16'`
- **问题：** 演示基线是 2026-06-16，已过去近一年。Demo 的"今天线"位置和"到期风险"都不对了
- **建议：** 改为动态计算：`const DEMO_TODAY = new Date().toISOString().split('T')[0]`

#### 10. shiftMilestone 无级联提示

- **位置：** `src/store/projectStore.ts:84-110`
- **问题：** 移动 M1 会自动级联移动 M2，但 UI 没有提示用户
- **建议：** 在 DragPreview 上加一行小字 `M2 也将顺延 N 天`

---

## 五、项目亮点总结

- ✅ **数据模型设计完整** — 7 个实体（Project / Phase / Milestone / Task / FileNode / Activity / AINote），类型定义严谨
- ✅ **状态管理清晰** — 3 个 Zustand store 职责分明（project / ui / ai）
- ✅ **乐观更新 + 回滚** — 拖拽操作即时反馈，写盘失败自动回滚
- ✅ **SSE 实时同步** — 多端协作基础设施完备
- ✅ **并发控制** — 软锁 + atomic write 避免写冲突
- ✅ **Mock LLM 引擎** — 零网络依赖，覆盖面广，延迟模拟真实 API
- ✅ **GitHub Pages 部署** — CI 完整（typecheck → build → 404 fallback → deploy）
- ✅ **拖拽系统抽象** — useDragController 可复用、性能优化好

---

## 六、总体评价

**代码质量：7/10**

TypeScript 严格模式、Zustand 状态管理、乐观更新回滚、拖拽系统等架构决策都做得很好。主要改进空间在于：

1. **移动端适配** — 当前几乎不可用
2. **去硬编码** — 抽屉数据应连接真实数据源
3. **Tailwind 应用** — 减少 inline styles 可显著降低代码体积
4. **动态时间基线** — Demo 不应固死在一个日期上
