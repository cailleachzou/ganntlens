# D8 文件夹扫描器实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 扫描服务器指定文件夹 → 自动识别项目数据 → 生成 GanttLens JSON，chokidar 实时监听变化。

**Architecture:** 新建 `server/scanner.mjs` 扫描器核心逻辑（项目识别 + 文件树 + 日期提取 + 阶段/任务生成），集成到 `dev-server.mjs`（新 API + chokidar 监听 scanRoot），前端 AIChatPanel 加扫描配置 UI。

**Tech Stack:** Node.js (fs, path, chokidar) + React + TypeScript + Zustand

**Spec:** [2026-06-22-d8-folder-scanner-design.md](file:///c:/git-project/TRAE/docs/superpowers/specs/2026-06-22-d8-folder-scanner-design.md)

---

## 文件结构

| 文件 | 动作 | 职责 |
|------|------|------|
| `server/scanner.mjs` | 新建 | 扫描器核心逻辑：项目识别、文件树、日期提取、阶段/里程碑/任务生成 |
| `server/dev-server.mjs` | 修改 | 集成扫描器 + 4 个新 API 端点 + chokidar 监听 scanRoot |
| `data/scan-config.json` | 新建 | 扫描配置（scanRoot, enabled, lastScan） |
| `src/types/data.ts` | 修改 | 加 ScanConfig 类型 + scan 事件类型 |
| `src/lib/data/apiClient.ts` | 修改 | 加 scan-config / scan API 调用 |
| `src/lib/data/sseClient.ts` | 修改 | 加 scan-start / scan-complete 事件监听 |
| `src/components/ai/AIChatPanel.tsx` | 修改 | 加扫描配置 UI（路径输入 + 开关 + 扫描按钮 + 状态） |

---

### Task 1: scanner.mjs — 扫描器核心逻辑

**Files:**
- Create: `server/scanner.mjs`

- [ ] **Step 1: 创建 scanner.mjs 骨架 + 工具函数**

创建 `server/scanner.mjs`，写入以下内容：

```javascript
// D8 文件夹扫描器
// 扫描指定根目录 → 识别项目 → 生成 project.json + files.json
// 见 docs/superpowers/specs/2026-06-22-d8-folder-scanner-design.md

import fs from 'node:fs/promises';
import fssync from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// ── 排除规则 ──
const EXCLUDE_DIRS = new Set(['.git', '.claude', 'node_modules', '_Archive_']);
const EXCLUDE_EXTS = new Set(['.bak', '.tmp', '.log']);

// ── 阶段关键词 ──
const PHASE_KEYWORDS = [
  { phaseId: 'design',       keywords: ['01', '方案', 'design', 'schematic'] },
  { phaseId: 'design',       keywords: ['02', '预算', 'budget', 'boq'] },
  { phaseId: 'construction', keywords: ['施工', 'construction', 'install'] },
  { phaseId: 'acceptance',   keywords: ['03', '资料', 'archive', 'acceptance', '验收'] }
];

// ── 工具函数 ──

function slugify(text) {
  return text
    .trim()
    .replace(/[^\w\u4e00-\u9fff-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

function hashId(text) {
  return crypto.createHash('md5').update(text).digest('hex').slice(0, 12);
}

// 从文件夹名解析项目信息
export function parseProjectName(folderName) {
  // 去掉常见前缀（如 "ACME - "）
  const cleaned = folderName.replace(/^[A-Z]+\s*-\s*/, '');

  // 匹配项目代号：[A-Z]{2,}-\d{4}-[A-Z0-9]+
  const codeMatch = cleaned.match(/([A-Z]{2,}-\d{4}-[A-Z0-9]+)/);

  if (codeMatch) {
    const code = codeMatch[1];
    const remaining = cleaned.replace(code, '').trim().replace(/^\s*-\s*/, '');
    return {
      id: code.toLowerCase(),
      code,
      name: remaining || cleaned
    };
  }

  // 不匹配模式：slugify
  const id = slugify(folderName);
  return {
    id,
    code: id.toUpperCase(),
    name: folderName
  };
}

// 从子文件夹名匹配阶段
export function matchPhase(folderName) {
  const lower = folderName.toLowerCase();
  for (const { phaseId, keywords } of PHASE_KEYWORDS) {
    if (keywords.some((kw) => lower.includes(kw.toLowerCase()))) {
      return phaseId;
    }
  }
  return null;
}

// 从文件名提取日期
export function extractDates(filename) {
  const dates = [];
  // YYYYMMDD
  const m1 = filename.match(/(\d{4})(\d{2})(\d{2})/g);
  if (m1) {
    for (const d of m1) {
      const y = parseInt(d.slice(0, 4));
      const mo = parseInt(d.slice(4, 6));
      const day = parseInt(d.slice(6, 8));
      if (y >= 2020 && y <= 2030 && mo >= 1 && mo <= 12 && day >= 1 && day <= 31) {
        dates.push(`${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`);
      }
    }
  }
  // YYYY-MM-DD / YYYY/MM/DD / YYYY.MM.DD
  const m2 = filename.match(/(\d{4})[-/.](\d{2})[-/.](\d{2})/g);
  if (m2) {
    for (const d of m2) {
      const parts = d.split(/[-/.]/);
      const y = parseInt(parts[0]);
      const mo = parseInt(parts[1]);
      const day = parseInt(parts[2]);
      if (y >= 2020 && y <= 2030 && mo >= 1 && mo <= 12 && day >= 1 && day <= 31) {
        dates.push(`${parts[0]}-${parts[1]}-${parts[2]}`);
      }
    }
  }
  return dates;
}

function earliestDate(dates) {
  if (dates.length === 0) return null;
  return dates.sort()[0];
}

function latestDate(dates) {
  if (dates.length === 0) return null;
  return dates.sort().reverse()[0];
}

function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// 从子文件夹名提取任务名（去掉编号前缀和双语后缀）
export function extractTaskName(folderName) {
  // 去掉 "XX_编号 " 前缀，如 "01_方案设计"
  let name = folderName.replace(/^\d+[_\s]*/, '');
  // 去掉双语后缀（英文部分在中文之后，用空格分隔）
  // "方案设计 Schematic Design" → "方案设计"
  name = name.replace(/\s+[A-Za-z][A-Za-z\s]*$/, '').trim();
  return name || folderName;
}
```

- [ ] **Step 2: 添加文件树扫描函数**

在 `server/scanner.mjs` 末尾追加：

```javascript
// ── 文件树扫描 ──

async function scanFileTree(dirPath, relativePath = '') {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const nodes = [];

  for (const entry of entries) {
    // 排除隐藏文件/文件夹
    if (entry.name.startsWith('.')) continue;
    if (EXCLUDE_DIRS.has(entry.name)) continue;

    const fullPath = path.join(dirPath, entry.name);
    const relPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      const children = await scanFileTree(fullPath, relPath);
      if (children.length > 0) {
        nodes.push({
          id: hashId(relPath),
          name: entry.name,
          type: 'folder',
          children
        });
      }
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (EXCLUDE_EXTS.has(ext)) continue;

      const stat = await fs.stat(fullPath);
      nodes.push({
        id: hashId(relPath),
        name: entry.name,
        type: 'file',
        ext: ext.replace('.', ''),
        size: stat.size,
        mtime: stat.mtimeMs
      });
    }
  }

  return nodes;
}

// 收集文件夹下所有文件名（用于日期提取）
function collectFileNames(nodes, names = []) {
  for (const node of nodes) {
    if (node.type === 'file') {
      names.push(node.name);
    } else if (node.children) {
      collectFileNames(node.children, names);
    }
  }
  return names;
}
```

- [ ] **Step 3: 添加项目扫描函数**

在 `server/scanner.mjs` 末尾追加：

```javascript
// ── 单项目扫描 ──

export async function scanProject(projectDir) {
  const folderName = path.basename(projectDir);
  const { id, code, name } = parseProjectName(folderName);

  // 扫描文件树
  const fileTree = await scanFileTree(projectDir);

  // 收集所有文件名提取日期
  const fileNames = collectFileNames(fileTree);
  const allDates = fileNames.flatMap(extractDates);

  // 项目时间线
  const start = earliestDate(allDates) || new Date().toISOString().slice(0, 10);
  const end = latestDate(allDates) || addDays(start, 90);
  const projectEnd = end > addDays(start, 90) ? end : addDays(start, 90);

  // 识别子文件夹 → 阶段 + 任务
  const entries = await fs.readdir(projectDir, { withFileTypes: true });
  const tasks = [];
  const phaseDates = {
    design: { start: null, end: null },
    construction: { start: null, end: null },
    acceptance: { start: null, end: null }
  };

  let taskIdx = 1;
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith('.') || EXCLUDE_DIRS.has(entry.name)) continue;

    const phaseId = matchPhase(entry.name);
    if (!phaseId) continue;

    const subDir = path.join(projectDir, entry.name);
    const subTree = await scanFileTree(subDir);
    const subFileNames = collectFileNames(subTree);
    const subDates = subFileNames.flatMap(extractDates);

    const taskStart = earliestDate(subDates) || start;
    const taskEnd = latestDate(subDates) || addDays(taskStart, 14);

    tasks.push({
      id: `task-${taskIdx}`,
      name: extractTaskName(entry.name),
      phaseId,
      planStart: taskStart,
      planEnd: taskEnd,
      progress: 0,
      owner: ''
    });
    taskIdx++;

    // 更新阶段日期
    if (!phaseDates[phaseId].start || taskStart < phaseDates[phaseId].start) {
      phaseDates[phaseId].start = taskStart;
    }
    if (!phaseDates[phaseId].end || taskEnd > phaseDates[phaseId].end) {
      phaseDates[phaseId].end = taskEnd;
    }
  }

  // 构建阶段
  const designEnd = phaseDates.design?.end || phaseDates.construction?.start || addDays(start, 30);
  const constructionEnd = phaseDates.construction?.end || phaseDates.acceptance?.start || addDays(start, 60);

  const phases = [
    {
      id: 'design',
      name: '设计',
      color: '#dbeafe',
      order: 1,
      planStart: start,
      planEnd: designEnd,
      actualStart: null,
      actualEnd: null
    },
    {
      id: 'construction',
      name: '施工',
      color: '#fef3c7',
      order: 2,
      planStart: designEnd,
      planEnd: constructionEnd,
      actualStart: null,
      actualEnd: null
    },
    {
      id: 'acceptance',
      name: '验收',
      color: '#dcfce7',
      order: 3,
      planStart: constructionEnd,
      planEnd: projectEnd,
      actualStart: null,
      actualEnd: null
    }
  ];

  // 构建里程碑
  const milestones = [
    {
      id: 'm1',
      name: 'M1 开工',
      date: designEnd,
      betweenPhases: ['design', 'construction'],
      status: 'planned'
    },
    {
      id: 'm2',
      name: 'M2 验收',
      date: constructionEnd,
      betweenPhases: ['construction', 'acceptance'],
      status: 'planned'
    }
  ];

  // 构建 project.json
  const project = {
    id,
    code,
    name,
    status: 'active',
    start,
    end: projectEnd,
    description: '自动扫描生成',
    phases,
    milestones,
    tasks,
    lastModifiedBy: 'scanner',
    lastModifiedAt: new Date().toISOString()
  };

  // 构建 files.json
  const files = {
    projectId: id,
    files: fileTree,
    lastModifiedBy: 'scanner',
    lastModifiedAt: new Date().toISOString()
  };

  return { project, files };
}
```

- [ ] **Step 4: 添加全量扫描函数**

在 `server/scanner.mjs` 末尾追加：

```javascript
// ── 全量扫描 ──

export async function scanAll(scanRoot) {
  // 检查根目录是否存在
  try {
    await fs.access(scanRoot);
  } catch {
    return { projects: [], error: `扫描根目录不存在: ${scanRoot}` };
  }

  const entries = await fs.readdir(scanRoot, { withFileTypes: true });
  const results = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith('.')) continue;

    const projectDir = path.join(scanRoot, entry.name);
    try {
      const result = await scanProject(projectDir);
      results.push(result);
    } catch (err) {
      console.error(`[scanner] 扫描项目失败: ${entry.name}`, err.message);
    }
  }

  return { projects: results, error: null };
}
```

- [ ] **Step 5: 验证 scanner.mjs 语法**

Run: `cd c:\git-project\TRAE; node -e "import('./server/scanner.mjs').then(m => console.log(Object.keys(m)))"`
Expected: `[ 'parseProjectName', 'matchPhase', 'extractDates', 'extractTaskName', 'scanProject', 'scanAll' ]`

- [ ] **Step 6: Commit**

```bash
cd c:\git-project\TRAE
git add server/scanner.mjs
git commit -m "feat(d8): scanner.mjs - 文件夹扫描器核心逻辑（项目识别+文件树+日期提取+阶段/任务生成）"
```

---

### Task 2: scan-config.json + 类型定义

**Files:**
- Create: `data/scan-config.json`
- Modify: `src/types/data.ts` (末尾追加)

- [ ] **Step 1: 创建 scan-config.json**

创建 `data/scan-config.json`：

```json
{
  "scanRoot": "",
  "enabled": false,
  "lastScan": null
}
```

- [ ] **Step 2: 在 types/data.ts 末尾追加 ScanConfig 类型**

在 `src/types/data.ts` 末尾追加：

```typescript
// D8 扫描配置
export interface ScanConfig {
  scanRoot: string;
  enabled: boolean;
  lastScan: number | null;
}

export interface ScanStatus {
  scanning: boolean;
  lastScan: number | null;
  projectCount: number;
  error: string | null;
}

export type ScanEventKind = 'scan-start' | 'scan-complete';

export interface ScanEvent {
  kind: ScanEventKind;
  timestamp: number;
  projectCount?: number;
  error?: string | null;
}
```

- [ ] **Step 3: Run typecheck**

Run: `cd c:\git-project\TRAE; npm run typecheck`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
cd c:\git-project\TRAE
git add data/scan-config.json src/types/data.ts
git commit -m "feat(d8): scan-config.json + ScanConfig/ScanStatus/ScanEvent 类型定义"
```

---

### Task 3: dev-server 集成 — API 端点 + chokidar 监听

**Files:**
- Modify: `server/dev-server.mjs`

- [ ] **Step 1: 在 dev-server.mjs 顶部添加 scanner import**

在 `server/dev-server.mjs` 第 13 行（`import { fileURLToPath }` 之后）追加：

```javascript
import { scanAll, scanProject } from './scanner.mjs';
```

- [ ] **Step 2: 添加扫描状态变量 + 配置读写函数**

在 `server/dev-server.mjs` 的 `const recentSelfWrites = new Map();` 之后（约第 27 行后）追加：

```javascript
// D8 扫描状态
const SCAN_CONFIG_PATH = path.join(DATA, 'scan-config.json');
let scanState = { scanning: false, lastScan: null, projectCount: 0, error: null };
let scanWatcher = null;

async function readScanConfig() {
  try {
    return await readJson(SCAN_CONFIG_PATH);
  } catch {
    return { scanRoot: '', enabled: false, lastScan: null };
  }
}

async function writeScanConfig(cfg) {
  await writeJsonAtomic(SCAN_CONFIG_PATH, cfg);
}
```

- [ ] **Step 3: 添加扫描执行函数**

在上一步的代码之后追加：

```javascript
async function executeScan() {
  const cfg = await readScanConfig();
  if (!cfg.scanRoot) {
    scanState.error = '未配置扫描根路径';
    return;
  }

  scanState.scanning = true;
  scanState.error = null;
  bus.emit('change', { kind: 'scan-start', timestamp: Date.now() });

  try {
    const { projects, error } = await scanAll(cfg.scanRoot);
    if (error) {
      scanState.error = error;
    } else {
      // 为每个项目生成 JSON 文件
      for (const { project, files } of projects) {
        const projDir = path.join(DATA, 'projects', project.id);
        await fs.mkdir(projDir, { recursive: true });
        await writeJsonAtomic(path.join(projDir, 'project.json'), project);
        await writeJsonAtomic(path.join(projDir, 'files.json'), files);
      }

      // 更新 manifest
      const manifest = await readJson(path.join(DATA, 'manifest.json'));
      for (const { project } of projects) {
        const existing = manifest.projects.find((p) => p.id === project.id);
        if (existing) {
          existing.code = project.code;
          existing.name = project.name;
          existing.status = project.status;
          existing.mtime = Date.now();
        } else {
          manifest.projects.push({
            id: project.id,
            code: project.code,
            name: project.name,
            status: project.status,
            mtime: Date.now()
          });
        }
      }
      await writeJsonAtomic(path.join(DATA, 'manifest.json'), manifest);

      scanState.projectCount = projects.length;
      scanState.lastScan = Date.now();

      // 更新配置中的 lastScan
      cfg.lastScan = Date.now();
      await writeScanConfig(cfg);
    }
  } catch (err) {
    scanState.error = err.message;
    console.error('[dev-server] 扫描失败:', err);
  } finally {
    scanState.scanning = false;
    bus.emit('change', {
      kind: 'scan-complete',
      timestamp: Date.now(),
      projectCount: scanState.projectCount,
      error: scanState.error
    });
  }
}

// 启动 scanRoot 监听
async function startScanWatcher(scanRoot) {
  if (scanWatcher) {
    await scanWatcher.close();
    scanWatcher = null;
  }
  if (!scanRoot) return;

  scanWatcher = chokidar.watch(scanRoot, {
    ignoreInitial: true,
    ignored: (p) => {
      const base = path.basename(p);
      return base.startsWith('.') || EXCLUDE_SCAN_PATHS.has(base);
    },
    awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 50 }
  });

  let debounceTimer = null;
  const triggerScan = () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      executeScan();
      debounceTimer = null;
    }, 500);
  };

  scanWatcher.on('addDir', triggerScan);
  scanWatcher.on('add', triggerScan);
  scanWatcher.on('change', triggerScan);
  scanWatcher.on('unlink', triggerScan);
  scanWatcher.on('unlinkDir', triggerScan);

  console.log(`[dev-server] scanRoot watcher started: ${scanRoot}`);
}
```

在 `startScanWatcher` 之前添加排除集合：

```javascript
const EXCLUDE_SCAN_PATHS = new Set(['.git', '.claude', 'node_modules', '_Archive_', '.DS_Store', 'Thumbs.db']);
```

- [ ] **Step 4: 添加 4 个 API handler 函数**

在 `handleEvents` 函数之前（约第 169 行前）追加：

```javascript
// D8 扫描 API
async function handleGetScanConfig(req, res) {
  const cfg = await readScanConfig();
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(cfg));
}

async function handleUpdateScanConfig(req, res) {
  const body = await new Promise((resolve, reject) => {
    let buf = '';
    req.on('data', (c) => (buf += c));
    req.on('end', () => resolve(buf));
    req.on('error', reject);
  });
  const update = JSON.parse(body);
  const cfg = await readScanConfig();
  if (typeof update.scanRoot === 'string') cfg.scanRoot = update.scanRoot;
  if (typeof update.enabled === 'boolean') cfg.enabled = update.enabled;
  await writeScanConfig(cfg);

  // 如果启用且 scanRoot 有值，启动监听 + 立即扫描
  if (cfg.enabled && cfg.scanRoot) {
    await startScanWatcher(cfg.scanRoot);
    executeScan(); // 异步，不 await
  } else if (!cfg.enabled) {
    if (scanWatcher) {
      await scanWatcher.close();
      scanWatcher = null;
    }
  }

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(cfg));
}

async function handleScan(req, res) {
  executeScan(); // 异步，不 await
  res.writeHead(202, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ message: 'scan started' }));
}

async function handleScanStatus(req, res) {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(scanState));
}
```

- [ ] **Step 5: 在 start() 函数中注册新路由**

在 `server/dev-server.mjs` 的 `start()` 函数中，找到 `if (url.pathname === '/api/events'` 之前，插入：

```javascript
    // D8 扫描 API
    if (url.pathname === '/api/scan-config' && req.method === 'GET') {
      return asyncRoute(handleGetScanConfig)(req, res);
    }
    if (url.pathname === '/api/scan-config' && req.method === 'POST') {
      return asyncRoute(handleUpdateScanConfig)(req, res);
    }
    if (url.pathname === '/api/scan' && req.method === 'POST') {
      return asyncRoute(handleScan)(req, res);
    }
    if (url.pathname === '/api/scan/status' && req.method === 'GET') {
      return asyncRoute(handleScanStatus)(req, res);
    }
```

- [ ] **Step 6: 在 start() 函数中添加启动时自动扫描**

在 `start()` 函数的 `startWatcher();` 之后，添加：

```javascript
  // D8: 启动时检查扫描配置，如果启用则自动扫描
  (async () => {
    const cfg = await readScanConfig();
    if (cfg.enabled && cfg.scanRoot) {
      console.log(`[dev-server] 启动自动扫描: ${cfg.scanRoot}`);
      await startScanWatcher(cfg.scanRoot);
      executeScan();
    }
  })();
```

- [ ] **Step 7: 在 SSE handler 中添加 scan 事件推送**

修改 `handleEvents` 函数中的 `onChange` 回调，让它也能推送 scan 事件。找到：

```javascript
  const onChange = (evt) => {
    res.write(`event: ${evt.kind}\ndata: ${JSON.stringify(evt)}\n\n`);
  };
  bus.on('change', onChange);
```

这段代码已经能处理任何 `evt.kind`，包括 `scan-start` 和 `scan-complete`，无需修改。确认即可。

- [ ] **Step 8: 验证 dev-server 启动**

Run: `cd c:\git-project\TRAE; node -e "import('./server/dev-server.mjs').then(m => m.getServer())"`
Expected: 控制台输出 `[dev-server] listening on http://localhost:5174`

- [ ] **Step 9: Commit**

```bash
cd c:\git-project\TRAE
git add server/dev-server.mjs
git commit -m "feat(d8): dev-server 集成扫描器 — 4 个新 API + chokidar 监听 scanRoot + SSE 推送"
```

---

### Task 4: apiClient + sseClient 更新

**Files:**
- Modify: `src/lib/data/apiClient.ts`
- Modify: `src/lib/data/sseClient.ts`

- [ ] **Step 1: 在 apiClient.ts 中添加扫描 API**

在 `src/lib/data/apiClient.ts` 的 import 行修改为：

```typescript
import type { Manifest, ProjectData, FilesData, ActivitiesData, AINotesData, ProjectPatch, ScanConfig, ScanStatus } from '../../types/data';
```

在 `api` 对象的 `patchProject` 方法之后，追加：

```typescript
  async getScanConfig(): Promise<ScanConfig> {
    return request<ScanConfig>('/scan-config');
  },

  async updateScanConfig(update: Partial<ScanConfig>): Promise<ScanConfig> {
    return request<ScanConfig>('/scan-config', {
      method: 'POST',
      body: JSON.stringify(update)
    });
  },

  async triggerScan(): Promise<{ message: string }> {
    return request<{ message: string }>('/scan', { method: 'POST' });
  },

  async getScanStatus(): Promise<ScanStatus> {
    return request<ScanStatus>('/scan/status');
  }
```

- [ ] **Step 2: 在 sseClient.ts 中添加 scan 事件监听**

修改 `src/lib/data/sseClient.ts`，在 import 中添加 ScanEvent：

```typescript
import type { ProjectEvent, ScanEvent } from '../../types/data';
```

修改 `useProjectEvents` hook，在 kinds 数组后添加 scan 事件监听。找到：

```typescript
  useEffect(() => {
    const es = new EventSource('/api/events');
    const kinds: ProjectEvent['kind'][] = [
      'project-updated',
      'files-updated',
      'activities-updated',
      'ai-notes-updated'
    ];
    kinds.forEach((kind) => {
      es.addEventListener(kind, (e: MessageEvent) => {
        try {
          handler(JSON.parse(e.data));
        } catch (err) {
          console.error('[sseClient] parse error', err);
        }
      });
    });
```

替换为：

```typescript
  useEffect(() => {
    const es = new EventSource('/api/events');
    const kinds: ProjectEvent['kind'][] = [
      'project-updated',
      'files-updated',
      'activities-updated',
      'ai-notes-updated'
    ];
    kinds.forEach((kind) => {
      es.addEventListener(kind, (e: MessageEvent) => {
        try {
          handler(JSON.parse(e.data));
        } catch (err) {
          console.error('[sseClient] parse error', err);
        }
      });
    });
    // D8 扫描事件
    const scanKinds: ScanEvent['kind'][] = ['scan-start', 'scan-complete'];
    scanKinds.forEach((kind) => {
      es.addEventListener(kind, (e: MessageEvent) => {
        try {
          scanHandler(JSON.parse(e.data));
        } catch (err) {
          console.error('[sseClient] scan parse error', err);
        }
      });
    });
```

然后在函数签名中添加 `scanHandler` 参数：

```typescript
export function useProjectEvents(
  handler: (evt: ProjectEvent) => void,
  scanHandler?: (evt: ScanEvent) => void
) {
```

在 `useEffect` 的依赖数组中添加 `scanHandler`：

```typescript
  }, [handler, scanHandler]);
```

- [ ] **Step 3: Run typecheck**

Run: `cd c:\git-project\TRAE; npm run typecheck`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
cd c:\git-project\TRAE
git add src/lib/data/apiClient.ts src/lib/data/sseClient.ts
git commit -m "feat(d8): apiClient + sseClient 添加扫描 API 调用 + scan 事件监听"
```

---

### Task 5: AIChatPanel 扫描配置 UI

**Files:**
- Modify: `src/components/ai/AIChatPanel.tsx`

- [ ] **Step 1: 在 AIChatPanel.tsx 顶部添加 import 和状态**

在 `src/components/ai/AIChatPanel.tsx` 的 import 区域追加：

```typescript
import { api } from '../../lib/data/apiClient';
import type { ScanConfig, ScanStatus } from '../../types/data';
import { FolderOpen, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
```

在组件内部（`const [input, setInput] = useState('')` 之后）追加状态：

```typescript
  const [scanConfig, setScanConfig] = useState<ScanConfig | null>(null);
  const [scanStatus, setScanStatus] = useState<ScanStatus | null>(null);
  const [scanPathInput, setScanPathInput] = useState('');
  const [scanPanelOpen, setScanPanelOpen] = useState(false);
```

- [ ] **Step 2: 添加 useEffect 加载扫描配置**

在 `useEffect` 区域追加：

```typescript
  // D8: 加载扫描配置
  useEffect(() => {
    api.getScanConfig().then((cfg) => {
      setScanConfig(cfg);
      setScanPathInput(cfg.scanRoot);
    }).catch(() => {});
    api.getScanStatus().then(setScanStatus).catch(() => {});
  }, []);
```

- [ ] **Step 3: 添加扫描操作函数**

在组件内追加：

```typescript
  const handleSaveScanConfig = async () => {
    const cfg = await api.updateScanConfig({
      scanRoot: scanPathInput,
      enabled: true
    });
    setScanConfig(cfg);
  };

  const handleToggleScan = async () => {
    if (!scanConfig) return;
    const cfg = await api.updateScanConfig({ enabled: !scanConfig.enabled });
    setScanConfig(cfg);
  };

  const handleTriggerScan = async () => {
    await api.triggerScan();
  };
```

- [ ] **Step 4: 添加扫描配置 UI**

在 AIChatPanel 的 return JSX 中，在消息列表区域之前（或设置按钮旁边）添加扫描配置折叠面板。找到 settings 按钮区域，在其后添加：

```typescript
              {/* D8 扫描配置 */}
              <button
                onClick={() => setScanPanelOpen(!scanPanelOpen)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 4,
                  color: 'var(--mute)',
                  display: 'flex',
                  alignItems: 'center'
                }}
                title="文件夹扫描配置"
              >
                <FolderOpen size={14} />
              </button>
```

然后在消息列表上方（或输入框上方）添加折叠面板内容：

```typescript
      {scanPanelOpen && (
        <div style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--line)',
          background: 'var(--bg-2)',
          fontSize: 11
        }}>
          <div style={{ fontWeight: 600, marginBottom: 8, fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.08em' }}>
            文件夹扫描
          </div>

          {/* 扫描路径输入 */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            <input
              value={scanPathInput}
              onChange={(e) => setScanPathInput(e.target.value)}
              placeholder="D:\项目根目录"
              style={{
                flex: 1,
                padding: '4px 8px',
                border: '1px solid var(--line-2)',
                background: 'var(--paper)',
                color: 'var(--ink)',
                fontSize: 11,
                fontFamily: 'JetBrains Mono, monospace'
              }}
            />
            <button
              onClick={handleSaveScanConfig}
              style={{
                padding: '4px 10px',
                border: '1px solid var(--line-2)',
                background: 'var(--paper)',
                color: 'var(--ink)',
                fontSize: 11,
                cursor: 'pointer'
              }}
            >
              保存
            </button>
          </div>

          {/* 启用开关 + 扫描按钮 */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              onClick={handleToggleScan}
              style={{
                padding: '4px 10px',
                border: '1px solid var(--line-2)',
                background: scanConfig?.enabled ? 'var(--accent-2)' : 'var(--paper)',
                color: scanConfig?.enabled ? '#fff' : 'var(--mute)',
                fontSize: 11,
                cursor: 'pointer'
              }}
            >
              {scanConfig?.enabled ? '已启用' : '已禁用'}
            </button>
            <button
              onClick={handleTriggerScan}
              disabled={!scanConfig?.enabled || scanStatus?.scanning}
              style={{
                padding: '4px 10px',
                border: '1px solid var(--line-2)',
                background: 'var(--paper)',
                color: 'var(--ink)',
                fontSize: 11,
                cursor: 'pointer',
                opacity: !scanConfig?.enabled || scanStatus?.scanning ? 0.5 : 1,
                display: 'flex',
                alignItems: 'center',
                gap: 4
              }}
            >
              <RefreshCw size={11} className={scanStatus?.scanning ? 'spin' : ''} />
              {scanStatus?.scanning ? '扫描中...' : '立即扫描'}
            </button>
          </div>

          {/* 扫描状态 */}
          {scanStatus && (
            <div style={{
              marginTop: 8,
              fontSize: 10,
              color: 'var(--mute)',
              display: 'flex',
              alignItems: 'center',
              gap: 4
            }}>
              {scanStatus.scanning ? (
                <><RefreshCw size={10} className="spin" /> 扫描中...</>
              ) : scanStatus.error ? (
                <><AlertCircle size={10} color="#ef4444" /> {scanStatus.error}</>
              ) : scanStatus.projectCount > 0 ? (
                <><CheckCircle size={10} color="#22c55e" /> 上次扫描: {scanStatus.projectCount} 个项目</>
              ) : (
                '尚未扫描'
              )}
            </div>
          )}
        </div>
      )}
```

- [ ] **Step 5: 添加 spin 动画 CSS**

在 `src/index.css` 或全局 CSS 中添加（如果已存在则跳过）：

```css
@keyframes spin {
  to { transform: rotate(360deg); }
}
.spin {
  animation: spin 1s linear infinite;
}
```

- [ ] **Step 6: Run typecheck**

Run: `cd c:\git-project\TRAE; npm run typecheck`
Expected: 0 errors

- [ ] **Step 7: Commit**

```bash
cd c:\git-project\TRAE
git add src/components/ai/AIChatPanel.tsx
git commit -m "feat(d8): AIChatPanel 添加扫描配置 UI（路径输入+开关+扫描按钮+状态指示器）"
```

---

## Self-Review

**Spec 覆盖检查：**
- §2 扫描配置（scan-config.json + API）→ Task 2 + Task 3 ✓
- §3.1 项目识别（parseProjectName）→ Task 1 Step 1 ✓
- §3.2 阶段识别（matchPhase）→ Task 1 Step 1 ✓
- §3.3 文件树生成（scanFileTree）→ Task 1 Step 2 ✓
- §3.4 日期提取（extractDates）→ Task 1 Step 1 ✓
- §3.5 里程碑生成 → Task 1 Step 3 ✓
- §3.6 任务生成（extractTaskName）→ Task 1 Step 1 + Step 3 ✓
- §4.1 project.json 生成 → Task 1 Step 3 ✓
- §4.2 files.json 生成 → Task 1 Step 3 ✓
- §4.3 manifest.json 更新 → Task 3 Step 3 ✓
- §5.1 启动流程 → Task 3 Step 6 ✓
- §5.2 chokidar 监听 scanRoot → Task 3 Step 3 ✓
- §5.3 4 个新 API 端点 → Task 3 Step 4-5 ✓
- §5.4 与现有 data/ 监听的关系 → 链式自动（scanner 写 data/ → 现有 watcher 推 SSE）✓
- §6.1 扫描配置面板 → Task 5 ✓
- §6.2 扫描状态 SSE → Task 3 Step 3 + Task 4 Step 2 ✓

**Placeholder 扫描：** 无 TBD/TODO。所有代码块完整。

**类型一致性：** `ScanConfig`、`ScanStatus`、`ScanEvent` 在 Task 2 定义，Task 4 和 Task 5 使用。`parseProjectName`、`matchPhase`、`extractDates`、`extractTaskName`、`scanProject`、`scanAll` 在 Task 1 定义，Task 3 使用。函数名一致。
