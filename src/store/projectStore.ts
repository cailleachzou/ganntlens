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

  const m1 = project.milestones.find((m) => m.id === 'M1')!;
  const m2 = project.milestones.find((m) => m.id === 'M2')!;
  const isM1 = milestoneId === 'M1';

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

  // 任务联动：按 planStart 判断属于哪个阶段，跟随阶段边界位移
  // clamp 确保任务不跨阶段边界
  const newTasks = project.tasks.map((t) => {
    const inDesign = t.planStart < designEnd;
    const inConstruction = t.planStart >= constructionStart && t.planStart < constructionEnd;
    const inAcceptance = t.planStart >= acceptanceStart;

    if (isM1) {
      // M1 移：设计 + 施工任务跟随 M1 位移，验收不动
      if (inDesign) {
        return shiftTask(t, finalDays, designStart, newM1Date);
      }
      if (inConstruction) {
        return shiftTask(t, finalDays, newM1Date, newM2Date);
      }
      return t;
    } else {
      // M2 移：施工 + 验收任务跟随 M2 位移，设计不动
      if (inConstruction) {
        return shiftTask(t, finalDays, newM1Date, newM2Date);
      }
      if (inAcceptance) {
        return shiftTask(t, finalDays, newM2Date, acceptanceEnd);
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

/** 平移任务，clamp 确保不跨阶段边界 */
function shiftTask(t: Task, days: number, clampMin: string, clampMax: string): Task {
  let newPlanStart = shiftDate(t.planStart, days);
  let newPlanEnd = shiftDate(t.planEnd, days);
  let newActualStart = t.actualStart ? shiftDate(t.actualStart, days) : undefined;
  let newActualEnd = t.actualEnd ? shiftDate(t.actualEnd, days) : undefined;

  // clamp 不超阶段下界
  if (newPlanStart < clampMin) {
    const adjust = daysBetween(newPlanStart, clampMin);
    newPlanStart = shiftDate(newPlanStart, adjust);
    newPlanEnd = shiftDate(newPlanEnd, adjust);
    if (newActualStart) newActualStart = shiftDate(newActualStart, adjust);
    if (newActualEnd) newActualEnd = shiftDate(newActualEnd, adjust);
  }

  // clamp 不超阶段上界（planEnd 不能超 clampMax）
  if (newPlanEnd > clampMax) {
    const adjust = daysBetween(clampMax, newPlanEnd);
    newPlanStart = shiftDate(newPlanStart, -adjust);
    newPlanEnd = shiftDate(newPlanEnd, -adjust);
    if (newActualStart) newActualStart = shiftDate(newActualStart, -adjust);
    if (newActualEnd) newActualEnd = shiftDate(newActualEnd, -adjust);
  }

  return {
    ...t,
    planStart: newPlanStart,
    planEnd: newPlanEnd,
    actualStart: newActualStart,
    actualEnd: newActualEnd
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
    const before = get().projects;
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
    // 2. 写盘
    try {
      const project = get().projects.find((p) => p.id === projectId);
      if (!project) return;
      await api.patchProject(projectId, {
        tasks: project.tasks,
        meta: { lastModifiedBy: 'ui-dude', lastModifiedAt: new Date().toISOString() }
      });
    } catch (err) {
      // 3. 回滚
      set({ projects: before });
      const msg = err instanceof ApiError ? `[${err.status}] ${err.message}` : String(err);
      console.error('[projectStore] moveTask write failed', msg);
      throw err;  // 让 UI 层 toast
    }
  },

  resizeTask: async (projectId, taskId, newStartOrEnd, side) => {
    const before = get().projects;
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
      set({ projects: before });
      throw err;
    }
  },

  moveMilestone: async (projectId, milestoneId, newDate) => {
    const before = get().projects;
    const prevProject = before.find((p) => p.id === projectId);
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
    // 2. 写盘
    try {
      await api.patchProject(projectId, {
        milestones: updated.milestones,
        phases: updated.phases,
        tasks: updated.tasks,
        meta: { lastModifiedBy: 'ui-dude', lastModifiedAt: new Date().toISOString() }
      });
    } catch (err) {
      // 3. 回滚
      set({ projects: before });
      throw err;
    }
  },

  // plan 模式：不写数据，只保留为 mock 引擎的 hook
  // AIChatPanel 不再调它；保留兼容旧调用
  updateTaskProgress: () => {
    // no-op: 改 plan 模式，AI 不再自动应用
  },

  addTask: async (projectId, task) => {
    const before = get().projects;
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
      set({ projects: before });
      throw err;
    }
  },

  deleteTask: async (projectId, taskId) => {
    const before = get().projects;
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
      set({ projects: before });
      throw err;
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
