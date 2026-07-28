import { api } from './client';
import type { Escrow, WalletInfo } from '../types';

export async function getProjectEscrow(projectId: string): Promise<Escrow> {
  const { data } = await api.get(`/projects/${projectId}/escrow`);
  return data;
}

export async function fundProjectEscrow(projectId: string): Promise<Escrow> {
  const { data } = await api.post(`/projects/${projectId}/escrow/fund`);
  return data;
}

export async function raiseDispute(projectId: string, reason: string): Promise<Escrow> {
  const { data } = await api.post(`/projects/${projectId}/escrow/dispute`, { reason });
  return data;
}

export async function getWallet(): Promise<WalletInfo> {
  const { data } = await api.get('/wallet');
  return data;
}
