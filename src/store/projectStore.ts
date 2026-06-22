import { create } from 'zustand';
import { seedProjects } from '../lib/seed/seedData';
import { api, ApiError } from '../lib/data/apiClient';
import type { Project, Task } from '../types';
import type { ProjectData, FilesData, ActivitiesData, AINotesData, ProjectEvent } from '../types/data';
import { daysBetween } from '../lib/gantt/dateUtils';

interface ProjectState {
  projects: Project[];
  selectedProjectId: string;
  loaded: boolean;
  loadError: string | null;
  initFromApi: () => Promise<void>;
  setSelectedProject: (id: string) => void;
  moveTask: (projectId: string, taskId: string, newPlanStart: string) => Promise<void>;
  resizeTask: (projectId: string, taskId: string, newStartOrEnd: string, side: 'start' | 'end') => Promise<void>;
  moveMilestone: (projectId: string, milestoneId: string, newDate: string) => Promise<void>;
  updateTaskProgress: (projectId: string, taskId: string, pct: number) => void;  // 改：plan 模式不写
  addTask: (projectId: string, task: Task) => Promise<void>;
  deleteTask: (projectId: string, taskId: string) => Promise<void>;
  applyRemoteUpdate: (evt: ProjectEvent) => Promise<void>;
}

// 工具：YYYY-MM-DD 加减天数
function shiftDate(date: string, days: number): string {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

/**
 * D7.1 总工期锁死的里程碑级联
 * M1 移 → 设计/施工边界动，验收不动
 * M2 移 → 施工/验收边界动，设计不动
 * 同时更新 phases 边界（让 PhaseRibbon 跟着动）
 * 实际完工保护：不能压过已完工任务的最晚 actualEnd
 */
function rebalancePhases(project: Project, milestoneId: string, newDate: string): Project {
  const ms = project.milestones.find((m) => m.id === milestoneId);
  if (!ms) return project;

  const m1 = project.milestones.find((m) => m.id === 'm1')!;
  const m2 = project.milestones.find((m) => m.id === 'm2')!;
  const isM1 = milestoneId === 'm1';

  // 当前阶段边界
  const designStart = project.start;
  const designEnd = m1.date;
  const constructionStart = m1.date;
  const constructionEnd = m2.date;
  const acceptanceStart = m2.date;
  const acceptanceEnd = project.end;

  // 实际完工保护：找各阶段已完工任务的最晚 actualEnd
  const phaseActualEnd = (phaseStart: string, phaseEnd: string): string | null => {
    const completed = project.tasks
      .filter((t) => t.actualEnd && t.planStart >= phaseStart && t.planStart < phaseEnd)
      .map((t) => t.actualEnd!)
      .sort();
    return completed.length > 0 ? completed[completed.length - 1] : null;
  };

  const designActualEnd = phaseActualEnd(designStart, designEnd);
  const constructionActualEnd = phaseActualEnd(constructionStart, constructionEnd);

  // clamp 新位置
  let clampedDate = newDate;
  if (isM1) {
    // M1 不能 < designActualEnd + 1（往前移保护）
    if (designActualEnd && clampedDate <= designActualEnd) {
      clampedDate = shiftDate(designActualEnd, 1);
    }
    // M1 不能 < project.start + 1（至少留 1 天设计）
    if (clampedDate <= designStart) {
      clampedDate = shiftDate(designStart, 1);
    }
    // M1 不能 >= M2（不能撞 M2）
    if (clampedDate >= m2.date) {
      clampedDate = shiftDate(m2.date, -1);
    }
  } else {
    // M2 不能 < constructionActualEnd + 1（往前移保护）
    if (constructionActualEnd && clampedDate <= constructionActualEnd) {
      clampedDate = shiftDate(constructionActualEnd, 1);
    }
    // M2 不能 <= M1（不能撞 M1）
    if (clampedDate <= m1.date) {
      clampedDate = shiftDate(m1.date, 1);
    }
    // M2 不能 >= project.end（至少留 1 天验收）
    if (clampedDate >= acceptanceEnd) {
      clampedDate = shiftDate(acceptanceEnd, -1);
    }
  }

  const finalDays = daysBetween(ms.date, clampedDate);
  if (finalDays === 0) return project;

  // 新的里程碑位置
  const newMilestones = project.milestones.map((m) =>
    m.id === milestoneId ? { ...m, date: clampedDate } : m
  );
  const newM1Date = isM1 ? clampedDate : m1.date;
  const newM2Date = isM1 ? m2.date : clampedDate;

  // 更新 phases 边界（让 PhaseRibbon 跟着动）
  const newPhases = project.phases.map((p) => {
    if (p.id === 'design') {
      return { ...p, planStart: designStart, planEnd: newM1Date };
    }
    if (p.id === 'construction') {
      return { ...p, planStart: newM1Date, planEnd: newM2Date };
    }
    if (p.id === 'acceptance') {
      return { ...p, planStart: newM2Date, planEnd: acceptanceEnd };
    }
    return p;
  });

  // 任务联动：按 planStart 判断属于哪个阶段，按比例缩放 duration
  const newTasks = project.tasks.map((t) => {
    const inDesign = t.planStart < designEnd;
    const inConstruction = t.planStart >= constructionStart && t.planStart < constructionEnd;
    const inAcceptance = t.planStart >= acceptanceStart;

    if (isM1) {
      // M1 移：设计阶段按比例缩放，施工阶段按比例缩放，验收不动
      if (inDesign) {
        return rescaleTask(t, designStart, designEnd, designStart, newM1Date);
      }
      if (inConstruction) {
        return rescaleTask(t, constructionStart, constructionEnd, newM1Date, newM2Date);
      }
      return t;
    } else {
      // M2 移：施工阶段按比例缩放，验收阶段按比例缩放，设计不动
      if (inConstruction) {
        return rescaleTask(t, constructionStart, constructionEnd, newM1Date, newM2Date);
      }
      if (inAcceptance) {
        return rescaleTask(t, acceptanceStart, acceptanceEnd, newM2Date, acceptanceEnd);
      }
      return t;
    }
  });

  return {
    ...project,
    milestones: newMilestones,
    phases: newPhases,
    tasks: newTasks
  };
}

/**
 * 按比例缩放任务 duration
 * 原阶段 [phaseStart, phaseEnd] → 新阶段 [newPhaseStart, newPhaseEnd]
 * 任务按比例调整 duration，起点从 newPhaseStart 重新分配
 */
function rescaleTask(
  t: Task,
  phaseStart: string,
  phaseEnd: string,
  newPhaseStart: string,
  newPhaseEnd: string
): Task {
  const oldPhaseDays = daysBetween(phaseStart, phaseEnd);
  const newPhaseDays = daysBetween(newPhaseStart, newPhaseEnd);
  if (oldPhaseDays <= 0 || newPhaseDays <= 0) return t;

  // 计算任务在原阶段中的相对位置（0-1）
  const taskOffset = daysBetween(phaseStart, t.planStart);
  const oldDuration = daysBetween(t.planStart, t.planEnd);
  const taskPosition = oldPhaseDays > 0 ? taskOffset / oldPhaseDays : 0;

  // 按比例计算新 duration（四舍五入，最小 1 天）
  const ratio = newPhaseDays / oldPhaseDays;
  let newDuration = Math.max(1, Math.round(oldDuration * ratio));

  // 从新阶段起点重新计算 planStart
  let newPlanStart = shiftDate(newPhaseStart, Math.round(taskPosition * newPhaseDays));
  let newPlanEnd = shiftDate(newPlanStart, newDuration);

  // clamp 不超阶段边界
  if (newPlanEnd > newPhaseEnd) {
    newPlanEnd = newPhaseEnd;
    newDuration = daysBetween(newPlanStart, newPlanEnd);
  }
  if (newPlanStart < newPhaseStart) {
    newPlanStart = newPhaseStart;
  }

  return {
    ...t,
    planStart: newPlanStart,
    planEnd: newPlanEnd
  };
}

function mergeToView(
  project: ProjectData,
  files: FilesData,
  activities: ActivitiesData,
  aiNotes: AINotesData
): Project {
  return {
    id: project.id,
    code: project.code,
    name: project.name,
    status: project.status,
    start: project.start,
    end: project.end,
    description: project.description,
    phases: project.phases,
    milestones: project.milestones,
    tasks: project.tasks,
    files: files.files,
    activities: activities.activities,
    aiNotes: aiNotes.notes,
    lastModifiedBy: project.lastModifiedBy,
    lastModifiedAt: project.lastModifiedAt
  };
}

export const useProjectStore = create<ProjectState>()((set, get) => ({
  projects: seedProjects,  // 启动时用 seed 占位，initFromApi 后覆盖
  selectedProjectId: 'm-2026',
  loaded: false,
  loadError: null,

  initFromApi: async () => {
    try {
      const manifest = await api.getManifest();
      const all = await Promise.all(
        manifest.projects.map(async (m) => {
          const { project, files, activities, aiNotes } = await api.getProject(m.id);
          return mergeToView(project, files, activities, aiNotes);
        })
      );
      set({ projects: all, loaded: true, loadError: null });
    } catch (err) {
      console.error('[projectStore] initFromApi failed', err);
      set({
        loadError: err instanceof Error ? err.message : 'unknown error',
        loaded: true  // 标记为 loaded 以让 UI 渲染 seed 降级
      });
    }
  },

  setSelectedProject: (id) => set({ selectedProjectId: id }),

  moveTask: async (projectId, taskId, newPlanStart) => {
    // 1. 乐观更新
    set((state) => ({
      projects: state.projects.map((p) => {
        if (p.id !== projectId) return p;
        return {
          ...p,
          tasks: p.tasks.map((t) => {
            if (t.id !== taskId) return t;
            const oldStart = t.planStart;
            const days = daysBetween(oldStart, newPlanStart);
            if (days === 0) return t;
            const isCompleted = !!t.actualEnd;
            if (isCompleted) {
              return { ...t, planStart: newPlanStart, planEnd: shiftDate(t.planEnd, days) };
            }
            return {
              ...t,
              planStart: newPlanStart,
              planEnd: shiftDate(t.planEnd, days),
              actualStart: t.actualStart ? shiftDate(t.actualStart, days) : undefined,
              actualEnd: t.actualEnd ? shiftDate(t.actualEnd, days) : undefined
            };
          })
        };
      })
    }));
    // 2. 尝试写盘（失败不回滚，静态站无后端时改动留在内存）
    try {
      const project = get().projects.find((p) => p.id === projectId);
      if (!project) return;
      await api.patchProject(projectId, {
        tasks: project.tasks,
        meta: { lastModifiedBy: 'ui-dude', lastModifiedAt: new Date().toISOString() }
      });
    } catch (err) {
      // 静态站 API 不可用时静默，改动保留在内存
    }
  },

  resizeTask: async (projectId, taskId, newStartOrEnd, side) => {
    set((state) => ({
      projects: state.projects.map((p) => {
        if (p.id !== projectId) return p;
        return {
          ...p,
          tasks: p.tasks.map((t) => {
            if (t.id !== taskId) return t;
            if (side === 'end') return { ...t, planEnd: newStartOrEnd };
            return {
              ...t,
              planStart: newStartOrEnd,
              actualStart: t.actualStart && !t.actualEnd
                ? shiftDate(t.actualStart, daysBetween(t.planStart, newStartOrEnd))
                : t.actualStart
            };
          })
        };
      })
    }));
    try {
      const project = get().projects.find((p) => p.id === projectId);
      if (!project) return;
      await api.patchProject(projectId, {
        tasks: project.tasks,
        meta: { lastModifiedBy: 'ui-dude', lastModifiedAt: new Date().toISOString() }
      });
    } catch (err) {
      // 静态站 API 不可用时静默
    }
  },

  moveMilestone: async (projectId, milestoneId, newDate) => {
    const prevProject = get().projects.find((p) => p.id === projectId);
    if (!prevProject) return;
    // 1. 乐观更新：用 rebalancePhases 重算（总工期锁死 + phases 同步 + 实际完工保护）
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === projectId ? rebalancePhases(p, milestoneId, newDate) : p
      )
    }));
    // 没变化则不写盘
    const updated = get().projects.find((p) => p.id === projectId);
    if (!updated || updated === prevProject) return;
    // 2. 尝试写盘（失败不回滚）
    try {
      await api.patchProject(projectId, {
        milestones: updated.milestones,
        phases: updated.phases,
        tasks: updated.tasks,
        meta: { lastModifiedBy: 'ui-dude', lastModifiedAt: new Date().toISOString() }
      });
    } catch (err) {
      // 静态站 API 不可用时静默，改动保留在内存
    }
  },

  // plan 模式：不写数据，只保留为 mock 引擎的 hook
  // AIChatPanel 不再调它；保留兼容旧调用
  updateTaskProgress: () => {
    // no-op: 改 plan 模式，AI 不再自动应用
  },

  addTask: async (projectId, task) => {
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === projectId ? { ...p, tasks: [...p.tasks, task] } : p
      )
    }));
    try {
      const project = get().projects.find((p) => p.id === projectId);
      if (!project) return;
      await api.patchProject(projectId, {
        tasks: project.tasks,
        meta: { lastModifiedBy: 'ui-dude', lastModifiedAt: new Date().toISOString() }
      });
    } catch (err) {
      // 静态站 API 不可用时静默
    }
  },

  deleteTask: async (projectId, taskId) => {
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === projectId ? { ...p, tasks: p.tasks.filter((t) => t.id !== taskId) } : p
      )
    }));
    try {
      const project = get().projects.find((p) => p.id === projectId);
      if (!project) return;
      await api.patchProject(projectId, {
        tasks: project.tasks,
        meta: { lastModifiedBy: 'ui-dude', lastModifiedAt: new Date().toISOString() }
      });
    } catch (err) {
      // 静态站 API 不可用时静默
    }
  },

  applyRemoteUpdate: async (evt) => {
    if (evt.file !== 'project.json') return;  // D7 只关心甘特核心；files/activities/ai-notes 等 Task 7
    try {
      const { project, files, activities, aiNotes } = await api.getProject(evt.projectId);
      const merged = mergeToView(project, files, activities, aiNotes);
      set((state) => ({
        projects: state.projects.map((p) => (p.id === evt.projectId ? merged : p))
      }));
    } catch (err) {
      console.error('[projectStore] applyRemoteUpdate failed', err);
    }
  }
}));
