'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BrainCircuit,
  ChevronDown,
  ChevronUp,
  CircleDollarSign,
  Clock,
  Loader2,
  Package,
  PackagePlus,
  RefreshCw,
  Search,
  Sparkles,
  TrendingDown,
  LineChart,
  Users,
  Warehouse,
  X,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { getApiError } from '@/lib/api';
import {
  intelligenceAPI,
  type Insight,
  type InsightCategory,
  type InsightSeverity,
  type InsightStatus,
  type InsightSummary,
  type ReorderSuggestion,
  predictionsAPI,
  type StockoutRow,
  type OverstockRow,
  type ChurnRow,
  type CashflowForecast,
} from '@/lib/api/intelligence';
import { notify } from '@/components/ui/AppToaster';
import { EmptyState } from '@/components/ui/EmptyState';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { money } from '@/components/sales/SalesPrimitives';
import { formatBusinessDateTime } from '@/lib/format/businessDate';

const surface =
  'min-w-0 rounded-2xl border border-[#e1e6dd] bg-white shadow-sm dark:border-white/10 dark:bg-[#191c19]';

const SEVERITY_META: Record<InsightSeverity, { label: string; chip: string; dot: string; ring: string; accent: string; soft: string }> = {
  CRITICAL: {
    label: 'Critical',
    chip: 'bg-red-600 text-white',
    dot: 'bg-red-500',
    ring: 'border-red-500',
    accent: 'border-l-red-600 dark:border-l-red-400',
    soft: 'bg-gradient-to-br from-rose-100 via-rose-50 to-white border-rose-200 text-rose-800 dark:from-rose-950/60 dark:via-rose-950/30 dark:to-[#191c19] dark:border-rose-900/50 dark:text-rose-200',
  },
  HIGH: {
    label: 'High',
    chip: 'bg-orange-500 text-white',
    dot: 'bg-orange-500',
    ring: 'border-orange-500',
    accent: 'border-l-orange-500 dark:border-l-orange-400',
    soft: 'bg-gradient-to-br from-orange-100 via-orange-50 to-white border-orange-200 text-orange-800 dark:from-orange-950/60 dark:via-orange-950/30 dark:to-[#191c19] dark:border-orange-900/50 dark:text-orange-200',
  },
  MEDIUM: {
    label: 'Medium',
    chip: 'bg-amber-500 text-white',
    dot: 'bg-amber-500',
    ring: 'border-amber-500',
    accent: 'border-l-amber-500 dark:border-l-amber-400',
    soft: 'bg-gradient-to-br from-amber-100 via-amber-50 to-white border-amber-200 text-amber-800 dark:from-amber-950/60 dark:via-amber-950/30 dark:to-[#191c19] dark:border-amber-900/50 dark:text-amber-200',
  },
  LOW: {
    label: 'Low',
    chip: 'bg-sky-600 text-white',
    dot: 'bg-sky-500',
    ring: 'border-sky-500',
    accent: 'border-l-sky-600 dark:border-l-sky-400',
    soft: 'bg-gradient-to-br from-sky-100 via-sky-50 to-white border-sky-200 text-sky-800 dark:from-sky-950/60 dark:via-sky-950/30 dark:to-[#191c19] dark:border-sky-900/50 dark:text-sky-200',
  },
  INFO: {
    label: 'Info',
    chip: 'bg-slate-500 text-white',
    dot: 'bg-slate-400',
    ring: 'border-slate-400',
    accent: 'border-l-slate-400 dark:border-l-slate-300',
    soft: 'bg-gradient-to-br from-slate-100 via-slate-50 to-white border-slate-200 text-slate-700 dark:from-white/10 dark:via-white/[0.06] dark:to-[#191c19] dark:border-white/15 dark:text-slate-300',
  },
};

const CATEGORY_META: Record<InsightCategory, { label: string; icon: typeof Package }> = {
  SALES: { label: 'Sales', icon: TrendingDown },
  PROFITABILITY: { label: 'Profitability', icon: CircleDollarSign },
  INVENTORY: { label: 'Inventory', icon: Warehouse },
  CUSTOMERS: { label: 'Customers', icon: Users },
  SUPPLIERS: { label: 'Suppliers', icon: Package },
  FINANCE: { label: 'Finance', icon: CircleDollarSign },
  OPERATIONS: { label: 'Operations', icon: Sparkles },
};

const STATUS_LABEL: Record<InsightStatus, string> = {
  ACTIVE: 'Active',
  ACKNOWLEDGED: 'Acknowledged',
  DISMISSED: 'Dismissed',
  RESOLVED: 'Resolved',
  EXPIRED: 'Expired',
};

const entityHref = (insight: Insight): string | null => {
  const id = insight.entityId;
  if (!id) return null;
  switch (insight.entityType) {
    case 'Product':
      return `/dashboard/products/${id}`;
    case 'Customer':
      return `/dashboard/customers/${id}`;
    case 'Supplier':
      return `/dashboard/suppliers/${id}`;
    case 'User':
      return '/dashboard/settings/users';
    default:
      return null;
  }
};

function SeverityBadge({ severity }: { severity: InsightSeverity }) {
  const meta = SEVERITY_META[severity] || SEVERITY_META.INFO;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${meta.chip}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  );
}

function InsightCard({
  insight,
  canManage,
  onAction,
}: {
  insight: Insight;
  canManage: boolean;
  onAction: (id: string, action: 'acknowledge' | 'dismiss' | 'resolve') => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const meta = CATEGORY_META[insight.category] || CATEGORY_META.OPERATIONS;
  const CategoryIcon = meta.icon;
  const href = entityHref(insight);
  const evidenceEntries = insight.evidence
    ? Object.entries(insight.evidence).filter(([, v]) => v !== null && v !== undefined)
    : [];

  const act = async (action: 'acknowledge' | 'dismiss' | 'resolve') => {
    setBusy(action);
    try {
      await onAction(insight.id, action);
    } finally {
      setBusy(null);
    }
  };

  return (
    <article className={`min-w-0 rounded-2xl border border-l-4 border-[#e1e6dd] bg-white p-4 shadow-sm transition hover:shadow-md dark:border-white/10 dark:bg-[#191c19] ${SEVERITY_META[insight.severity]?.accent || 'border-l-emerald-700'}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-300">
            <CategoryIcon size={17} />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <SeverityBadge severity={insight.severity} />
              <span className="rounded-full bg-[#eef2ec] px-2 py-0.5 text-[11px] font-medium text-[#53604f] dark:bg-white/10 dark:text-white/65">
                {meta.label}
              </span>
              {insight.status !== 'ACTIVE' && (
                <span className="rounded-full bg-[#f1f3ef] px-2 py-0.5 text-[11px] font-medium text-[#606b5f] dark:bg-white/10 dark:text-white/55">
                  {STATUS_LABEL[insight.status]}
                </span>
              )}
            </div>
            <h3 className="mt-1.5 break-words text-[15px] font-semibold leading-snug text-[#20231f] dark:text-white">
              {insight.title}
            </h3>
            <p className="mt-1 break-words text-sm leading-relaxed text-[#606b5f] dark:text-white/65">
              {insight.summary}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {href && (
            <Link
              href={href}
              className="min-h-9 rounded-lg border border-[#d9dfd5] px-2.5 py-1.5 text-xs font-semibold text-[#465342] transition hover:bg-emerald-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700 dark:border-white/15 dark:text-white/80 dark:hover:bg-white/10"
            >
              View record
            </Link>
          )}
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="min-h-9 min-w-9 rounded-lg border border-[#d9dfd5] p-1.5 text-[#53604f] transition hover:bg-emerald-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700 dark:border-white/15 dark:text-white/60 dark:hover:bg-white/10"
            aria-label={expanded ? 'Collapse details' : 'Expand details'}
          >
            {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-4 space-y-3 border-t border-[#e8ece6] pt-4 dark:border-white/10">
          {insight.detail && (
            <p className="text-xs leading-relaxed text-[#606b5f] dark:text-white/60">{insight.detail}</p>
          )}
          {evidenceEntries.length > 0 && (
            <div>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-300">
                Evidence
              </p>
              <dl className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
                {evidenceEntries.slice(0, 12).map(([key, value]) => (
                  <div key={key} className="flex items-baseline justify-between gap-3 text-xs">
                    <dt className="text-[#687064] dark:text-white/55">{key.replace(/([A-Z])/g, ' $1')}</dt>
                    <dd className="min-w-0 break-words text-right font-medium text-[#303a30] dark:text-white/85">
                      {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
          {insight.recommendation && (
            <div className="rounded-xl bg-emerald-50/70 p-3 dark:bg-emerald-950/20">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-300">
                Recommended action
              </p>
              <p className="mt-0.5 text-sm text-[#465342] dark:text-white/80">{insight.recommendation}</p>
            </div>
          )}
          <p className="break-words text-[11px] text-[#687064] dark:text-white/45">
            Detected {formatBusinessDateTime(insight.detectedAt)} · Last seen{' '}
            {formatBusinessDateTime(insight.lastSeenAt)}
            {insight.periodEnd ? ` · Period ends ${formatBusinessDateTime(insight.periodEnd)}` : ''}
          </p>
        </div>
      )}

      {canManage && insight.status === 'ACTIVE' && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[#e8ece6] pt-3 dark:border-white/10">
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => act('acknowledge')}
            className="min-h-9 rounded-lg bg-[#eef2ec] px-3 py-1.5 text-xs font-semibold text-[#465342] transition hover:bg-emerald-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700 disabled:opacity-50 dark:bg-white/10 dark:text-slate-200 dark:hover:bg-white/15"
          >
            {busy === 'acknowledge' ? <Loader2 size={13} className="animate-spin" /> : 'Acknowledge'}
          </button>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => act('resolve')}
            className="min-h-9 rounded-lg bg-emerald-800 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:opacity-50 dark:bg-emerald-700 dark:hover:bg-emerald-600"
          >
            {busy === 'resolve' ? <Loader2 size={13} className="animate-spin" /> : 'Mark resolved'}
          </button>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => act('dismiss')}
            className="ml-auto min-h-9 rounded-lg px-3 py-1.5 text-xs font-semibold text-[#687064] transition hover:bg-[#f1f3ef] focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700 disabled:opacity-50 dark:text-white/55 dark:hover:bg-white/10"
          >
            {busy === 'dismiss' ? <Loader2 size={13} className="animate-spin" /> : 'Dismiss'}
          </button>
        </div>
      )}
    </article>
  );
}

function ReorderTable({
  rows,
  selected,
  quantities,
  onToggle,
  onQuantity,
  onCreatePO,
  creating,
}: {
  rows: ReorderSuggestion[];
  selected: Set<string>;
  quantities: Record<string, number>;
  onToggle: (key: string) => void;
  onQuantity: (key: string, qty: number) => void;
  onCreatePO: () => void;
  creating: boolean;
}) {
  if (!rows.length)
    return (
      <EmptyState
        title="No replenishment needed"
        description="All tracked products have enough stock to cover lead time plus a review period, based on the last 30 days of sales."
      />
    );
  return (
    <div className={`${surface} overflow-hidden`}>
      <div className="flex flex-col items-start justify-between gap-3 border-b border-[#e8ece6] px-4 py-3 sm:flex-row sm:items-center dark:border-white/10">
        <p className="text-sm text-[#606b5f] dark:text-white/60">
          {rows.length} product{rows.length === 1 ? '' : 's'} may need replenishment. Quantities are suggestions — review before ordering.
        </p>
        <button
          type="button"
          disabled={!selected.size || creating}
          onClick={onCreatePO}
          className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl bg-emerald-800 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto dark:bg-emerald-700 dark:hover:bg-emerald-600"
        >
          {creating ? <Loader2 size={15} className="animate-spin" /> : <PackagePlus size={15} />}
          Create draft PO ({selected.size})
        </button>
      </div>
      <div className="overflow-x-auto overscroll-x-contain">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="bg-[#f5f7f3] text-[11px] uppercase tracking-wide text-[#687064] dark:bg-white/[0.04] dark:text-white/50">
            <tr>
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3">Location</th>
              <th className="px-4 py-3 text-right">Available</th>
              <th className="px-4 py-3 text-right">Incoming</th>
              <th className="px-4 py-3 text-right">Daily sales</th>
              <th className="px-4 py-3 text-right">Days left</th>
              <th className="px-4 py-3 text-right">Suggested qty</th>
              <th className="px-4 py-3">Supplier</th>
              <th className="px-4 py-3 text-right">Est. cost</th>
              <th className="px-4 py-3">Why</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e8ece6] dark:divide-white/10">
            {rows.map((row) => {
              const key = `${row.productId}:${row.locationId}`;
              const isSelected = selected.has(key);
              return (
                <tr key={key} className={isSelected ? 'bg-emerald-50/70 dark:bg-white/[0.05]' : ''}>
                  <td className="px-4 py-3">
                    <label className="flex cursor-pointer items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onToggle(key)}
                        className="h-4 w-4 rounded border-emerald-300 accent-emerald-800"
                      />
                      <div>
                        <p className="font-medium text-[#20231f] dark:text-white">{row.productName}</p>
                        <p className="text-xs text-[#687064] dark:text-white/45">{row.sku}</p>
                      </div>
                    </label>
                  </td>
                  <td className="px-4 py-3 text-[#465342] dark:text-white/75">{row.locationName}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-[#465342] dark:text-white/75">{row.available}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-[#465342] dark:text-white/75">{row.incoming}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-[#465342] dark:text-white/75">{row.dailyVelocity}</td>
                  <td className="px-4 py-3 text-right">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold text-white ${
                        row.daysOfStock === null
                          ? 'bg-slate-500'
                          : row.daysOfStock <= 3
                            ? 'bg-red-600'
                            : row.daysOfStock <= 14
                              ? 'bg-amber-500'
                              : 'bg-sky-600'
                      }`}
                    >
                      {row.daysOfStock === null ? '—' : `${row.daysOfStock}d`}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums text-[#20231f] dark:text-white">
                    {isSelected ? (
                      <input
                        type="number"
                        min={0.0001}
                        step={0.0001}
                        value={quantities[key] ?? row.suggestedQuantity}
                        onChange={(e) => onQuantity(key, Number(e.target.value))}
                        className="w-24 rounded-lg border border-[#d9dfd5] bg-white px-2 py-1 text-right text-sm font-semibold tabular-nums text-[#20231f] focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 dark:border-white/15 dark:bg-white/[0.06] dark:text-white dark:focus:border-emerald-400"
                      />
                    ) : (
                      row.suggestedQuantity
                    )}
                  </td>
                  <td className="px-4 py-3 text-[#465342] dark:text-white/75">
                    {row.supplierName || <span className="text-[#687064] dark:text-white/45">No supplier</span>}
                    {row.leadTimeDays !== 7 && (
                      <span className="ml-1 text-[11px] text-[#687064] dark:text-white/45">({row.leadTimeDays}d lead)</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-[#465342] dark:text-white/75">
                    {row.estimatedOrderCost !== null ? money(row.estimatedOrderCost) : '—'}
                  </td>
                  <td className="max-w-[220px] px-4 py-3 text-xs leading-relaxed text-[#687064] dark:text-white/55">
                    {row.reason}
                    <span className="mt-0.5 block text-[10px] uppercase tracking-wide text-[#687064] dark:text-white/45">
                      Confidence: {row.confidence}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RiskBadge({ risk }: { risk: string }) {
  const styles: Record<string, string> = {
    CRITICAL: 'bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-200',
    HIGH: 'bg-orange-100 text-orange-800 dark:bg-orange-950/50 dark:text-orange-200',
    MEDIUM: 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200',
    LOW: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200',
  };
  return <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-bold ${styles[risk] ?? styles.LOW}`}>{risk}</span>;
}

export default function IntelligencePage() {
  const permissions = useAuthStore((state) => state.user?.permissions ?? []);
  const canManage = permissions.includes('insights.manage');
  const [tab, setTab] = useState<'insights' | 'reorder' | 'forecasts'>('insights');
  const [summary, setSummary] = useState<InsightSummary | null>(null);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [filters, setFilters] = useState({ severity: '', category: '', status: 'ACTIVE', q: '', page: 1 });
  const [reorder, setReorder] = useState<ReorderSuggestion[]>([]);
  const [reorderLoading, setReorderLoading] = useState(false);
  const [reorderGeneratedAt, setReorderGeneratedAt] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [reorderFilters, setReorderFilters] = useState({ urgency: '', confidence: '', supplier: '', q: '' });
  const [creatingPO, setCreatingPO] = useState(false);
  const [forecastData, setForecastData] = useState<{ stockout: StockoutRow[]; overstock: OverstockRow[]; churn: ChurnRow[]; cashflow: CashflowForecast | null } | null>(null);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [forecastDays, setForecastDays] = useState(30);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sum, list] = await Promise.all([
        intelligenceAPI.summary(),
        intelligenceAPI.list({
          severity: filters.severity || undefined,
          category: filters.category || undefined,
          status: filters.status || undefined,
          q: filters.q || undefined,
          page: filters.page,
          limit: 25,
        }),
      ]);
      setSummary(sum);
      setInsights(list.data);
      setTotal(list.total);
    } catch (error) {
      notify.error(getApiError(error, 'Failed to load intelligence'));
    } finally {
      setLoading(false);
    }
  }, [filters.severity, filters.category, filters.status, filters.q, filters.page]);

  const loadReorder = useCallback(async () => {
    setReorderLoading(true);
    try {
      const res = await intelligenceAPI.reorderSuggestions();
      setReorder(res.data);
      setReorderGeneratedAt(res.generatedAt);
      setSelected(new Set());
      setQuantities({});
    } catch (error) {
      notify.error(getApiError(error, 'Failed to load reorder suggestions'));
    } finally {
      setReorderLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (tab === 'reorder' && !reorder.length && !reorderLoading) void loadReorder();
  }, [tab, reorder.length, reorderLoading, loadReorder]);

  const loadForecasts = useCallback(async (days = forecastDays) => {
    setForecastLoading(true);
    try {
      const [so, ov, ch, cf] = await Promise.all([
        predictionsAPI.stockout(), predictionsAPI.overstock(), predictionsAPI.churn(), predictionsAPI.cashflow(days),
      ]);
      setForecastData({ stockout: so.data, overstock: ov.data, churn: ch.data, cashflow: cf });
    } catch (error) {
      notify.error(getApiError(error, 'Failed to load forecasts'));
    } finally {
      setForecastLoading(false);
    }
  }, [forecastDays]);

  useEffect(() => {
    if (tab === 'forecasts' && !forecastData && !forecastLoading) void loadForecasts();
  }, [tab, forecastData, forecastLoading, loadForecasts]);

  const runDetection = async () => {
    setRunning(true);
    try {
      const res = await intelligenceAPI.run();
      notify.success(`Analysis complete — ${res.created} new, ${res.updated} updated, ${res.expired} expired`);
      await load();
    } catch (error) {
      notify.error(getApiError(error, 'Failed to run analysis'));
    } finally {
      setRunning(false);
    }
  };

  const act = async (id: string, action: 'acknowledge' | 'dismiss' | 'resolve') => {
    try {
      if (action === 'acknowledge') await intelligenceAPI.acknowledge(id);
      if (action === 'dismiss') await intelligenceAPI.dismiss(id);
      if (action === 'resolve') await intelligenceAPI.resolve(id);
      notify.success(`Insight ${action}d`);
      await load();
    } catch (error) {
      notify.error(getApiError(error, `Failed to ${action} insight`));
    }
  };

  const toggleSelect = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const setQuantity = (key: string, qty: number) =>
    setQuantities((prev) => ({ ...prev, [key]: qty }));

  const filteredReorder = useMemo(() => {
    const q = reorderFilters.q.trim().toLowerCase();
    return reorder.filter((r) => {
      if (reorderFilters.confidence && r.confidence !== reorderFilters.confidence) return false;
      if (reorderFilters.supplier === 'NONE' && r.supplierId) return false;
      if (reorderFilters.supplier && reorderFilters.supplier !== 'NONE' && r.supplierId !== reorderFilters.supplier) return false;
      if (reorderFilters.urgency === 'CRITICAL' && !(r.daysOfStock !== null && r.daysOfStock <= 3)) return false;
      if (reorderFilters.urgency === 'SOON' && !(r.daysOfStock !== null && r.daysOfStock > 3 && r.daysOfStock <= 14)) return false;
      if (reorderFilters.urgency === 'OK' && !(r.daysOfStock === null || r.daysOfStock > 14)) return false;
      if (q && !(`${r.productName} ${r.sku} ${r.locationName} ${r.supplierName || ''}`.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [reorder, reorderFilters]);

  const supplierOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of reorder) if (r.supplierId) map.set(r.supplierId, r.supplierName || r.supplierId);
    return [...map.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [reorder]);

  const createPO = async () => {
    const items = reorder
      .filter((r) => selected.has(`${r.productId}:${r.locationId}`))
      .map((r) => {
        const key = `${r.productId}:${r.locationId}`;
        const qty = quantities[key] ?? r.suggestedQuantity;
        return { productId: r.productId, locationId: r.locationId, quantity: qty };
      })
      .filter((i) => Number.isFinite(i.quantity) && i.quantity > 0);
    if (!items.length) return;
    setCreatingPO(true);
    try {
      const res = await intelligenceAPI.createDraftPOs(items);
      notify.success(`Created ${res.count} draft purchase order(s) — review them in Purchases`);
      setSelected(new Set());
      await loadReorder();
    } catch (error) {
      notify.error(getApiError(error, 'Failed to create draft purchase orders'));
    } finally {
      setCreatingPO(false);
    }
  };

  const severityCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of summary?.bySeverity || []) map.set(row.severity, row._count._all);
    return map;
  }, [summary]);
  const activeTotal = useMemo(
    () => (summary?.byStatus || []).find((r) => r.status === 'ACTIVE')?._count._all || 0,
    [summary],
  );

  return (
    <main className="mx-auto w-full max-w-7xl min-w-0 space-y-5 pb-10">
      <header className="flex flex-col justify-between gap-4 rounded-2xl border border-emerald-200/70 bg-emerald-50/70 p-5 dark:border-emerald-900/40 dark:bg-[#17231b] sm:flex-row sm:items-end sm:p-7">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-800 to-emerald-600 text-white shadow-sm">
              <BrainCircuit size={20} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-extrabold uppercase tracking-[0.15em] text-emerald-800 dark:text-emerald-300">Business insights</p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#20231f] dark:text-white sm:text-3xl">Intelligence</h1>
              <p className="mt-1 max-w-3xl text-sm text-[#606b5f] dark:text-white/65">
                What is happening in your business and what needs attention today.
              </p>
            </div>
          </div>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={runDetection}
            disabled={running}
            className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:opacity-50 sm:w-auto dark:bg-emerald-700 dark:hover:bg-emerald-600"
          >
            {running ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
            Run analysis
          </button>
        )}
      </header>

      {/* Severity strip */}
      <section className={`grid grid-cols-2 gap-3 p-3 sm:grid-cols-3 sm:p-4 lg:grid-cols-5 ${surface}`} aria-label="Insight counts by severity">
        {(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'] as InsightSeverity[]).map((sev) => {
          const count = severityCounts.get(sev) || 0;
          return (
            <button
              key={sev}
              type="button"
              aria-label={`${SEVERITY_META[sev].label}: ${count} insights`}
              onClick={() => setFilters((f) => ({ ...f, severity: f.severity === sev ? '' : sev, page: 1 }))}
              className={`flex min-h-[76px] min-w-0 items-center justify-between gap-2 rounded-xl border p-2.5 text-left transition hover:shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 sm:min-h-[112px] sm:p-3 ${SEVERITY_META[sev].soft} ${
                filters.severity === sev ? 'ring-2 ring-offset-1 ' + SEVERITY_META[sev].ring + ' dark:ring-offset-[#191c19]' : 'hover:brightness-[0.98] dark:hover:brightness-110'
              }`}
            >
              <span className="flex min-w-0 items-center gap-1.5 sm:gap-2">
                <span className={`h-2 w-2 shrink-0 rounded-full ${SEVERITY_META[sev].dot}`} />
                <span className="truncate text-[10px] font-semibold uppercase tracking-wide text-[#687064] dark:text-white/55 sm:text-xs">
                  {SEVERITY_META[sev].label}
                </span>
              </span>
              <span
                aria-hidden="true"
                className="relative grid h-12 w-12 shrink-0 place-items-center rounded-full border border-white/55 bg-[radial-gradient(circle_at_34%_28%,#efe4c0_0%,#c9a74e_29%,#957b3a_55%,#315c45_100%)] text-lg font-extrabold tabular-nums text-white shadow-[inset_-8px_-9px_16px_rgba(24,31,26,.4),inset_4px_4px_8px_rgba(255,255,255,.28),0_0_10px_rgba(217,166,54,.16)] after:absolute after:inset-[10%] after:rounded-full after:border after:border-white/20 after:content-[''] sm:h-[76px] sm:w-[76px] sm:text-2xl dark:border-white/15 dark:from-[#e6d49e] dark:via-[#806a36] dark:to-[#183b2b]"
              >
                <AnimatedNumber value={count} format={(value) => Math.round(value).toLocaleString()} />
              </span>
            </button>
          );
        })}
      </section>

      {/* Tabs */}
      <nav className="flex min-w-0 gap-1 rounded-2xl border border-[#e1e6dd] bg-white p-1.5 shadow-sm dark:border-white/10 dark:bg-[#191c19]" role="tablist" aria-label="Intelligence sections">
        {(
          [
            ['insights', `Insights${activeTotal ? ` (${activeTotal})` : ''}`, AlertTriangle],
            ['reorder', 'Smart reorder', PackagePlus],
            ['forecasts', 'Forecasts', LineChart],
          ] as const
        ).map(([key, label, Icon]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`flex min-h-10 min-w-0 flex-1 items-center justify-center gap-2 rounded-xl px-2 py-2 text-xs font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700 sm:px-4 sm:text-sm ${
              tab === key
                ? 'bg-emerald-800 text-white shadow-sm dark:bg-emerald-700'
                : 'text-[#53604f] hover:bg-emerald-50 dark:text-white/65 dark:hover:bg-white/[0.06]'
            }`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </nav>

      {tab === 'insights' && (
        <>
          <section className={`${surface} ui-filter-surface p-4 sm:p-5`} aria-label="Insight filters">
            <div className="mb-3 flex items-center gap-2">
              <Search size={16} className="text-emerald-700 dark:text-emerald-300" />
              <h2 className="text-sm font-bold text-[#303a30] dark:text-white">Find an insight</h2>
            </div>
            <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(240px,1fr)_minmax(160px,auto)_minmax(160px,auto)]">
              <div className="relative min-w-0 sm:col-span-2 lg:col-span-1">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#748071]" />
                <input
                  value={filters.q}
                  onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value, page: 1 }))}
                  placeholder="Search insights…"
                  aria-label="Search insights"
                  className="min-h-10 w-full rounded-xl border border-[#d9dfd5] bg-white py-2 pl-9 pr-3 text-sm text-[#252a24] shadow-sm outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-600/20 dark:border-white/10 dark:bg-[#111310] dark:text-white dark:focus:border-emerald-400"
                />
              </div>
              <select
                value={filters.category}
                onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value, page: 1 }))}
                aria-label="Filter by category"
                className="min-h-10 w-full min-w-0 rounded-xl border border-[#d9dfd5] bg-white px-3 py-2 text-sm text-[#303a30] shadow-sm outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-600/20 dark:border-white/10 dark:bg-[#111310] dark:text-white/85 dark:focus:border-emerald-400"
              >
                <option value="">All categories</option>
                {Object.entries(CATEGORY_META).map(([key, meta]) => (
                  <option key={key} value={key}>{meta.label}</option>
                ))}
              </select>
              <select
                value={filters.status}
                onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value, page: 1 }))}
                aria-label="Filter by status"
                className="min-h-10 w-full min-w-0 rounded-xl border border-[#d9dfd5] bg-white px-3 py-2 text-sm text-[#303a30] shadow-sm outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-600/20 dark:border-white/10 dark:bg-[#111310] dark:text-white/85 dark:focus:border-emerald-400"
              >
                <option value="">All statuses</option>
                {Object.entries(STATUS_LABEL).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
              {(filters.q || filters.category || filters.severity || filters.status !== 'ACTIVE') && (
                <button
                  type="button"
                  onClick={() => setFilters({ severity: '', category: '', status: '', q: '', page: 1 })}
                  className="inline-flex min-h-9 items-center gap-1 justify-self-start rounded-lg px-2.5 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700 dark:text-emerald-300 dark:hover:bg-white/10"
                >
                  <X size={13} /> Clear
                </button>
              )}
            </div>
          </section>

          {/* List */}
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-[#687064] dark:text-white/55">
              <Loader2 size={18} className="animate-spin" />
              <span className="text-sm">Analyzing your business…</span>
            </div>
          ) : insights.length ? (
            <div className="space-y-3">
              {insights.map((insight) => (
                <InsightCard key={insight.id} insight={insight} canManage={canManage} onAction={act} />
              ))}
            </div>
          ) : (
            <div className={surface}>
              <EmptyState
                title="No insights right now"
                description="Your business looks healthy across the tracked signals, or analysis hasn't run yet. Use “Run analysis” to evaluate the latest data."
              />
            </div>
          )}

          {total > 25 && (
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                disabled={filters.page <= 1}
                onClick={() => setFilters((f) => ({ ...f, page: f.page - 1 }))}
                className="min-h-10 rounded-xl border border-[#d9dfd5] px-3 py-1.5 text-sm font-semibold text-[#465342] transition hover:bg-emerald-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700 disabled:opacity-40 dark:border-white/15 dark:text-white/80 dark:hover:bg-white/10"
              >
                Previous
              </button>
              <span className="text-center text-sm text-[#687064] dark:text-white/55">
                Page {filters.page} · {total} insights
              </span>
              <button
                type="button"
                disabled={filters.page * 25 >= total}
                onClick={() => setFilters((f) => ({ ...f, page: f.page + 1 }))}
                className="min-h-10 rounded-xl border border-[#d9dfd5] px-3 py-1.5 text-sm font-semibold text-[#465342] transition hover:bg-emerald-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700 disabled:opacity-40 dark:border-white/15 dark:text-white/80 dark:hover:bg-white/10"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      {tab === 'reorder' && (
        <>
          <section className={`${surface} ui-filter-surface p-4 sm:p-5`} aria-label="Reorder filters">
            <div className="mb-3 flex items-center gap-2">
              <PackagePlus size={16} className="text-emerald-700 dark:text-emerald-300" />
              <h2 className="text-sm font-bold text-[#303a30] dark:text-white">Refine suggestions</h2>
            </div>
            <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="relative min-w-0">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#748071]" />
                <input
                  value={reorderFilters.q}
                  onChange={(e) => setReorderFilters((f) => ({ ...f, q: e.target.value }))}
                  placeholder="Search product, SKU, location…"
                  aria-label="Search products, SKUs, locations, and suppliers"
                  className="min-h-10 w-full rounded-xl border border-[#d9dfd5] bg-white py-2 pl-9 pr-3 text-sm shadow-sm outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-600/20 dark:border-white/10 dark:bg-[#111310] dark:text-white dark:focus:border-emerald-400"
                />
              </div>
              <select
                value={reorderFilters.urgency}
                onChange={(e) => setReorderFilters((f) => ({ ...f, urgency: e.target.value }))}
                aria-label="Filter by stock urgency"
                className="min-h-10 w-full min-w-0 rounded-xl border border-[#d9dfd5] bg-white px-3 py-2 text-sm outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-600/20 dark:border-white/10 dark:bg-[#111310] dark:text-white/85 dark:focus:border-emerald-400"
              >
                <option value="">All urgency</option>
                <option value="CRITICAL">Critical (≤3 days)</option>
                <option value="SOON">Soon (4–14 days)</option>
                <option value="OK">Reorder level only</option>
              </select>
              <select
                value={reorderFilters.confidence}
                onChange={(e) => setReorderFilters((f) => ({ ...f, confidence: e.target.value }))}
                aria-label="Filter by suggestion confidence"
                className="min-h-10 w-full min-w-0 rounded-xl border border-[#d9dfd5] bg-white px-3 py-2 text-sm outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-600/20 dark:border-white/10 dark:bg-[#111310] dark:text-white/85 dark:focus:border-emerald-400"
              >
                <option value="">All confidence</option>
                <option value="HIGH">High confidence</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low / no demand data</option>
              </select>
              <select
                value={reorderFilters.supplier}
                onChange={(e) => setReorderFilters((f) => ({ ...f, supplier: e.target.value }))}
                aria-label="Filter by supplier"
                className="min-h-10 w-full min-w-0 rounded-xl border border-[#d9dfd5] bg-white px-3 py-2 text-sm outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-600/20 dark:border-white/10 dark:bg-[#111310] dark:text-white/85 dark:focus:border-emerald-400"
              >
                <option value="">All suppliers</option>
                {supplierOptions.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
                <option value="NONE">No supplier</option>
              </select>
            </div>
          </section>
          <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
            <p className="flex min-w-0 items-start gap-1.5 break-words text-xs text-[#687064] dark:text-white/55">
              <Clock size={13} />
              {reorderGeneratedAt
                ? `Generated ${formatBusinessDateTime(reorderGeneratedAt)} from the last 30 days of sales`
                : 'Computed live from stock, sales velocity, open purchase orders and supplier lead times'}
            </p>
            <button
              type="button"
              onClick={loadReorder}
              disabled={reorderLoading}
              className="inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-[#d9dfd5] px-3 py-1.5 text-xs font-semibold text-[#465342] transition hover:bg-emerald-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700 disabled:opacity-50 sm:w-auto dark:border-white/15 dark:text-white/75 dark:hover:bg-white/10"
            >
              {reorderLoading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
              Refresh
            </button>
          </div>
          {reorderLoading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-[#687064] dark:text-white/55">
              <Loader2 size={18} className="animate-spin" />
              <span className="text-sm">Calculating reorder suggestions…</span>
            </div>
          ) : (
            <ReorderTable
              rows={filteredReorder}
              selected={selected}
              quantities={quantities}
              onToggle={toggleSelect}
              onQuantity={setQuantity}
              onCreatePO={createPO}
              creating={creatingPO}
            />
          )}
        </>
      )}
      {tab === 'forecasts' && (
        <>
          <section className={`${surface} ui-filter-surface flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5`}>
            <div>
              <h2 className="text-sm font-bold text-[#303a30] dark:text-white">Demand &amp; cash forecasts</h2>
              <p className="mt-0.5 text-xs text-[#687064] dark:text-white/55">Predictions from your own sales, stock and payment history. Estimates, not guarantees.</p>
            </div>
            <div className="flex items-center gap-2">
              {[7, 14, 30].map((d) => (
                <button key={d} type="button" onClick={() => { setForecastDays(d); setForecastData(null); }}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${forecastDays === d ? 'bg-emerald-800 text-white' : 'bg-emerald-50 text-emerald-800 dark:bg-white/10 dark:text-emerald-200'}`}>
                  {d}d
                </button>
              ))}
              <button type="button" onClick={() => void loadForecasts()} className="rounded-lg border border-emerald-200 p-2 text-emerald-700 dark:border-white/15 dark:text-emerald-300" aria-label="Refresh forecasts">
                <RefreshCw size={15} className={forecastLoading ? 'animate-spin' : ''} />
              </button>
            </div>
          </section>

          {forecastLoading || !forecastData ? (
            <div className="flex items-center justify-center gap-2 py-16 text-[#687064] dark:text-white/55">
              <Loader2 size={18} className="animate-spin" /><span className="text-sm">Computing forecasts…</span>
            </div>
          ) : (
            <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">
              <section className={`${surface} min-w-0 overflow-hidden`}>
                <header className="border-b border-[#e6e9e2] px-4 py-3 dark:border-white/10">
                  <h3 className="flex items-center gap-2 text-sm font-bold text-[#303a30] dark:text-white"><AlertTriangle size={15} className="text-amber-600" /> Predicted stockouts</h3>
                </header>
                {forecastData.stockout.length === 0 ? <p className="px-4 py-6 text-sm text-[#687064]">No stockout risk detected.</p> : (
                  <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-sm">
                    <thead><tr className="text-left text-[11px] uppercase tracking-wide text-[#748071]">
                      <th className="px-4 py-2">Product</th><th className="px-2 py-2">Location</th><th className="px-2 py-2">Avail</th><th className="px-2 py-2">Incoming</th><th className="px-2 py-2">Days left</th><th className="px-4 py-2">Risk</th>
                    </tr></thead>
                    <tbody>{forecastData.stockout.slice(0, 12).map((r) => (
                      <tr key={`${r.productId}:${r.locationId}`} className="border-t border-[#eef1ec] dark:border-white/5">
                        <td className="px-4 py-2.5"><div className="font-medium text-[#303a30] dark:text-white">{r.productName}</div><div className="text-[11px] text-[#748071]">{r.sku}</div></td>
                        <td className="px-2 py-2.5 text-[#53604f] dark:text-white/70">{r.locationName}</td>
                        <td className="px-2 py-2.5 tabular-nums">{r.available}</td>
                        <td className="px-2 py-2.5 tabular-nums">{r.incoming}</td>
                        <td className="px-2 py-2.5 tabular-nums">{r.daysRemaining ?? '—'}</td>
                        <td className="px-4 py-2.5"><RiskBadge risk={r.risk} /></td>
                      </tr>
                    ))}</tbody>
                  </table></div>
                )}
              </section>

              <section className={`${surface} min-w-0 overflow-hidden`}>
                <header className="border-b border-[#e6e9e2] px-4 py-3 dark:border-white/10">
                  <h3 className="flex items-center gap-2 text-sm font-bold text-[#303a30] dark:text-white"><Warehouse size={15} className="text-sky-600" /> Overstock risk</h3>
                </header>
                {forecastData.overstock.length === 0 ? <p className="px-4 py-6 text-sm text-[#687064]">No overstock detected.</p> : (
                  <div className="overflow-x-auto"><table className="w-full min-w-[520px] text-sm">
                    <thead><tr className="text-left text-[11px] uppercase tracking-wide text-[#748071]">
                      <th className="px-4 py-2">Product</th><th className="px-2 py-2">Location</th><th className="px-2 py-2">Excess units</th><th className="px-2 py-2">Est. value</th><th className="px-4 py-2">Risk</th>
                    </tr></thead>
                    <tbody>{forecastData.overstock.slice(0, 12).map((r) => (
                      <tr key={`${r.productId}:${r.locationId}`} className="border-t border-[#eef1ec] dark:border-white/5">
                        <td className="px-4 py-2.5"><div className="font-medium text-[#303a30] dark:text-white">{r.productName}</div><div className="text-[11px] text-[#748071]">{r.sku}</div></td>
                        <td className="px-2 py-2.5 text-[#53604f] dark:text-white/70">{r.locationName}</td>
                        <td className="px-2 py-2.5 tabular-nums">{r.excessUnits}</td>
                        <td className="px-2 py-2.5 tabular-nums">{r.excessValue !== null ? money(r.excessValue) : '—'}</td>
                        <td className="px-4 py-2.5"><RiskBadge risk={r.risk} /></td>
                      </tr>
                    ))}</tbody>
                  </table></div>
                )}
              </section>

              <section className={`${surface} min-w-0 overflow-hidden`}>
                <header className="border-b border-[#e6e9e2] px-4 py-3 dark:border-white/10">
                  <h3 className="flex items-center gap-2 text-sm font-bold text-[#303a30] dark:text-white"><Users size={15} className="text-rose-600" /> Churn risk</h3>
                </header>
                {forecastData.churn.length === 0 ? <p className="px-4 py-6 text-sm text-[#687064]">No at-risk customers.</p> : (
                  <div className="overflow-x-auto"><table className="w-full min-w-[480px] text-sm">
                    <thead><tr className="text-left text-[11px] uppercase tracking-wide text-[#748071]">
                      <th className="px-4 py-2">Customer</th><th className="px-2 py-2">Invoices</th><th className="px-2 py-2">Days since</th><th className="px-4 py-2">Risk</th>
                    </tr></thead>
                    <tbody>{forecastData.churn.slice(0, 12).map((r) => (
                      <tr key={r.customerId} className="border-t border-[#eef1ec] dark:border-white/5">
                        <td className="px-4 py-2.5"><div className="font-medium text-[#303a30] dark:text-white">{r.name}</div><div className="text-[11px] text-[#748071]">{r.customerCode} · {r.factors[0]}</div></td>
                        <td className="px-2 py-2.5 tabular-nums">{r.invoiceCount}</td>
                        <td className="px-2 py-2.5 tabular-nums">{r.daysSinceLastPurchase ?? '—'}</td>
                        <td className="px-4 py-2.5"><RiskBadge risk={r.risk} /></td>
                      </tr>
                    ))}</tbody>
                  </table></div>
                )}
              </section>

              <section className={`${surface} min-w-0 p-4 sm:p-5`}>
                <h3 className="flex items-center gap-2 text-sm font-bold text-[#303a30] dark:text-white"><CircleDollarSign size={15} className="text-emerald-600" /> Cash flow — next {forecastDays} days</h3>
                {forecastData.cashflow && (
                  <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <div className="rounded-xl bg-emerald-50 p-3 dark:bg-emerald-950/30"><div className="text-[11px] font-semibold uppercase text-emerald-700 dark:text-emerald-300">Actual net (30d)</div><div className="mt-1 text-lg font-bold tabular-nums text-emerald-800 dark:text-emerald-200">{money(forecastData.cashflow.actuals.netLast30Days)}</div></div>
                    <div className="rounded-xl bg-amber-50 p-3 dark:bg-amber-950/30"><div className="text-[11px] font-semibold uppercase text-amber-700 dark:text-amber-300">Overdue receivables</div><div className="mt-1 text-lg font-bold tabular-nums text-amber-800 dark:text-amber-200">{money(forecastData.cashflow.expected.overdueReceivables.amount)}</div><div className="text-[11px] text-amber-700/80 dark:text-amber-300/80">{forecastData.cashflow.expected.overdueReceivables.count} invoices — owed, not cash</div></div>
                    <div className="rounded-xl bg-sky-50 p-3 dark:bg-sky-950/30"><div className="text-[11px] font-semibold uppercase text-sky-700 dark:text-sky-300">Due within {forecastDays}d</div><div className="mt-1 text-lg font-bold tabular-nums text-sky-800 dark:text-sky-200">{money(forecastData.cashflow.expected.dueWithinHorizon.amount)}</div><div className="text-[11px] text-sky-700/80 dark:text-sky-300/80">{forecastData.cashflow.expected.dueWithinHorizon.count} invoices expected</div></div>
                  </div>
                )}
                <ul className="mt-3 space-y-1 text-[11px] leading-relaxed text-[#687064] dark:text-white/55">
                  {(forecastData.cashflow?.assumptions ?? []).map((a, i) => <li key={i}>• {a}</li>)}
                </ul>
              </section>
            </div>
          )}
        </>
      )}
    </main>
  );
}
