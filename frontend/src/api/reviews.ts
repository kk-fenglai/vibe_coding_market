import { api } from './client';
import type { Review, ReviewPayload } from '../types';

export async function submitReview(projectId: string, payload: ReviewPayload): Promise<Review> {
  const { data } = await api.post(`/projects/${projectId}/reviews`, payload);
  return data;
}

export async function getProjectReviews(projectId: string): Promise<{ items: Review[]; myReview: Review | null }> {
  const { data } = await api.get(`/projects/${projectId}/reviews`);
  return data;
}
