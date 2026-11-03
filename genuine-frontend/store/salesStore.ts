import { create } from 'zustand';
import { getApiError } from '@/lib/api';
import {
  salesAPI,
  type CreateSalesInvoiceInput,
  type CreateSalesReturnInput,
  type Customer,
  type SalesInvoice,
  type SalesInvoiceFilters,
  type SalesReturn,
  type SalesReturnFilters,
} from '@/lib/api/sales';

interface SalesState {
  invoices: SalesInvoice[];
  returns: SalesReturn[];
  customers: Customer[];
  selectedInvoice: SalesInvoice | null;
  selectedReturn: SalesReturn | null;
  total: number;
  page: number;
  limit: number;
  isLoading: boolean;
  error: string | null;
  fetchInvoices: (filters?: SalesInvoiceFilters) => Promise<void>;
  fetchInvoice: (id: string) => Promise<SalesInvoice>;
  createInvoice: (input: CreateSalesInvoiceInput) => Promise<SalesInvoice>;
  updateInvoice: (id: string, input: Partial<CreateSalesInvoiceInput>) => Promise<SalesInvoice>;
  issueInvoice: (id: string) => Promise<SalesInvoice>;
  cancelInvoice: (id: string, reason: string) => Promise<SalesInvoice>;
  recordPayment: (
    id: string,
    input: {
      amount: number;
      paymentMethodId: string;
      paymentDate?: string;
      reference?: string;
      notes?: string;
    },
    idempotencyKey: string
  ) => Promise<SalesInvoice>;
  fetchReturns: (filters?: SalesReturnFilters) => Promise<void>;
  fetchReturn: (id: string) => Promise<SalesReturn>;
  createReturn: (input: CreateSalesReturnInput) => Promise<SalesReturn>;
  authorizeReturn: (id: string) => Promise<SalesReturn>;
  receiveReturn: (id: string) => Promise<SalesReturn>;
  rejectReturn: (id: string, reason: string) => Promise<SalesReturn>;
  fetchCustomers: () => Promise<void>;
  clearError: () => void;
}

function message(error: unknown, fallback: string) {
  return getApiError(error, fallback);
}

// Rapid filter changes/navigation can leave requests in flight. Only the newest
// read for each view is allowed to replace that view's current data.
let invoiceListRequest = 0;
let invoiceDetailRequest = 0;
let returnListRequest = 0;

export const useSalesStore = create<SalesState>((set, get) => {
  let activeOperations = 0;
  const startOperation = (patch: Partial<SalesState> = {}) => {
    activeOperations += 1;
    set({ isLoading: true, error: null, ...patch });
  };
  const finishOperation = () => {
    activeOperations = Math.max(0, activeOperations - 1);
    set({ isLoading: activeOperations > 0 });
  };

  return {
    invoices: [],
    returns: [],
    customers: [],
    selectedInvoice: null,
    selectedReturn: null,
    total: 0,
    page: 1,
    limit: 20,
    isLoading: false,
    error: null,
    fetchInvoices: async (filters = {}) => {
      const requestId = ++invoiceListRequest;
      startOperation();
      try {
        const result = await salesAPI.invoices(filters);
        if (requestId !== invoiceListRequest) return;
        set({ invoices: result.data, total: result.total, page: result.page, limit: result.limit });
      } catch (error) {
        if (requestId === invoiceListRequest) {
          set({ invoices: [], total: 0, error: message(error, 'Could not load invoices.') });
        }
        throw error;
      } finally {
        finishOperation();
      }
    },
    fetchInvoice: async (id) => {
      const requestId = ++invoiceDetailRequest;
      startOperation({ selectedInvoice: null });
      try {
        const invoice = await salesAPI.invoice(id);
        if (requestId !== invoiceDetailRequest) return invoice;
        set((state) => ({
          selectedInvoice: invoice,
          invoices: state.invoices.map((row) => (row.id === id ? invoice : row)),
        }));
        return invoice;
      } catch (error) {
        if (requestId === invoiceDetailRequest)
          set({ error: message(error, 'Could not load this invoice.') });
        throw error;
      } finally {
        finishOperation();
      }
    },
    createInvoice: async (input) => {
      startOperation();
      try {
        return await salesAPI.createInvoice(input);
      } catch (error) {
        set({ error: message(error, 'Could not create the invoice.') });
        throw error;
      } finally {
        finishOperation();
      }
    },
    updateInvoice: async (id, input) => {
      startOperation();
      try {
        const invoice = await salesAPI.updateInvoice(id, input);
        set((state) => ({
          selectedInvoice: invoice,
          invoices: state.invoices.map((row) => (row.id === id ? invoice : row)),
        }));
        return invoice;
      } catch (error) {
        set({ error: message(error, 'Could not update the invoice.') });
        throw error;
      } finally {
        finishOperation();
      }
    },
    issueInvoice: async (id) => {
      startOperation();
      try {
        const invoice = await salesAPI.issueInvoice(id);
        set((state) => ({
          selectedInvoice: invoice,
          invoices: state.invoices.map((row) => (row.id === id ? invoice : row)),
        }));
        return invoice;
      } catch (error) {
        set({ error: message(error, 'Could not issue the invoice.') });
        throw error;
      } finally {
        finishOperation();
      }
    },
    cancelInvoice: async (id, reason) => {
      startOperation();
      try {
        const invoice = await salesAPI.cancelInvoice(id, reason);
        set((state) => ({
          selectedInvoice: invoice,
          invoices: state.invoices.map((row) => (row.id === id ? invoice : row)),
        }));
        return invoice;
      } catch (error) {
        set({ error: message(error, 'Could not cancel the invoice.') });
        throw error;
      } finally {
        finishOperation();
      }
    },
    recordPayment: async (id, input, idempotencyKey) => {
      startOperation();
      try {
        await salesAPI.recordPayment(id, input, idempotencyKey);
        return await get().fetchInvoice(id);
      } catch (error) {
        set({ error: message(error, 'Could not record the payment.') });
        throw error;
      } finally {
        finishOperation();
      }
    },
    fetchReturns: async (filters = {}) => {
      const requestId = ++returnListRequest;
      startOperation();
      try {
        const result = await salesAPI.returns(filters);
        if (requestId !== returnListRequest) return;
        set({ returns: result.data, total: result.total, page: result.page, limit: result.limit });
      } catch (error) {
        if (requestId === returnListRequest) {
          set({ returns: [], total: 0, error: message(error, 'Could not load sales returns.') });
        }
        throw error;
      } finally {
        finishOperation();
      }
    },
    fetchReturn: async (id) => {
      startOperation();
      try {
        const item = await salesAPI.salesReturn(id);
        set({ selectedReturn: item });
        return item;
      } catch (error) {
        set({ error: message(error, 'Could not load this return.') });
        throw error;
      } finally {
        finishOperation();
      }
    },
    createReturn: async (input) => {
      startOperation();
      try {
        return await salesAPI.createReturn(input);
      } catch (error) {
        set({ error: message(error, 'Could not create the return.') });
        throw error;
      } finally {
        finishOperation();
      }
    },
    authorizeReturn: async (id) => {
      startOperation();
      try {
        const item = await salesAPI.authorizeReturn(id);
        set((state) => ({
          selectedReturn: item,
          returns: state.returns.map((row) => (row.id === id ? item : row)),
        }));
        return item;
      } catch (error) {
        set({ error: message(error, 'Could not authorize the return.') });
        throw error;
      } finally {
        finishOperation();
      }
    },
    receiveReturn: async (id) => {
      startOperation();
      try {
        const item = await salesAPI.receiveReturn(id);
        set((state) => ({
          selectedReturn: item,
          returns: state.returns.map((row) => (row.id === id ? item : row)),
        }));
        try {
          const invoice = await salesAPI.invoice(item.salesInvoiceId);
          set((state) => ({
            selectedInvoice:
              state.selectedInvoice?.id === invoice.id ? invoice : state.selectedInvoice,
            invoices: state.invoices.map((row) => (row.id === invoice.id ? invoice : row)),
          }));
        } catch {
          set({
            error:
              'Return was received, but the related invoice could not be refreshed. Reopen the invoice to load its current balance.',
          });
        }
        return item;
      } catch (error) {
        set({ error: message(error, 'Could not receive the return.') });
        throw error;
      } finally {
        finishOperation();
      }
    },
    rejectReturn: async (id, reason) => {
      startOperation();
      try {
        const item = await salesAPI.rejectReturn(id, reason);
        set((state) => ({
          selectedReturn: item,
          returns: state.returns.map((row) => (row.id === id ? item : row)),
        }));
        return item;
      } catch (error) {
        set({ error: message(error, 'Could not reject the return.') });
        throw error;
      } finally {
        finishOperation();
      }
    },
    fetchCustomers: async () => {
      set({ error: null });
      try {
        set({ customers: await salesAPI.customers() });
      } catch (error) {
        set({ error: message(error, 'Could not load customers.') });
        throw error;
      }
    },
    clearError: () => set({ error: null }),
  };
});
