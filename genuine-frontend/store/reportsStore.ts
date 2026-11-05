import { create } from 'zustand';
import { getApiError } from '@/lib/api';
import {
  reportsAPI,
  type ExecutiveReport,
  type FinancialReport,
  type InventoryReport,
  type ReportPage,
  type ReportRange,
  type SalesReport,
  type ProductReportRow,
  type CustomerReportRow,
  type SupplierReportRow,
  type FinancialSummaryReport,
  type OperationalTrialBalance,
} from '@/lib/api/reports';

export type ReportTab = 'overview' | 'sales' | 'products' | 'customers' | 'suppliers' | 'finance' | 'inventory' | 'trends';
export type ReportsData =
  | { kind: 'overview'; executive: ExecutiveReport }
  | { kind: 'sales'; sales: SalesReport; channels: Array<Record<string, unknown>>; channelBy: string; trends: Record<string, unknown> }
  | { kind: 'products'; products: ReportPage<ProductReportRow> }
  | { kind: 'customers'; customers: ReportPage<CustomerReportRow> }
  | { kind: 'suppliers'; suppliers: ReportPage<SupplierReportRow> }
  | { kind: 'finance'; statement: FinancialReport; cashFlow: FinancialReport; financialSummary: FinancialSummaryReport; trialBalance: OperationalTrialBalance; receivables: Record<string, unknown>; payables: Record<string, unknown>; expenses: Array<Record<string, unknown>>; comparison: { period1: string; period2: string; data: Array<Record<string, unknown>> } }
  | { kind: 'inventory'; inventory: InventoryReport }
  | { kind: 'trends'; trends: Record<string, unknown>; forecast: Record<string, unknown>; forecastMetric: string; forecastMethod: string };

interface ReportsState {
  data: ReportsData | null;
  tab: ReportTab;
  loading: boolean;
  error: string;
  channelBy: string;
  forecastMetric: string;
  forecastMethod: string;
  page: number;
  pageSize: number;
  productSortBy: string;
  customerSegmentBy: string;
  setPage: (page: number) => void;
  setProductSortBy: (sortBy: string) => void;
  setCustomerSegmentBy: (segmentBy: string) => void;
  setChannelBy: (channelBy: string) => void;
  setForecastMetric: (forecastMetric: string) => void;
  setForecastMethod: (forecastMethod: string) => void;
  load: (tab: ReportTab, range: ReportRange) => Promise<void>;
  clear: () => void;
}

function previousRange(range: ReportRange) {
  const start = new Date(`${range.dateFrom}T00:00:00`);
  const end = new Date(`${range.dateTo}T00:00:00`);
  const length = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
  const previousEnd = new Date(start);
  previousEnd.setDate(previousEnd.getDate() - 1);
  const previousStart = new Date(previousEnd);
  previousStart.setDate(previousStart.getDate() - length + 1);
  const toDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return { dateFrom1: toDate(previousStart), dateTo1: toDate(previousEnd), dateFrom2: range.dateFrom, dateTo2: range.dateTo };
}

let latestRequestId = 0;

export const useReportsStore = create<ReportsState>((set) => ({
  data: null,
  tab: 'overview',
  loading: false,
  error: '',
  channelBy: 'LOCATION',
  forecastMetric: 'REVENUE',
  forecastMethod: 'MOVING_AVERAGE',
  page: 1,
  pageSize: 20,
  productSortBy: 'REVENUE',
  customerSegmentBy: 'REVENUE',
  setPage: (page) => set({ page: Math.max(1, page) }),
  setProductSortBy: (productSortBy) => set({ productSortBy, page: 1 }),
  setCustomerSegmentBy: (customerSegmentBy) => set({ customerSegmentBy, page: 1 }),
  setChannelBy: (channelBy) => set({ channelBy }),
  setForecastMetric: (forecastMetric) => set({ forecastMetric }),
  setForecastMethod: (forecastMethod) => set({ forecastMethod }),
  load: async (tab, range) => {
    const requestId = ++latestRequestId;
    set({ tab, loading: true, error: '' });
    const { channelBy, forecastMetric, forecastMethod, page, pageSize, productSortBy, customerSegmentBy } = useReportsStore.getState();
    const current = () => latestRequestId === requestId;
    try {
      let data: ReportsData;
      switch (tab) {
        case 'overview': data = { kind: 'overview', executive: await reportsAPI.executive(range) }; break;
        case 'sales': {
          const [sales, channels, trends] = await Promise.all([
            reportsAPI.sales(range), reportsAPI.channels(range, channelBy), reportsAPI.trends(range, 'REVENUE', 12),
          ]);
          data = { kind: 'sales', sales, channels, channelBy, trends };
          break;
        }
        case 'products': data = { kind: 'products', products: await reportsAPI.products(range, page, pageSize, productSortBy) }; break;
        case 'customers': data = { kind: 'customers', customers: await reportsAPI.customers(range, page, pageSize, customerSegmentBy) }; break;
        case 'suppliers': data = { kind: 'suppliers', suppliers: await reportsAPI.suppliers(range, page, pageSize) }; break;
        case 'finance': {
          const prior = previousRange(range);
          const [statement, cashFlow, financialSummary, trialBalance, receivables, payables, expenses, comparison] = await Promise.all([
            reportsAPI.incomeStatement(range), reportsAPI.cashFlow(range),
            reportsAPI.financialSummary(range.dateTo), reportsAPI.trialBalance(range.dateTo),
            reportsAPI.receivablesAgeing(range.dateTo), reportsAPI.payablesAgeing(range.dateTo),
            reportsAPI.expenseBreakdown(range), reportsAPI.compare(prior.dateFrom1, prior.dateTo1, prior.dateFrom2, prior.dateTo2),
          ]);
          data = { kind: 'finance', statement, cashFlow, financialSummary, trialBalance, receivables, payables, expenses, comparison };
          break;
        }
        case 'inventory': data = { kind: 'inventory', inventory: await reportsAPI.inventory(range) }; break;
        case 'trends': {
          const [trends, forecast] = await Promise.all([
            reportsAPI.trends(range, forecastMetric, 12), reportsAPI.forecast(forecastMetric, 3, forecastMethod),
          ]);
          data = { kind: 'trends', trends, forecast, forecastMetric, forecastMethod };
          break;
        }
      }
      if (current()) set({ data, tab, loading: false, error: '' });
    } catch (error) {
      if (current()) set({ loading: false, error: getApiError(error, 'Could not load this report. Try again.') });
    }
  },
  clear: () => {
    latestRequestId += 1;
    set({ data: null, error: '', loading: false });
  },
}));
