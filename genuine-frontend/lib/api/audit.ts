import { apiClient, unwrap } from '@/lib/api';

export interface AuditEvent {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  description?: string | null;
  actor: { id: string; name: string; email: string } | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  beforeData: unknown;
  afterData: unknown;
  createdAt: string;
}
export interface AuditFilters { page?: number; limit?: number; q?: string; action?: string; entityType?: string; dateFrom?: string; dateTo?: string; }
export interface AuditPage { data: AuditEvent[]; page: number; limit: number; total: number; totalPages: number; }

export const auditAPI = {
  async list(filters: AuditFilters = {}) { return unwrap<AuditPage>(await apiClient.get('/audit-logs', { params: filters })); },
  async detail(id: string) { return unwrap<AuditEvent>(await apiClient.get(`/audit-logs/${encodeURIComponent(id)}`)); },
  async export(filters: Omit<AuditFilters, 'page' | 'limit'> = {}) { return apiClient.get('/audit-logs/export', { params: filters, responseType: 'blob' }); },
};
