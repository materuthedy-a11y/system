import { apiClient, unwrap } from '@/lib/api';

export type ExpenseStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'PAID' | 'REJECTED';

export interface ExpenseLineItem {
  id?: string;
  expenseCategoryId: string;
  categoryName?: string;
  description?: string | null;
  amount: number;
  notes?: string | null;
}

export interface ExpenseRecord {
  id: string;
  businessId: string;
  expenseNumber: string;
  expenseCategoryId: string;
  categoryName: string;
  status: ExpenseStatus;
  totalAmount: number;
  paidAmount?: number;
  balanceDue?: number;
  isPaid: boolean;
  reference?: string;
  expenseDate: string;
  description?: string;
  items: ExpenseLineItem[];
  attachment?: string;
  notes?: string;
  location?: { id: string; name: string };
  supplier?: { id: string; name: string; code: string };
  paymentMethod?: { id: string; name: string };
  approvedBy?: { id: string; name: string; email: string };
  approvedAt?: string;
  approvalNotes?: string;
  paidBy?: { id: string; name: string };
  paidAt?: string;
  paymentReference?: string;
  rejectedBy?: { id: string; name: string };
  rejectedAt?: string;
  rejectionReason?: string;
  createdBy: { id: string; name: string; email: string } | null;
  budgetCode?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExpenseInput {
  expenseCategoryId?: string;
  locationId?: string;
  supplierId?: string;
  paymentMethodId?: string;
  items: Array<{ expenseCategoryId: string; amount: number; description?: string; notes?: string }>;
  totalAmount?: number;
  expenseDate?: string;
  description?: string;
  reference?: string;
  attachmentUrl?: string;
  notes?: string;
  budgetCode?: string;
}

export interface ExpenseSummary {
  totalExpenses: number;
  totalApproved: number;
  totalPaid: number;
  totalPending: number;
  totalRejected: number;
  averageExpenseAmount: number;
  largestExpense: number;
  smallestExpense: number;
  byCategory: Array<{ category: string; count: number; total: number; percentage: number }>;
}

export interface ExpenseBudgetStatus {
  categoryId: string;
  categoryName: string;
  budgetLimit: number;
  budgetPeriod: string;
  spent: number;
  available: number;
  utilization: number;
  status: 'ON_TRACK' | 'WARNING' | 'EXCEEDED';
}

export interface ExpenseOptions {
  categories: Array<{ id: string; name: string; code: string; budgetLimit?: number | null; budgetPeriod?: string | null }>;
  locations: Array<{ id: string; name: string; code: string }>;
  suppliers: Array<{ id: string; name: string; supplierCode: string }>;
  paymentMethods: Array<{ id: string; name: string; methodType: string; requiresReference: boolean }>;
  currency: string;
}

export interface ExpenseFilters {
  search?: string;
  status?: ExpenseStatus;
  categoryId?: string;
  locationId?: string;
  supplierId?: string;
  fromDate?: string;
  toDate?: string;
  minAmount?: number;
  maxAmount?: number;
  page?: number;
  limit?: number;
}

export interface ExpensePage {
  data: ExpenseRecord[];
  total: number;
  page: number;
  limit: number;
}

export const expensesAPI = {
  async options() {
    return unwrap<ExpenseOptions>(await apiClient.get('/payments/expenses/options'));
  },
  async list(filters: ExpenseFilters = {}) {
    return unwrap<ExpensePage>(await apiClient.get('/payments/expenses', { params: filters }));
  },
  async get(id: string) {
    return unwrap<ExpenseRecord>(await apiClient.get(`/payments/expenses/${encodeURIComponent(id)}`));
  },
  async create(input: ExpenseInput) {
    return unwrap<ExpenseRecord>(await apiClient.post('/payments/expenses', input));
  },
  async update(id: string, input: Partial<ExpenseInput>) {
    return unwrap<ExpenseRecord>(await apiClient.patch(`/payments/expenses/${encodeURIComponent(id)}`, input));
  },
  async delete(id: string) {
    return unwrap<{ message: string }>(await apiClient.delete(`/payments/expenses/${encodeURIComponent(id)}`));
  },
  async submit(id: string) {
    return unwrap<ExpenseRecord>(await apiClient.post(`/payments/expenses/${encodeURIComponent(id)}/submit`));
  },
  async approve(id: string, notes?: string) {
    return unwrap<ExpenseRecord>(await apiClient.post(`/payments/expenses/${encodeURIComponent(id)}/approve`, { notes }));
  },
  async reject(id: string, reason: string) {
    return unwrap<ExpenseRecord>(await apiClient.post(`/payments/expenses/${encodeURIComponent(id)}/reject`, { reason }));
  },
  async pay(id: string, input: { paymentMethodId: string; amount?: number; transactionReference?: string; notes?: string }) {
    return unwrap(await apiClient.post(`/payments/expenses/${encodeURIComponent(id)}/pay`, input));
  },
  async summary(filters: { fromDate?: string; toDate?: string } = {}) {
    return unwrap<ExpenseSummary>(await apiClient.get('/payments/expenses/reports/summary', { params: filters }));
  },
  async budgets(date?: string) {
    return unwrap<ExpenseBudgetStatus[]>(await apiClient.get('/payments/expenses/reports/budget-status', { params: date ? { date } : {} }));
  },
  async trends(months = 6) {
    return unwrap<Array<{ month: string; total: number; byCategory: Array<{ category: string; total: number }> }>>(
      await apiClient.get('/payments/expenses/reports/trends', { params: { months } }),
    );
  },
};
