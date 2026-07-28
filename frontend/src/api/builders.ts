import { api } from './client';
import type {
  BuilderProfile, BuilderProfilePayload, PortfolioItem, PortfolioPayload,
  PublicBuilderProfile, Review,
} from '../types';

export async function getMyBuilderProfile(): Promise<BuilderProfile | null> {
  const { data } = await api.get('/builders/me');
  return data.profile;
}

export async function saveMyBuilderProfile(payload: BuilderProfilePayload): Promise<BuilderProfile> {
  const { data } = await api.put('/builders/me', payload);
  return data.profile;
}

export async function getPublicBuilder(userId: string): Promise<{ profile: PublicBuilderProfile; reviews: Review[] }> {
  const { data } = await api.get(`/builders/${userId}`);
  return data;
}

export async function listMyPortfolio(): Promise<{ items: PortfolioItem[] }> {
  const { data } = await api.get('/builders/me/portfolio');
  return data;
}

export async function createPortfolioItem(payload: PortfolioPayload): Promise<PortfolioItem> {
  const { data } = await api.post('/builders/me/portfolio', payload);
  return data;
}

export async function updatePortfolioItem(id: string, payload: PortfolioPayload): Promise<PortfolioItem> {
  const { data } = await api.patch(`/builders/me/portfolio/${id}`, payload);
  return data;
}

export async function deletePortfolioItem(id: string): Promise<void> {
  await api.delete(`/builders/me/portfolio/${id}`);
}
