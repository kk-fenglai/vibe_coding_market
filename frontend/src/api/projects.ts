import { api } from './client';
import type { Project, ProjectListResponse, ProjectPayload } from '../types';

export interface MarketFilters {
  q?: string;
  category?: string;
  currency?: string;
  budgetMin?: number;
  budgetMax?: number;
  maxDeliveryDays?: number;
  urgent?: boolean;
  stack?: string;
  sort?: 'newest' | 'budget' | 'delivery';
  page?: number;
  pageSize?: number;
}

// 空值不发给后端，否则 zod 会因为空字符串报 400。
function clean(f: MarketFilters): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  Object.entries(f).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '' || v === false) return;
    out[k] = typeof v === 'boolean' ? String(v) : v;
  });
  return out;
}

export async function listProjects(filters: MarketFilters): Promise<ProjectListResponse> {
  const { data } = await api.get('/projects', { params: clean(filters) });
  return data;
}

export async function getProject(id: string): Promise<Project> {
  const { data } = await api.get(`/projects/${id}`);
  return data;
}

export async function listMyProjects(status?: string): Promise<{ items: Project[] }> {
  const { data } = await api.get('/projects/mine', { params: status ? { status } : {} });
  return data;
}

export async function createProject(payload: ProjectPayload, submit: boolean): Promise<Project> {
  const { data } = await api.post('/projects', { ...payload, submit });
  return data;
}

export async function updateProject(id: string, payload: ProjectPayload): Promise<Project> {
  const { data } = await api.patch(`/projects/${id}`, payload);
  return data;
}

export async function submitProject(id: string): Promise<Project> {
  const { data } = await api.post(`/projects/${id}/submit`);
  return data;
}

export async function cancelProject(id: string): Promise<Project> {
  const { data } = await api.post(`/projects/${id}/cancel`);
  return data;
}
