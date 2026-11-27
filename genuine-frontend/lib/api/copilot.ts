import { apiClient, unwrap } from '@/lib/api';

export interface ChatResult {
  answer: string;
  sources: string[];
  provider: string;
  toolCalls: string[];
  followUps?: string[];
  dataPeriod?: string;
  facts?: ChatFact[];
  conversationId?: string;
}
export interface ChatFact { label: string; value: string }
export interface ChatMessage { role: 'user' | 'assistant'; content: string }
export interface ConversationSummary {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}
export interface ConversationDetail extends ConversationSummary {
  messages: Array<ChatMessage & { createdAt: string }>;
}

export const copilotAPI = {
  status: () => apiClient.get('/copilot/status').then((r) => unwrap<{ assistant: string; provider: string; llmConfigured: boolean }>(r)),
  suggestions: () => apiClient.get('/copilot/suggestions').then((r) => unwrap<{ suggestions: string[] }>(r)),
  chat: (message: string, history: ChatMessage[], files: File[] = [], conversationId?: string) => {
    if (!files.length) {
      return apiClient
        .post('/copilot/chat', { message, history, conversationId })
        .then((r) => unwrap<ChatResult>(r));
    }
    const body = new FormData();
    body.append('message', message);
    body.append('history', JSON.stringify(history));
    if (conversationId) body.append('conversationId', conversationId);
    files.forEach((file) => body.append('files', file));
    return apiClient
      .post('/copilot/chat', body, { headers: { 'Content-Type': 'multipart/form-data' } })
      .then((r) => unwrap<ChatResult>(r));
  },
  conversations: () =>
    apiClient.get('/copilot/conversations').then((r) => unwrap<ConversationSummary[]>(r)),
  conversation: (id: string) =>
    apiClient.get(`/copilot/conversations/${id}`).then((r) => unwrap<ConversationDetail>(r)),
  deleteConversation: (id: string) =>
    apiClient.delete(`/copilot/conversations/${id}`).then((r) => unwrap<{ deleted: boolean }>(r)),
};
