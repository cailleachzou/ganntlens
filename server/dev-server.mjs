// GanttLens D7 dev-server
// 挂在 Vite dev plugin 上，复用 5173 端口
// 4 端点：GET /api/manifest, GET /api/projects/:id, POST /api/projects/:id, GET /api/events
// chokidar 监听 data/，写盘推 SSE
// 软锁防冲突，atomic write 防写一半

import http from 'node:http';
import fs from 'node:fs/promises';
import fssync from 'node:fs';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import chokidar from 'chokidar';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, 'data');
const LOCKS = path.join(DATA, 'locks');

const PORT = parseInt(process.env.GANNTLENS_API_PORT ?? '5174', 10);
const LOCK_TTL_MS = 2 * 60 * 1000;
const SELF_WRITE_GRACE_MS = 80;

// 状态
const bus = new EventEmitter();
const locks = new Map(); // projectId -> { owner, ts, reason, ttlMs }
const recentSelfWrites = new Map(); // filePath -> ts

// utils
function asyncRoute(handler) {
  return (req, res) => Promise.resolve(handler(req, res)).catch((err) => {
    console.error('[dev-server]', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: err.message ?? String(err) }));
  });
}

async function readJson(file) {
  const txt = await fs.readFile(file, 'utf8');
  return JSON.parse(txt);
}

async function writeJsonAtomic(file, data) {
  const tmp = file + '.tmp';
  recentSelfWrites.set(file, Date.now());
  await fs.writeFile(tmp, JSON.stringify(data, null, 2));
  await fs.rename(tmp, file);
}

function isLockFresh(lock) {
  return Date.now() - lock.ts < lock.ttlMs;
}

async function acquireLock(projectId, owner, reason) {
  if (locks.has(projectId)) {
    const existing = locks.get(projectId);
    if (isLockFresh(existing)) {
      return { ok: false, existing };
    }
    locks.delete(projectId);
  }
  const lock = { projectId, owner, ts: Date.now(), reason, ttlMs: LOCK_TTL_MS };
  locks.set(projectId, lock);
  await fs.writeFile(
    path.join(LOCKS, `${projectId}.lock`),
    JSON.stringify(lock, null, 2)
  );
  return { ok: true, lock };
}

async function releaseLock(projectId) {
  locks.delete(projectId);
  try {
    await fs.unlink(path.join(LOCKS, `${projectId}.lock`));
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }
}

// chokidar 启动
let watcher = null;
function startWatcher() {
  watcher = chokidar.watch(DATA, {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 50, pollInterval: 20 }
  });
  watcher.on('change', (filePath) => {
    const rel = path.relative(DATA, filePath).replaceAll('\\', '/');
    // 跳过锁文件 + AGENT-README.md + .tmp
    if (rel.startsWith('locks/') || rel.endsWith('.tmp') || rel === 'AGENT-README.md') return;
    const recentTs = recentSelfWrites.get(filePath);
    if (recentTs && Date.now() - recentTs < SELF_WRITE_GRACE_MS) {
      recentSelfWrites.delete(filePath);
      return;
    }
    const parts = rel.split('/');
    if (parts.length !== 3) return;
    const [kind, projectId, file] = parts;
    if (kind !== 'projects') return;
    const kindMap = {
      'project.json': 'project-updated',
      'files.json': 'files-updated',
      'activities.json': 'activities-updated',
      'ai-notes.json': 'ai-notes-updated'
    };
    const evtKind = kindMap[file];
    if (!evtKind) return;
    bus.emit('change', {
      kind: evtKind,
      projectId,
      file,
      mtime: Date.now()
    });
  });
}

// HTTP handler
async function handleManifest(req, res) {
  const manifest = await readJson(path.join(DATA, 'manifest.json'));
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(manifest));
}

async function handleGetProject(req, res, projectId) {
  const dir = path.join(DATA, 'projects', projectId);
  const [project, files, activities, aiNotes] = await Promise.all([
    readJson(path.join(dir, 'project.json')),
    readJson(path.join(dir, 'files.json')).catch(() => ({ projectId, files: [] })),
    readJson(path.join(dir, 'activities.json')).catch(() => ({ projectId, activities: [] })),
    readJson(path.join(dir, 'ai-notes.json')).catch(() => ({ projectId, notes: [] }))
  ]);
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ project, files, activities, aiNotes }));
}

async function handlePatchProject(req, res, projectId) {
  const body = await new Promise((resolve, reject) => {
    let buf = '';
    req.on('data', (c) => (buf += c));
    req.on('end', () => resolve(buf));
    req.on('error', reject);
  });
  const patch = JSON.parse(body);
  // 拿锁
  const lock = await acquireLock(projectId, 'ui-dude', 'patch');
  if (!lock.ok) {
    res.writeHead(409, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: 'locked', existing: lock.existing }));
    return;
  }
  try {
    const dir = path.join(DATA, 'projects', projectId);
    const current = await readJson(path.join(dir, 'project.json'));
    if (patch.tasks) current.tasks = patch.tasks;
    if (patch.phases) current.phases = patch.phases;
    if (patch.milestones) current.milestones = patch.milestones;
    if (patch.meta) {
      current.lastModifiedBy = patch.meta.lastModifiedBy;
      current.lastModifiedAt = patch.meta.lastModifiedAt;
    }
    await writeJsonAtomic(path.join(dir, 'project.json'), current);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ mtime: Date.now() }));
  } finally {
    await releaseLock(projectId);
  }
}

function handleEvents(req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive'
  });
  res.write('retry: 1000\n\n');
  const onChange = (evt) => {
    res.write(`event: ${evt.kind}\ndata: ${JSON.stringify(evt)}\n\n`);
  };
  bus.on('change', onChange);
  // 心跳保活
  const hb = setInterval(() => res.write(': ping\n\n'), 25000);
  req.on('close', () => {
    bus.off('change', onChange);
    clearInterval(hb);
  });
}

// 启动
function start() {
  startWatcher();
  // 锁清理周期（只在 dev server 真正启动时跑，避免 build 时 setInterval 卡住进程）
  setInterval(() => {
    for (const [id, lock] of locks) {
      if (!isLockFresh(lock)) {
        locks.delete(id);
        fs.unlink(path.join(LOCKS, `${id}.lock`)).catch(() => {});
      }
    }
  }, 30000);
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    if (url.pathname === '/api/manifest' && req.method === 'GET') {
      return asyncRoute(handleManifest)(req, res);
    }
    const m = url.pathname.match(/^\/api\/projects\/([\w-]+)$/);
    if (m) {
      const projectId = m[1];
      if (req.method === 'GET') return asyncRoute((req, res) => handleGetProject(req, res, projectId))(req, res);
      if (req.method === 'POST') return asyncRoute((req, res) => handlePatchProject(req, res, projectId))(req, res);
    }
    if (url.pathname === '/api/events' && req.method === 'GET') {
      return handleEvents(req, res);
    }
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: 'not found' }));
  });
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      // 端口已被占用 —— 可能是 Vite HMR 导致模块重载，老 server 还在跑
      console.warn(`[dev-server] port ${PORT} in use, reusing existing instance`);
    } else {
      console.error('[dev-server] server error', err);
    }
  });
  server.listen(PORT, () => {
    console.log(`[dev-server] listening on http://localhost:${PORT}`);
  });
  return server;
}

// 用 globalThis 防 Vite HMR 模块重载后 _server 重置
const G = globalThis;
if (!G.__GANNTLENS_DEV_SERVER__) {
  G.__GANNTLENS_DEV_SERVER__ = { _server: null, watcher: null, locks: locks, bus: bus, recentSelfWrites: recentSelfWrites };
}
const state = G.__GANNTLENS_DEV_SERVER__;

export function getServer() {
  if (!state._server) {
    state._server = start();
  }
  return state._server;
}

export { bus, recentSelfWrites, locks, DATA, LOCKS };
