import { apiClient, unwrap } from '@/lib/api';

export interface ChatResult {
  answer: string;
  sources: string[];
  provider: string;
  toolCalls: string[];
  followUps?: string[];
  dataPeriod?: string;
  facts?: ChatFact[];
}
export interface ChatFact { label: string; value: string }
export interface ChatMessage { role: 'user' | 'assistant'; content: string }

export const copilotAPI = {
  status: () => apiClient.get('/copilot/status').then((r) => unwrap<{ assistant: string; provider: string; llmConfigured: boolean }>(r)),
  suggestions: () => apiClient.get('/copilot/suggestions').then((r) => unwrap<{ suggestions: string[] }>(r)),
  chat: (message: string, history: ChatMessage[], files: File[] = []) => {
    if (!files.length) {
      return apiClient.post('/copilot/chat', { message, history }).then((r) => unwrap<ChatResult>(r));
    }
    const body = new FormData();
    body.append('message', message);
    body.append('history', JSON.stringify(history));
    files.forEach((file) => body.append('files', file));
    return apiClient
      .post('/copilot/chat', body, { headers: { 'Content-Type': 'multipart/form-data' } })
      .then((r) => unwrap<ChatResult>(r));
  },
};
