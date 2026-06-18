import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { seedProjects } from '../lib/seed/seedData';
import type { Project, Task } from '../types';

interface ProjectState {
  projects: Project[];
  selectedProjectId: string;
  setSelectedProject: (id: string) => void;
  /** 里程碑平移 N 天；同时平移该里程碑之后所有任务和后续里程碑 */
  shiftMilestone: (projectId: string, milestoneId: string, days: number) => void;
  updateTaskProgress: (projectId: string, taskId: string, pct: number) => void;
  addTask: (projectId: string, task: Task) => void;
  deleteTask: (projectId: string, taskId: string) => void;
}

// 工具：YYYY-MM-DD 加减天数
function shiftDate(date: string, days: number): string {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set) => ({
      projects: seedProjects,
      selectedProjectId: 'm-2026',

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

      updateTaskProgress: (projectId, taskId, pct) =>
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === projectId
              ? {
                  ...p,
                  tasks: p.tasks.map((t) => (t.id === taskId ? { ...t, progress: pct } : t))
                }
              : p
          )
        })),

      addTask: (projectId, task) =>
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === projectId ? { ...p, tasks: [...p.tasks, task] } : p
          )
        })),

      deleteTask: (projectId, taskId) =>
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === projectId ? { ...p, tasks: p.tasks.filter((t) => t.id !== taskId) } : p
          )
        }))
    }),
    { name: 'pm-projects' }
  )
);
