import { create } from 'zustand';

export type DragType = 'task-move' | 'task-resize-start' | 'task-resize-end' | 'milestone';

export interface DragState {
  type: DragType;
  projectId: string;
  /** task id or milestone id */
  id: string;
  /** 拖动期间临时值（不写 store，preview 用） */
  previewStart: string;
  previewEnd: string;
  /** 相对原值的偏移天数（+5 / -3） */
  daysDelta: number;
  /** 鼠标 clientX/Y，用于 DragPreview 定位 */
  clientX: number;
  clientY: number;
  /** 是否越界（true → 松手回弹） */
  outOfBounds: boolean;
}

interface UIState {
  drawerOpen: boolean;
  selectedTaskId: string | null;
  selectedProjectId: string | null;
  hoverTaskId: string | null;
  hoverSuppressed: boolean;
  /** 拖动状态（null = 不在拖动） */
  dragState: DragState | null;
  /** D7 软锁状态（其他端正在写盘时显示 banner） */
  lockState: {
    projectId: string | null;
    owner: string | null;
    reason: string | null;
  };
  setLockState: (state: { projectId: string | null; owner: string | null; reason: string | null }) => void;
  openDrawer: (taskId: string, projectId: string) => void;
  closeDrawer: () => void;
  setHoverTask: (taskId: string | null) => void;
  setHoverSuppressed: (b: boolean) => void;
  startDrag: (s: DragState) => void;
  updateDrag: (patch: Partial<DragState>) => void;
  endDrag: () => void;
  cancelDrag: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  drawerOpen: false,
  selectedTaskId: null,
  selectedProjectId: null,
  hoverTaskId: null,
  hoverSuppressed: false,
  dragState: null,
  lockState: { projectId: null, owner: null, reason: null },
  setLockState: (lockState) => set({ lockState }),
  openDrawer: (taskId, projectId) =>
    set({ drawerOpen: true, selectedTaskId: taskId, selectedProjectId: projectId, hoverSuppressed: true, dragState: null }),
  closeDrawer: () => set({ drawerOpen: false, hoverSuppressed: false, dragState: null }),
  setHoverTask: (taskId) => set({ hoverTaskId: taskId }),
  setHoverSuppressed: (b) => set({ hoverSuppressed: b }),
  startDrag: (s) => set({ dragState: s }),
  updateDrag: (patch) =>
    set((state) => (state.dragState ? { dragState: { ...state.dragState, ...patch } } : {})),
  endDrag: () => set({ dragState: null }),
  cancelDrag: () => set({ dragState: null })
}));
