// D7 数据模型：拆分自原 Project 类型
// 见 docs/superpowers/specs/2026-06-18-gantt-day7-lan-agent-collab-design.md §3.3

import type { Phase, Milestone, Task, FileNode, AINote, Activity } from './index';

export interface ProjectData {
  id: string;
  code: string;
  name: string;
  status: 'planning' | 'active' | 'completed' | 'archived';
  start: string;
  end: string;
  description?: string;
  phases: Phase[];
  milestones: Milestone[];
  tasks: Task[];
  lastModifiedBy?: string;
  lastModifiedAt?: string;
}

export interface FilesData {
  projectId: string;
  files: FileNode[];
  lastModifiedBy?: string;
  lastModifiedAt?: string;
}

export interface ActivitiesData {
  projectId: string;
  activities: Activity[];
  lastModifiedBy?: string;
  lastModifiedAt?: string;
}

export interface AINotesData {
  projectId: string;
  notes: AINote[];
  lastModifiedBy?: string;
  lastModifiedAt?: string;
}

export interface Manifest {
  version: string;
  projects: Array<{
    id: string;
    code: string;
    name: string;
    status: ProjectData['status'];
    mtime: number;
  }>;
}

export type ProjectEventKind =
  | 'project-updated'
  | 'files-updated'
  | 'activities-updated'
  | 'ai-notes-updated';

export interface ProjectEvent {
  kind: ProjectEventKind;
  projectId: string;
  file: 'project.json' | 'files.json' | 'activities.json' | 'ai-notes.json';
  mtime: number;
  /** mtime 与 dev-server 内存中的不一致 = 409 conflict 提示 */
  conflictWith?: 'ui-drag' | 'agent-edit';
}

export interface ProjectPatch {
  tasks?: Task[];
  phases?: Phase[];
  milestones?: Milestone[];
  meta?: { lastModifiedBy: string; lastModifiedAt: string };
}
