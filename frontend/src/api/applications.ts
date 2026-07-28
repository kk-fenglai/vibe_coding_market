import { api } from './client';
import type { Application, ApplicationPayload } from '../types';

export async function applyToProject(projectId: string, payload: ApplicationPayload): Promise<Application> {
  const { data } = await api.post(`/projects/${projectId}/applications`, payload);
  return data;
}

export async function listProjectApplications(projectId: string): Promise<{ items: Application[] }> {
  const { data } = await api.get(`/projects/${projectId}/applications`);
  return data;
}

export async function listMyApplications(): Promise<{ items: Application[] }> {
  const { data } = await api.get('/applications/mine');
  return data;
}

export async function acceptApplication(id: string): Promise<Application> {
  const { data } = await api.post(`/applications/${id}/accept`);
  return data;
}

export async function rejectApplication(id: string): Promise<Application> {
  const { data } = await api.post(`/applications/${id}/reject`);
  return data;
}

export async function withdrawApplication(id: string): Promise<Application> {
  const { data } = await api.post(`/applications/${id}/withdraw`);
  return data;
}

export async function deliverProject(projectId: string, deliveryNote: string) {
  const { data } = await api.post(`/projects/${projectId}/deliver`, { deliveryNote });
  return data;
}

export async function confirmProject(projectId: string) {
  const { data } = await api.post(`/projects/${projectId}/confirm`);
  return data;
}

export async function requestChanges(projectId: string) {
  const { data } = await api.post(`/projects/${projectId}/request-changes`);
  return data;
}
