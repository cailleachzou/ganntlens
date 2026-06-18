// D7 plan 模式 —— commandRouter 委托给 planGenerator
// 保留旧 CommandResult 接口以兼容 AIChatPanel（runPlan 改造后这部分会改）

import { runPlan, scopeLabel, type AIScope, type PlanResult } from './planGenerator';

export type { AIScope, PlanResult };
export { scopeLabel };

/** 兼容旧 AIChatPanel 调用：返回 PlanResult */
export async function runCommand(
  input: string,
  options?: { provider?: string; scope?: AIScope }
): Promise<PlanResult> {
  return runPlan(input, options?.scope ?? 'global');
}
