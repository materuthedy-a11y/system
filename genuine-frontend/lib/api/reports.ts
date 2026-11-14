import { apiClient, unwrap } from '@/lib/api';

export type ReportGroup = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
export type ReportRange = { dateFrom: string; dateTo: string; groupBy?: ReportGroup };
export type ReportType =
  | 'DASHBOARD'
  | 'SALES_DASHBOARD'
  | 'INVENTORY_DASHBOARD'
  | 'INCOME_STATEMENT'
  | 'CASH_FLOW'
  | 'RECEIVABLES_AGEING'
  | 'PAYABLES_AGEING'
  | 'KPI'
  | 'PRODUCT_PERFORMANCE'
  | 'CUSTOMER_ANALYTICS'
  | 'SUPPLIER_ANALYTICS'
  | 'SALES_BY_CHANNEL'
  | 'EXPENSE_BREAKDOWN'
  | 'TREND_ANALYSIS'
  | 'FORECAST'
  | 'TRIAL_BALANCE'
  | 'FINANCIAL_SUMMARY';
export type ReportFormat = 'CSV' | 'EXCEL' | 'PDF' | 'JSON';
export interface ReportSettingsContext {
  currency: string;
  timezone: string;
  financialYear: string;
  dateFormat: string;
  weekStartsOn: 'MONDAY' | 'SUNDAY';
}

export interface ReportPage<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  currency?: string;
}

export interface ReportMetric {
  name: string;
  label: string;
  value: number;
  unit: string;
  previousValue: number;
  changePercent: number | null;
  trend: 'UP' | 'DOWN' | 'FLAT';
  status: 'GOOD' | 'WARNING' | 'CRITICAL';
  formula?: string;
}

export interface ExecutiveReport {
  period: string;
  asOf: string;
  inventoryAsOf: string;
  currency: string;
  summary: Record<string, ReportMetric>;
  kpis: ReportMetric[];
  charts: {
    periods: string[];
    revenueVsExpenses: Array<{ label: string; data: number[] }>;
    topProducts: { labels: string[]; revenue: number[]; quantity: number[] };
    salesTrend: { labels: string[]; values: number[] };
    cashFlow: { labels: string[]; inflows: number[]; outflows: number[]; netFlow: number[] };
    customerMetrics: { labels: string[]; revenue: number[]; transactions: number[] };
  };
  definitions: Record<string, string>;
}

export interface SalesReport {
  period: string;
  currency: string;
  metrics: {
    invoiceCount: number;
    revenue: number;
    quantitySold: number;
    averageOrderValue: number;
    paidAmount: number;
    outstandingAmount: number;
    unpaidInvoiceCount: number;
  };
  topCustomers: Array<{ customerId: string; customerName: string; revenue: number; invoiceCount: number }>;
}

export interface ProductReportRow {
  productId: string;
  productName: string;
  productSku: string;
  categoryName: string;
  quantity: number;
  revenue: number;
  cogs: number;
  profit: number;
  marginPercent: number;
  inventoryTurnover: number | null;
  estimatedDaysOfInventory: number | null;
  currentStock: number;
  unit: string;
}

export interface CustomerReportRow {
  customerId: string;
  customerName: string;
  customerCode: string;
  customerType: string;
  totalRevenue: number;
  transactionCount: number;
  averageOrderValue: number;
  lastTransactionDate: string | null;
  daysInactive: number | null;
  loyaltyScore: number;
  segment: string;
}

export interface SupplierReportRow {
  supplierId: string;
  supplierName: string;
  supplierCode: string;
  purchaseOrderCount: number;
  acceptedPurchaseValue: number;
  acceptedQuantity: number;
  rejectedQuantity: number;
  damagedQuantity: number;
  onTimeDeliveryPercent: number | null;
  qualityScore: number | null;
  averageLeadTimeDays: number | null;
  riskLevel: string;
  dataCoverage: string;
}

export interface InventoryReport {
  period: string;
  asOf: string;
  currency?: string;
  costingMethod: string;
  metrics: {
    activeProducts: number;
    stockKeepingUnitsWithStock: number;
    totalQuantity: number;
    inventoryValue: number;
    lowStockCount: number;
    locationCount: number;
  };
  lowStockItems: Array<Record<string, unknown>>;
  topMovingProducts: Array<{ productId: string; name: string; sku: string; quantity: number }>;
}

export interface FinancialReport {
  period: string;
  revenue?: number;
  costOfGoodsSold?: number;
  grossProfit?: number;
  grossMarginPercentage?: number;
  operatingExpenses?: number;
  operatingIncome?: number;
  operatingMarginPercentage?: number;
  netIncome?: number;
  netMarginPercentage?: number;
  openingBalance?: number;
  totalInflows?: number;
  totalOutflows?: number;
  closingBalance?: number;
  details?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

export interface FinancialSummaryReport {
  period: string;
  asOf: string;
  currency: string;
  totalSalesAmount: number;
  totalSalesTaxAmount: number;
  totalPurchasesAmount: number;
  totalExpensesAmount: number;
  totalPayments: number;
  totalReceivables: number;
  totalPayables: number;
  totalInventoryValue: number;
  inventoryValueAsOf: string;
  inventoryValuationMethod: string;
  costOfGoodsSold: number;
  netIncome: number;
  cashOnHand: number;
  netCashFlow: number;
  unpaidExpenses: number;
}

export interface OperationalTrialBalance {
  period: string;
  asOf: string;
  items: Array<{ accountName: string; accountType: string; debit: number; credit: number }>;
  totalDebits: number;
  totalCredits: number;
  isBalanced: boolean;
  reportBasis: string;
}

async function get<T>(path: string, params?: Record<string, string | number | undefined>) {
  return unwrap<T>(await apiClient.get(path, { params }));
}

export const reportsAPI = {
  settings: () => get<ReportSettingsContext>('/analytics/report-settings'),
  executive: (range: ReportRange) => get<ExecutiveReport>('/analytics/dashboard/executive', range),
  sales: (range: ReportRange) => get<SalesReport>('/analytics/dashboard/sales', range),
  products: (range: ReportRange, page = 1, limit = 20, sortBy = 'REVENUE') => get<ReportPage<ProductReportRow>>('/analytics/products', { dateFrom: range.dateFrom, dateTo: range.dateTo, page, limit, sortBy }),
  customers: (range: ReportRange, page = 1, limit = 20, segmentBy = 'REVENUE') => get<ReportPage<CustomerReportRow>>('/analytics/customers', { dateFrom: range.dateFrom, dateTo: range.dateTo, page, limit, segmentBy }),
  suppliers: (range: ReportRange, page = 1, limit = 20) => get<ReportPage<SupplierReportRow>>('/analytics/suppliers', { dateFrom: range.dateFrom, dateTo: range.dateTo, page, limit }),
  inventory: (range: ReportRange) => get<InventoryReport>('/analytics/dashboard/inventory', range),
  expenseBreakdown: (range: ReportRange) => get<Array<Record<string, unknown>>>('/analytics/expense-breakdown', range),
  trends: (range: ReportRange, metric: string, periods = 12) => get<Record<string, unknown>>('/analytics/trends', { ...range, metric, periods }),
  forecast: (metric: string, periods = 3, method = 'MOVING_AVERAGE') => get<Record<string, unknown>>('/analytics/forecast', { metric, periods, method }),
  channels: (range: ReportRange, channelBy: string) => get<Array<Record<string, unknown>>>('/analytics/sales-by-channel', { ...range, channelBy }),
  compare: (dateFrom1: string, dateTo1: string, dateFrom2: string, dateTo2: string) =>
    get<{ period1: string; period2: string; data: Array<Record<string, unknown>> }>('/analytics/compare-periods', { dateFrom1, dateTo1, dateFrom2, dateTo2 }),
  incomeStatement: (range: ReportRange) => get<FinancialReport>('/payments/reports/income-statement', range),
  cashFlow: (range: ReportRange) => get<FinancialReport>('/payments/reports/cash-flow', range),
  receivablesAgeing: (dateAs: string) => get<Record<string, unknown>>('/payments/reports/receivables-ageing', { dateAs }),
  payablesAgeing: (dateAs: string) => get<Record<string, unknown>>('/payments/reports/payables-ageing', { dateAs }),
  financialSummary: (dateAs: string) => get<FinancialSummaryReport>('/payments/reports/financial-summary', { dateAs }),
  trialBalance: (dateAs: string) => get<OperationalTrialBalance>('/payments/reports/trial-balance', { dateAs }),
  async export(reportType: ReportType, format: ReportFormat, range: ReportRange, options?: { channelBy?: string; sortBy?: string; segmentBy?: string; metric?: string; method?: string; periods?: number }) {
    const response = await apiClient.get('/analytics/export', {
      params: { reportType, format, ...range, ...options },
      responseType: 'blob',
    });
    const disposition = response.headers['content-disposition'] as string | undefined;
    const encoded = disposition?.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
    const plain = disposition?.match(/filename="?([^";]+)"?/i)?.[1];
    const fileName = (encoded ? decodeURIComponent(encoded) : plain) || `mizania-${reportType.toLowerCase()}.${format.toLowerCase()}`;
    return { blob: response.data as Blob, fileName };
  },
};
