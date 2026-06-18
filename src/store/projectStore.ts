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
  shiftMilestone: (projectId: string, milestoneId: string, days: number) => void;
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

  shiftMilestone: (projectId, milestoneId, days) =>
    set((state) => ({
      projects: state.projects.map((p) => {
        if (p.id !== projectId) return p;
        const ms = p.milestones.find((m) => m.id === milestoneId);
        if (!ms) return p;
        const msIndex = p.milestones.findIndex((m) => m.id === milestoneId);
        return {
          ...p,
          milestones: p.milestones.map((m) =>
            m.id === milestoneId || p.milestones.indexOf(m) > msIndex
              ? { ...m, date: shiftDate(m.date, days) }
              : m
          ),
          tasks: p.tasks.map((t) => {
            if (t.planStart < ms.date) return t;
            return {
              ...t,
              planStart: shiftDate(t.planStart, days),
              planEnd: shiftDate(t.planEnd, days),
              actualStart: t.actualStart ? shiftDate(t.actualStart, days) : undefined,
              actualEnd: t.actualEnd ? shiftDate(t.actualEnd, days) : undefined
            };
          })
        };
      })
    })),

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
    const state = get();
    const project = state.projects.find((p) => p.id === projectId);
    if (!project) return;
    const ms = project.milestones.find((m) => m.id === milestoneId);
    if (!ms) return;
    const days = daysBetween(ms.date, newDate);
    if (days === 0) return;
    // 复用级联逻辑（本地先算）
    const before = get().projects;
    state.shiftMilestone(projectId, milestoneId, days);
    try {
      const updated = get().projects.find((p) => p.id === projectId);
      if (!updated) return;
      await api.patchProject(projectId, {
        milestones: updated.milestones,
        tasks: updated.tasks,
        meta: { lastModifiedBy: 'ui-dude', lastModifiedAt: new Date().toISOString() }
      });
    } catch (err) {
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
