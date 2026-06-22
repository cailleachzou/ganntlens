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
