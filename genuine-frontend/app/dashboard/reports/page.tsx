'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Download, FileSpreadsheet, FileText, Loader2, RefreshCw, TrendingUp } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useReportsStore, type ReportTab, type ReportsData } from '@/store/reportsStore';
import { reportsAPI, type ReportFormat, type ReportMetric, type ReportRange, type ReportSettingsContext, type ReportType } from '@/lib/api/reports';
import { getApiError } from '@/lib/api';
import { cacheBusinessDateSettings, formatBusinessDate } from '@/lib/format/businessDate';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';

const tabs: Array<{ id: ReportTab; label: string }> = [
  { id: 'overview', label: 'Overview' }, { id: 'sales', label: 'Sales' },
  { id: 'products', label: 'Products' }, { id: 'customers', label: 'Customers' },
  { id: 'suppliers', label: 'Suppliers' }, { id: 'finance', label: 'Finance' },
  { id: 'inventory', label: 'Inventory' }, { id: 'trends', label: 'Trends & forecast' },
];

const panels: Record<ReportTab, { title: string; description: string; exportType: ReportType }> = {
  overview: { title: 'Business overview', description: 'Business-wide view across all locations: sales, finance, purchasing and current stock. Use inventory detail reports to filter stock by location.', exportType: 'DASHBOARD' },
  sales: { title: 'Sales performance', description: 'Issued invoices, accepted returns, collections and sales channels.', exportType: 'SALES_DASHBOARD' },
  products: { title: 'Product performance', description: 'Units, net sales, cost of goods sold and margin from recorded stock movements.', exportType: 'PRODUCT_PERFORMANCE' },
  customers: { title: 'Customer analytics', description: 'Customer sales, buying frequency, recency and segment for active accounts.', exportType: 'CUSTOMER_ANALYTICS' },
  suppliers: { title: 'Supplier performance', description: 'Accepted deliveries, inspected quality and delivery timing from purchase orders and GRNs.', exportType: 'SUPPLIER_ANALYTICS' },
  finance: { title: 'Financial reports', description: 'Income, cash movement, receivable/payable ageing and approved expense categories.', exportType: 'INCOME_STATEMENT' },
  inventory: { title: 'Inventory summary', description: 'Current valuation, stock coverage and low-stock signals from the inventory service.', exportType: 'INVENTORY_DASHBOARD' },
  trends: { title: 'Trends and forecast', description: 'Historical revenue trend and a short model-based projection. Forecasts are estimates.', exportType: 'KPI' },
};

const exportChoices: Record<ReportTab, Array<{ type: ReportType; label: string }>> = {
  overview: [{ type: 'DASHBOARD', label: 'Executive overview' }],
  sales: [{ type: 'SALES_DASHBOARD', label: 'Sales summary' }, { type: 'SALES_BY_CHANNEL', label: 'Sales by selected channel' }],
  products: [{ type: 'PRODUCT_PERFORMANCE', label: 'Product performance' }],
  customers: [{ type: 'CUSTOMER_ANALYTICS', label: 'Customer analytics' }],
  suppliers: [{ type: 'SUPPLIER_ANALYTICS', label: 'Supplier analytics' }],
  finance: [{ type: 'INCOME_STATEMENT', label: 'Income statement' }, { type: 'CASH_FLOW', label: 'Cash flow' }, { type: 'RECEIVABLES_AGEING', label: 'Receivables ageing' }, { type: 'PAYABLES_AGEING', label: 'Payables ageing' }, { type: 'EXPENSE_BREAKDOWN', label: 'Expense breakdown' }, { type: 'FINANCIAL_SUMMARY', label: 'Business position' }, { type: 'TRIAL_BALANCE', label: 'Operational balance summary' }],
  inventory: [{ type: 'INVENTORY_DASHBOARD', label: 'Inventory snapshot' }],
  trends: [{ type: 'TREND_ANALYSIS', label: 'Historical trend' }, { type: 'FORECAST', label: 'Forecast estimate' }],
};

const inputClass = 'min-h-10 w-full rounded-xl border border-[#d9ded3] bg-white px-3 text-sm font-medium text-[#273128] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-amber-500 dark:border-white/10 dark:bg-[#151713] dark:text-[#e5e7df] dark:focus-visible:outline-amber-300';
const panelClass = 'min-w-0 rounded-2xl border border-[#e1e4dc] bg-white p-4 shadow-sm shadow-black/[0.03] dark:border-white/[0.09] dark:bg-[#191b18] sm:p-5';

function localDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function businessToday(timezone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const part = (type: string) => parts.find((item) => item.type === type)?.value || '';
  return new Date(Number(part('year')), Number(part('month')) - 1, Number(part('day')));
}

function initialRange(): ReportRange {
  const today = new Date();
  return { dateFrom: localDate(new Date(today.getFullYear(), today.getMonth(), 1)), dateTo: localDate(today), groupBy: 'DAILY' };
}

function currency(value: unknown, code = 'TZS') {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '—';
  try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: code, maximumFractionDigits: 2 }).format(amount); }
  catch { return `${code} ${amount.toLocaleString()}`; }
}

function formatPeriodLabel(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? formatBusinessDate(value) : value;
}

function labelOf(key: string) {
  return key.replace(/([A-Z])/g, ' $1').replace(/[_-]/g, ' ').replace(/^./, (s) => s.toUpperCase());
}

function display(value: unknown, key: string, code: string) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'number' && /(amount|revenue|profit|cost|value|balance|total|debit|credit|paid|expense|cogs|price)/i.test(key)) return currency(value, code);
  if (typeof value === 'number' && /(percent|margin|score|rate)/i.test(key)) return `${value.toLocaleString()}%`;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}(T.*)?$/.test(value)) return formatBusinessDate(value);
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') return Array.isArray(value) ? `${value.length} items` : 'Details';
  return String(value).replace(/_/g, ' ');
}

function DataTable({ rows, currencyCode, empty = 'No records in this date range.' }: { rows: Array<Record<string, unknown>>; currencyCode: string; empty?: string }) {
  if (!rows.length) return <div className="rounded-xl border border-dashed border-[#d9ded3] px-4 py-9 text-center text-sm text-[#6b7468] dark:border-white/10 dark:text-[#aeb6ab]">{empty}</div>;
  const keys = Object.keys(rows[0]).filter((key) => !['id', 'businessId', 'customerId', 'supplierId', 'productId', 'categoryId', 'locationId', 'valueType'].includes(key));
  return <div className="overflow-x-auto rounded-xl border border-[#e4e7e0] dark:border-white/[0.08]"><table className="w-full min-w-[640px] text-left text-sm"><thead className="bg-[#f7f8f5] text-[10px] font-bold uppercase tracking-[0.12em] text-[#586251] dark:bg-[#111310] dark:text-[#bbc2b5]"><tr>{keys.map((key) => <th key={key} className="px-3 py-3">{labelOf(key)}</th>)}</tr></thead><tbody className="divide-y divide-[#eceee8] dark:divide-white/[0.07]">{rows.map((row, index) => <tr key={String(row.id || row.reference || index)} className="text-[#333a31] dark:text-[#e2e5dd]">{keys.map((key) => <td key={key} className="max-w-64 px-3 py-3 align-top">{key === 'value' && row.valueType === 'percent' ? `${Number(row[key]).toLocaleString()}%` : display(row[key], key, currencyCode)}</td>)}</tr>)}</tbody></table></div>;
}

function ReportPager({ page, limit, total, onPage }: { page: number; limit: number; total: number; onPage: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / limit));
  const start = total === 0 ? 0 : (page - 1) * limit + 1;
  const end = Math.min(total, page * limit);
  return <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[#687064] dark:text-[#aeb6aa]"><span>{start}–{end} of {total}</span><div className="flex items-center gap-2"><button type="button" aria-label="Previous report page" disabled={page <= 1} onClick={() => onPage(page - 1)} className="min-h-9 rounded-xl border border-[#d9ded3] px-3 font-semibold hover:bg-[#f5f6f1] focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:hover:bg-white/[0.06]">Previous</button><span>Page {page} of {pages}</span><button type="button" aria-label="Next report page" disabled={page >= pages} onClick={() => onPage(page + 1)} className="min-h-9 rounded-xl border border-[#d9ded3] px-3 font-semibold hover:bg-[#f5f6f1] focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:hover:bg-white/[0.06]">Next</button></div></div>;
}

function MetricCards({ entries, code }: { entries: Array<[string, unknown, string?]>; code: string }) {
  const tones = ['border-emerald-200 bg-emerald-50/75 dark:border-emerald-900/40 dark:bg-emerald-950/10', 'border-blue-200 bg-blue-50/75 dark:border-blue-900/40 dark:bg-blue-950/10', 'border-amber-200 bg-amber-50/75 dark:border-amber-900/40 dark:bg-amber-950/10', 'border-violet-200 bg-violet-50/75 dark:border-violet-900/40 dark:bg-violet-950/10'];
  const accents = ['text-emerald-700 dark:text-emerald-300/85', 'text-blue-700 dark:text-blue-300/85', 'text-amber-700 dark:text-amber-300/85', 'text-violet-700 dark:text-violet-300/85'];
  return <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">{entries.map(([label, value, unit], index) => { const numberValue = typeof value === 'number' && Number.isFinite(value) ? value : null; const format = (number: number) => unit === '%' ? `${number.toLocaleString(undefined, { maximumFractionDigits: 1 })}%` : unit === 'count' ? Math.round(number).toLocaleString() : currency(number, code); return <article key={label} className={`min-w-0 rounded-2xl border p-4 ${tones[index % tones.length]}`}><p className={`truncate text-xs font-bold ${accents[index % accents.length]}`}>{label}</p><p className={`mt-2 break-words text-xl font-extrabold tracking-tight tabular-nums ${accents[index % accents.length]}`}>{numberValue !== null ? <AnimatedNumber value={numberValue} format={format}/> : value == null ? '—' : `${value}${unit === 'count' ? '' : unit || ''}`}</p></article>; })}</div>;
}

function TrendBars({ labels, values, code }: { labels: string[]; values: number[]; code: string }) {
  const safe = values.map((value) => Number.isFinite(Number(value)) ? Number(value) : 0);
  const max = Math.max(1, ...safe.map(Math.abs));
  if (!safe.length) return <div className="grid min-h-40 place-items-center text-sm text-[#70786d] dark:text-[#aab2a5]">No trend points for this period.</div>;
  return <div className="flex min-h-48 items-end gap-2 overflow-x-auto border-b border-[#dfe4da] px-1 pt-5 dark:border-white/10">{safe.map((value, index) => <div key={`${labels[index] || index}-${value}`} className="flex min-w-12 flex-1 flex-col items-center justify-end gap-2"><span className="max-w-20 truncate text-[9px] text-[#646d60] dark:text-[#aab2a5]" title={currency(value, code)}>{value ? currency(value, code) : '0'}</span><div className="chart-bar-rise w-full max-w-14 rounded-t-lg bg-gradient-to-t from-[#a98220] to-[#e3c46c] dark:from-[#8e6a15] dark:to-[#d8b454]" style={{ height: `${Math.max(value ? 8 : 3, Math.abs(value) / max * 120)}px`, animationDelay: `${Math.min(index * 55, 500)}ms` }} /><span className="max-w-16 truncate pb-2 text-[9px] text-[#687064] dark:text-[#aab2a5]" title={labels[index]}>{formatPeriodLabel(labels[index] || '—')}</span></div>)}</div>;
}

function PairedTrendBars({ labels, series, code }: { labels: string[]; series: Array<{ label: string; data: number[] }>; code: string }) {
  const width = 760;
  const height = 300;
  const left = 86;
  const right = 22;
  const top = 24;
  const bottom = 52;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const cleanSeries = series.map((item) => ({ ...item, data: labels.map((_, index) => Number(item.data[index]) || 0) }));
  const maxValue = Math.max(0, ...cleanSeries.flatMap((item) => item.data));
  const max = maxValue > 0 ? maxValue * 1.12 : 1;
  const xAt = (index: number) => labels.length === 1 ? left + plotWidth / 2 : left + (index / (labels.length - 1)) * plotWidth;
  const yAt = (value: number) => top + (1 - Math.max(0, value) / max) * plotHeight;
  const pointsFor = (item: { label: string; data: number[] }) => item.data.map((value, index) => ({ x: xAt(index), y: yAt(value), value, label: labels[index] }));
  const linePath = (points: Array<{ x: number; y: number }>) => points.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ');
  const colors = cleanSeries.map((item) => /expense/i.test(item.label) ? '#e89112' : '#07845b');
  const visibleLabels = labels.map((_, index) => index).filter((index) => index === 0 || index === labels.length - 1 || index % Math.max(1, Math.ceil(labels.length / 5)) === 0);
  const compactAmount = (value: number) => `${code} ${new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(value)}`;
  if (!labels.length) return <div className="grid min-h-40 place-items-center text-sm text-[#70786d] dark:text-[#aab2a5]">No trend points for this period.</div>;
  return <div className="mt-4 min-w-0">
    <div className="flex items-center justify-between gap-3 pb-1 text-[10px] text-[#687064] dark:text-[#aab2a5]"><span>Amount ({code})</span><span>{labels.length} periods</span></div>
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label={`Revenue and expenses line chart across ${labels.length} periods, in ${code}`} className="h-56 w-full sm:h-72">
      <defs><linearGradient id="report-revenue-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#07845b" stopOpacity="0.2"/><stop offset="100%" stopColor="#07845b" stopOpacity="0.01"/></linearGradient></defs>
      {[0, 1, 2, 3].map((step) => {
        const y = top + (step / 3) * plotHeight;
        const value = max - (step / 3) * max;
        return <g key={step}><line x1={left} x2={width - right} y1={y} y2={y} className="stroke-[#e5e9e2] dark:stroke-white/10" strokeDasharray={step === 3 ? undefined : '3 6'}/><text x={left - 10} y={y + 4} textAnchor="end" className="fill-[#697368] dark:fill-[#b6c0b5]" fontSize="11">{compactAmount(value)}</text></g>;
      })}
      {cleanSeries.map((item, index) => {
        const points = pointsFor(item);
        const path = linePath(points);
        const area = `${path} L ${points[points.length - 1].x} ${top + plotHeight} L ${points[0].x} ${top + plotHeight} Z`;
        return <g key={item.label}>
          {index === 0 ? <path d={area} className="chart-area-reveal" fill="url(#report-revenue-fill)"/> : null}
          <path d={path} pathLength={1} className="chart-line-draw" fill="none" stroke={colors[index]} strokeWidth={index === 0 ? 3.5 : 3} strokeLinecap="round" strokeLinejoin="round" style={{ animationDelay: `${index * 160}ms` }}/>
          {points.map((point, pointIndex) => <circle key={`${item.label}-${point.label}-${pointIndex}`} className="chart-point-appear" style={{ animationDelay: `${350 + pointIndex * 45 + index * 100}ms` }} cx={point.x} cy={point.y} r={labels.length <= 10 ? 4 : 2.8} fill="white" stroke={colors[index]} strokeWidth="2"><title>{`${formatPeriodLabel(point.label)} · ${item.label}: ${currency(point.value, code)}`}</title></circle>)}
        </g>;
      })}
      {visibleLabels.map((index) => <text key={`${labels[index]}-${index}`} x={xAt(index)} y={height - 13} textAnchor={index === 0 ? 'start' : index === labels.length - 1 ? 'end' : 'middle'} className="fill-[#697368] dark:fill-[#b6c0b5]" fontSize="11">{formatPeriodLabel(labels[index] || '—')}</text>)}
    </svg>
    <ul className="sr-only" aria-label="Revenue and expense values by period">{labels.map((label, index) => <li key={`${label}-${index}`}>{formatPeriodLabel(label)}: {cleanSeries.map((item) => `${item.label} ${currency(item.data[index], code)}`).join(', ')}.</li>)}</ul>
  </div>;
}

function MetricDefinition({ metric, code, index }: { metric: ReportMetric; code: string; index: number }) {
  const m = metric;
  const format = (number: number) => m.unit === '%' ? `${number.toLocaleString(undefined, { maximumFractionDigits: 1 })}%` : /invoice/i.test(m.unit) ? `${Math.round(number).toLocaleString()} ${m.unit}` : currency(number, code);
  const accents = [
    { text: 'text-emerald-700 dark:text-emerald-300/85', icon: 'bg-emerald-600 text-white dark:bg-emerald-400/15 dark:text-emerald-300' },
    { text: 'text-blue-700 dark:text-blue-300/85', icon: 'bg-blue-600 text-white dark:bg-blue-400/15 dark:text-blue-300' },
    { text: 'text-amber-700 dark:text-amber-300/85', icon: 'bg-amber-400 text-[#352500] dark:bg-amber-400/15 dark:text-amber-300' },
    { text: 'text-violet-700 dark:text-violet-300/85', icon: 'bg-violet-600 text-white dark:bg-violet-400/15 dark:text-violet-300' },
  ];
  const accent = accents[index % accents.length];
  return <article className={panelClass}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-xs font-bold text-[#536153] dark:text-[#b8c0b3]">{m.label || m.name}</p><p className={`mt-2 break-words text-xl font-extrabold tabular-nums ${accent.text}`}><AnimatedNumber value={m.value} format={format}/></p></div><span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl shadow-sm ${accent.icon}`}><TrendingUp size={17}/></span></div><p className="mt-3 text-[11px] text-[#6e766b] dark:text-[#aeb6a9]">{m.changePercent === null || m.changePercent === undefined ? 'No prior-period baseline' : `${m.changePercent.toLocaleString()}% vs previous period`}</p>{m.formula ? <p className="mt-2 text-[11px] leading-5 text-[#777e73] dark:text-[#9da69a]">{m.formula}</p> : null}</article>;
}

function asRows(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) return [];
  return value.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === 'object' && !Array.isArray(row));
}

function keyRows(data: Record<string, unknown>, keys: string[]) {
  return keys.filter((key) => key in data).map((key) => ({
    measure: labelOf(key),
    value: data[key],
    valueType: /percentage|margin/i.test(key) ? 'percent' : 'currency',
  }));
}

export default function ReportsPage() {
  const user = useAuthStore((state) => state.user);
  const canView = Boolean(user?.permissions.includes('reports.view'));
  const canExport = Boolean(user?.permissions.includes('reports.export'));
  const { data, tab, loading, error, load, clear, channelBy, forecastMetric, forecastMethod, page, pageSize, productSortBy, customerSegmentBy, setPage, setProductSortBy, setCustomerSegmentBy, setChannelBy, setForecastMetric, setForecastMethod } = useReportsStore();
  const [range, setRange] = useState<ReportRange>(initialRange);
  const [preset, setPreset] = useState('month');
  const [exportFormat, setExportFormat] = useState<ReportFormat>('PDF');
  const [exportType, setExportType] = useState<ReportType>(() => exportChoices[tab][0]?.type || 'DASHBOARD');
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const [currencyCode, setCurrencyCode] = useState('TZS');
  const [reportSettings, setReportSettings] = useState<ReportSettingsContext | null>(null);
  const panel = panels[tab];

  useEffect(() => {
    const requestedTab = new URLSearchParams(window.location.search).get('tab');
    if (requestedTab && tabs.some((item) => item.id === requestedTab)) {
      const nextTab = requestedTab as ReportTab;
      if (nextTab !== useReportsStore.getState().tab) useReportsStore.setState({ tab: nextTab, page: 1 });
      setExportType(exportChoices[nextTab][0]?.type || 'DASHBOARD');
    }
  }, []);

  useEffect(() => {
    if (!canView) return;
    let active = true;
    reportsAPI.settings().then((settings) => {
      if (!active) return;
      setReportSettings(settings);
      setCurrencyCode(settings.currency);
      cacheBusinessDateSettings({ ...settings });
      const today = businessToday(settings.timezone);
      setRange((current) => current.dateTo === localDate(new Date())
        ? { ...current, dateFrom: localDate(new Date(today.getFullYear(), today.getMonth(), 1)), dateTo: localDate(today) }
        : current);
    }).catch(() => {
      if (active) setExportError('Could not load business report settings. Date presets may be unavailable until you refresh.');
    });
    return () => { active = false; };
  }, [canView, user?.id, user?.businessId]);

  const choosePreset = useCallback((value: string) => {
    setPage(1);
    const today = businessToday(reportSettings?.timezone || 'UTC');
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    let groupBy: ReportRange['groupBy'] = 'DAILY';
    if (value === 'last-month') start.setMonth(start.getMonth() - 1);
    if (value === 'last-month') { const lastDay = new Date(today.getFullYear(), today.getMonth(), 0); setRange({ dateFrom: localDate(new Date(lastDay.getFullYear(), lastDay.getMonth(), 1)), dateTo: localDate(lastDay), groupBy: 'DAILY' }); setPreset(value); return; }
    if (value === 'quarter') { start.setMonth(Math.floor(today.getMonth() / 3) * 3, 1); groupBy = 'WEEKLY'; }
    if (value === 'year') {
      const financialYear = reportSettings?.financialYear || 'CALENDAR';
      let startMonth = 0;
      startMonth = financialYear === 'JULY' ? 6 : financialYear === 'APRIL' ? 3 : 0;
      const year = today.getMonth() < startMonth ? today.getFullYear() - 1 : today.getFullYear();
      start.setFullYear(year, startMonth, 1); groupBy = 'MONTHLY';
    }
    setRange({ dateFrom: localDate(start), dateTo: localDate(today), groupBy });
    setPreset(value);
  }, [setPage, reportSettings]);

  useEffect(() => {
    clear();
    if (canView) void load(tab, range);
  }, [canView, user?.id, user?.businessId, tab, range, page, pageSize, productSortBy, customerSegmentBy, load, clear, channelBy, forecastMetric, forecastMethod]);
  useEffect(() => {
    const reportCurrency = data?.kind === 'overview' ? data.executive.currency
      : data?.kind === 'sales' ? data.sales.currency
      : data?.kind === 'products' ? data.products.currency
      : data?.kind === 'customers' ? data.customers.currency
      : data?.kind === 'suppliers' ? data.suppliers.currency
      : data?.kind === 'finance' ? data.financialSummary.currency
      : data?.kind === 'inventory' ? data.inventory.currency
      : data?.kind === 'trends' ? String(data.forecast.currency || data.trends.currency || '')
      : undefined;
    if (reportCurrency) setCurrencyCode(reportCurrency);
  }, [data]);

  const refresh = () => { if (canView) void load(tab, range); };
  const chooseTab = (id: ReportTab) => { if (id !== tab) { useReportsStore.setState({ tab: id, page: 1 }); setExportType(panels[id].exportType); } };
  const changeDate = (key: 'dateFrom' | 'dateTo', value: string) => { setPage(1); setPreset('custom'); setRange((current) => ({ ...current, [key]: value })); };
  const doExport = async () => {
    if (!canExport || exporting || !range.dateFrom || !range.dateTo || range.dateFrom > range.dateTo) return;
    setExporting(true); setExportError('');
    try {
      const result = await reportsAPI.export(exportType, exportFormat, range, {
        channelBy: exportType === 'SALES_BY_CHANNEL' ? channelBy : undefined,
        sortBy: exportType === 'PRODUCT_PERFORMANCE' ? productSortBy : undefined,
        segmentBy: exportType === 'CUSTOMER_ANALYTICS' ? customerSegmentBy : undefined,
        metric: exportType === 'TREND_ANALYSIS' || exportType === 'FORECAST' ? forecastMetric : undefined,
        method: exportType === 'FORECAST' ? forecastMethod : undefined,
        periods: exportType === 'FORECAST' ? 3 : exportType === 'TREND_ANALYSIS' ? 12 : undefined,
      });
      const url = URL.createObjectURL(result.blob);
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = result.fileName; document.body.appendChild(anchor); anchor.click(); anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (cause) { setExportError(getApiError(cause, 'Could not export this report.')); }
    finally { setExporting(false); }
  };

  const rangeInvalid = Boolean(range.dateFrom && range.dateTo && range.dateFrom > range.dateTo);
  const reportLabel = useMemo(() => `${formatBusinessDate(range.dateFrom)} – ${formatBusinessDate(range.dateTo)}`, [range.dateFrom, range.dateTo]);

  if (!canView) return <section className={`${panelClass} mx-auto mt-8 max-w-2xl`}><div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#dc2626] text-white dark:bg-[#b91c1c] dark:text-white"><AlertCircle size={19}/></span><div><h1 className="text-lg font-bold text-[#252b23] dark:text-white">Reports access required</h1><p className="mt-1 text-sm leading-6 text-[#626b60] dark:text-[#b1b8ad]">Your account does not have permission to view business reports. Contact your business administrator.</p></div></div></section>;

  return <div className="min-w-0 space-y-5 sm:space-y-6">
    <section className="flex min-w-0 flex-col gap-4 rounded-2xl border border-[#dec98b] bg-[#fff9e9] p-4 shadow-sm shadow-amber-950/[0.04] dark:border-[#6b531b] dark:bg-[#282317] sm:flex-row sm:items-end sm:justify-between sm:p-6">
      <div className="min-w-0"><p className="text-[10px] font-extrabold uppercase tracking-[0.17em] text-[#846211] dark:text-[#e0c56e]">Mizania · Business intelligence</p><h1 className="mt-1 text-2xl font-bold tracking-tight text-[#20251f] dark:text-[#f0f1eb] sm:text-3xl">Reports & analytics</h1><p className="mt-1 text-sm text-[#5f675d] dark:text-[#b8bfb2]">One reliable view across your business records.</p></div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="grid gap-1 text-[10px] font-bold uppercase tracking-wide text-[#5f675d] dark:text-[#bbc2b5]">Period<select aria-label="Report period" className={inputClass} value={preset} onChange={(event) => choosePreset(event.target.value)}><option value="month">This month</option><option value="last-month">Last month</option><option value="quarter">This quarter</option><option value="year">This financial year</option><option value="custom">Custom range</option></select></label>
        <label className="grid gap-1 text-[10px] font-bold uppercase tracking-wide text-[#5f675d] dark:text-[#bbc2b5]">From<input aria-label="Report start date" className={inputClass} type="date" value={range.dateFrom} onChange={(event) => changeDate('dateFrom', event.target.value)}/></label>
        <label className="grid gap-1 text-[10px] font-bold uppercase tracking-wide text-[#5f675d] dark:text-[#bbc2b5]">To<input aria-label="Report end date" className={inputClass} type="date" value={range.dateTo} onChange={(event) => changeDate('dateTo', event.target.value)}/></label><label className="grid gap-1 text-[10px] font-bold uppercase tracking-wide text-[#5f675d] dark:text-[#bbc2b5]">Group by<select aria-label="Report grouping" className={inputClass} value={range.groupBy || 'DAILY'} onChange={(event) => setRange((current) => ({ ...current, groupBy: event.target.value as ReportRange['groupBy'] }))}>{['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY'].map((group) => <option key={group} value={group}>{labelOf(group)}</option>)}</select></label>
        <button type="button" onClick={refresh} disabled={loading || rangeInvalid} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#24251f] px-3.5 text-sm font-semibold text-white transition hover:bg-[#3a3a30] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 disabled:cursor-wait disabled:opacity-60 dark:bg-[#d8b454] dark:text-[#201b0e] dark:hover:bg-[#e4c56d]">{loading ? <Loader2 size={16} className="animate-spin"/> : <RefreshCw size={15}/>}<span className="hidden sm:inline">{loading ? 'Loading' : 'Refresh'}</span></button>
      </div>
    </section>

    <section className={`${panelClass} !p-2`} aria-label="Report sections"><div className="flex min-w-0 gap-1 overflow-x-auto">{tabs.map((item) => <button key={item.id} type="button" onClick={() => chooseTab(item.id)} aria-current={tab === item.id ? 'page' : undefined} data-theme-tab-active={tab === item.id ? 'true' : undefined} className={`min-h-10 shrink-0 rounded-xl px-3 text-xs font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-amber-500 sm:px-4 sm:text-sm ${tab === item.id ? 'bg-[#f5d788] text-[#5f4300] shadow-sm dark:bg-[#4b3716] dark:text-[#ffdc82]' : 'text-[#61695e] hover:bg-[#f5f6f1] dark:text-[#b8c0b4] dark:hover:bg-white/[0.06]'}`}>{item.label}</button>)}</div></section>

    <section className="flex min-w-0 flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">{reportLabel}</p><h2 className="mt-1 text-xl font-bold text-[#242a23] dark:text-[#eceee7]">{panel.title}</h2><p className="mt-1 max-w-3xl text-sm leading-6 text-[#687064] dark:text-[#aeb6aa]">{panel.description}</p></div><div className="flex min-w-0 flex-wrap items-center gap-2">{tab === 'products' ? <label className="grid gap-1 text-[9px] font-bold uppercase tracking-wide text-[#5f675d] dark:text-[#bbc2b5]">Rank products by<select aria-label="Product report ranking" className={`${inputClass} !min-h-9 !w-auto !py-1 text-xs`} value={productSortBy} onChange={(event) => setProductSortBy(event.target.value)}><option value="REVENUE">Revenue</option><option value="QUANTITY">Quantity</option><option value="PROFIT">Profit</option><option value="MARGIN">Margin</option></select></label> : null}{tab === 'customers' ? <label className="grid gap-1 text-[9px] font-bold uppercase tracking-wide text-[#5f675d] dark:text-[#bbc2b5]">Segment customers by<select aria-label="Customer report segmentation" className={`${inputClass} !min-h-9 !w-auto !py-1 text-xs`} value={customerSegmentBy} onChange={(event) => setCustomerSegmentBy(event.target.value)}><option value="REVENUE">Revenue</option><option value="FREQUENCY">Purchase frequency</option><option value="LOYALTY">Loyalty</option><option value="RECENCY">Recency</option></select></label> : null}{tab === 'sales' ? <label className="grid gap-1 text-[9px] font-bold uppercase tracking-wide text-[#5f675d] dark:text-[#bbc2b5]">Group sales by<select aria-label="Sales channel grouping" className={`${inputClass} !min-h-9 !w-auto !py-1 text-xs`} value={channelBy} onChange={(event) => setChannelBy(event.target.value)}><option value="LOCATION">Location</option><option value="SALESPERSON">Salesperson</option><option value="CUSTOMER_TYPE">Customer type</option></select></label> : null}{tab === 'trends' ? <><label className="grid gap-1 text-[9px] font-bold uppercase tracking-wide text-[#5f675d] dark:text-[#bbc2b5]">Metric<select aria-label="Forecast metric" className={`${inputClass} !min-h-9 !w-auto !py-1 text-xs`} value={forecastMetric} onChange={(event) => setForecastMetric(event.target.value)}><option value="REVENUE">Revenue</option><option value="EXPENSES">Expenses</option><option value="PROFIT">Profit</option><option value="SALES_QUANTITY">Units sold</option><option value="CUSTOMER_COUNT">Customer count</option></select></label><label className="grid gap-1 text-[9px] font-bold uppercase tracking-wide text-[#5f675d] dark:text-[#bbc2b5]">Forecast method<select aria-label="Forecast method" className={`${inputClass} !min-h-9 !w-auto !py-1 text-xs`} value={forecastMethod} onChange={(event) => setForecastMethod(event.target.value)}><option value="MOVING_AVERAGE">Moving average</option><option value="SIMPLE_LINEAR">Linear trend</option><option value="EXPONENTIAL_SMOOTHING">Exponential smoothing</option></select></label></> : null}<label className="sr-only" htmlFor="report-export-type">Report to export</label><select id="report-export-type" aria-label="Report to export" className={`${inputClass} !min-h-9 !w-auto !py-1 text-xs`} value={exportType} onChange={(event) => setExportType(event.target.value as ReportType)}>{exportChoices[tab].map((choice) => <option key={choice.type} value={choice.type}>{choice.label}</option>)}</select><label className="sr-only" htmlFor="report-export-format">Export format</label><select id="report-export-format" className={`${inputClass} !min-h-9 !w-auto !py-1 text-xs`} value={exportFormat} onChange={(event) => setExportFormat(event.target.value as ReportFormat)}><option value="PDF">PDF</option><option value="EXCEL">Excel</option><option value="CSV">CSV</option><option value="JSON">JSON</option></select><button type="button" onClick={() => void doExport()} disabled={!canExport || exporting || loading || rangeInvalid} title={!canExport ? 'Your account does not have report export permission.' : undefined} className="inline-flex min-h-9 items-center gap-2 rounded-xl border border-[#d9c88f] bg-white px-3 text-xs font-bold text-[#69500e] transition hover:bg-[#fff8e7] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-amber-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#705a25] dark:bg-[#191b18] dark:text-[#e2c76e] dark:hover:bg-[#282317]"><span className="hidden sm:inline">{exporting ? 'Preparing' : 'Export'}</span>{exporting ? <Loader2 className="animate-spin" size={15}/> : exportFormat === 'EXCEL' ? <FileSpreadsheet size={15}/> : exportFormat === 'PDF' ? <FileText size={15}/> : <Download size={15}/>}</button></div></section>
    {rangeInvalid ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">Start date must be on or before end date.</p> : null}
    {exportError ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">{exportError}</p> : null}
    {error ? <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200"><span className="flex min-w-0 items-start gap-2"><AlertCircle size={17} className="mt-0.5 shrink-0"/><span><strong className="block">Report unavailable</strong>{error}</span></span><button type="button" onClick={refresh} disabled={loading} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-red-300 px-3 font-semibold hover:bg-red-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-500 disabled:opacity-60 dark:border-red-800 dark:hover:bg-red-950/50"><RefreshCw size={14} className={loading ? 'animate-spin' : ''}/>Retry</button></div> : null}
    {loading ? <div role="status" aria-live="polite" className={`${panelClass} grid min-h-64 place-items-center text-sm text-[#687064] dark:text-[#b3bbb0]`}><span className="flex items-center gap-2"><Loader2 size={18} className="animate-spin text-[#9a7416]"/>Loading {panel.title.toLowerCase()}…</span></div> : !error && data ? <ReportContent data={data} currencyCode={currencyCode}/> : null}
  </div>;
}

function ReportContent({ data, currencyCode }: { data: ReportsData; currencyCode: string }) {
  switch (data.kind) {
    case 'overview': {
      const executive = data.executive;
      return <div className="min-w-0 space-y-4"><div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">{Object.entries(executive.summary).map(([key, metric], index) => <MetricDefinition key={key} metric={metric} code={executive.currency} index={index}/>)}</div><div className="grid min-w-0 gap-4 xl:grid-cols-2"><section className={panelClass}><h3 className="text-sm font-bold text-[#283027] dark:text-[#eceee7]">Revenue and expenses</h3><p className="mt-1 text-xs text-[#70786c] dark:text-[#aeb6aa]">Grouped values for the selected period.</p><PairedTrendBars labels={executive.charts.periods} series={executive.charts.revenueVsExpenses} code={executive.currency}/><div className="mt-2 flex flex-wrap gap-4 text-[11px] text-[#5e685b] dark:text-[#b6bdb2]">{executive.charts.revenueVsExpenses.map((series) => <span key={series.label} className="inline-flex items-center gap-1.5"><i className={`h-2 w-2 rounded-full ${series.label === 'Revenue' ? 'bg-emerald-600' : 'bg-amber-500'}`}/>{series.label}</span>)}</div></section><section className={panelClass}><h3 className="text-sm font-bold text-[#283027] dark:text-[#eceee7]">Top products</h3><DataTable rows={executive.charts.topProducts.labels.map((name, index) => ({ product: name, revenue: executive.charts.topProducts.revenue[index], quantity: executive.charts.topProducts.quantity[index] }))} currencyCode={executive.currency}/></section></div><p className="text-[11px] leading-5 text-[#70786c] dark:text-[#aeb6aa]">Current inventory value is a live stock snapshot as of {formatBusinessDate(executive.inventoryAsOf)}; it is not a historical valuation for the selected dates.</p></div>;
    }
    case 'sales': return <div className="min-w-0 space-y-4"><MetricCards code={data.sales.currency} entries={[["Net revenue", data.sales.metrics.revenue], ["Invoices issued", data.sales.metrics.invoiceCount, 'count'], ["Average invoice", data.sales.metrics.averageOrderValue], ["Collected by period end", data.sales.metrics.paidAmount], ["Outstanding", data.sales.metrics.outstandingAmount], ["Units sold", data.sales.metrics.quantitySold, 'count'], ["Unpaid invoices", data.sales.metrics.unpaidInvoiceCount, 'count']]}/><p className="text-[11px] leading-5 text-[#70786c] dark:text-[#aeb6aa]">Invoice revenue includes tax and subtracts returns accepted in this period. Collected total is payments received by the selected end date on invoices issued in this range; it is not cash received only during this range. Product performance shows merchandise line value before invoice tax.</p><div className="grid min-w-0 gap-4 xl:grid-cols-2"><section className={panelClass}><h3 className="text-sm font-bold text-[#283027] dark:text-[#eceee7]">Revenue trend</h3><TrendBars labels={asRows(data.trends['data']).map((point) => String(point.period || ''))} values={asRows(data.trends['data']).map((point) => Number(point.value || 0))} code={data.sales.currency}/></section><section className={panelClass}><h3 className="mb-3 text-sm font-bold text-[#283027] dark:text-[#eceee7]">Sales by {data.channelBy === 'LOCATION' ? 'location' : data.channelBy === 'SALESPERSON' ? 'salesperson' : 'customer type'}</h3><DataTable rows={data.channels} currencyCode={data.sales.currency}/></section></div><section className={panelClass}><h3 className="mb-3 text-sm font-bold text-[#283027] dark:text-[#eceee7]">Top customers</h3><DataTable rows={data.sales.topCustomers} currencyCode={data.sales.currency}/></section></div>;
    case 'products': return <section className={panelClass}><p className="mb-3 text-xs text-[#687064] dark:text-[#aeb6aa]">Products ranked by recognized revenue after accepted returns.</p><DataTable rows={data.products.data as unknown as Array<Record<string, unknown>>} currencyCode={currencyCode}/><ReportPager page={data.products.page} limit={data.products.limit} total={data.products.total} onPage={useReportsStore.getState().setPage}/></section>;
    case 'customers': return <section className={panelClass}><p className="mb-3 text-xs text-[#687064] dark:text-[#aeb6aa]">Active customer accounts · inactive and archived customers are excluded from segmentation.</p><DataTable rows={data.customers.data as unknown as Array<Record<string, unknown>>} currencyCode={currencyCode}/><ReportPager page={data.customers.page} limit={data.customers.limit} total={data.customers.total} onPage={useReportsStore.getState().setPage}/></section>;
    case 'suppliers': return <section className={panelClass}><p className="mb-3 text-xs text-[#687064] dark:text-[#aeb6aa]">Suppliers with non-draft purchase activity. Quality and lead-time figures require accepted GRNs.</p><DataTable rows={data.suppliers.data as unknown as Array<Record<string, unknown>>} currencyCode={currencyCode}/><ReportPager page={data.suppliers.page} limit={data.suppliers.limit} total={data.suppliers.total} onPage={useReportsStore.getState().setPage}/></section>;
    case 'finance': {
      const agingRows = (value: Record<string, unknown>) => asRows(value['items']).map((row) => {
        const { days120Plus, ...rest } = row;
        return { ...rest, overdue91Plus: days120Plus };
      });
      return <div className="min-w-0 space-y-4"><MetricCards code={currencyCode} entries={[["Revenue", Number(data.statement.revenue || 0)], ["Cost of goods sold", Number(data.statement.costOfGoodsSold || 0)], ["Gross profit", Number(data.statement.grossProfit || 0)], ["Recognized expenses", Number(data.statement.operatingExpenses || 0)], ["Net income", Number(data.statement.netIncome || 0)], ["Net margin", Number(data.statement.netMarginPercentage || 0), '%'], ["Cash inflows", Number(data.cashFlow.totalInflows || 0)], ["Cash outflows", Number(data.cashFlow.totalOutflows || 0)]]}/><div className="grid min-w-0 gap-4 xl:grid-cols-2"><section className={panelClass}><h3 className="mb-3 text-sm font-bold text-[#283027] dark:text-[#eceee7]">Income statement</h3><DataTable rows={keyRows(data.statement, ['revenue','costOfGoodsSold','grossProfit','operatingExpenses','operatingIncome','netIncome','grossMarginPercentage','netMarginPercentage'])} currencyCode={currencyCode}/></section><section className={panelClass}><h3 className="mb-3 text-sm font-bold text-[#283027] dark:text-[#eceee7]">Cash flow</h3><MetricCards code={currencyCode} entries={[["Opening balance", Number(data.cashFlow.openingBalance || 0)], ["Closing balance", Number(data.cashFlow.closingBalance || 0)]]}/><div className="mt-3"><DataTable rows={asRows(data.cashFlow.details)} currencyCode={currencyCode}/></div></section><section className={panelClass}><h3 className="mb-3 text-sm font-bold text-[#283027] dark:text-[#eceee7]">Receivables ageing · as at selected end date</h3><MetricCards code={currencyCode} entries={[["Current", Number(data.receivables.totalCurrent || 0)], ["1–30 days", Number(data.receivables.totalDays30 || 0)], ["31–60 days", Number(data.receivables.totalDays60 || 0)], ["61–90 days", Number(data.receivables.totalDays90 || 0)], ["91+ days", Number(data.receivables.totalDays120Plus || 0)], ["Total due", Number(data.receivables.grandTotal || 0)]]}/><div className="mt-3"><DataTable rows={agingRows(data.receivables)} currencyCode={currencyCode}/></div></section><section className={panelClass}><h3 className="mb-3 text-sm font-bold text-[#283027] dark:text-[#eceee7]">Payables ageing · as at selected end date</h3><MetricCards code={currencyCode} entries={[["Current", Number(data.payables.totalCurrent || 0)], ["1–30 days", Number(data.payables.totalDays30 || 0)], ["31–60 days", Number(data.payables.totalDays60 || 0)], ["61–90 days", Number(data.payables.totalDays90 || 0)], ["91+ days", Number(data.payables.totalDays120Plus || 0)], ["Total due", Number(data.payables.grandTotal || 0)]]}/><div className="mt-3"><DataTable rows={agingRows(data.payables)} currencyCode={currencyCode}/></div></section><section className={`${panelClass} xl:col-span-2`}><h3 className="mb-3 text-sm font-bold text-[#283027] dark:text-[#eceee7]">Expenses by category</h3><DataTable rows={data.expenses} currencyCode={currencyCode}/></section><section className={`${panelClass} xl:col-span-2`}><h3 className="mb-3 text-sm font-bold text-[#283027] dark:text-[#eceee7]">Selected period vs previous period</h3><p className="mb-3 text-xs text-[#687064] dark:text-[#aeb6aa]">{data.comparison.period1} → {data.comparison.period2}</p><DataTable rows={data.comparison.data} currencyCode={currencyCode}/></section></div><section className={panelClass}><h3 className="mb-3 text-sm font-bold text-[#283027] dark:text-[#eceee7]">Business position · as of {formatBusinessDate(data.financialSummary.asOf)}</h3><MetricCards code={currencyCode} entries={[["Receivables", data.financialSummary.totalReceivables], ["Payables", data.financialSummary.totalPayables], ["Inventory snapshot", data.financialSummary.totalInventoryValue], ["Cash position", data.financialSummary.cashOnHand], ["Unpaid expenses", data.financialSummary.unpaidExpenses], ["Tax on recorded sales", data.financialSummary.totalSalesTaxAmount]]}/><p className="mt-3 text-[11px] text-[#70786c] dark:text-[#aeb6aa]">Inventory valuation is a current snapshot as of {formatBusinessDate(data.financialSummary.inventoryValueAsOf)} using {data.financialSummary.inventoryValuationMethod}; it is not historical for the selected period.</p></section><section className={panelClass}><h3 className="mb-1 text-sm font-bold text-[#283027] dark:text-[#eceee7]">Operational balance summary</h3><p className="mb-3 text-xs text-[#687064] dark:text-[#aeb6aa]">{data.trialBalance.reportBasis}</p><MetricCards code={currencyCode} entries={[["Operational debits", data.trialBalance.totalDebits], ["Operational credits", data.trialBalance.totalCredits], ["Difference", Math.abs(data.trialBalance.totalDebits - data.trialBalance.totalCredits)]]}/><div className="mt-3"><DataTable rows={data.trialBalance.items as unknown as Array<Record<string, unknown>>} currencyCode={currencyCode}/></div></section><p className="text-[11px] leading-5 text-[#70786c] dark:text-[#aeb6aa]">Cash flow is based on recorded payment movements. Expenses are recognized after approval/payment. This application does not yet maintain a complete double-entry general ledger, so the balance summary is operational, not an accounting trial balance.</p></div>;
    }
    case 'inventory': return <div className="min-w-0 space-y-4"><MetricCards code={currencyCode} entries={[["Active products", data.inventory.metrics.activeProducts, 'count'], ["SKUs with stock", data.inventory.metrics.stockKeepingUnitsWithStock, 'count'], ["Stock quantity", data.inventory.metrics.totalQuantity, 'count'], ["Stock value", data.inventory.metrics.inventoryValue], ["Low-stock items", data.inventory.metrics.lowStockCount, 'count'], ["Locations with stock", data.inventory.metrics.locationCount, 'count']]}/><div className="grid min-w-0 gap-4 xl:grid-cols-2"><section className={panelClass}><h3 className="mb-1 text-sm font-bold text-[#283027] dark:text-[#eceee7]">Low-stock items</h3><p className="mb-3 text-xs text-[#687064] dark:text-[#aeb6aa]">Costing: {data.inventory.costingMethod}. Valuation is the current snapshot.</p><DataTable rows={data.inventory.lowStockItems} currencyCode={currencyCode}/></section><section className={panelClass}><h3 className="mb-3 text-sm font-bold text-[#283027] dark:text-[#eceee7]">Fast-moving products</h3><DataTable rows={data.inventory.topMovingProducts} currencyCode={currencyCode}/><a href="/dashboard/inventory/reports" className="mt-4 inline-flex min-h-9 items-center rounded-xl border border-[#d9c88f] px-3 text-xs font-bold text-[#69500e] hover:bg-[#fff8e7] focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-500 dark:border-[#705a25] dark:text-[#e2c76e] dark:hover:bg-[#282317]">Open inventory detail reports</a></section></div></div>;
    case 'trends': {
      const points = asRows(data.trends['data']);
      const forecastPoints = asRows(data.forecast['forecast']);
      return <div className="min-w-0 space-y-4"><section className={panelClass}><h3 className="text-sm font-bold text-[#283027] dark:text-[#eceee7]">Historical {labelOf(data.forecastMetric).toLowerCase()}</h3><TrendBars labels={points.map((point) => String(point.period || ''))} values={points.map((point) => Number(point.value || 0))} code={currencyCode}/></section><section className={panelClass}><div className="mb-3 flex items-center gap-2"><TrendingUp size={17} className="text-[#a17a17]"/><h3 className="text-sm font-bold text-[#283027] dark:text-[#eceee7]">{labelOf(data.forecastMetric)} forecast</h3></div><DataTable rows={forecastPoints} currencyCode={currencyCode} empty="Forecast needs at least three monthly historical periods. Expand the date range and retry."/><p className="mt-3 text-[11px] leading-5 text-[#70786c] dark:text-[#aeb6aa]">Method: {labelOf(data.forecastMethod)}. Forecast uses the latest 24 monthly historical periods, even when the chart above uses a shorter custom date range. It has an approximate confidence interval, does not model seasonality and is not a guarantee.</p></section></div>;
    }
  }
}
