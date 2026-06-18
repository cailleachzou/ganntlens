import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { seedProjects } from '../lib/seed/seedData';
import type { Project, Task } from '../types';
import { daysBetween } from '../lib/gantt/dateUtils';

interface ProjectState {
  projects: Project[];
  selectedProjectId: string;
  setSelectedProject: (id: string) => void;
  /** 里程碑平移 N 天；同时平移该里程碑之后所有任务和后续里程碑 */
  shiftMilestone: (projectId: string, milestoneId: string, days: number) => void;
  /** 移动整条 task：planStart+planEnd 同步平移，actual 联动（见 §2.1 表格） */
  moveTask: (projectId: string, taskId: string, newPlanStart: string) => void;
  /** 改 planStart 或 planEnd（duration 改）。side='start' | 'end' */
  resizeTask: (projectId: string, taskId: string, newStartOrEnd: string, side: 'start' | 'end') => void;
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

      moveTask: (projectId, taskId, newPlanStart) =>
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
                // spec §2.1：已完成不动 actual；未开始/进行中 actual* 整体平移
                // （进行中 actualEnd 不存在，未开始 actual* 全为 undefined——两种情况表达式安全）
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
        })),

      resizeTask: (projectId, taskId, newStartOrEnd, side) =>
        set((state) => ({
          projects: state.projects.map((p) => {
            if (p.id !== projectId) return p;
            return {
              ...p,
              tasks: p.tasks.map((t) => {
                if (t.id !== taskId) return t;
                if (side === 'end') {
                  return { ...t, planEnd: newStartOrEnd };
                }
                // side === 'start'
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
