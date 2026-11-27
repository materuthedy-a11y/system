import { apiClient, unwrap } from '@/lib/api';

export type InsightSeverity = 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type InsightStatus = 'ACTIVE' | 'ACKNOWLEDGED' | 'DISMISSED' | 'RESOLVED' | 'EXPIRED';
export type InsightCategory =
  | 'SALES'
  | 'PROFITABILITY'
  | 'INVENTORY'
  | 'CUSTOMERS'
  | 'SUPPLIERS'
  | 'FINANCE'
  | 'OPERATIONS';

export interface Insight {
  id: string;
  type: string;
  category: InsightCategory;
  severity: InsightSeverity;
  status: InsightStatus;
  title: string;
  summary: string;
  detail?: string | null;
  evidence?: Record<string, unknown> | null;
  impact?: Record<string, unknown> | null;
  recommendation?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  productId?: string | null;
  customerId?: string | null;
  supplierId?: string | null;
  locationId?: string | null;
  periodStart?: string | null;
  periodEnd?: string | null;
  detectedAt: string;
  lastSeenAt: string;
  acknowledgedBy?: string | null;
  acknowledgedAt?: string | null;
  dismissedBy?: string | null;
  dismissedAt?: string | null;
  resolvedBy?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InsightListResponse {
  data: Insight[];
  total: number;
  page: number;
  limit: number;
  summary: Array<{ severity: string; status: string; _count: { _all: number } }>;
}

export interface InsightSummary {
  bySeverity: Array<{ severity: string; _count: { _all: number } }>;
  byCategory: Array<{ category: string; _count: { _all: number } }>;
  byStatus: Array<{ status: string; _count: { _all: number } }>;
  topInsights: Array<{
    id: string;
    type: string;
    severity: InsightSeverity;
    title: string;
    summary: string;
    category: InsightCategory;
    lastSeenAt: string;
  }>;
}

export interface ReorderSuggestion {
  productId: string;
  productName: string;
  sku: string;
  locationId: string;
  locationName: string;
  available: number;
  incoming: number;
  dailyVelocity: number;
  daysOfStock: number | null;
  leadTimeDays: number;
  safetyStock: number;
  suggestedQuantity: number;
  supplierId: string | null;
  supplierName: string | null;
  estimatedUnitCost: number | null;
  estimatedOrderCost: number | null;
  reason: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface ReorderSuggestionsResponse {
  data: ReorderSuggestion[];
  generatedAt: string;
}

export interface InsightFilters {
  severity?: string;
  category?: string;
  status?: string;
  type?: string;
  locationId?: string;
  q?: string;
  page?: number;
  limit?: number;
}

const qs = (params: Record<string, string | number | undefined>) => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value));
  }
  const s = search.toString();
  return s ? `?${s}` : '';
};

export const intelligenceAPI = {
  summary: () => apiClient.get('/insights/summary').then((r) => unwrap<InsightSummary>(r)),
  list: (filters: InsightFilters = {}) =>
    apiClient
      .get(`/insights${qs({ ...filters })}`)
      .then((r) => unwrap<InsightListResponse>(r)),
  get: (id: string) => apiClient.get(`/insights/${id}`).then((r) => unwrap<Insight>(r)),
  run: () => apiClient.post('/insights/run', {}).then((r) => unwrap<{ created: number; updated: number; expired: number }>(r)),
  acknowledge: (id: string, note?: string) =>
    apiClient.post(`/insights/${id}/acknowledge`, { note }).then((r) => unwrap<Insight>(r)),
  dismiss: (id: string, note?: string) =>
    apiClient.post(`/insights/${id}/dismiss`, { note }).then((r) => unwrap<Insight>(r)),
  resolve: (id: string, note?: string) =>
    apiClient.post(`/insights/${id}/resolve`, { note }).then((r) => unwrap<Insight>(r)),
  reorderSuggestions: (locationId?: string) =>
    apiClient
      .get(`/insights/reorder-suggestions${qs({ locationId })}`)
      .then((r) => unwrap<ReorderSuggestionsResponse>(r)),
  createDraftPOs: (items: Array<{ productId: string; locationId: string; quantity: number }>, notes?: string) =>
    apiClient
      .post('/insights/reorder-suggestions/create-po', { items, notes })
      .then((r) => unwrap<{ created: Array<{ poId: string; poNumber: string; supplierId: string; locationId: string; itemCount: number }>; count: number }>(r)),
};

// ---------- Phase 4: Predictions ----------
export interface DemandForecast {
  productId: string; productName: string; sku: string; locationId: string | null; horizonDays: number;
  forecast: {
    method: string; totalForecast: number; confidence: string;
    dailyForecast: number[];
    dataSufficiency: { daysWithData: number; totalDays: number; coveragePct: number; intermittent: boolean };
    factors: string[];
    backtest?: { mae: number; baselineMae: number; improvementPct: number };
  };
}
export interface StockoutRow {
  productId: string; productName: string; sku: string; locationId: string; locationName: string;
  risk: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'; daysRemaining: number | null; stockoutDate: string | null;
  available: number; incoming: number; dailyDemand: number; suggestedQuantity: number;
  horizonStockout: boolean; explanation: string[];
}
export interface OverstockRow {
  productId: string; productName: string; sku: string; locationId: string; locationName: string;
  available: number; excessUnits: number; excessValue: number | null; coverageDays: number | null;
  risk: 'HIGH' | 'MEDIUM' | 'LOW'; explanation: string[];
}
export interface ChurnRow {
  customerId: string; name: string; customerCode: string; invoiceCount: number;
  totalRevenue: number; daysSinceLastPurchase: number | null;
  risk: 'HIGH' | 'MEDIUM' | 'LOW' | 'INSUFFICIENT'; factors: string[]; recommendedAction: string;
}
export interface CashflowForecast {
  horizonDays: number;
  actuals: { inflowLast30Days: number; outflowLast30Days: number; netLast30Days: number };
  expected: { overdueReceivables: { amount: number; count: number }; dueWithinHorizon: { amount: number; count: number } };
  assumptions: string[];
}

export const predictionsAPI = {
  demand: (productId: string, locationId?: string, horizon = 30) =>
    apiClient.get(`/insights/predictions/demand/${productId}${qs({ locationId, horizon })}`).then((r) => unwrap<DemandForecast>(r)),
  stockout: () => apiClient.get('/insights/predictions/stockout').then((r) => unwrap<{ data: StockoutRow[] }>(r)),
  overstock: () => apiClient.get('/insights/predictions/overstock').then((r) => unwrap<{ data: OverstockRow[] }>(r)),
  churn: () => apiClient.get('/insights/predictions/churn').then((r) => unwrap<{ data: ChurnRow[]; methodology?: string }>(r)),
  cashflow: (days = 30) => apiClient.get(`/insights/predictions/cashflow${qs({ days })}`).then((r) => unwrap<CashflowForecast>(r)),
};
