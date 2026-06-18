// =====================================================================
// 命令路由器 - D5
//
// 把 mockEngine 产出的 action 转换成实际的 store 调用
// 真实 LLM 在 D6+ 接入，本文件保持 provider 无关
// =====================================================================

import { mockLLM, type MockResponse } from './mockEngine';
import { useProjectStore } from '../../store/projectStore';
import { useUIStore } from '../../store/uiStore';
import type { AIProvider, Project } from '../../types';

/**
 * AI 操作范围
 * - 'global'：可在所有项目中操作（用于 Overview 页）
 * - { projectId }：只能操作指定项目（用于项目详情页）
 */
export type AIScope = 'global' | { projectId: string };

export interface CommandResult {
  content: string;
  /** 是否触发了副作用（修改 store / 导航） */
  sideEffect: boolean;
  /** 是否在 scope 内未找到匹配项目（用于提示用户） */
  outOfScope?: boolean;
}

/** 根据 scope 过滤项目列表 */
function scopeProjects(projects: Project[], scope: AIScope): Project[] {
  if (scope === 'global') return projects;
  return projects.filter((p) => p.id === scope.projectId);
}

/** scope 的可读标签（用于 UI 展示） */
export function scopeLabel(scope: AIScope, projects: Project[]): string {
  if (scope === 'global') return 'GLOBAL';
  const p = projects.find((p) => p.id === scope.projectId);
  return p ? `SCOPED · ${p.code}` : 'SCOPED';
}

export async function runCommand(
  input: string,
  options?: { provider?: AIProvider; scope?: AIScope }
): Promise<CommandResult> {
  const projects = useProjectStore.getState().projects;
  const setSelectedProject = useProjectStore.getState().setSelectedProject;
  const shiftMilestone = useProjectStore.getState().shiftMilestone;
  const updateTaskProgress = useProjectStore.getState().updateTaskProgress;

  const scope = options?.scope ?? 'global';
  const scoped = scopeProjects(projects, scope);

  // 跳转类命令用全项目（导航不受 scope 限制），其他命令用 scoped
  const isNavigate = /^(打开|看|跳到|进入|show|open|go)\s/i.test(input.trim());
  const projectsForEngine = isNavigate ? projects : scoped;

  const resp: MockResponse = await mockLLM(input, projectsForEngine);

  let sideEffect = false;
  let outOfScope = false;

  if (resp.action) {
    const { type, payload } = resp.action;
    switch (type) {
      case 'shift_milestone': {
        const { projectId, milestoneId, days } = payload as {
          projectId: string;
          milestoneId: string;
          days: number;
        };
        // 双保险：scope 内才执行
        if (scope === 'global' || scope.projectId === projectId) {
          shiftMilestone(projectId, milestoneId, days);
          sideEffect = true;
        } else {
          outOfScope = true;
        }
        break;
      }
      case 'update_progress': {
        const { projectId, taskId, pct } = payload as {
          projectId: string;
          taskId: string;
          pct: number;
        };
        if (scope === 'global' || scope.projectId === projectId) {
          updateTaskProgress(projectId, taskId, pct);
          sideEffect = true;
        } else {
          outOfScope = true;
        }
        break;
      }
      case 'navigate': {
        // 跳转永远允许（不属于修改类）
        const { projectId } = payload as { projectId: string };
        setSelectedProject(projectId);
        const ui = useUIStore.getState();
        ui.setHoverTask(null);
        sideEffect = true;
        break;
      }
    }
  }

  // scope 收紧后没匹配到任何项目 → 提示
  if (scoped.length === 0) {
    return {
      content: `⚠️ 当前 scope 内无项目可操作。`,
      sideEffect: false,
      outOfScope: true
    };
  }

  return { content: resp.content, sideEffect, outOfScope };
}
