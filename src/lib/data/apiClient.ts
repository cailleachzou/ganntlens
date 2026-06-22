// D7 API 客户端
// 见 docs/superpowers/specs/2026-06-18-gantt-day7-lan-agent-collab-design.md §4.2

import type { Manifest, ProjectData, FilesData, ActivitiesData, AINotesData, ProjectPatch, ScanConfig, ScanStatus } from '../../types/data';

const BASE = '/api';

export class ApiError extends Error {
  constructor(public status: number, public body: any) {
    super(body?.message ?? 'API error');
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    ...init
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body);
  }
  return res.json();
}

export const api = {
  async getManifest(): Promise<Manifest> {
    return request<Manifest>('/manifest');
  },

  async getProject(projectId: string): Promise<{
    project: ProjectData;
    files: FilesData;
    activities: ActivitiesData;
    aiNotes: AINotesData;
  }> {
    return request(`/projects/${projectId}`);
  },

  async patchProject(projectId: string, patch: ProjectPatch): Promise<{ mtime: number }> {
    return request(`/projects/${projectId}`, {
      method: 'POST',
      body: JSON.stringify(patch)
    });
  },

  async getScanConfig(): Promise<ScanConfig> {
    return request<ScanConfig>('/scan-config');
  },

  async updateScanConfig(update: Partial<ScanConfig>): Promise<ScanConfig> {
    return request<ScanConfig>('/scan-config', {
      method: 'POST',
      body: JSON.stringify(update)
    });
  },

  async triggerScan(): Promise<{ message: string }> {
    return request<{ message: string }>('/scan', { method: 'POST' });
  },

  async getScanStatus(): Promise<ScanStatus> {
    return request<ScanStatus>('/scan/status');
  }
};
