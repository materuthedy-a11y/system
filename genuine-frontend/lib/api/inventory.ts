import { apiClient, unwrap } from '@/lib/api';

export type InventoryStatus = 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'SENT' | 'PARTIAL' | 'COMPLETED' | 'POSTED';
export type InventoryPage<T> = { data: T[]; total: number; page: number; limit: number };
export type InventoryFilters = { locationId?: string; status?: string; search?: string; page?: number; limit?: number };
export interface InventoryProductOption { id: string; name: string; sku: string; minimumStock: number; reorderLevel: number; buyingPrice: number; currentStock?: number }
export interface InventoryLocationOption { id: string; name: string; code: string; type?: string; isActive: boolean }

export interface InventoryDashboard {
  totalProducts: number; totalLocations: number; totalStockUnits: number; totalStockValue: number;
  lowStockBalances: number; expiredBatchCount: number; expiringWithin30Days: number;
  pendingAdjustments: number; pendingTransfers: number; pendingCounts: number;
  recentMovements: InventoryMovement[];
}
export interface InventoryMovement {
  id: string; productId: string; locationId: string; type: string; quantity: number;
  referenceId?: string | null; referenceType?: string | null; notes?: string | null;
  unitCost?: number | null; batchNumber?: string | null; expiryDate?: string | null; createdAt: string;
  product: { id: string; name: string; sku: string }; location: { id: string; name: string };
}
export interface StockBalance {
  id: string; productId: string; locationId: string; quantity: number; lastMovementAt: string;
  product: { id: string; name: string; sku: string; minimumStock: number; reorderLevel: number; buyingPrice: number };
  location: { id: string; name: string; code: string };
}
export interface InventoryLine {
  id: string; productId: string; quantity?: number; unit?: string; batchNumber?: string | null;
  notes?: string | null; receivedQuantity?: number; unitCost?: number | null;
  currentQty?: number; adjustedQty?: number; difference?: number; reason?: string;
  systemQuantity?: number; countedQuantity?: number; variance?: number;
  product: { id: string; name: string; sku: string };
  location?: { id: string; name: string } | null;
}
export interface StockAdjustment {
  id: string; adjustmentNumber: string; adjustmentDate: string; status: InventoryStatus; reason: string;
  notes?: string | null; createdAt: string; approvedAt?: string | null; rejectedAt?: string | null;
  rejectionReason?: string | null; items: InventoryLine[];
}
export interface StockTransfer {
  id: string; transferNumber: string; transferDate: string; status: InventoryStatus; reason?: string | null;
  notes?: string | null; createdAt: string; sentDate?: string | null; receivedDate?: string | null;
  fromLocationId: string; toLocationId: string;
  fromLocation: { id: string; name: string; code: string }; toLocation: { id: string; name: string; code: string };
  items: InventoryLine[];
}
export interface PhysicalCount {
  id: string; countNumber: string; status: InventoryStatus; createdAt: string; completedDate?: string | null;
  postedDate?: string | null; notes?: string | null; varianceCount: number; totalVarianceAmount: number;
  locationId: string; location: { id: string; name: string; code: string };
  items: InventoryLine[];
}
export interface InventoryReportRow extends Record<string, unknown> {
  productId: string; productName: string; sku: string; locationId: string; locationName: string;
}

function params(filters: Record<string, string | number | undefined>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value !== undefined && value !== '') query.set(key, String(value));
  return query.toString();
}
function get<T>(path: string) { return apiClient.get(path).then((r) => unwrap<T>(r)); }
function post<T>(path: string, body?: unknown) { return apiClient.post(path, body ?? {}).then((r) => unwrap<T>(r)); }
function patch<T>(path: string, body: unknown) { return apiClient.patch(path, body).then((r) => unwrap<T>(r)); }

export const inventoryAPI = {
  dashboard: () => get<InventoryDashboard>('/inventory/dashboard'),
  options: () => get<{ products: InventoryProductOption[]; locations: InventoryLocationOption[] }>('/inventory/options'),
  reorderPoints: (filters: InventoryFilters = {}) => get<InventoryPage<InventoryProductOption>>(`/inventory/reorder-points?${params(filters)}`),
  updateReorderPoint: (productId: string, input: { minimumStock?: number; reorderLevel?: number }) => patch<InventoryProductOption>(`/inventory/reorder-points/${encodeURIComponent(productId)}`, input),
  balances: (filters: InventoryFilters = {}) => get<InventoryPage<StockBalance>>(`/inventory/balances?${params(filters)}`),
  adjustments: (filters: InventoryFilters = {}) => get<InventoryPage<StockAdjustment>>(`/inventory/adjustments?${params(filters)}`),
  adjustment: (id: string) => get<StockAdjustment>(`/inventory/adjustments/${encodeURIComponent(id)}`),
  createAdjustment: (input: { notes?: string; items: Array<{ productId: string; locationId: string; quantity: number; reason: string; batchNumber?: string; notes?: string }> }) => post<StockAdjustment>('/inventory/adjustments', input),
  approveAdjustment: (id: string) => post<StockAdjustment>(`/inventory/adjustments/${encodeURIComponent(id)}/approve`),
  rejectAdjustment: (id: string, reason: string) => post<StockAdjustment>(`/inventory/adjustments/${encodeURIComponent(id)}/reject`, { reason }),
  transfers: (filters: InventoryFilters = {}) => get<InventoryPage<StockTransfer>>(`/inventory/transfers?${params(filters)}`),
  transfer: (id: string) => get<StockTransfer>(`/inventory/transfers/${encodeURIComponent(id)}`),
  createTransfer: (input: { fromLocationId: string; toLocationId: string; reason?: string; notes?: string; items: Array<{ productId: string; quantity: number; unit?: string; batchNumber?: string; notes?: string }> }) => post<StockTransfer>('/inventory/transfers', input),
  sendTransfer: (id: string) => post<StockTransfer>(`/inventory/transfers/${encodeURIComponent(id)}/send`),
  receiveTransfer: (id: string, receivedQuantities: Record<string, number>) => post<StockTransfer>(`/inventory/transfers/${encodeURIComponent(id)}/receive`, { receivedQuantities }),
  counts: (filters: InventoryFilters = {}) => get<InventoryPage<PhysicalCount>>(`/inventory/counts?${params(filters)}`),
  count: (id: string) => get<PhysicalCount>(`/inventory/counts/${encodeURIComponent(id)}`),
  createCount: (input: { locationId: string; notes?: string; items: Array<{ productId: string; countedQuantity: number; batchNumber?: string; notes?: string }> }) => post<PhysicalCount>('/inventory/counts', input),
  completeCount: (id: string) => post<PhysicalCount>(`/inventory/counts/${encodeURIComponent(id)}/complete`),
  postCount: (id: string) => post<PhysicalCount>(`/inventory/counts/${encodeURIComponent(id)}/post`),
  valuation: (filters: InventoryFilters & { productId?: string; valuationMethod?: string } = {}) => get<InventoryPage<InventoryReportRow> & { totalValue: number; costingMethod: string }>(`/inventory/reports/valuation?${params(filters)}`),
  lowStock: (filters: InventoryFilters & { productId?: string; type?: string } = {}) => get<InventoryPage<InventoryReportRow & { quantity: number; minimumStock: number; reorderLevel: number; belowMinimum: boolean; atOrBelowReorderLevel: boolean; daysToStockout: number | null }>>(`/inventory/reports/low-stock?${params(filters)}`),
  expiry: (filters: InventoryFilters & { productId?: string; status?: string; asOfDate?: string } = {}) => get<InventoryPage<InventoryReportRow & { quantity: number; batchNumber: string; expiryDate: string; daysUntilExpiry: number; status: string; unitCost: number }>>(`/inventory/reports/expiry?${params(filters)}`),
  ageing: (filters: InventoryFilters & { productId?: string; asOfDate?: string } = {}) => get<InventoryPage<InventoryReportRow & { quantity: number; ageDays: number; bucket: string; value: number; batchNumber: string | null }>>(`/inventory/reports/ageing?${params(filters)}`),
  movements: (filters: InventoryFilters & { productId?: string; type?: string; dateFrom?: string; dateTo?: string; referenceId?: string; sortBy?: string; sortOrder?: string } = {}) => get<InventoryPage<InventoryMovement>>(`/inventory/reports/movements?${params(filters)}`),
};
