// =====================================================================
// Mock LLM 引擎 - D5
//
// 设计原则：
// 1. 零网络依赖，Demo 100% 稳定
// 2. 关键词匹配 → 返回结构化响应
// 3. 部分命令会附带 action 副作用（通过 commandRouter 执行）
// 4. 600-1500ms 模拟真实 LLM 响应延迟
// =====================================================================

import type { Project } from '../../types';

export interface MockAction {
  type: 'shift_milestone' | 'update_progress' | 'navigate';
  payload: Record<string, unknown>;
}

export interface MockResponse {
  content: string;
  action?: MockAction;
  delay?: number;
}

const FILLER = ['好的，已识别意图：', '明白，让我处理：', '收到，正在分析：', ''];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ---------------------------------------------------------------------
// 场景 1: 里程碑平移 — "M1 延后 3 天" / "M2 提前 1 周" / "把 M1 推后 5d"
// ---------------------------------------------------------------------
function matchShiftMilestone(input: string, projects: Project[]): MockResponse | null {
  const m = input.match(/M(\d)\s*(延后|提前|推后|推迟|后移|前移|挪)\s*(\d+)\s*(天|d|日|周|w|week)/i);
  if (!m) return null;
  const msIndex = parseInt(m[1]) - 1;
  const direction = ['延后', '推后', '推迟', '后移'].includes(m[2]) ? 1 : -1;
  const num = parseInt(m[3]);
  const unit = m[4];
  const days = unit.match(/周|w|week/i) ? num * 7 : num;
  const sign = direction * days;

  // 找第一个有该里程碑的项目
  for (const p of projects) {
    const ms = p.milestones[msIndex];
    if (!ms) continue;
    return {
      content:
        `${pick(FILLER)}M${msIndex + 1} (${ms.name}) ${sign > 0 ? '延后' : '提前'} ${Math.abs(days)} 天。\n\n` +
        `项目：${p.code} ${p.name}\n` +
        `影响范围：M${msIndex + 1} 之后所有任务/里程碑 ${sign > 0 ? '顺延' : '前移'} ${Math.abs(days)} 天。\n\n` +
        `✅ 已应用。是否需要通知相关责任人？`,
      action: { type: 'shift_milestone', payload: { projectId: p.id, milestoneId: ms.id, days: sign } },
      delay: 800 + Math.random() * 400
    };
  }
  return null;
}

// ---------------------------------------------------------------------
// 场景 2: 任务进度更新 — "M1 进度 50%" / "验收测试 70%"
// ---------------------------------------------------------------------
function matchUpdateProgress(input: string, projects: Project[]): MockResponse | null {
  // 形式 1: "M1 进度 50%"
  let m = input.match(/M(\d)\s*进度\s*(\d+)\s*%/i);
  if (m) {
    const msIndex = parseInt(m[1]) - 1;
    const pct = Math.min(100, Math.max(0, parseInt(m[2])));
    for (const p of projects) {
      const ms = p.milestones[msIndex];
      if (!ms) continue;
      // 用 M 后第一个任务作为代表
      const msDate = ms.date;
      const targetTask = p.tasks.find((t) => t.planStart >= msDate) || p.tasks[0];
      return {
        content: `${pick(FILLER)}${targetTask.name} 进度更新为 ${pct}%。\n\n项目：${p.code}\n\n✅ 已应用。`,
        action: { type: 'update_progress', payload: { projectId: p.id, taskId: targetTask.id, pct } },
        delay: 600
      };
    }
  }
  // 形式 2: "<任务名> 进度 50%"
  m = input.match(/(.+?)\s*进度\s*(\d+)\s*%/);
  if (m) {
    const kw = m[1].trim();
    const pct = Math.min(100, Math.max(0, parseInt(m[2])));
    for (const p of projects) {
      const t = p.tasks.find((t) => t.name.includes(kw));
      if (t) {
        return {
          content: `${pick(FILLER)}「${t.name}」进度更新为 ${pct}%。\n\n项目：${p.code}\n\n✅ 已应用。`,
          action: { type: 'update_progress', payload: { projectId: p.id, taskId: t.id, pct } },
          delay: 600
        };
      }
    }
  }
  return null;
}

// ---------------------------------------------------------------------
// 场景 3: 冲突检测 — "冲突" / "有问题吗" / "风险"
// ---------------------------------------------------------------------
function matchConflictCheck(input: string, projects: Project[]): MockResponse | null {
  if (!/冲突|风险|延期|问题|delay|risk/i.test(input)) return null;
  const lines: string[] = ['已扫描 3 个项目，检测到以下风险：\n'];

  for (const p of projects) {
    const issues: string[] = [];
    for (const t of p.tasks) {
      if (t.actualStart && !t.actualEnd && t.progress === 0) {
        issues.push(`  • ${t.name}：已开始未推进（${t.progress}%）`);
      } else if (t.actualStart && t.actualEnd && new Date(t.actualEnd) > new Date(t.planEnd)) {
        issues.push(`  • ${t.name}：实际完成晚于计划 ${Math.round((new Date(t.actualEnd).getTime() - new Date(t.planEnd).getTime()) / 86400000)} 天`);
      }
    }
    if (issues.length) {
      lines.push(`【${p.code} ${p.name}】`);
      lines.push(...issues);
      lines.push('');
    }
  }

  if (lines.length === 1) lines.push('🎉 当前无重大风险。');
  return {
    content: lines.join('\n'),
    delay: 1000
  };
}

// ---------------------------------------------------------------------
// 场景 4: 周报生成 — "周报" / "weekly"
// ---------------------------------------------------------------------
function matchWeeklyReport(input: string, projects: Project[]): MockResponse | null {
  if (!/周报|weekly|本周|这周/i.test(input)) return null;
  const lines: string[] = ['📋 本周项目进度周报（基于 2026-06-16 基线）\n'];

  for (const p of projects) {
    const total = p.tasks.length;
    const done = p.tasks.filter((t) => t.progress === 100).length;
    const ongoing = p.tasks.filter((t) => t.progress > 0 && t.progress < 100).length;
    const pending = p.tasks.filter((t) => t.progress === 0).length;
    const overall = Math.round((done / total) * 100);

    lines.push(`【${p.code} ${p.name}】${overall}%`);
    lines.push(`  ✅ 已完成 ${done} / ${total}　🔄 进行中 ${ongoing}　⏳ 待启动 ${pending}`);
    const currentPhase = p.phases.find((ph) => {
      const start = new Date(ph.planStart);
      const end = new Date(ph.planEnd);
      const now = new Date('2026-06-16');
      return start <= now && now <= end;
    });
    if (currentPhase) lines.push(`  📍 当前阶段：${currentPhase.name}`);
    lines.push('');
  }

  lines.push('---\n由 GanttLens AI 生成 · 数据基于 localStorage');

  return {
    content: lines.join('\n'),
    delay: 1200
  };
}

// ---------------------------------------------------------------------
// 场景 5: 完成度统计 — "完成度" / "进度总览"
// ---------------------------------------------------------------------
function matchCompletionStats(input: string, projects: Project[]): MockResponse | null {
  if (!/完成度|进度总览|整体进度|完成率/i.test(input)) return null;
  const lines: string[] = ['📊 整体完成度（按项目）\n'];

  for (const p of projects) {
    const total = p.tasks.length;
    const avg = Math.round(p.tasks.reduce((sum, t) => sum + t.progress, 0) / total);
    const bar = '█'.repeat(Math.floor(avg / 10)) + '░'.repeat(10 - Math.floor(avg / 10));
    lines.push(`${p.code}  ${bar} ${avg}%`);
  }
  lines.push('\n点击任务条可查看详情。');
  return { content: lines.join('\n'), delay: 600 };
}

// ---------------------------------------------------------------------
// 场景 6: 任务拆解 — "拆解 M1" / "分解 XXX"
// ---------------------------------------------------------------------
function matchBreakdown(input: string, projects: Project[]): MockResponse | null {
  const m = input.match(/拆解|分解|breakdown/i);
  if (!m) return null;
  const kw = input.replace(/拆解|分解|breakdown|把|M\d|的|任务|一下|看看/g, '').trim();

  for (const p of projects) {
    const target = kw
      ? p.tasks.find((t) => t.name.includes(kw))
      : p.tasks.find((t) => t.progress === 0) || p.tasks[0];
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

// ---------------------------------------------------------------------
// 场景 7: 跳转 — "打开 M-2026" / "看 OFC"
// ---------------------------------------------------------------------
function matchNavigate(input: string, projects: Project[]): MockResponse | null {
  const m = input.match(/(打开|看|跳到|进入|show)\s*([A-Z]+-\d+|\S+项目)/i);
  if (!m) return null;
  const code = m[2].toUpperCase();
  const p = projects.find((p) => p.code.toUpperCase() === code || p.id.toUpperCase().includes(code));
  if (p) {
    return {
      content: `已打开 ${p.code} ${p.name}。`,
      action: { type: 'navigate', payload: { projectId: p.id } },
      delay: 400
    };
  }
  return null;
}

// ---------------------------------------------------------------------
// 主入口: 派发到各场景
// ---------------------------------------------------------------------
export async function mockLLM(input: string, projects: Project[]): Promise<MockResponse> {
  const handlers = [
    matchShiftMilestone,
    matchUpdateProgress,
    matchNavigate,
    matchConflictCheck,
    matchBreakdown,
    matchWeeklyReport,
    matchCompletionStats
  ];

  for (const h of handlers) {
    const r = h(input, projects);
    if (r) {
      const delay = r.delay ?? 700;
      await new Promise((res) => setTimeout(res, delay));
      return r;
    }
  }

  // fallback
  await new Promise((res) => setTimeout(res, 600));
  return {
    content:
      `🤔 暂不支持「${input}」\n\n试试这些：\n` +
      `• 里程碑：把 M1 延后 3 天 / M2 提前 1 周\n` +
      `• 进度：验收测试 进度 70% / M1 进度 50%\n` +
      `• 查询：冲突 / 风险 / 周报 / 完成度\n` +
      `• 拆解：拆解 弱电管线\n` +
      `• 跳转：打开 DC-2026`
  };
}
