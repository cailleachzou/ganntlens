import { create } from 'zustand';

interface UIState {
  drawerOpen: boolean;
  selectedTaskId: string | null;
  selectedProjectId: string | null;
  hoverTaskId: string | null;
  /** 抽屉打开时抑制 hover 卡立即隐藏 */
  hoverSuppressed: boolean;
  openDrawer: (taskId: string, projectId: string) => void;
  closeDrawer: () => void;
  setHoverTask: (taskId: string | null) => void;
  setHoverSuppressed: (b: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  drawerOpen: false,
  selectedTaskId: null,
  selectedProjectId: null,
  hoverTaskId: null,
  hoverSuppressed: false,
  openDrawer: (taskId, projectId) =>
    set({ drawerOpen: true, selectedTaskId: taskId, selectedProjectId: projectId, hoverSuppressed: true }),
  closeDrawer: () => set({ drawerOpen: false, hoverSuppressed: false }),
  setHoverTask: (taskId) => set({ hoverTaskId: taskId }),
  setHoverSuppressed: (b) => set({ hoverSuppressed: b })
}));
