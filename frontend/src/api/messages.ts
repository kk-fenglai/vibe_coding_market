import { api } from './client';
import type { ChatMessage, Conversation } from '../types';

export async function openConversation(projectId: string, builderId?: string): Promise<Conversation> {
  const { data } = await api.post(`/projects/${projectId}/conversations`, builderId ? { builderId } : {});
  return data;
}

export async function listConversations(): Promise<{ items: Conversation[] }> {
  const { data } = await api.get('/conversations');
  return data;
}

export async function getConversation(id: string): Promise<{ conversation: Conversation; messages: ChatMessage[] }> {
  const { data } = await api.get(`/conversations/${id}`);
  return data;
}

export async function sendMessage(conversationId: string, body: string): Promise<ChatMessage> {
  const { data } = await api.post(`/conversations/${conversationId}/messages`, { body });
  return data;
}

export async function getUnreadCount(): Promise<number> {
  const { data } = await api.get('/conversations-unread');
  return data.unread;
}
