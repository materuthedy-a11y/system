import { apiClient, unwrap } from '@/lib/api';

export type NotificationEventType = 'PAYMENT_RECEIVED' | 'INVOICE_CREATED' | 'PAYMENT_DUE' | 'LOW_STOCK' | 'PURCHASE_ORDER_APPROVED' | 'SALES_INVOICE_ISSUED' | 'EXPENSE_APPROVED' | 'REPORT_GENERATED';
export type NotificationType = 'EMAIL' | 'SMS' | 'IN_APP';
export interface InboxNotification {
  id: string;
  notificationId: string;
  type: NotificationType;
  eventType: NotificationEventType;
  subject: string;
  body: string;
  referenceId?: string | null;
  referenceType?: string | null;
  createdAt: string;
  isRead: boolean;
  readAt?: string | null;
  isArchived: boolean;
  archivedAt?: string | null;
}
export interface InboxPage { data: InboxNotification[]; unreadCount: number; total: number; page: number; limit: number; totalPages: number; }
export interface InAppPreference { eventType: NotificationEventType; inAppEnabled: boolean; }
export interface NotificationLogPage {
  data: Array<{ id: string; type: NotificationType; eventType: NotificationEventType; status: string; subject: string; attemptCount: number; createdAt: string; recipientCount: number; sentCount: number; failedCount: number }>;
  total: number; page: number; limit: number; totalPages: number;
}
export interface NotificationLogDetail {
  id: string; type: NotificationType; eventType: NotificationEventType | 'PASSWORD_RESET'; status: string;
  subject: string; body: string; attemptCount: number;
  recipients: Array<{ status: string; failureReason?: string | null }>;
  logs: Array<{ status: string; message: string; timestamp: string; responseCode?: number | null }>;
}
export interface EmailProviderConfig { provider: 'SMTP' | 'SENDGRID'; fromEmail: string; fromName: string; configured: true; }
export type SmsProvider = 'TWILIO' | 'AFRICAS_TALKING' | 'SASISMS' | 'DARSMS' | 'EHUB' | 'SAKURA';
export interface SmsProviderConfig { provider: SmsProvider; fromNumber: string; configured: true; }

export const notificationEventLabels: Record<NotificationEventType, string> = {
  PAYMENT_RECEIVED: 'Payment received', INVOICE_CREATED: 'Invoice created', PAYMENT_DUE: 'Payment due',
  LOW_STOCK: 'Low stock', PURCHASE_ORDER_APPROVED: 'Purchase order approved',
  SALES_INVOICE_ISSUED: 'Sales invoice issued', EXPENSE_APPROVED: 'Expense approved', REPORT_GENERATED: 'Report generated',
};

export const notificationsAPI = {
  async inbox(filters: { unreadOnly?: boolean; archivedOnly?: boolean; search?: string; page?: number; limit?: number } = {}) {
    return unwrap<InboxPage>(await apiClient.get('/notifications/inbox/in-app', { params: filters }));
  },
  async markRead(id: string) {
    return unwrap<{ id: string; isRead: boolean }>(await apiClient.patch(`/notifications/inbox/in-app/${encodeURIComponent(id)}/read`));
  },
  async markAllRead() {
    return unwrap<{ updated: number }>(await apiClient.patch('/notifications/inbox/in-app/read-all'));
  },
  async archive(id: string) {
    return unwrap<{ id: string; isArchived: boolean }>(await apiClient.patch(`/notifications/inbox/in-app/${encodeURIComponent(id)}/archive`));
  },
  async restore(id: string) {
    return unwrap<{ id: string; isArchived: boolean }>(await apiClient.patch(`/notifications/inbox/in-app/${encodeURIComponent(id)}/restore`));
  },
  async removeFromInbox(id: string) {
    return apiClient.delete(`/notifications/inbox/in-app/${encodeURIComponent(id)}`);
  },
  async preferences() {
    return unwrap<InAppPreference[]>(await apiClient.get('/notifications/preferences/in-app'));
  },
  async updatePreference(eventType: NotificationEventType, inAppEnabled: boolean) {
    return unwrap<InAppPreference>(await apiClient.patch('/notifications/preferences/in-app', { eventType, inAppEnabled }));
  },
  async deliveryLog(filters: { status?: string; type?: NotificationType; eventType?: NotificationEventType; page?: number; limit?: number } = {}) {
    return unwrap<NotificationLogPage>(await apiClient.get('/notifications', { params: filters }));
  },
  async deliveryDetail(id: string) {
    return unwrap<NotificationLogDetail>(await apiClient.get(`/notifications/${encodeURIComponent(id)}`));
  },
  async emailConfig() { return unwrap<EmailProviderConfig>(await apiClient.get('/notifications/config/email')); },
  async saveEmailConfig(input: { provider: 'SMTP' | 'SENDGRID'; fromEmail: string; fromName: string; smtpHost?: string; smtpPort?: number; smtpUsername?: string; smtpPassword?: string; secure?: boolean; apiKey?: string }) {
    return unwrap<{ message: string }>(await apiClient.post('/notifications/config/email', input));
  },
  async smsConfig() { return unwrap<SmsProviderConfig>(await apiClient.get('/notifications/config/sms')); },
  async saveSmsConfig(input: { provider: SmsProvider; fromNumber: string; accountSid?: string; apiKey?: string; username?: string; apiSecret?: string }) {
    return unwrap<{ message: string }>(await apiClient.post('/notifications/config/sms', input));
  },
  async testSms(to: string) { return unwrap<{ message: string; providerId?: string }>(await apiClient.post('/notifications/config/sms/test', { to })); },
};
