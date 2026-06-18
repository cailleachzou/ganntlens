// D7 plan 模式
// 替代 commandRouter 的副作用执行
// AI 不再自动应用，只生成结构化 patch 描述

import { mockLLM, type MockResponse } from './mockEngine';
import { useProjectStore } from '../../store/projectStore';
import type { Project } from '../../types';

export type AIScope = 'global' | { projectId: string };

export interface PlanResult {
  content: string;
  /** 结构化 patch —— 待用户在 IDE 应用 */
  plan: MockResponse['action'];
  /** 跳转类操作（不修改数据，保留） */
  navigateTo?: string;
  outOfScope?: boolean;
}

function scopeProjects(projects: Project[], scope: AIScope): Project[] {
  if (scope === 'global') return projects;
  return projects.filter((p) => p.id === scope.projectId);
}

export function scopeLabel(scope: AIScope, projects: Project[]): string {
  if (scope === 'global') return 'GLOBAL';
  const p = projects.find((p) => p.id === scope.projectId);
  return p ? `SCOPED · ${p.code}` : 'SCOPED';
}

export async function runPlan(input: string, scope: AIScope = 'global'): Promise<PlanResult> {
  const projects = useProjectStore.getState().projects;
  const isNavigate = /^(打开|看|跳到|进入|show|open|go)\s/i.test(input.trim());
  const projectsForEngine = isNavigate ? projects : scopeProjects(projects, scope);

  const resp = await mockLLM(input, projectsForEngine);

  const result: PlanResult = {
    content: resp.content,
    plan: resp.action
  };

  // 跳转类保留（让 AIChatPanel 处理）
  if (resp.action?.type === 'navigate') {
    result.navigateTo = (resp.action.payload as { projectId: string }).projectId;
  }

  if (scope !== 'global') {
    const actionProjectId =
      (resp.action?.payload as { projectId?: string })?.projectId ?? null;
    if (actionProjectId && actionProjectId !== scope.projectId) {
      result.outOfScope = true;
    }
  }

  return result;
}
