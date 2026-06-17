import { create } from 'zustand';

interface UIState {
  drawerOpen: boolean;
  selectedTaskId: string | null;
  selectedProjectId: string | null;
  hoverTaskId: string | null;
  openDrawer: (taskId: string, projectId: string) => void;
  closeDrawer: () => void;
  setHoverTask: (taskId: string | null) => void;
}

export const useUIStore = create<UIState>((set) => ({
  drawerOpen: false,
  selectedTaskId: null,
  selectedProjectId: null,
  hoverTaskId: null,
  openDrawer: (taskId, projectId) =>
    set({ drawerOpen: true, selectedTaskId: taskId, selectedProjectId: projectId }),
  closeDrawer: () => set({ drawerOpen: false }),
  setHoverTask: (taskId) => set({ hoverTaskId: taskId })
}));
