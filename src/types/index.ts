// GanttLens 数据模型 - 7 实体
// 见 docs/superpowers/specs/2026-06-16-gantt-project-management-demo-design.md §4

export type ProjectStatus = 'planning' | 'active' | 'completed' | 'archived';
export type MilestoneStatus = 'pending' | 'reached' | 'missed';
export type AIProvider =
  | 'mock'
  | 'openai'
  | 'deepseek'
  | 'moonshot'
  | 'zhipu'
  | 'MiniMax'
  | 'mimo'
  | 'custom';

export interface Project {
  id: string;
  code: string;
  name: string;
  status: ProjectStatus;
  start: string; // YYYY-MM-DD
  end: string;
  description?: string;
  phases: Phase[];
  milestones: Milestone[];
  tasks: Task[];
  files: FileNode[];
}

export interface Phase {
  id: string; // 'design' | 'construction' | 'acceptance'
  name: string; // '前期 · 设计'
  color: string; // '#dbeafe'
  order: number;
  planStart: string;
  planEnd: string;
  actualStart?: string;
  actualEnd?: string;
}

export interface Milestone {
  id: string; // 'm1' | 'm2'
  name: string; // 'M1 开工'
  date: string;
  betweenPhases: [string, string];
  status: MilestoneStatus;
}

export interface Task {
  id: string;
  name: string;
  phaseId: string;
  planStart: string;
  planEnd: string;
  actualStart?: string;
  actualEnd?: string;
  progress: number; // 0-100
  parentId?: string;
  owner?: string;
  fileIds?: string[];
  deliverableIds?: string[];
}

export interface FileNode {
  id: string;
  name: string;
  type: 'folder' | 'file';
  parentId?: string;
  ext?: string;
  size?: number;
  taskIds?: string[];
}

export interface Deliverable {
  id: string;
  name: string;
  taskId: string;
  status: 'pending' | 'in-review' | 'approved';
  criteria?: string[];
}

export interface AINote {
  id: string;
  projectId: string;
  taskId?: string;
  type: 'summary' | 'risk' | 'change' | 'insight';
  content: string;
  createdAt: string;
}
