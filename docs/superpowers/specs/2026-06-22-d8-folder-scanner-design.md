# D8: 文件夹扫描器设计

> 日期：2026-06-22
> 状态：Spec
> 目标：扫描服务器指定文件夹 → 自动识别项目数据 → 生成 GanttLens JSON

## 1. 概述

### 1.1 当前状态

数据是手写 JSON 在 `data/projects/<id>/`。每个项目 9 个文件（project.json, files.json 等）。dev-server 读这些文件提供 API。

### 1.2 目标

扫描真实文件夹（如 Nextcloud 项目目录）→ 自动生成 project.json + files.json → 前端甘特图直接展示。chokidar 实时监听变化。

### 1.3 参考文件夹结构

```
项目根目录/
├── ACME - PRJ-2026-001 苏州工厂改造/
│   ├── 01_方案 Design Documents/
│   │   ├── 方案设计 Schematic Design/    (docx, xls, md)
│   │   └── 深化图纸 Shop Drawings/       (dwg, pdf, bak)
│   ├── 02_预算 Budget & BOQ/
│   │   └── 设备材料清单 BOQ/             (xlsx, md)
│   ├── 03_资料 Technical Archive/
│   │   └── Correspondence/
│   │       ├── 会议纪要 Meeting Minutes/         (md, 有日期)
│   │       ├── 发文 Outgoing Documents/
│   │       └── 收文 Incoming Documents/
│   ├── CLAUDE.md
│   └── 项目详情.md
├── [其他项目文件夹...]
```

---

## 2. 扫描配置

### 2.1 配置文件

`data/scan-config.json`：

```json
{
  "scanRoot": "D:\\项目根目录",
  "enabled": true,
  "lastScan": null
}
```

- `scanRoot`：扫描根路径（绝对路径）
- `enabled`：是否启用扫描
- `lastScan`：上次扫描时间戳（epoch 毫秒）

### 2.2 配置 API

- `GET /api/scan-config` — 读取配置
- `POST /api/scan-config` — 更新配置（写 scan-config.json）
- `POST /api/scan` — 手动触发一次全量扫描

---

## 3. 扫描器逻辑

### 3.1 项目识别

从文件夹名解析项目信息：

```
"ACME - PRJ-2026-001 苏州工厂改造"
       └───────────┘ └──────────┘
       项目代号        项目名称
```

解析规则：
1. 去掉前缀（如 `ACME - `）
2. 匹配 `[A-Z]{2,}-\d{4}-[A-Z0-9]+` 模式 → 项目代号（`PRJ-2026-001`）
3. 剩余部分 → 项目名称（`苏州工厂改造`）
4. 项目 ID = 代号小写化（`prj-2026-001`）

如果文件夹名不匹配模式：
- ID = 文件夹名 slugify（空格→横线，小写）
- 代号 = ID 大写
- 名称 = 文件夹名原文

### 3.2 阶段识别

从子文件夹名匹配阶段（关键词匹配，不区分大小写）：

| 关键词 | 匹配阶段 | GanttLens phaseId |
|--------|----------|-------------------|
| `01` / `方案` / `design` / `schematic` | 设计 | `design` |
| `施工` / `construction` / `install` | 施工 | `construction` |
| `02` / `预算` / `budget` / `boq` | 预算（归入设计阶段尾部） | `design` |
| `03` / `资料` / `archive` / `acceptance` / `验收` | 验收 | `acceptance` |

如果一个子文件夹不匹配任何关键词，归入"其他"类别，文件仍然扫描进 files.json。

### 3.3 文件树生成

递归扫描项目文件夹，生成 FileNode 树：

```typescript
interface ScanFileNode {
  id: string;          // 相对路径 hash
  name: string;        // 文件/文件夹名
  type: 'file' | 'folder';
  ext?: string;        // 扩展名（无点，小写）
  size?: number;       // 字节数（文件）
  mtime?: number;      // 修改时间戳
  children?: ScanFileNode[];  // 子节点（文件夹）
}
```

排除规则：
- 隐藏文件夹（`.`开头，如 `.claude/`）
- 临时文件（`.bak`, `.tmp`, `.log`）
- `_Archive_` 文件夹内的文件（归档不展示）

### 3.4 日期提取

从文件名提取日期，推断项目时间线：

匹配模式：
- `YYYYMMDD`（如 `20260323`）
- `YYYY-MM-DD`（如 `2026-03-23`）
- `YYYY/MM/DD`
- `YYYY.MM.DD`

提取所有日期 → 最早日期 = 项目 start，最晚日期 = 项目 end（或 start + 90 天默认工期，取较晚者）。

阶段日期：
- 设计阶段：start → 最早施工类文件日期（或 start + 30 天）
- 施工阶段：最早施工文件 → 最晚施工文件（或 start + 60 天）
- 验收阶段：最晚文件日期 → end

### 3.5 里程碑生成

自动生成 2 个里程碑：
- M1：设计→施工边界（设计阶段 planEnd）
- M2：施工→验收边界（施工阶段 planEnd）

### 3.6 任务生成

从子文件夹名生成任务（去掉编号前缀和双语后缀）：

```
"01_方案设计 Schematic Design" → "方案设计"
"01_深化图纸 Shop Drawings"    → "深化图纸"
"02_设备材料清单 BOQ"           → "设备材料清单"
"03_会议纪要 Meeting Minutes"   → "会议纪要"
```

任务属性：
- `phaseId`：按子文件夹匹配的阶段
- `planStart` / `planEnd`：从该子文件夹下文件的日期范围推断
- `progress`：0（默认未开始，用户手动更新）
- `owner`：从文件名或 CLAUDE.md 推断（可选，默认空）

---

## 4. 生成产物

扫描器为每个项目生成/更新以下文件：

### 4.1 project.json

```json
{
  "id": "prj-2026-001",
  "code": "PRJ-2026-001",
  "name": "苏州工厂改造",
  "status": "active",
  "start": "2026-03-13",
  "end": "2026-06-30",
  "description": "自动扫描生成",
  "phases": [
    {
      "id": "design",
      "name": "设计",
      "color": "#dbeafe",
      "order": 1,
      "planStart": "2026-03-13",
      "planEnd": "2026-04-15",
      "actualStart": null,
      "actualEnd": null
    }
  ],
  "milestones": [
    { "id": "m1", "name": "M1 开工", "date": "2026-04-15", "betweenPhases": ["design", "construction"], "status": "planned" },
    { "id": "m2", "name": "M2 验收", "date": "2026-06-15", "betweenPhases": ["construction", "acceptance"], "status": "planned" }
  ],
  "tasks": [
    { "id": "task-1", "name": "方案设计", "phaseId": "design", "planStart": "2026-03-13", "planEnd": "2026-03-23", "progress": 0, "owner": "" }
  ],
  "lastModifiedBy": "scanner",
  "lastModifiedAt": "2026-06-22T12:00:00.000Z"
}
```

### 4.2 files.json

完整的 FileNode 树（见 §3.3）。

### 4.3 manifest.json 更新

扫描后更新 manifest.json：
- 新项目 → 添加条目
- 已有项目 → 更新 mtime
- 不删除 manifest 中已有但文件夹不存在的历史项目（保留数据）

---

## 5. dev-server 集成

### 5.1 启动流程

```
dev-server 启动
  → 读取 data/scan-config.json
  → 如果 enabled && scanRoot 存在
    → 全量扫描一次
    → chokidar 监听 scanRoot
  → 启动 API server (5174)
```

### 5.2 chokidar 监听

监听 scanRoot（非 data/）：
- `addDir` → 新项目文件夹 → 扫描该项目
- `add` / `change` / `unlink` → 文件变化 → 重新扫描所属项目
- `unlinkDir` → 项目文件夹删除 → 从 manifest 标记为 inactive

防抖：500ms 内多次变化合并为一次扫描。

### 5.3 新增 API 端点

| 方法 | 路径 | 功能 |
|------|------|------|
| GET | `/api/scan-config` | 读取扫描配置 |
| POST | `/api/scan-config` | 更新扫描配置（scanRoot, enabled） |
| POST | `/api/scan` | 手动触发全量扫描 |
| GET | `/api/scan/status` | 扫描状态（scanning/idle, lastScan, projectCount） |

### 5.4 与现有 data/ 监听的关系

- 现有 chokidar 监听 `data/` → SSE 推送（不变）
- 新增 chokidar 监听 `scanRoot` → 触发扫描 → 写 data/ → 触发现有监听 → SSE
- 链式：scanRoot 变化 → 扫描 → 写 data/ → SSE → 前端 reload

---

## 6. 前端

### 6.1 扫描配置面板

在 AI 面板或设置入口加一个"扫描配置"区域：
- 显示当前 scanRoot 路径
- 输入框修改路径
- 开关启用/禁用
- "立即扫描"按钮
- 扫描状态指示器（idle / scanning + 进度）

### 6.2 扫描状态 SSE

扫描开始/完成时通过 SSE 推送事件：
```json
{ "type": "scan-start", "timestamp": 1719014400000 }
{ "type": "scan-complete", "projectCount": 3, "timestamp": 1719014410000 }
```

---

## 7. 文件结构

| 文件 | 动作 | 职责 |
|------|------|------|
| `server/scanner.mjs` | 新建 | 扫描器核心逻辑 |
| `server/dev-server.mjs` | 修改 | 集成扫描器 + 新 API 端点 |
| `data/scan-config.json` | 新建 | 扫描配置 |
| `src/types/index.ts` | 修改 | 加 ScanConfig 类型 |
| `src/lib/apiClient.ts` | 修改 | 加 scan-config / scan API 调用 |
| `src/components/ai/AIChatPanel.tsx` | 修改 | 加扫描配置 UI |

---

## 8. 不做

- 不做文件预览（D9 范围）
- 不做文件内容解析（不读 docx/pdf 内容，只读文件名和元数据）
- 不做项目删除（文件夹删除只标记 inactive，不删 data/）
- 不做多根路径（只支持一个 scanRoot）
- 不做扫描规则自定义（阶段关键词硬编码，后续可扩展）

---

## 9. 验证

- 配置 scanRoot 指向真实文件夹
- 启动 dev-server → 自动扫描 → 生成 project.json + files.json
- 前端显示扫描到的项目
- 在源文件夹新增文件 → 5s 内前端更新
- typecheck 0 errors
