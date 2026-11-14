import { apiClient, unwrap } from '@/lib/api';

export type FeedbackCategory = 'BUG' | 'QUESTION' | 'IDEA';
export type FeedbackPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
export type FeedbackStatus = 'OPEN' | 'IN_PROGRESS' | 'WAITING_ON_USER' | 'RESOLVED' | 'CLOSED';

export interface FeedbackAgent {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export interface FeedbackSubmission {
  id: string;
  category: FeedbackCategory;
  subject: string;
  message: string;
  pagePath: string | null;
  priority: FeedbackPriority;
  assignedToId: string | null;
  assignedTo?: FeedbackAgent | null;
  status: FeedbackStatus;
  createdAt: string;
  updatedAt: string;
}

export interface FeedbackInboxItem extends FeedbackSubmission {
  submitterName: string;
  submitterEmail: string;
  assignedTo?: FeedbackAgent | null;
}

export interface FeedbackMessage {
  id: string;
  senderType: 'USER' | 'ADMIN';
  senderName: string;
  body: string;
  createdAt: string;
}

export const supportAPI = {
  async submit(input: {
    category: FeedbackCategory;
    subject: string;
    message: string;
    pagePath?: string;
    priority?: FeedbackPriority;
  }) {
    return unwrap<FeedbackSubmission>(await apiClient.post('/support/feedback', input));
  },
  async mine() {
    return unwrap<FeedbackSubmission[]>(await apiClient.get('/support/feedback/mine'));
  },
  async inbox() {
    return unwrap<FeedbackInboxItem[]>(await apiClient.get('/support/feedback'));
  },
  async agents() {
    return unwrap<FeedbackAgent[]>(await apiClient.get('/support/feedback/agents'));
  },
  async updateStatus(id: string, status: FeedbackStatus) {
    return unwrap<FeedbackInboxItem>(
      await apiClient.patch(`/support/feedback/${encodeURIComponent(id)}/status`, { status }),
    );
  },
  async updatePriority(id: string, priority: FeedbackPriority) {
    return unwrap<FeedbackInboxItem>(
      await apiClient.patch(`/support/feedback/${encodeURIComponent(id)}/priority`, { priority }),
    );
  },
  async assign(id: string, userId: string | null) {
    return unwrap<FeedbackInboxItem>(
      await apiClient.patch(`/support/feedback/${encodeURIComponent(id)}/assignee`, { userId }),
    );
  },
  async messages(id: string) {
    return unwrap<FeedbackMessage[]>(
      await apiClient.get(`/support/feedback/${encodeURIComponent(id)}/messages`),
    );
  },
  async reply(id: string, body: string) {
    return unwrap<FeedbackMessage>(
      await apiClient.post(`/support/feedback/${encodeURIComponent(id)}/messages`, { body }),
    );
  },
};
