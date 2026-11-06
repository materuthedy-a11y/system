import { apiClient, unwrap } from '@/lib/api';

export type PaymentDirection = 'INFLOW' | 'OUTFLOW';
export type PaymentSourceType = 'SALES_INVOICE' | 'PURCHASE_ORDER' | 'EXPENSE' | 'OTHER';

export interface FinancePayment {
  id: string;
  paymentNumber: string;
  paymentDate: string;
  amount: number;
  currency?: string;
  direction?: PaymentDirection | null;
  referenceType?: string | null;
  referenceId?: string | null;
  invoiceId?: string | null;
  poId?: string | null;
  expenseId?: string | null;
  customerId?: string | null;
  supplierId?: string | null;
  paymentMethodId: string;
  paymentMethodName: string;
  reference?: string | null;
  referenceNumber?: string | null;
  transactionId?: string | null;
  bankName?: string | null;
  accountNumber?: string | null;
  chequeNumber?: string | null;
  bankStatementReference?: string | null;
  notes?: string | null;
  status: string;
  isReconciled: boolean;
  reconciledAt?: string | null;
  voidReason?: string | null;
  locationName?: string | null;
  sourceType: PaymentSourceType;
  sourceReference?: string | null;
  counterpartyName?: string | null;
  invoice?: { id: string; invoiceNumber: string; location?: { id: string; name: string } } | null;
  po?: { id: string; poNumber: string; location?: { id: string; name: string } } | null;
  expense?: { id: string; expenseNumber: string; location?: { id: string; name: string } } | null;
  createdBy?: string | null;
  processedBy?: string | null;
}

export interface PaymentFilters {
  search?: string;
  status?: string;
  referenceType?: string;
  sourceType?: PaymentSourceType;
  direction?: PaymentDirection;
  fromDate?: string;
  toDate?: string;
  paymentMethodId?: string;
  locationId?: string;
  purchaseOrderId?: string;
  invoiceId?: string;
  expenseId?: string;
  page?: number;
  limit?: number;
}

export interface PaymentPage {
  data: FinancePayment[];
  total: number;
  page: number;
  limit: number;
}

export interface AccountingPeriod {
  id: string;
  periodName: string;
  startDate: string;
  endDate: string;
  status: 'OPEN' | 'LOCKED' | 'CLOSED';
  createdAt: string;
  lockedAt?: string | null;
  closedAt?: string | null;
  closingNotes?: string | null;
}

export const financeAPI = {
  async options() {
    return unwrap<{ currency: string; paymentMethods: Array<{ id: string; name: string; isActive: boolean; isDefault: boolean; requiresReference: boolean }> }>(
      await apiClient.get('/payments/finance-options'),
    );
  },
  async paymentMethods() {
    return unwrap<Array<{ id: string; name: string; isActive: boolean; isDefault?: boolean; requiresReference?: boolean }>>(
      await apiClient.get('/payments/methods'),
    );
  },
  async payments(filters: PaymentFilters = {}) {
    return unwrap<PaymentPage>(await apiClient.get('/payments', { params: filters }));
  },
  async payment(id: string) {
    return unwrap<FinancePayment>(await apiClient.get(`/payments/${encodeURIComponent(id)}`));
  },
  async reconcilePayment(id: string, bankStatementReference: string, notes?: string) {
    return unwrap<FinancePayment>(await apiClient.post(`/payments/${encodeURIComponent(id)}/reconcile`, { bankStatementReference, notes }));
  },
  async voidPayment(id: string, reason: string) {
    return unwrap<FinancePayment>(await apiClient.post(`/payments/${encodeURIComponent(id)}/void`, { reason }));
  },
  async periods() {
    return unwrap<AccountingPeriod[]>(await apiClient.get('/payments/periods'));
  },
  async createPeriod(input: { periodName: string; startDate: string; endDate: string }) {
    return unwrap<AccountingPeriod>(await apiClient.post('/payments/periods/create', input));
  },
  async lockPeriod(id: string) {
    return unwrap<AccountingPeriod>(await apiClient.post(`/payments/periods/${encodeURIComponent(id)}/lock`));
  },
  async closePeriod(id: string, closingNotes?: string) {
    return unwrap<AccountingPeriod>(await apiClient.post(`/payments/periods/${encodeURIComponent(id)}/close`, { closingNotes }));
  },
};
